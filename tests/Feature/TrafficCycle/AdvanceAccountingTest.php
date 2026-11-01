<?php

namespace Tests\Feature\TrafficCycle;

use App\Jobs\TrafficFetchJob;
use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\TrafficResetLog;
use App\Models\User;
use App\Services\Plugin\HookManager;
use Illuminate\Support\Facades\Redis;

/**
 * Exact advance accounting (DESIGN §3.7): the old cycle absorbs exactly its quota, everything used beyond
 * it is carried into the new cycle. Reports are recorded by TrafficFetchJob, which then calls
 * traffic.process.after; the listener here does what TrafficReset 1.2.1 does there.
 */
class AdvanceAccountingTest extends TrafficCycleTestCase
{
    private Plan $plan;
    /** @var array[] advance() results of the simulated plugin */
    private array $advances = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->plan = $this->makePlan();
        Redis::shouldReceive('sadd')->andReturn(1);
    }

    /**
     * Quarterly from 09-15 10:00 (expiry 12-15 10:00), cycles end on the 15th; the report arrives at
     * 09-25 10:00, 20 days before the cycle ends.
     */
    private function subscriber(int $upload, int $download): User
    {
        $this->at('2026-09-15 10:00:00');
        $user = $this->makeUser();
        $this->openOrder($user, $this->plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);
        $user = $this->useTraffic($user, $upload, $download);
        $this->at('2026-09-25 10:00:00');

        return $user;
    }

    private function advanceAfterReports(): void
    {
        HookManager::register('traffic.process.after', function ($params) {
            [, , $data] = $params;
            User::whereIn('id', array_keys($data))
                ->where('transfer_enable', '>', 0)
                ->whereRaw('u + d >= transfer_enable')
                ->get()
                ->each(function (User $user) {
                    $this->advances[] = $this->cycles()->advance($user, ['source' => 'traffic_report', 'server_id' => 3], 30);
                });
        });
    }

    private function report(User $user, int $upload, int $download, float $rate = 1): User
    {
        (new TrafficFetchJob(['id' => 3, 'name' => 'HK-01', 'rate' => $rate], [$user->id => [$upload, $download]], 'vless', time()))->handle();

        return $user->refresh();
    }

    public function test_the_part_of_a_report_beyond_the_quota_starts_the_new_cycle(): void
    {
        $user = $this->subscriber(10 * self::GB, 89 * self::GB);
        $cycle = $this->currentCycle($user);
        $this->advanceAfterReports();

        // 99 GB used of 100, the report adds 3 GB
        $user = $this->report($user, self::GB, 2 * self::GB);

        $this->assertCount(1, $this->advances);
        $result = $this->advances[0];
        $this->assertTrue($result['ok']);
        $this->assertSame(100 * self::GB, $result['cleared']);
        $this->assertSame(2 * self::GB, $result['carried']);
        $this->assertSame(102 * self::GB, $result['before']['used_traffic']);
        $this->assertSame(2 * self::GB, $result['after']['used_traffic']);

        // the old cycle closes at exactly its quota, the new one starts at 2 GB
        $cycle->refresh();
        $this->assertSame(TrafficCycle::REASON_ADVANCED, $cycle->end_reason);
        $this->assertSame(100 * self::GB, $cycle->u_end + $cycle->d_end);
        $this->assertSame(2 * self::GB, $user->u + $user->d);
        // the split follows upload / download and adds up per side
        $this->assertSame(11 * self::GB, $cycle->u_end + (int) $user->u);
        $this->assertSame(91 * self::GB, $cycle->d_end + (int) $user->d);
        $this->assertGreaterThan(0, (int) $user->u);
        $this->assertSame(100 * self::GB, (int) $user->transfer_enable);

        // the expiry moves by the unused time of the old cycle: 20 days
        $this->assertSame(20 * 86400, $result['shift_seconds']);
        $this->assertSame('2026-11-25 10:00:00', $this->date($user->expired_at));

        $log = TrafficResetLog::find($result['reset_log_id']);
        $this->assertSame(102 * self::GB, (int) $log->old_total);
        $this->assertSame(2 * self::GB, (int) $log->new_total);
        $this->assertSame(2 * self::GB, $log->metadata['carried']);
        $fields = $log->cycleFields();
        $this->assertSame(100 * self::GB, $fields['cleared']);
        $this->assertSame(2 * self::GB, $fields['carried']);
        $event = $this->cycles()->timeline($user)['events'][0];
        $this->assertSame(['auto_advance', 100 * self::GB, 2 * self::GB], [$event['reason'], $event['cleared'], $event['carried']]);

        // the new cycle is not exhausted: no second advance from the sweep
        $this->assertSame([], $this->cycles()->exhaustedCandidates(30)->pluck('id')->all());
    }

    public function test_a_report_that_fills_the_quota_exactly_advances_once_and_carries_nothing(): void
    {
        $user = $this->subscriber(0, 0);
        $this->advanceAfterReports();

        $user = $this->report($user, 40 * self::GB, 60 * self::GB);

        $this->assertCount(1, $this->advances);
        $this->assertTrue($this->advances[0]['ok']);
        $this->assertSame(0, $this->advances[0]['carried']);
        $this->assertSame(0, $user->u + $user->d);
        $this->assertCount(1, $this->logsOf($user));
        $this->assertSame(0, $this->logsOf($user)[0]->cycleFields()['carried']);
        $this->assertSame([], $this->cycles()->exhaustedCandidates(30)->pluck('id')->all());
        // a late or duplicate trigger finds nothing to do
        $again = $this->cycles()->advance($user, ['source' => 'sweep'], 30);
        $this->assertSame('not_exhausted', $again['reason']);
        $this->assertCount(1, $this->logsOf($user));
    }

    public function test_a_report_beyond_the_new_quota_advances_again_and_every_byte_is_counted_once(): void
    {
        $user = $this->subscriber(10 * self::GB, 89 * self::GB);
        $this->advanceAfterReports();

        // 99 GB + 202 GB: one advance per recording, no loop inside advance()
        $user = $this->report($user, 2 * self::GB, 200 * self::GB);
        $this->assertCount(1, $this->advances);
        $this->assertSame(201 * self::GB, $this->advances[0]['carried']);
        $this->assertSame(201 * self::GB, $user->u + $user->d);
        $this->assertSame('2026-11-25 10:00:00', $this->date($user->expired_at));
        // still over quota: the sweep picks the user up, this is real usage
        $this->assertSame([$user->id], $this->cycles()->exhaustedCandidates(30)->pluck('id')->all());

        $this->at('2026-09-25 10:01:00');
        $second = $this->cycles()->advance($user, ['source' => 'sweep'], 30);
        $this->assertTrue($second['ok']);
        $this->assertSame(100 * self::GB, $second['cleared']);
        $this->assertSame(101 * self::GB, $second['carried']);
        $user->refresh();
        // the second cycle ran 09-25 10:00 -> 10-25 10:00 and was given up after a minute
        $this->assertSame(30 * 86400 - 60, $second['shift_seconds']);
        $this->assertSame('2026-10-26 10:01:00', $this->date($user->expired_at));

        // the cycle now is the final one: still over quota, nothing left to advance into
        $third = $this->cycles()->advance($user, ['source' => 'sweep'], 30);
        $this->assertSame('final_cycle', $third['reason']);
        $this->assertSame([], $this->cycles()->exhaustedCandidates(30)->pluck('id')->all());

        $closed = TrafficCycle::where('user_id', $user->id)->whereNotNull('ended_at')->orderBy('seq')->get();
        $this->assertCount(2, $closed);
        foreach ($closed as $cycle) {
            $this->assertSame(100 * self::GB, $cycle->u_end + $cycle->d_end);
        }
        $this->assertSame(101 * self::GB, $user->u + $user->d);
        // 99 GB before + 202 GB reported = 100 + 100 + 101
        $this->assertSame(301 * self::GB, $closed->sum(fn(TrafficCycle $c) => $c->u_end + $c->d_end) + $user->u + $user->d);
        $logs = $this->logsOf($user);
        $this->assertSame([301 * self::GB, 201 * self::GB], [(int) $logs[0]->old_total, (int) $logs[1]->old_total]);
        $this->assertSame([201 * self::GB, 101 * self::GB], [(int) $logs[0]->new_total, (int) $logs[1]->new_total]);
    }

    public function test_the_job_reports_with_the_node_rate_and_survives_a_failing_listener(): void
    {
        $user = $this->subscriber(0, 10 * self::GB);
        HookManager::register('traffic.process.after', function () {
            throw new \RuntimeException('plugin bug');
        });
        $seen = null;
        HookManager::register('traffic.process.after', function ($params) use (&$seen) {
            $seen = $params;
        }, 10);

        $user = $this->report($user, self::GB, self::GB, 1.5);

        // recorded with the rate even though a listener threw
        $this->assertSame(13 * self::GB, $user->u + $user->d);
        $this->assertSame(3, $seen[0]['id']);
        $this->assertSame('vless', $seen[1]);
        $this->assertSame([$user->id => [self::GB, self::GB]], $seen[2]);
    }

    public function test_only_advance_rows_carry_usage(): void
    {
        $user = $this->subscriber(10 * self::GB, 20 * self::GB);
        // an admin usage edit keeps new_total as the usage after the edit: that is not carried
        $edit = app(\App\Services\TrafficResetService::class)->writeLog($user, TrafficResetLog::SOURCE_MANUAL, 10 * self::GB, 20 * self::GB, [
            'reason' => TrafficResetLog::REASON_ADMIN_USAGE_EDIT,
        ], 0, 5 * self::GB, false);
        $this->assertSame(0, $edit->cycleFields()['carried']);
        $this->assertSame(25 * self::GB, $edit->cycleFields()['cleared']);
        // rows written before this field existed
        $legacy = TrafficResetLog::create([
            'user_id' => $user->id, 'reset_type' => TrafficResetLog::TYPE_MANUAL, 'reset_time' => now(),
            'old_upload' => 0, 'old_download' => 0, 'old_total' => 0, 'new_upload' => 0, 'new_download' => 0, 'new_total' => 0,
            'trigger_source' => TrafficResetLog::SOURCE_MANUAL,
            'metadata' => ['reason' => TrafficResetLog::REASON_AUTO_ADVANCE, 'cleared' => 40 * self::GB],
        ]);
        $this->assertSame(['cleared' => 40 * self::GB, 'carried' => 0], array_intersect_key($legacy->cycleFields(), ['cleared' => 0, 'carried' => 0]));
    }

    public function test_admin_user_history_carries_the_ledger_fields(): void
    {
        $user = $this->subscriber(10 * self::GB, 89 * self::GB);
        $this->advanceAfterReports();
        $this->report($user, self::GB, 2 * self::GB);
        $this->actingAsAdmin();

        $row = $this->getJson($this->adminApi('traffic-reset/user/' . $user->id . '/history'))
            ->assertOk()
            ->json('data.history.0');
        $this->assertSame('auto_advance', $row['reason']);
        $this->assertSame(100 * self::GB, $row['cleared']);
        $this->assertSame(2 * self::GB, $row['carried']);
        $this->assertSame(20 * 86400, $row['shift_seconds']);
        $this->assertSame($this->ts('2026-12-15 10:00:00'), $row['expired_before']);
        $this->assertSame($this->ts('2026-11-25 10:00:00'), $row['expired_after']);

        $logs = $this->getJson($this->adminApi('traffic-reset/logs') . '?user_id=' . $user->id)->assertOk()->json('data.0');
        $this->assertSame(2 * self::GB, $logs['carried']);
    }
}
