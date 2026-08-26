<?php

namespace App\WebSocket;

use App\Models\Server;
use App\Services\DeviceStateService;
use App\Services\NodeRegistry;
use App\Services\ServerService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Workerman\Connection\TcpConnection;

class NodeEventHandlers
{
    /**
     * Handle pong heartbeat
     */
    public static function handlePong(TcpConnection $conn, int $nodeId, array $data = []): void
    {
        Cache::put("node_ws_alive:{$nodeId}", true, 86400);
    }

    /**
     * Handle node status update
     */
    public static function handleNodeStatus(TcpConnection $conn, int $nodeId, array $data): void
    {
        $node = Server::find($nodeId);
        if (!$node) return;

        $nodeType = strtoupper($node->type);
        Cache::put(\App\Utils\CacheKey::get('SERVER_' . $nodeType . '_LAST_CHECK_AT', $nodeId), time(), 3600);
        ServerService::updateMetrics($node, $data);

        Log::debug("[WS] Node#{$nodeId} status updated");
    }

    /**
     * Handle device report from node
     *
     * 数据格式: {"event": "report.devices", "data": {userId: [ip1, ip2, ...], ...}}
     *
     * Multiple xboard-node instances (redundant machines) may serve the same
     * node_id. Each connection keeps its own snapshot and we reconcile the
     * union of all snapshots against Redis so machines never overwrite each
     * other's observed devices.
     */
    public static function handleDeviceReport(TcpConnection $conn, int $nodeId, array $data): void
    {
        $service = app(DeviceStateService::class);

        if (isset($data['devices']) && is_array($data['devices'])) {
            $data = $data['devices'];
        }

        // Normalize the payload this specific connection sent.
        $snapshot = [];
        foreach ($data as $userId => $ips) {
            if (is_numeric($userId) && is_array($ips)) {
                $snapshot[(int) $userId] = array_values(
                    array_unique(array_map([DeviceStateService::class, 'normalizeIP'], $ips))
                );
            }
        }

        // Remember this connection's contribution so close/recompute can use it.
        $conn->lastDeviceReport = $snapshot;

        self::syncMergedViewToRedis($nodeId, $service);

        Log::debug("[WS] Node#{$nodeId} synced " . count($snapshot) . ' users from one connection, active connections=' . count(NodeRegistry::getAll($nodeId)));
    }

    /**
     * Recompute the union of every live connection's device snapshot for a node
     * and reconcile the Redis cache with that merged view. A user stays online
     * while ANY contributing connection reports them; they only disappear once
     * every live connection stops reporting them.
     */
    public static function syncMergedViewToRedis(int $nodeId, DeviceStateService $service): void
    {
        $mergedView = [];
        foreach (NodeRegistry::getAll($nodeId) as $c) {
            if (!isset($c->lastDeviceReport) || !is_array($c->lastDeviceReport)) {
                continue;
            }
            foreach ($c->lastDeviceReport as $uid => $ips) {
                if (!isset($mergedView[$uid])) {
                    $mergedView[$uid] = [];
                }
                $mergedView[$uid] = array_values(array_unique(array_merge($mergedView[$uid], $ips)));
            }
        }

        $oldDevices = $service->getNodeDevices($nodeId);
        $removedUsers = array_diff_key($oldDevices, $mergedView);

        foreach ($removedUsers as $userId => $ips) {
            $service->removeNodeDevices($nodeId, $userId);
            $service->notifyUpdate($userId);
        }

        // Refresh stored entries even when unchanged so the TTL does not expire
        // a still-active device just because nothing changed between cycles.
        foreach ($mergedView as $userId => $ips) {
            $service->setDevices($userId, $nodeId, array_values($ips));
        }

        Redis::sadd('device:push_pending_nodes', $nodeId);
    }

    /**
     * Handle device state request from node
     */
    public static function handleDeviceRequest(TcpConnection $conn, int $nodeId, array $data = []): void
    {
        $node = Server::find($nodeId);
        if (!$node) return;

        $users = ServerService::getAvailableUsers($node);
        $userIds = $users->pluck('id')->toArray();

        $service = app(DeviceStateService::class);
        $devices = $service->getUsersDevices($userIds);

        NodeRegistry::send($nodeId, 'sync.devices', [
            'users' => $devices,
        ]);

        Log::debug("[WS] Node#{$nodeId} requested devices, sent " . count($devices) . ' users');
    }

    /**
     * Push device state to node
     */
    public static function pushDeviceStateToNode(int $nodeId, DeviceStateService $service): void
    {
        $node = Server::find($nodeId);
        if (!$node) return;

        $users = ServerService::getAvailableUsers($node);
        $userIds = $users->pluck('id')->toArray();
        $devices = $service->getUsersDevices($userIds);

        NodeRegistry::send($nodeId, 'sync.devices', [
            'users' => $devices
        ]);

        Log::debug("[WS] Pushed device state to node#{$nodeId}: " . count($devices) . ' users');
    }

    /**
     * Push full config + users to newly connected node
     */
    public static function pushFullSync(TcpConnection $conn, Server $node): void
    {
        $nodeId = (int) $node->id;

        // Push config
        $config = ServerService::buildNodeConfig($node);
        NodeRegistry::send($nodeId, 'sync.config', [
            'config' => $config,
        ]);

        // Push users
        $users = ServerService::getAvailableUsers($node)->toArray();
        NodeRegistry::send($nodeId, 'sync.users', [
            'users' => $users,
        ]);

        Log::info("[WS] Full sync pushed to node#{$nodeId}", [
            'users' => count($users),
        ]);
    }
}
