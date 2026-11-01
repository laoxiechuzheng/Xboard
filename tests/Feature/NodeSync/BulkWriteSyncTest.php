<?php

namespace Tests\Feature\NodeSync;

use App\Jobs\NodeGroupSyncJob;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Support\Testing\Fakes\QueueFake;

/**
 * Admin bulk writes go through the query builder (no model events), so they queue the group full syncs themselves.
 */
class BulkWriteSyncTest extends NodeSyncTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAsAdmin();
    }

    private function tokenCount(User $user): int
    {
        return $user->tokens()->count();
    }

    /**
     * Servable users inserted in bulk (no model events, no per-user password hash).
     *
     * @return int[] their ids, ascending
     */
    private function insertUsers(int $count, int $groupId): array
    {
        $now = time();
        $emails = [];
        foreach (array_chunk(range(1, $count), 50) as $chunk) {
            $rows = [];
            foreach ($chunk as $ignored) {
                $email = Str::lower(Str::random(12)) . '@bulk.test';
                $emails[] = $email;
                $rows[] = [
                    'email' => $email,
                    'password' => 'not-a-hash',
                    'uuid' => (string) Str::uuid(),
                    'token' => Str::lower(Str::random(32)),
                    'group_id' => $groupId,
                    'transfer_enable' => 100 * self::GB,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            DB::table('v2_user')->insert($rows);
        }

        return User::whereIn('email', $emails)->orderBy('id')->pluck('id')->map(fn($id) => (int) $id)->all();
    }

    /**
     * The queue rejects group syncs (e.g. Redis down) after the write has committed.
     */
    private function failGroupSyncDispatch(): void
    {
        Queue::swap(new class($this->app) extends QueueFake {
            public function push($job, $data = '', $queue = null)
            {
                if ($job instanceof NodeGroupSyncJob) {
                    throw new \RuntimeException('queue down');
                }

                return parent::push($job, $data, $queue);
            }
        });
    }

    public function test_bulk_ban_of_selected_users_bans_them_drops_their_sessions_and_resyncs_their_groups(): void
    {
        $first = $this->makeServableUser(1);
        $second = $this->makeServableUser(2);
        $untouched = $this->makeServableUser(3);
        foreach ([$first, $second, $untouched] as $user) {
            $user->createToken('session');
        }

        $this->postJson($this->adminApi('user/ban'), [
            'scope' => 'selected',
            'user_ids' => [$first->id, $second->id],
        ])->assertOk();

        $this->assertTrue((bool) $first->refresh()->banned);
        $this->assertTrue((bool) $second->refresh()->banned);
        $this->assertFalse((bool) $untouched->refresh()->banned);
        $this->assertSame(0, $this->tokenCount($first));
        $this->assertSame(0, $this->tokenCount($second));
        $this->assertSame(1, $this->tokenCount($untouched));
        $this->assertSame([1, 2], $this->groupSyncs());
        $this->assertSame(1, $this->groupSyncJobCount(), 'one job for all the groups');
    }

    public function test_bulk_ban_with_or_filters_only_bans_the_matching_users(): void
    {
        $alpha = $this->makeServableUser(1, ['email' => 'alpha-ban@bulk.test']);
        $beta = $this->makeServableUser(2, ['email' => 'beta-ban@bulk.test']);
        $gamma = $this->makeServableUser(3, ['email' => 'gamma-keep@bulk.test']);

        $this->postJson($this->adminApi('user/ban'), [
            'scope' => 'filtered',
            'filter' => [
                ['id' => 'email', 'value' => 'alpha-ban'],
                ['id' => 'email', 'value' => 'beta-ban', 'logic' => 'or'],
            ],
        ])->assertOk();

        $this->assertTrue((bool) $alpha->refresh()->banned);
        $this->assertTrue((bool) $beta->refresh()->banned);
        $this->assertFalse((bool) $gamma->refresh()->banned);
        $this->assertSame([1, 2], $this->groupSyncs());
    }

    public function test_plan_force_update_resyncs_the_groups_users_leave_and_the_one_they_join(): void
    {
        $plan = $this->makePlan(['group_id' => 1]);
        $onPlanGroup = $this->makeServableUser(1, ['plan_id' => $plan->id]);
        $drifted = $this->makeServableUser(3, ['plan_id' => $plan->id]);
        $otherPlan = $this->makeServableUser(4, ['plan_id' => $this->makePlan(['group_id' => 4])->id]);

        $this->postJson($this->adminApi('plan/save'), [
            'id' => $plan->id,
            'name' => $plan->name,
            'transfer_enable' => 200,
            'group_id' => 2,
            'speed_limit' => 100,
            'device_limit' => 3,
            'force_update' => true,
        ])->assertOk();

        $this->assertSame(2, (int) $onPlanGroup->refresh()->group_id);
        $this->assertSame(2, (int) $drifted->refresh()->group_id);
        $this->assertSame(4, (int) $otherPlan->refresh()->group_id);
        $this->assertSame([1, 2, 3], $this->groupSyncs());
        $this->assertSame(1, $this->groupSyncJobCount(), 'one job for all the groups');
    }

    public function test_plan_save_without_force_update_resyncs_nothing(): void
    {
        $plan = $this->makePlan(['group_id' => 1]);
        $this->makeServableUser(1, ['plan_id' => $plan->id]);

        $this->postJson($this->adminApi('plan/save'), [
            'id' => $plan->id,
            'name' => $plan->name,
            'transfer_enable' => 200,
            'group_id' => 2,
        ])->assertOk();

        $this->assertSame([], $this->groupSyncs());
    }

    public function test_a_ban_failing_partway_still_resyncs_the_chunks_already_banned(): void
    {
        $firstChunk = $this->insertUsers(500, 1);
        $secondChunk = $this->insertUsers(1, 2);

        // the second chunk's UPDATE fails before it runs
        $bans = 0;
        DB::beforeExecuting(function (string $query) use (&$bans) {
            if (str_starts_with(strtolower(ltrim($query)), 'update') && str_contains($query, 'banned') && ++$bans === 2) {
                throw new \RuntimeException('database went away');
            }
        });

        $this->postJson($this->adminApi('user/ban'), [
            'scope' => 'selected',
            'user_ids' => array_merge($firstChunk, $secondChunk),
        ])->assertStatus(500);

        $this->assertSame(500, User::whereIn('id', $firstChunk)->where('banned', 1)->count());
        $this->assertSame(0, User::whereIn('id', $secondChunk)->where('banned', 1)->count());
        $this->assertSame([1], $this->groupSyncs(), 'the banned chunk is resynced, the failed one is not');
    }

    public function test_a_failing_group_sync_dispatch_does_not_fail_a_committed_ban(): void
    {
        $user = $this->makeServableUser(1);
        $this->failGroupSyncDispatch();

        $this->postJson($this->adminApi('user/ban'), [
            'scope' => 'selected',
            'user_ids' => [$user->id],
        ])->assertOk();

        $this->assertTrue((bool) $user->refresh()->banned);
    }

    public function test_a_failing_group_sync_dispatch_does_not_fail_a_committed_force_update(): void
    {
        $plan = $this->makePlan(['group_id' => 1]);
        $user = $this->makeServableUser(1, ['plan_id' => $plan->id]);
        $this->failGroupSyncDispatch();

        $this->postJson($this->adminApi('plan/save'), [
            'id' => $plan->id,
            'name' => $plan->name,
            'transfer_enable' => 200,
            'group_id' => 2,
            'speed_limit' => 100,
            'device_limit' => 3,
            'force_update' => true,
        ])->assertOk();

        $this->assertSame(2, (int) $user->refresh()->group_id);
        $this->assertSame(2, (int) $plan->refresh()->group_id);
    }
}
