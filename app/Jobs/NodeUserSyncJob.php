<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\NodeSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;

class NodeUserSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Seconds a job waits before retrying while another job of the same user runs.
    public const OVERLAP_RELEASE_AFTER = 1;
    // Lock lifetime: well above $timeout, so a killed worker cannot block the user's syncs for long.
    public const OVERLAP_EXPIRE_AFTER = 30;
    // retryUntil replaces $tries: overlap releases must not use up attempts. The job re-reads the user, so a
    // late run (queue backlog) still publishes the current state.
    public const RETRY_FOR_SECONDS = 600;

    // Real failures still stop the job after two exceptions, releases do not count.
    public $maxExceptions = 2;
    public $timeout = 10;

    public function __construct(
        private readonly int $userId,
        private readonly string $action,
        private readonly ?int $oldGroupId = null
    ) {
        $this->onQueue('node_sync');
    }

    /**
     * One job per user at a time (node_sync runs on several workers). Each job reads the user and publishes while
     * holding the lock, so a job that read the user before a renewal can no longer publish its stale 'remove'
     * after the renewal's 'add': the last publish always follows the last read.
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping((string) $this->userId))
                ->releaseAfter(self::OVERLAP_RELEASE_AFTER)
                ->expireAfter(self::OVERLAP_EXPIRE_AFTER),
        ];
    }

    public function retryUntil(): \DateTimeInterface
    {
        return now()->addSeconds(self::RETRY_FOR_SECONDS);
    }

    public function handle(): void
    {
        $user = User::find($this->userId);

        if ($this->action === 'updated' || $this->action === 'created') {
            // A user still in the old group (moved back, or a stale observer record) must not be removed there.
            if ($this->oldGroupId && (!$user || (int) $user->group_id !== $this->oldGroupId)) {
                NodeSyncService::notifyUserRemovedFromGroup($this->userId, $this->oldGroupId);
            }
            if ($user) {
                NodeSyncService::notifyUserChanged($user);
            }
        } elseif ($this->action === 'deleted') {
            if ($this->oldGroupId) {
                NodeSyncService::notifyUserRemovedFromGroup($this->userId, $this->oldGroupId);
            }
        }
    }
}
