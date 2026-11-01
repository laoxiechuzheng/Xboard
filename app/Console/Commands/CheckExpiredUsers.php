<?php

namespace App\Console\Commands;

use App\Jobs\NodeUserSyncJob;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * A subscription running out writes nothing, so no model event tells the nodes. Every minute, sync the users
 * whose expired_at passed since the last scan; NodeUserSyncJob re-reads each one, so a user renewed in the
 * meantime gets an add instead of a remove.
 *
 * This is only the fast path. The scan never looks further back than MAX_WINDOW (FIRST_WINDOW without a cursor,
 * e.g. after a cache flush), so expiries missed during a longer scheduler outage are never pushed. Those rely on
 * xboard-node polling the REST user list every pull_interval even while its WebSocket is connected
 * (internal/service/service.go pullTicker): the pulled list already leaves out expired users. If the node ever
 * stops polling while connected, widen MAX_WINDOW (the query and the jobs are idempotent).
 *
 * v2_user has no index led by expired_at (only the composite (u, d, expired_at, ...)), so the query is a full
 * table scan every minute. That is cheap at the current table size; add an expired_at index if it grows.
 */
class CheckExpiredUsers extends Command
{
    protected $signature = 'check:expired-users';
    protected $description = '通知节点移除刚到期的用户';

    public const CURSOR_KEY = 'check_expired_users:cursor';
    // first run (no cursor): only recent expiries, older ones already left the nodes' pulled lists
    public const FIRST_WINDOW = 600;
    // a stalled scheduler never makes one scan walk further back than this; the nodes' REST pull covers older ones
    public const MAX_WINDOW = 3600;
    // rescan a little before the cursor so an expiry committed late in the previous second is not skipped
    public const OVERLAP = 60;

    public function handle(): int
    {
        $now = Carbon::now()->getTimestamp();
        $cursor = Cache::get(self::CURSOR_KEY);
        $from = is_numeric($cursor)
            ? max((int) $cursor - self::OVERLAP, $now - self::MAX_WINDOW)
            : $now - self::FIRST_WINDOW;

        // ServerService::getAvailableUsers keeps expired_at >= now, so expired_at < now is out of every node list
        $userIds = User::toBase()
            ->where('expired_at', '>=', $from)
            ->where('expired_at', '<', $now)
            ->where('banned', 0)
            ->whereNotNull('group_id')
            ->orderBy('id')
            ->pluck('id');

        foreach ($userIds as $id) {
            NodeUserSyncJob::dispatch((int) $id, 'updated');
        }

        Cache::forever(self::CURSOR_KEY, $now);

        $this->info('Synced ' . $userIds->count() . ' users expired in [' . $from . ', ' . $now . ').');
        return self::SUCCESS;
    }
}
