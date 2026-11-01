<?php

namespace Tests\Feature\NodeSync;

use App\Models\Server;
use App\Services\NodeRegistry;
use App\WebSocket\NodeEventHandlers;
use Mockery;
use Workerman\Connection\TcpConnection;

/**
 * The full sync after authentication goes to the connection that authenticated, not to every connection that
 * serves the same node: N machines reconnecting must not cost N(N+1)/2 full user lists.
 */
class FullSyncTargetTest extends NodeSyncTestCase
{
    private Server $node;
    /** @var array<int, array<int, array>> spl_object_id => decoded messages */
    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->node = $this->makeServer([1]);
        $this->makeServableUser(1);
    }

    protected function tearDown(): void
    {
        // setUp may have failed before the node existed; do not hide that failure behind an uninitialized property
        if (isset($this->node)) {
            NodeRegistry::remove($this->node->id);
            NodeRegistry::remove($this->node->id + 1000);
        }
        parent::tearDown();
    }

    private function connection(array $machineNodeIds = []): TcpConnection
    {
        $conn = Mockery::mock(TcpConnection::class);
        $id = spl_object_id($conn);
        $this->sent[$id] = [];
        $conn->shouldReceive('send')->andReturnUsing(function ($buffer) use ($id) {
            $this->sent[$id][] = json_decode($buffer, true);
            return true;
        });
        if ($machineNodeIds) {
            $conn->machineNodeIds = $machineNodeIds;
        }

        return $conn;
    }

    private function events(TcpConnection $conn): array
    {
        return array_column($this->sent[spl_object_id($conn)], 'event');
    }

    public function test_full_sync_goes_only_to_the_authenticating_connection(): void
    {
        $sibling = $this->connection();
        $joining = $this->connection();
        NodeRegistry::add($this->node->id, $sibling);
        NodeRegistry::add($this->node->id, $joining);

        NodeEventHandlers::pushFullSync($joining, $this->node);

        $this->assertSame(['sync.config', 'sync.users'], $this->events($joining));
        $this->assertSame([], $this->events($sibling));
        $users = $this->sent[spl_object_id($joining)][1]['data']['users'];
        $this->assertCount(1, $users);
        $this->assertArrayNotHasKey('node_id', $this->sent[spl_object_id($joining)][1]['data']);
    }

    public function test_machine_connections_get_the_node_id_with_their_full_sync(): void
    {
        $machine = $this->connection([$this->node->id, $this->node->id + 1000]);
        NodeRegistry::add($this->node->id, $machine);

        NodeEventHandlers::pushFullSync($machine, $this->node);

        foreach ($this->sent[spl_object_id($machine)] as $message) {
            $this->assertSame($this->node->id, $message['data']['node_id']);
        }
        $this->assertSame(['sync.config', 'sync.users'], $this->events($machine));
    }

    public function test_broadcast_pushes_still_reach_every_connection_of_the_node(): void
    {
        $first = $this->connection();
        $second = $this->connection();
        NodeRegistry::add($this->node->id, $first);
        NodeRegistry::add($this->node->id, $second);

        $this->assertTrue(NodeRegistry::send($this->node->id, 'sync.user.delta', ['action' => 'remove', 'users' => [['id' => 1]]]));

        $this->assertSame(['sync.user.delta'], $this->events($first));
        $this->assertSame(['sync.user.delta'], $this->events($second));
    }
}
