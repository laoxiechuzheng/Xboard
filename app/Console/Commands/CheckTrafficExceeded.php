<?php

namespace App\Console\Commands;

use App\Jobs\NodeUserSyncJob;
use App\Models\Server;
use App\Models\User;
use App\Services\NodeSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

class CheckTrafficExceeded extends Command
{
    protected $signature = 'check:traffic-exceeded';
    protected $description = '检查流量超标用户并通知节点';

    public function handle()
    {
        $count = Redis::scard('traffic:pending_check');
        if ($count <= 0) {
            return;
        }

        $pendingUserIds = array_map('intval', Redis::spop('traffic:pending_check', $count));

        $exceededUsers = User::toBase()
            ->whereIn('id', $pendingUserIds)
            ->whereRaw('u + d >= transfer_enable')
            ->where('transfer_enable', '>', 0)
            ->where('banned', 0)
            ->select(['id', 'group_id'])
            ->get();

        if ($exceededUsers->isEmpty()) {
            return;
        }

        $groupedUsers = $exceededUsers->groupBy('group_id');
        $notifiedCount = 0;

        foreach ($groupedUsers as $groupId => $users) {
            if (!$groupId) {
                continue;
            }

            $userIdsInGroup = $users->pluck('id')->toArray();
            $servers = Server::whereJsonContains('group_ids', (string) $groupId)->get();

            foreach ($servers as $server) {
                if (!NodeSyncService::isNodeOnline($server->id)) {
                    continue;
                }

                NodeSyncService::push($server->id, 'sync.user.delta', [
                    'action' => 'remove',
                    'users' => array_map(fn($id) => ['id' => $id], $userIdsInGroup),
                ]);
                $notifiedCount++;
            }
        }

        $restored = $this->resyncRestored($exceededUsers->pluck('id')->all());

        $this->info("Checked " . count($pendingUserIds) . " users, notified {$notifiedCount} nodes for " . $exceededUsers->count() . " exceeded users"
            . ($restored ? ", resynced {$restored} no longer exceeded." : "."));
    }

    /**
     * The exceeded list was read before the removals went out. A user whose quota came back in between
     * (a cycle advance, a renewal, an admin edit) already had its "add" pushed by NodeUserSyncJob, which the
     * removal above then overrode. Read those users again now that the removals are published: any that are
     * no longer exceeded get one more sync with their current state, which reaches the nodes after the removal.
     * A change that commits after this read dispatches its own sync after commit, so it also lands after the removal.
     */
    private function resyncRestored(array $userIds): int
    {
        if (!$userIds) {
            return 0;
        }
        $stillExceeded = User::toBase()
            ->whereIn('id', $userIds)
            ->whereRaw('u + d >= transfer_enable')
            ->where('transfer_enable', '>', 0)
            ->where('banned', 0)
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->all();
        $restored = array_values(array_diff($userIds, $stillExceeded));
        foreach ($restored as $id) {
            NodeUserSyncJob::dispatch((int) $id, 'updated');
        }
        return count($restored);
    }
}
