<?php

namespace Tests\Feature\NodeSync;

use App\Jobs\NodeUserSyncJob;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;

/**
 * node_sync runs on several workers. Two syncs of the same user must not interleave their read and publish, or a
 * job that read the user before a renewal can publish its 'remove' after the renewal's 'add'.
 */
class UserSyncOverlapTest extends NodeSyncTestCase
{
    private function overlapOf(NodeUserSyncJob $job): WithoutOverlapping
    {
        $middleware = $job->middleware();
        $this->assertCount(1, $middleware);
        $this->assertInstanceOf(WithoutOverlapping::class, $middleware[0]);

        return $middleware[0];
    }

    public function test_user_syncs_are_serialized_per_user_and_released_not_dropped(): void
    {
        $job = new NodeUserSyncJob(42, 'updated', 1);
        $overlap = $this->overlapOf($job);

        $this->assertSame('42', $overlap->key);
        $this->assertFalse($overlap->shareKey);
        $this->assertSame(NodeUserSyncJob::OVERLAP_RELEASE_AFTER, $overlap->releaseAfter);
        $this->assertSame(NodeUserSyncJob::OVERLAP_EXPIRE_AFTER, $overlap->expiresAfter);
        $this->assertGreaterThan($job->timeout, $overlap->expiresAfter, 'the lock outlives a running job');

        $other = new NodeUserSyncJob(43, 'updated');
        $this->assertNotSame($overlap->getLockKey($job), $this->overlapOf($other)->getLockKey($other));
    }

    public function test_releases_do_not_use_up_attempts(): void
    {
        $job = new NodeUserSyncJob(42, 'updated');
        $now = time();

        $this->assertFalse(property_exists($job, 'tries'), 'retryUntil bounds the retries, not a try count');
        $until = $job->retryUntil()->getTimestamp();
        $this->assertGreaterThanOrEqual($now + NodeUserSyncJob::RETRY_FOR_SECONDS - 5, $until);
        $this->assertLessThanOrEqual($now + NodeUserSyncJob::RETRY_FOR_SECONDS + 5, $until);
        $this->assertSame(2, $job->maxExceptions);
    }

    public function test_a_sync_waits_while_another_sync_of_the_same_user_holds_the_lock(): void
    {
        $job = new NodeUserSyncJob(42, 'updated');
        $overlap = $this->overlapOf($job);
        $lock = Cache::lock($overlap->getLockKey($job), NodeUserSyncJob::OVERLAP_EXPIRE_AFTER);
        $lock->forceRelease();
        $this->assertTrue($lock->get());

        $ran = [];
        try {
            $overlap->handle($job, function () use (&$ran) {
                $ran[] = 42;
            });
            $other = new NodeUserSyncJob(43, 'updated');
            $this->overlapOf($other)->handle($other, function () use (&$ran) {
                $ran[] = 43;
            });
        } finally {
            $lock->forceRelease();
        }
        $this->assertSame([43], $ran, 'user 42 is released while locked, user 43 is not blocked');

        $overlap->handle($job, function () use (&$ran) {
            $ran[] = 42;
        });
        $this->assertSame([43, 42], $ran, 'it runs once the lock is free');
    }
}
