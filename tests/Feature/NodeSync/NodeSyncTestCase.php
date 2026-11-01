<?php

namespace Tests\Feature\NodeSync;

use App\Jobs\NodeGroupSyncJob;
use App\Jobs\NodeUserSyncJob;
use App\Models\Server;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;
use Tests\Feature\TrafficCycle\TrafficCycleTestCase;

/**
 * Node push paths: jobs are faked, Redis publishes (NodeSyncService::push) are captured per node.
 */
abstract class NodeSyncTestCase extends TrafficCycleTestCase
{
    /** @var array<int, array{node_id: int, event: string, data: array}> */
    protected array $pushes = [];

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    protected function makeServer(array $groupIds, bool $online = true): Server
    {
        $server = Server::create([
            'name' => 'node-' . Str::lower(Str::random(6)),
            'type' => Server::TYPE_SOCKS,
            'host' => '127.0.0.1',
            'port' => '443',
            'server_port' => 443,
            'rate' => '1',
            'group_ids' => array_map('strval', $groupIds),
        ]);
        if ($online) {
            Cache::put("node_ws_alive:{$server->id}", true, 3600);
        }

        return $server;
    }

    /**
     * A user the full list serves: group set, quota left, no expiry, not banned. No model events.
     */
    protected function makeServableUser(int $groupId, array $attributes = []): User
    {
        return User::withoutEvents(fn() => $this->makeUser(array_merge([
            'group_id' => $groupId,
            'transfer_enable' => 100 * self::GB,
            'expired_at' => null,
        ], $attributes)));
    }

    protected function capturePushes(): void
    {
        $this->pushes = [];
        Redis::shouldReceive('publish')->andReturnUsing(function ($channel, $message) {
            $this->pushes[] = json_decode($message, true);
            return 1;
        });
    }

    /**
     * @return array<int, array{event: string, data: array}>
     */
    protected function pushesTo(Server $server): array
    {
        return array_values(array_map(
            fn(array $push) => ['event' => $push['event'], 'data' => $push['data']],
            array_filter($this->pushes, fn(array $push) => ($push['node_id'] ?? null) === $server->id)
        ));
    }

    protected static function prop(object $job, string $name): mixed
    {
        return (new \ReflectionProperty($job, $name))->getValue($job);
    }

    /**
     * @return array<int, array{0: int, 1: int|null}> [userId, oldGroupId] of every queued 'updated' user sync
     */
    protected function updatedSyncs(): array
    {
        return Queue::pushed(NodeUserSyncJob::class)
            ->filter(fn(NodeUserSyncJob $job) => self::prop($job, 'action') === 'updated')
            ->map(fn(NodeUserSyncJob $job) => [self::prop($job, 'userId'), self::prop($job, 'oldGroupId')])
            ->values()
            ->all();
    }

    /**
     * @return int[] userIds of the queued user syncs with this action
     */
    protected function syncedUsers(string $action): array
    {
        return Queue::pushed(NodeUserSyncJob::class)
            ->filter(fn(NodeUserSyncJob $job) => self::prop($job, 'action') === $action)
            ->map(fn(NodeUserSyncJob $job) => self::prop($job, 'userId'))
            ->values()
            ->all();
    }

    /**
     * @return int[] sorted group ids of all queued group syncs
     */
    protected function groupSyncs(): array
    {
        $groups = Queue::pushed(NodeGroupSyncJob::class)
            ->flatMap(fn(NodeGroupSyncJob $job) => self::prop($job, 'groupIds'))
            ->values()
            ->all();
        sort($groups);

        return $groups;
    }

    protected function groupSyncJobCount(): int
    {
        return Queue::pushed(NodeGroupSyncJob::class)->count();
    }
}
