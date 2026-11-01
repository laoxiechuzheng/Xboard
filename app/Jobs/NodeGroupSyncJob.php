<?php

namespace App\Jobs;

use App\Services\NodeSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Pushes the full user list (sync.users, a replace on the node) to every online node serving any of the given
 * groups, once per node even when it serves several of them. Used after bulk writes that bypass the model events
 * (admin bulk ban, plan force_update). It reads the lists when it runs, so it must be dispatched after the write
 * commits.
 */
class NodeGroupSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 2;
    // one available-user query per online node; below the redis connection's retry_after (90)
    public $timeout = 80;

    /**
     * @param int[] $groupIds
     */
    public function __construct(
        private readonly array $groupIds
    ) {
        $this->onQueue('node_sync');
    }

    public function handle(): void
    {
        NodeSyncService::notifyUsersUpdatedByGroups($this->groupIds);
    }

    /**
     * Queue one job for the distinct non-empty group ids, if any. Never throws: it runs after the caller's write
     * has committed, and a lost push only delays the change until the nodes' next REST pull.
     *
     * @param iterable<int|string|null> $groupIds
     */
    public static function dispatchForGroups(iterable $groupIds): void
    {
        $unique = [];
        foreach ($groupIds as $groupId) {
            if ($groupId !== null && $groupId !== '' && (int) $groupId > 0) {
                $unique[(int) $groupId] = true;
            }
        }
        if ($unique === []) {
            return;
        }
        $groupIds = array_keys($unique);
        sort($groupIds);

        try {
            self::dispatch($groupIds);
        } catch (\Throwable $e) {
            Log::error('Node group sync dispatch failed', ['group_ids' => $groupIds, 'error' => $e->getMessage()]);
        }
    }
}
