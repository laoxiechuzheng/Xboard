<?php

namespace Tests\Feature\NodeSync;

use App\Jobs\NodeGroupSyncJob;
use App\Jobs\NodeUserSyncJob;
use App\Models\Server;
use App\Services\NodeSyncService;
use App\Services\ServerService;

/**
 * What the queued syncs publish to the nodes, and that a delta never disagrees with the full list.
 */
class NodePushTest extends NodeSyncTestCase
{
    private Server $groupOne;
    private Server $groupTwo;
    private Server $groupOneOffline;

    protected function setUp(): void
    {
        parent::setUp();
        $this->groupOne = $this->makeServer([1]);
        $this->groupTwo = $this->makeServer([2]);
        $this->groupOneOffline = $this->makeServer([1], false);
        $this->capturePushes();
    }

    private function delta(string $action, int $userId): array
    {
        return ['event' => 'sync.user.delta', 'data' => ['action' => $action, 'users' => [['id' => $userId]]]];
    }

    private function deltaAction(Server $server): array
    {
        return array_map(fn(array $push) => [$push['data']['action'], $push['data']['users'][0]['id']], $this->pushesTo($server));
    }

    public function test_a_group_move_removes_from_the_old_group_and_adds_to_the_new_one(): void
    {
        $user = $this->makeServableUser(2);

        (new NodeUserSyncJob($user->id, 'updated', 1))->handle();

        $this->assertSame([$this->delta('remove', $user->id)], $this->pushesTo($this->groupOne));
        $this->assertSame([['add', $user->id]], $this->deltaAction($this->groupTwo));
        $this->assertSame([], $this->pushesTo($this->groupOneOffline));
    }

    public function test_an_old_group_equal_to_the_current_group_is_not_removed(): void
    {
        $user = $this->makeServableUser(1);

        (new NodeUserSyncJob($user->id, 'updated', 1))->handle();

        $this->assertSame([['add', $user->id]], $this->deltaAction($this->groupOne));
        $this->assertSame([], $this->pushesTo($this->groupTwo));
    }

    public function test_a_user_without_a_plan_that_the_full_list_serves_is_added_not_removed(): void
    {
        $user = $this->makeServableUser(1, ['plan_id' => null]);
        $this->assertFalse($user->isAvailable(), 'User::isAvailable() still requires a plan');

        NodeSyncService::notifyUserChanged($user);

        $this->assertSame([['add', $user->id]], $this->deltaAction($this->groupOne));
    }

    public function test_an_expired_user_is_removed(): void
    {
        $user = $this->makeServableUser(1, ['expired_at' => time() - 10]);

        NodeSyncService::notifyUserChanged($user);

        $this->assertSame([['remove', $user->id]], $this->deltaAction($this->groupOne));
    }

    public function test_servable_matches_the_full_list_user_by_user(): void
    {
        $users = [
            $this->makeServableUser(1),
            $this->makeServableUser(1, ['plan_id' => null]),
            $this->makeServableUser(1, ['expired_at' => time() + 3600]),
            $this->makeServableUser(1, ['expired_at' => time() - 10]),
            $this->makeServableUser(1, ['banned' => 1]),
            $this->makeServableUser(1, ['u' => 60 * self::GB, 'd' => 40 * self::GB]),
            $this->makeServableUser(1, ['u' => 60 * self::GB, 'd' => 39 * self::GB]),
            $this->makeServableUser(1, ['transfer_enable' => 0]),
        ];
        $listed = ServerService::getAvailableUsers($this->groupOne)->pluck('id')->map(fn($id) => (int) $id)->all();

        foreach ($users as $user) {
            $this->assertSame(
                in_array($user->id, $listed, true),
                ServerService::isUserServable($user->refresh()),
                "user {$user->id}"
            );
        }
        $this->assertCount(4, $listed);
    }

    public function test_a_group_sync_replaces_the_list_on_the_online_nodes_of_that_group_only(): void
    {
        $kept = $this->makeServableUser(1);
        $this->makeServableUser(1, ['banned' => 1]);
        $this->makeServableUser(2);

        (new NodeGroupSyncJob([1]))->handle();

        $pushes = $this->pushesTo($this->groupOne);
        $this->assertCount(1, $pushes);
        $this->assertSame('sync.users', $pushes[0]['event']);
        $this->assertSame([$kept->id], array_map(fn(array $u) => (int) $u['id'], $pushes[0]['data']['users']));
        $this->assertSame([], $this->pushesTo($this->groupTwo));
        $this->assertSame([], $this->pushesTo($this->groupOneOffline));
    }

    public function test_group_syncs_are_queued_as_one_job_for_the_distinct_groups_on_node_sync(): void
    {
        NodeGroupSyncJob::dispatchForGroups([2, '1', null, 2, 0, '']);

        $this->assertSame([1, 2], $this->groupSyncs());
        $this->assertSame(1, $this->groupSyncJobCount());
        \Illuminate\Support\Facades\Queue::assertPushedOn('node_sync', NodeGroupSyncJob::class);
    }

    public function test_no_group_sync_is_queued_without_groups(): void
    {
        NodeGroupSyncJob::dispatchForGroups([null, 0, '']);

        $this->assertSame(0, $this->groupSyncJobCount());
    }

    public function test_a_node_in_several_synced_groups_gets_one_full_list(): void
    {
        $shared = $this->makeServer([1, 2]);
        $inOne = $this->makeServableUser(1);
        $inTwo = $this->makeServableUser(2);
        $this->makeServableUser(3);

        (new NodeGroupSyncJob([1, 2]))->handle();

        $pushes = $this->pushesTo($shared);
        $this->assertCount(1, $pushes, 'one sync.users per node, not one per group');
        $this->assertSame('sync.users', $pushes[0]['event']);
        $listed = array_map(fn(array $u) => (int) $u['id'], $pushes[0]['data']['users']);
        sort($listed);
        $this->assertSame([$inOne->id, $inTwo->id], $listed);
        $this->assertCount(1, $this->pushesTo($this->groupOne));
        $this->assertCount(1, $this->pushesTo($this->groupTwo));
        $this->assertSame([], $this->pushesTo($this->groupOneOffline));
    }
}
