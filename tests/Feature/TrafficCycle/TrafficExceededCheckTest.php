<?php

namespace Tests\Feature\TrafficCycle;

use App\Jobs\NodeUserSyncJob;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;

/**
 * check:traffic-exceeded reads the exceeded users, then pushes their removal. An advance (or renewal, admin edit)
 * that restores a user in between already had its "add" pushed; the removal must not be the last word.
 */
class TrafficExceededCheckTest extends TrafficCycleTestCase
{
    private function pending(array $userIds): void
    {
        Redis::shouldReceive('scard')->with('traffic:pending_check')->andReturn(count($userIds));
        Redis::shouldReceive('spop')->with('traffic:pending_check', count($userIds))->andReturn(array_map('strval', $userIds));
    }

    private function syncedUsers(): array
    {
        $read = fn(NodeUserSyncJob $job, string $name) => (new \ReflectionProperty($job, $name))->getValue($job);
        return Queue::pushed(NodeUserSyncJob::class)
            ->filter(fn(NodeUserSyncJob $job) => $read($job, 'action') === 'updated')
            ->map(fn(NodeUserSyncJob $job) => $read($job, 'userId'))
            ->values()
            ->all();
    }

    public function test_a_user_restored_after_the_read_is_synced_again_with_its_current_state(): void
    {
        $restored = $this->useTraffic($this->makeUser(['transfer_enable' => 100 * self::GB]), 0, 100 * self::GB);
        $exhausted = $this->useTraffic($this->makeUser(['transfer_enable' => 100 * self::GB]), 0, 101 * self::GB);
        Queue::fake();
        $this->pending([$restored->id, $exhausted->id]);

        // the cycle advance commits right after the check read the exceeded users
        $advanced = false;
        DB::listen(function ($query) use (&$advanced, $restored) {
            if (!$advanced && str_contains($query->sql, 'u + d >= transfer_enable')) {
                $advanced = true;
                User::whereKey($restored->id)->update(['u' => 0, 'd' => 2 * self::GB]);
            }
        });

        $this->artisan('check:traffic-exceeded')->assertSuccessful();

        $this->assertTrue($advanced);
        $this->assertSame([$restored->id], $this->syncedUsers());
    }

    public function test_users_still_exceeded_are_not_synced_again(): void
    {
        $user = $this->useTraffic($this->makeUser(['transfer_enable' => 100 * self::GB]), 0, 100 * self::GB);
        Queue::fake();
        $this->pending([$user->id]);

        $this->artisan('check:traffic-exceeded')->assertSuccessful();

        $this->assertSame([], $this->syncedUsers());
    }
}
