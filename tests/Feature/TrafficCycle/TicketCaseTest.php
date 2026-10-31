<?php

namespace Tests\Feature\TrafficCycle;

use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\TrafficResetLog;
use Laravel\Sanctum\Sanctum;

/**
 * 芒果云工单 #6982 (docs/traffic-cycle/DESIGN.md §1.2, §3.7).
 */
class TicketCaseTest extends TrafficCycleTestCase
{
    public function test_special_cycle_survives_renewal_and_advance_restores_the_plan_quota(): void
    {
        $plan = $this->makePlan(['id' => 19]);
        $user = $this->makeUser(['email' => 'case6982@cycle.test']);

        $this->at('2026-10-01 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $user->refresh();
        $this->assertSame('2026-11-01 10:00:00', $this->date($user->expired_at));
        $first = $this->currentCycle($user);
        $this->assertSame(TrafficCycle::REASON_PURCHASE, $first->start_reason);
        $this->assertSame(100 * self::GB, $first->quota);
        $this->useTraffic($user, 10 * self::GB, 50 * self::GB);

        // 10-31 23:03 the admin converts the remaining value: 40 GB for this cycle, ending 12-01 23:59:59
        $now = $this->at('2026-10-31 23:03:00');
        $admin = $this->actingAsAdmin();
        $cycleEnd = $this->ts('2026-12-01 23:59:59');
        $this->postJson($this->adminApi('user/update'), [
            'id' => $user->id,
            'plan_id' => 19,
            'transfer_enable' => 40 * self::GB,
            'expired_at' => $cycleEnd,
            'cycle_mode' => 'restart',
            'cycle_quota_scope' => 'cycle',
            'cycle_ends_at' => $cycleEnd,
            'cycle_note' => '中型芒果剩余价值等值转换',
        ])->assertOk()->assertJsonPath('data', true);

        $user->refresh();
        $first->refresh();
        $special = $this->currentCycle($user);
        $this->assertSame(TrafficCycle::REASON_REPLACED, $first->end_reason);
        $this->assertSame($now, $first->ended_at);
        $this->assertSame(60 * self::GB, $first->u_end + $first->d_end);
        $this->assertSame(TrafficCycle::KIND_SPECIAL, $special->kind);
        $this->assertSame(40 * self::GB, $special->quota);
        $this->assertSame(100 * self::GB, $special->next_quota);
        $this->assertSame($now, $special->started_at);
        $this->assertSame($cycleEnd, $special->ends_at);
        $this->assertSame(TrafficCycle::REASON_ADMIN, $special->start_reason);
        $this->assertSame('中型芒果剩余价值等值转换', $special->note);
        $this->assertSame(40 * self::GB, (int) $user->transfer_enable);
        $this->assertSame(0, $user->u + $user->d);
        // the cycle ends with the subscription: no reset is scheduled
        $this->assertNull($user->next_reset_at);

        $restartLog = collect($this->logsOf($user))->last();
        $this->assertSame(TrafficResetLog::REASON_ADMIN_RESTART, $restartLog->metadata['reason']);
        $this->assertSame(60 * self::GB, (int) $restartLog->old_total);
        $this->assertSame($admin->id, $restartLog->metadata['admin_id']);
        $this->assertSame($special->id, $restartLog->metadata['cycle_id']);
        $this->assertSame($first->id, $restartLog->metadata['prev_cycle_id']);

        // 10-31 23:18 the user renews one month: the 40 GB stay, the next cycle gets the plan's 100 GB
        $this->at('2026-10-31 23:18:00');
        $this->useTraffic($user, 53241998, 400877322);
        $renewal = $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_RENEWAL);
        $user->refresh();
        $this->assertSame('2027-01-01 23:59:59', $this->date($user->expired_at));
        $this->assertSame(40 * self::GB, (int) $user->transfer_enable);
        $this->assertSame(53241998 + 400877322, $user->u + $user->d);
        $special->refresh();
        $this->assertSame($special->id, $this->currentCycle($user)->id);
        $this->assertSame(40 * self::GB, $special->quota);
        $this->assertSame(100 * self::GB, $special->next_quota);
        $this->assertSame($cycleEnd, $special->ends_at);
        $this->assertSame($cycleEnd, $user->next_reset_at);
        $renewalEvent = collect($special->events)->firstWhere('type', 'renewal');
        $this->assertSame($renewal->id, $renewalEvent['order_id']);
        $this->assertSame($cycleEnd, $renewalEvent['expired_before']);
        $this->assertSame($user->expired_at, $renewalEvent['expired_after']);

        Sanctum::actingAs($user);
        $this->getJson('/api/v1/user/trafficCycle/fetch')
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.current.kind', 'special')
            ->assertJsonPath('data.current.quota', 40 * self::GB)
            ->assertJsonPath('data.current.next_quota', 100 * self::GB)
            ->assertJsonPath('data.current.ends_at', $cycleEnd)
            ->assertJsonPath('data.current.is_final', false)
            ->assertJsonPath('data.current.note', '中型芒果剩余价值等值转换')
            ->assertJsonPath('data.upcoming', [[
                'index' => 1,
                'starts_at' => $cycleEnd,
                'ends_at' => $this->ts('2027-01-01 23:59:59'),
                'quota' => 100 * self::GB,
                'is_final' => true,
            ]]);

        // 11-20 12:00 the 40 GB are used up: advance starts the next cycle now with 100 GB
        $this->at('2026-11-20 12:00:00');
        $this->useTraffic($user, 2 * self::GB, 38 * self::GB);
        $this->enableAdvancePolicy(30);
        $section = $this->cycles()->timeline($user->refresh())['advance'];
        $this->assertTrue($section['eligible_if_exhausted']);
        $this->assertSame(993599, $section['shift_seconds']);
        $this->assertSame('2026-12-21 12:00:00', $this->date($section['expired_after']));

        $result = $this->cycles()->advance($user, ['source' => 'traffic_report', 'server_id' => 3], 30);
        $this->assertTrue($result['ok']);
        $this->assertSame('eligible', $result['reason']);
        $this->assertSame(993599, $result['shift_seconds']);
        $this->assertSame($special->id, $result['closed_cycle_id']);
        $this->assertSame(40 * self::GB, $result['before']['transfer_enable']);
        $this->assertSame(40 * self::GB, $result['before']['used_traffic']);
        $this->assertSame(100 * self::GB, $result['after']['transfer_enable']);
        $this->assertSame(0, $result['after']['used_traffic']);
        $this->assertSame('2026-12-21 12:00:00', $this->date($result['after']['expired_at']));

        $user->refresh();
        $special->refresh();
        $next = TrafficCycle::find($result['new_cycle_id']);
        $this->assertSame(TrafficCycle::REASON_ADVANCED, $special->end_reason);
        $this->assertSame($this->ts('2026-11-20 12:00:00'), $special->ended_at);
        $this->assertSame(TrafficCycle::REASON_ADVANCE, $next->start_reason);
        $this->assertSame(TrafficCycle::KIND_STANDARD, $next->kind);
        $this->assertSame(100 * self::GB, $next->quota);
        $this->assertSame('2026-11-20 12:00:00', $this->date($next->started_at));
        $this->assertSame('2026-12-21 12:00:00', $this->date($next->ends_at));
        $this->assertSame(100 * self::GB, (int) $user->transfer_enable);
        $this->assertSame('2026-12-21 12:00:00', $this->date($user->expired_at));
        $this->assertNull($user->next_reset_at);

        $log = TrafficResetLog::find($result['reset_log_id']);
        $this->assertSame(TrafficResetLog::REASON_AUTO_ADVANCE, $log->metadata['reason']);
        $this->assertSame(40 * self::GB, (int) $log->old_total);
        $this->assertSame(993599, $log->metadata['shift_seconds']);
        $this->assertSame(40 * self::GB, $log->metadata['quota_before']);
        $this->assertSame(100 * self::GB, $log->metadata['quota_after']);
        $this->assertSame($this->ts('2027-01-01 23:59:59'), $log->metadata['expired_before']);
        $this->assertSame($this->ts('2026-12-21 12:00:00'), $log->metadata['expired_after']);
        $this->assertSame('traffic_report', $log->metadata['trigger']['source']);
        $this->assertSame($next->id, $log->metadata['cycle_id']);
        $this->assertSame($special->id, $log->metadata['prev_cycle_id']);

        // a second exhaustion right away: the new cycle is the final one, nothing to advance into
        $this->useTraffic($user, 0, 100 * self::GB);
        $again = $this->cycles()->advance($user->refresh(), ['source' => 'traffic_report'], 30);
        $this->assertFalse($again['ok']);
        $this->assertSame('final_cycle', $again['reason']);
        $this->assertSame(100 * self::GB, $user->refresh()->d);
    }
}
