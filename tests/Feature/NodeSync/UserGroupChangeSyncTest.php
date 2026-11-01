<?php

namespace Tests\Feature\NodeSync;

use App\Jobs\NodeUserSyncJob;
use App\Models\User;
use App\Services\TrafficCycleService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Mockery\MockInterface;

/**
 * UserObserver hands NodeUserSyncJob the group a user left. Admin edits, orders and gift cards change the group
 * inside a transaction, sometimes saving the user more than once; the old group must survive both.
 */
class UserGroupChangeSyncTest extends NodeSyncTestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = $this->makeUser(['group_id' => 1, 'transfer_enable' => 100 * self::GB]);
    }

    public function test_a_group_change_without_a_transaction_removes_from_the_old_group(): void
    {
        $this->user->forceFill(['group_id' => 2])->save();

        $this->assertSame([[$this->user->id, 1]], $this->updatedSyncs());
    }

    public function test_a_group_change_inside_a_transaction_removes_from_the_old_group_after_commit(): void
    {
        DB::transaction(function () {
            $this->user->forceFill(['group_id' => 2])->save();
            $this->assertSame([], $this->updatedSyncs(), 'nothing is pushed before the commit');
        });

        $this->assertSame([[$this->user->id, 1]], $this->updatedSyncs());
    }

    public function test_a_later_save_in_the_same_transaction_does_not_lose_the_old_group(): void
    {
        DB::transaction(function () {
            $this->user->forceFill(['group_id' => 2])->save();
            // e.g. OrderService saving the user again after the reset; not a sync field
            $this->user->forceFill(['remarks' => 'renewed'])->save();
        });

        $this->assertSame([[$this->user->id, 1]], $this->updatedSyncs());
    }

    public function test_the_group_before_the_first_save_wins_when_the_group_changes_twice(): void
    {
        DB::transaction(function () {
            $this->user->forceFill(['group_id' => 2])->save();
            $this->user->forceFill(['group_id' => 3])->save();
        });

        $syncs = $this->updatedSyncs();
        $this->assertContains([$this->user->id, 1], $syncs);
        $this->assertNotContains([$this->user->id, 2], $syncs);
    }

    public function test_a_user_moved_back_to_its_group_is_not_removed_from_it(): void
    {
        DB::transaction(function () {
            $this->user->forceFill(['group_id' => 2])->save();
            $this->user->forceFill(['group_id' => 1])->save();
        });

        $syncs = $this->updatedSyncs();
        $this->assertNotEmpty($syncs);
        foreach ($syncs as [$userId, $oldGroupId]) {
            $this->assertSame($this->user->id, $userId);
            $this->assertNull($oldGroupId);
        }
    }

    public function test_a_sync_field_changed_by_an_earlier_save_is_still_synced(): void
    {
        DB::transaction(function () {
            $this->user->forceFill(['banned' => 1])->save();
            $this->user->forceFill(['remarks' => 'abuse'])->save();
        });

        $this->assertSame([[$this->user->id, null]], $this->updatedSyncs());
    }

    public function test_saves_without_sync_fields_push_nothing(): void
    {
        DB::transaction(fn() => $this->user->forceFill(['remarks' => 'note'])->save());
        $this->user->forceFill(['remarks' => 'another note'])->save();

        $this->assertSame([], $this->updatedSyncs());
    }

    public function test_a_rolled_back_change_pushes_nothing(): void
    {
        try {
            DB::transaction(function () {
                $this->user->forceFill(['group_id' => 2])->save();
                throw new \RuntimeException('rollback');
            });
        } catch (\RuntimeException) {
        }

        $this->assertSame([], $this->updatedSyncs());
    }

    public function test_a_rolled_back_create_pushes_nothing(): void
    {
        $before = $this->syncedUsers('created');
        try {
            DB::transaction(function () {
                $this->makeUser(['group_id' => 1]);
                throw new \RuntimeException('rollback');
            });
        } catch (\RuntimeException) {
        }

        $this->assertSame($before, $this->syncedUsers('created'));
    }

    public function test_a_create_inside_a_transaction_is_queued_after_commit(): void
    {
        $created = DB::transaction(function () {
            $user = $this->makeUser(['group_id' => 1]);
            $this->assertNotContains($user->id, $this->syncedUsers('created'), 'nothing is pushed before the commit');

            return $user;
        });

        $this->assertContains($created->id, $this->syncedUsers('created'));
    }

    public function test_a_rolled_back_delete_pushes_nothing(): void
    {
        try {
            DB::transaction(function () {
                $this->user->delete();
                throw new \RuntimeException('rollback');
            });
        } catch (\RuntimeException) {
        }

        $this->assertSame([], $this->syncedUsers('deleted'));
        $this->assertNotNull(User::find($this->user->id));
    }

    public function test_a_stale_record_after_rollback_does_not_remove_from_the_current_group(): void
    {
        // A servable user (the fixture's expired_at 0 is expired), so the current group gets an 'add'.
        User::whereKey($this->user->id)->update(['expired_at' => null]);
        $this->user->refresh();
        $groupOne = $this->makeServer([1]);
        $groupTwo = $this->makeServer([2]);
        try {
            DB::transaction(function () {
                $this->user->forceFill(['group_id' => 2])->save();
                throw new \RuntimeException('rollback');
            });
        } catch (\RuntimeException) {
        }
        // The same instance still believes it is in group 2; the row is in group 1.
        $this->user->forceFill(['remarks' => 'after rollback'])->save();
        $this->assertSame(1, (int) User::find($this->user->id)->group_id);

        $this->capturePushes();
        Queue::pushed(NodeUserSyncJob::class)
            ->filter(fn(NodeUserSyncJob $job) => self::prop($job, 'action') === 'updated')
            ->each(fn(NodeUserSyncJob $job) => $job->handle());

        $actions = array_map(fn(array $push) => $push['data']['action'] ?? null, $this->pushesTo($groupOne));
        $this->assertContains('add', $actions);
        $this->assertNotContains('remove', $actions);
        $this->assertSame([], $this->pushesTo($groupTwo));
    }

    public function test_a_cycle_field_changed_by_an_earlier_save_still_reconciles_the_cycle(): void
    {
        $userId = $this->user->id;
        $this->mock(TrafficCycleService::class, function (MockInterface $mock) use ($userId) {
            $mock->shouldReceive('enabled')->andReturn(true);
            $mock->shouldReceive('reconcile')
                ->once()
                ->withArgs(fn($user) => $user instanceof User && $user->id === $userId);
        });

        DB::transaction(function () {
            $this->user->forceFill(['expired_at' => time() + 30 * 86400])->save();
            // e.g. a gift card or an order saving the user again; no cycle field
            $this->user->forceFill(['remarks' => 'renewed'])->save();
        });
    }
}
