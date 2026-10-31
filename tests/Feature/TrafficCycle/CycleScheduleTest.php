<?php

namespace Tests\Feature\TrafficCycle;

use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\TrafficResetLog;
use App\Models\User;
use App\Services\UserService;

/**
 * Scheduling rules: DESIGN §3.2 – §3.4, §3.8.
 */
class CycleScheduleTest extends TrafficCycleTestCase
{
    public function test_month_end_purchase_gets_no_reset_one_day_later(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-10-31 05:42:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $user->refresh();
        $this->assertSame('2026-12-01 05:42:00', $this->date($user->expired_at));
        $this->assertSame($user->expired_at, $this->currentCycle($user)->ends_at);
        $this->assertNull($user->next_reset_at);
        $this->assertNull(app(UserService::class)->getResetDay($user));

        $this->useTraffic($user, 5 * self::GB, 25 * self::GB);
        $this->at('2026-11-01 06:00:00');
        $this->artisan('reset:traffic')->assertSuccessful();

        $user->refresh();
        $this->assertSame(30 * self::GB, $user->u + $user->d);
        $this->assertCount(1, $this->cyclesOf($user));
        $this->assertSame([], $this->logsOf($user));
    }

    public function test_rollover_chain_closes_each_cycle_at_its_planned_end(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);
        $user->refresh();
        $this->assertSame('2026-12-15 10:00:00', $this->date($user->expired_at));
        $first = $this->currentCycle($user);
        $this->assertSame('2026-10-15 10:00:00', $this->date($first->ends_at));
        $this->assertSame($first->ends_at, $user->next_reset_at);
        $this->assertSame(30, app(UserService::class)->getResetDay($user));

        $this->useTraffic($user, 20 * self::GB, 30 * self::GB);
        $now = $this->at('2026-10-15 10:05:00');
        $this->artisan('reset:traffic')->assertSuccessful();

        $user->refresh();
        $first->refresh();
        $second = $this->currentCycle($user);
        $this->assertSame(TrafficCycle::REASON_ROLLOVER, $first->end_reason);
        $this->assertSame($this->ts('2026-10-15 10:00:00'), $first->ended_at);
        $this->assertSame(20 * self::GB, $first->u_end);
        $this->assertSame(30 * self::GB, $first->d_end);
        $this->assertSame(2, $second->seq);
        $this->assertSame(TrafficCycle::REASON_ROLLOVER, $second->start_reason);
        $this->assertSame($first->ends_at, $second->started_at);
        $this->assertSame('2026-11-15 10:00:00', $this->date($second->ends_at));
        $this->assertSame(0, $user->u + $user->d);
        $this->assertSame(1, $user->reset_count);
        $this->assertSame($now, $user->last_reset_at);
        $this->assertSame($second->ends_at, $user->next_reset_at);

        $logs = $this->logsOf($user);
        $this->assertCount(1, $logs);
        $this->assertSame(TrafficResetLog::SOURCE_CRON, $logs[0]->trigger_source);
        $this->assertSame(TrafficResetLog::REASON_CYCLE_ROLLOVER, $logs[0]->metadata['reason']);
        $this->assertSame(50 * self::GB, (int) $logs[0]->old_total);
        $this->assertSame($second->id, $logs[0]->metadata['cycle_id']);
        $this->assertSame($first->id, $logs[0]->metadata['prev_cycle_id']);

        // nothing used in the second cycle: the rollover happens but no 0 B log row and no reset_count++
        $this->at('2026-11-15 10:01:00');
        $this->artisan('reset:traffic')->assertSuccessful();
        $user->refresh();
        $third = $this->currentCycle($user);
        $this->assertSame(3, $third->seq);
        $this->assertSame('2026-12-15 10:00:00', $this->date($third->ends_at));
        $this->assertNull($user->next_reset_at);
        $this->assertSame(1, $user->reset_count);
        $this->assertCount(1, $this->logsOf($user));
    }

    public function test_catch_up_starts_from_the_last_passed_boundary_without_empty_cycles(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-01-10 08:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_YEARLY, Order::TYPE_NEW_PURCHASE);
        $this->assertSame('2026-02-10 08:00:00', $this->date($this->currentCycle($user)->ends_at));
        $this->useTraffic($user, 0, 5 * self::GB);

        // the cron was down from February to April
        $this->at('2026-04-20 09:00:00');
        $this->artisan('reset:traffic')->assertSuccessful();

        $cycles = $this->cyclesOf($user);
        $this->assertCount(2, $cycles);
        $this->assertSame('2026-02-10 08:00:00', $this->date($cycles[0]->ended_at));
        $this->assertSame(TrafficCycle::REASON_CATCH_UP, $cycles[1]->start_reason);
        $this->assertSame('2026-04-10 08:00:00', $this->date($cycles[1]->started_at));
        $this->assertSame('2026-05-10 08:00:00', $this->date($cycles[1]->ends_at));
        $this->assertCount(1, $this->logsOf($user));
        $this->assertSame(0, $user->refresh()->d);
    }

    public function test_extending_expiry_keeps_the_promised_end_and_shrinking_cuts_it(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-01-10 08:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_YEARLY, Order::TYPE_NEW_PURCHASE);
        $cycle = $this->currentCycle($user);
        $promised = $this->ts('2026-02-10 08:00:00');

        // e.g. a gift card adds days: plain save, reconciled by the observer
        $this->at('2026-01-20 00:00:00');
        $user->refresh();
        $user->expired_at = $this->ts('2027-03-10 08:00:00');
        $user->save();
        $cycle->refresh();
        $this->assertSame($promised, $cycle->ends_at);
        $this->assertSame($promised, $user->refresh()->next_reset_at);
        $event = collect($cycle->events)->last();
        $this->assertSame('expiry_changed', $event['type']);
        $this->assertSame($this->ts('2027-01-10 08:00:00'), $event['before']);
        $this->assertSame($this->ts('2027-03-10 08:00:00'), $event['after']);

        // the subscription now ends before the planned reset: the cycle ends with it
        $user->expired_at = $this->ts('2026-02-01 08:00:00');
        $user->save();
        $cycle->refresh();
        $this->assertSame($this->ts('2026-02-01 08:00:00'), $cycle->ends_at);
        // MySQL stores JSON objects with their keys re-ordered
        $this->assertEquals(['type' => 'schedule_changed', 'why' => 'expiry_shrunk'], array_intersect_key(collect($cycle->events)->last(), ['type' => 1, 'why' => 1]));
        $this->assertNull($user->refresh()->next_reset_at);
    }

    public function test_a_remainder_shorter_than_the_minimum_is_merged_into_the_cycle(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-01-10 08:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_YEARLY, Order::TYPE_NEW_PURCHASE);

        $this->at('2026-01-20 00:00:00');
        $user->refresh();
        $user->expired_at = $this->ts('2026-02-20 08:00:00');
        $user->save();

        $cycle = $this->currentCycle($user);
        $this->assertSame($this->ts('2026-02-20 08:00:00'), $cycle->ends_at);
        $this->assertSame('tail_merged', collect($cycle->events)->last()['why']);
        $this->assertNull($user->refresh()->next_reset_at);
    }

    public function test_reconcile_twice_changes_nothing(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);
        $this->at('2026-09-20 10:00:00');
        $user->refresh();
        $user->transfer_enable = 120 * self::GB;
        $user->save();

        // a user the ledger has never seen (bulk insert, no model events)
        $legacy = User::withoutEvents(fn() => $this->makeUser([
            'plan_id' => $plan->id,
            'transfer_enable' => 100 * self::GB,
            'expired_at' => $this->ts('2026-12-01 00:00:00'),
            'next_reset_at' => $this->ts('2026-10-01 00:00:00'),
        ]));
        $this->assertNull($this->currentCycle($legacy));

        $this->at('2026-09-25 10:00:00');
        foreach ([$user, $legacy] as $subject) {
            $this->cycles()->reconcile($subject);
            $cycle = $this->currentCycle($subject)->getAttributes();
            $row = User::find($subject->id)->getAttributes();
            $this->at('2026-09-25 11:00:00');
            $this->cycles()->reconcile(User::find($subject->id));
            $this->cycles()->reconcile(User::find($subject->id));
            $this->assertSame($cycle, $this->currentCycle($subject)->getAttributes());
            $this->assertSame($row, User::find($subject->id)->getAttributes());
            $this->assertCount(1, TrafficCycle::where('user_id', $subject->id)->whereNull('ended_at')->get());
        }

        // the promised next_reset_at of the legacy user is kept
        $this->assertSame($this->ts('2026-10-01 00:00:00'), $this->currentCycle($legacy)->ends_at);
        $this->assertSame(TrafficCycle::REASON_BOOTSTRAP, $this->currentCycle($legacy)->start_reason);
    }

    public function test_plan_reset_method_change_reschedules_from_the_cycle_start(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);
        $this->assertSame('2026-10-15 10:00:00', $this->date($this->currentCycle($user)->ends_at));

        $this->at('2026-09-20 10:00:00');
        $plan->update(['reset_traffic_method' => Plan::RESET_TRAFFIC_NEVER]);

        $cycle = $this->currentCycle($user);
        $this->assertSame('2026-12-15 10:00:00', $this->date($cycle->ends_at));
        $this->assertSame('method_changed', collect($cycle->events)->last()['why']);
        $this->assertNull($user->refresh()->next_reset_at);
    }

    public function test_reset_traffic_fix_null_goes_through_the_ledger(): void
    {
        $plan = $this->makePlan();
        $this->at('2026-09-15 10:00:00');
        $user = User::withoutEvents(fn() => $this->makeUser([
            'plan_id' => $plan->id,
            'transfer_enable' => 100 * self::GB,
            'expired_at' => $this->ts('2026-12-15 10:00:00'),
        ]));

        $this->artisan('reset:traffic', ['--fix-null' => true])->assertSuccessful();

        $cycle = $this->currentCycle($user);
        $this->assertSame(TrafficCycle::REASON_BOOTSTRAP, $cycle->start_reason);
        $this->assertSame('2026-10-15 10:00:00', $this->date($cycle->ends_at));
        $this->assertSame($cycle->ends_at, $user->refresh()->next_reset_at);
    }
}
