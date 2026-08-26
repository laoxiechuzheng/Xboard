<?php

namespace App\Services;

use Workerman\Connection\TcpConnection;

/**
 * In-memory registry for active WebSocket node connections.
 * Runs inside the Workerman process.
 */
class NodeRegistry
{
    /** @var array<int, array<int, TcpConnection>> nodeId → [connId → connection] */
    private static array $connections = [];

    /** @var array<int, TcpConnection> machineId → connection */
    private static array $machineConnections = [];

    /**
     * Register a connection for a node. Several physical machines may serve
     * the same node, so one nodeId can hold multiple live connections.
     * Adding a new connection must never kick the existing ones.
     */
    public static function add(int $nodeId, TcpConnection $conn): void
    {
        self::$connections[$nodeId][spl_object_id($conn)] = $conn;
    }

    public static function addMachine(int $machineId, TcpConnection $conn): void
    {
        if (isset(self::$machineConnections[$machineId]) && self::$machineConnections[$machineId] !== $conn) {
            self::$machineConnections[$machineId]->close();
        }
        self::$machineConnections[$machineId] = $conn;
    }

    /**
     * Remove a node mapping only if it still points to the given connection.
     * Passing null removes unconditionally (backward compat for single-node mode).
     */
    public static function remove(int $nodeId, ?TcpConnection $conn = null): void
    {
        if ($conn !== null) {
            unset(self::$connections[$nodeId][spl_object_id($conn)]);
            if (empty(self::$connections[$nodeId])) {
                unset(self::$connections[$nodeId]);
            }
            return;
        }
        unset(self::$connections[$nodeId]);
    }

    public static function removeMachine(int $machineId, ?TcpConnection $conn = null): void
    {
        if ($conn !== null && isset(self::$machineConnections[$machineId]) && self::$machineConnections[$machineId] !== $conn) {
            return;
        }
        unset(self::$machineConnections[$machineId]);
    }

    public static function get(int $nodeId): ?TcpConnection
    {
        $conns = self::$connections[$nodeId] ?? [];
        return $conns ? end($conns) : null;
    }

    /**
     * Get every live connection registered for a node.
     *
     * @return TcpConnection[]
     */
    public static function getAll(int $nodeId): array
    {
        return array_values(self::$connections[$nodeId] ?? []);
    }

    public static function getMachine(int $machineId): ?TcpConnection
    {
        return self::$machineConnections[$machineId] ?? null;
    }

    /**
     * Send a JSON message to every connection registered for a node.
     */
    public static function send(int $nodeId, string $event, array $data): bool
    {
        $conns = self::getAll($nodeId);
        if (!$conns) {
            return false;
        }

        foreach ($conns as $conn) {
            $payloadData = $data;

            // Machine-mode connections multiplex multiple node IDs through the same
            // socket, so node-scoped events must carry node_id for the client mux.
            if (!empty($conn->machineNodeIds) && $event !== 'sync.nodes' && !array_key_exists('node_id', $payloadData)) {
                $payloadData['node_id'] = $nodeId;
            }

            $conn->send(json_encode([
                'event' => $event,
                'data' => $payloadData,
                'timestamp' => time(),
            ]));
        }

        return true;
    }

    /**
     * Update in-memory registry when a machine's node set changes.
     * Called from the WS process when a sync.nodes event is dispatched.
     */
    public static function refreshMachineNodes(int $machineId, array $newNodeIds): void
    {
        $conn = self::getMachine($machineId);
        if (!$conn) {
            return;
        }

        $oldNodeIds = $conn->machineNodeIds ?? [];

        // Remove nodes no longer on this machine
        foreach (array_diff($oldNodeIds, $newNodeIds) as $removedId) {
            self::remove($removedId, $conn);
        }

        // Register the newly assigned nodes, keeping any connections already
        // registered for shared nodes.
        foreach ($newNodeIds as $nodeId) {
            self::add($nodeId, $conn);
        }

        $conn->machineNodeIds = $newNodeIds;
    }

    public static function sendMachine(int $machineId, string $event, array $data): bool
    {
        $conn = self::getMachine($machineId);
        if (!$conn) {
            return false;
        }

        $payload = json_encode([
            'event' => $event,
            'data' => $data,
            'timestamp' => time(),
        ]);

        $conn->send($payload);
        return true;
    }

    /**
     * Get the connection for a node by ID, checking if it's still alive.
     */
    public static function isOnline(int $nodeId): bool
    {
        foreach (self::getAll($nodeId) as $conn) {
            if ($conn->getStatus() === TcpConnection::STATUS_ESTABLISHED) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all connected node IDs.
     * @return int[]
     */
    public static function getConnectedNodeIds(): array
    {
        return array_keys(self::$connections);
    }

    public static function count(): int
    {
        return count(self::$connections);
    }

    /**
     * @return int[]
     */
    public static function getConnectedMachineIds(): array
    {
        return array_keys(self::$machineConnections);
    }

    public static function machineCount(): int
    {
        return count(self::$machineConnections);
    }
}