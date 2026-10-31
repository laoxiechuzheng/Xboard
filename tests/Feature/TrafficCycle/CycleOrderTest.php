<?php

namespace Tests\Feature\TrafficCycle;

use App\Jobs\OrderHandleJob;
use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\TrafficResetLog;
use App\Utils\Helper;

/**
 * Orders: DESIGN §3.5 and §4.4.
 */
class CycleOrderTest extends TrafficCycleTestCase
{
    public function test_new_purchase_with_the_second_reset_event_writes_one_log_at_most(): void
    {
        admin_setting(['new_order_event_id' => 1]);
        $plan = $this->makePlan();
        $this->at('2026-10-01 10:00:00');

        $used = $this->makeUser(['u' => 3 * self::GB, 'd' => 7 * self::GB]);
        $order = $this->openOrder($used, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $logs = $this->logsOf($used);
        $this->assertCount(1, $logs);
        $this->assertSame(TrafficResetLog::REASON_NEW_PURCHASE, $logs[0]->metadata['reason']);
        $this->assertSame(10 * self::GB, (int) $logs[0]->old_total);
        $this->assertSame($order->id, $logs[0]->metadata['order_id']);
        $this->assertSame($this->currentCycle($used)->id, $logs[0]->metadata['cycle_id']);
        $this->assertSame(1, $used->refresh()->reset_count);

        $fresh = $this->makeUser();
        $this->openOrder($fresh, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $this->assertSame([], $this->logsOf($fresh));
        $this->assertSame(0, (int) $fresh->refresh()->reset_count);
        $this->assertSame(TrafficCycle::REASON_PURCHASE, $this->currentCycle($fresh)->start_reason);
    }

    public function test_renewal_of_a_standard_cycle_takes_the_plan_quota_and_keeps_the_schedule(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);
        $cycle = $this->currentCycle($user);
        $this->useTraffic($user, 0, 30 * self::GB);

        $plan->update(['transfer_enable' => 120]);
        $this->at('2026-10-01 10:00:00');
        $order = $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_RENEWAL);

        $user->refresh();
        $cycle->refresh();
        $this->assertSame($cycle->id, $this->currentCycle($user)->id);
        $this->assertSame('2027-01-15 10:00:00', $this->date($user->expired_at));
        $this->assertSame('2026-10-15 10:00:00', $this->date($cycle->ends_at));
        $this->assertSame(120 * self::GB, $cycle->quota);
        $this->assertSame(120 * self::GB, $cycle->next_quota);
        $this->assertSame(120 * self::GB, (int) $user->transfer_enable);
        $this->assertSame(30 * self::GB, (int) $user->d);
        $types = collect($cycle->events)->pluck('type')->all();
        $this->assertSame(['quota_changed', 'renewal'], $types);
        $this->assertSame($order->id, collect($cycle->events)->firstWhere('type', 'renewal')['order_id']);
        $this->assertSame([], $this->logsOf($user));
    }

    public function test_reset_package_clears_usage_inside_the_cycle(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);
        $cycle = $this->currentCycle($user);
        $this->useTraffic($user, 10 * self::GB, 90 * self::GB);

        $this->at('2026-09-25 10:00:00');
        $order = $this->openOrder($user, $plan, Plan::PERIOD_RESET_TRAFFIC, Order::TYPE_RESET_TRAFFIC);

        $user->refresh();
        $cycle->refresh();
        $this->assertSame($cycle->id, $this->currentCycle($user)->id);
        $this->assertSame('2026-10-15 10:00:00', $this->date($cycle->ends_at));
        $this->assertSame($cycle->ends_at, $user->next_reset_at);
        $this->assertSame(0, $user->u + $user->d);
        $log = collect($this->logsOf($user))->last();
        $this->assertSame(TrafficResetLog::REASON_RESET_PACKAGE, $log->metadata['reason']);
        $this->assertSame($order->id, $log->metadata['order_id']);
        $this->assertSame($cycle->id, $log->metadata['cycle_id']);
        $event = collect($cycle->events)->last();
        $this->assertSame('usage_cleared', $event['type']);
        $this->assertSame('order', $event['by']);
        $this->assertSame($log->id, $event['log_id']);
        $this->assertSame(100 * self::GB, $event['cleared']);
    }

    public function test_upgrade_opens_a_new_cycle_with_the_new_plan_quota(): void
    {
        admin_setting(['change_order_event_id' => 1]);
        $small = $this->makePlan(['name' => '银河标准 · 128G', 'transfer_enable' => 128]);
        $big = $this->makePlan(['transfer_enable' => 300]);
        $user = $this->makeUser();
        $this->at('2026-10-05 10:00:00');
        $this->openOrder($user, $small, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $old = $this->currentCycle($user);
        $this->useTraffic($user, 0, 20 * self::GB);

        $this->at('2026-10-20 10:00:00');
        $order = $this->openOrder($user, $big, Plan::PERIOD_MONTHLY, Order::TYPE_UPGRADE);

        $user->refresh();
        $old->refresh();
        $new = $this->currentCycle($user);
        $this->assertSame(TrafficCycle::REASON_REPLACED, $old->end_reason);
        $this->assertSame(TrafficCycle::REASON_UPGRADE, $new->start_reason);
        $this->assertSame($order->id, $new->order_id);
        $this->assertSame($big->id, $new->plan_id);
        $this->assertSame(300 * self::GB, $new->quota);
        $this->assertSame('2026-11-20 10:00:00', $this->date($user->expired_at));
        $log = collect($this->logsOf($user))->last();
        $this->assertSame(TrafficResetLog::REASON_PLAN_CHANGE, $log->metadata['reason']);
        $this->assertSame(20 * self::GB, (int) $log->old_total);
    }

    public function test_onetime_purchase_opens_an_unscheduled_final_cycle(): void
    {
        $plan = $this->makePlan([
            'name' => '流量包 · 300G 一次性',
            'transfer_enable' => 300,
            'reset_traffic_method' => Plan::RESET_TRAFFIC_NEVER,
            'prices' => ['onetime' => 50],
        ]);
        $user = $this->makeUser(['u' => self::GB]);
        $this->at('2026-10-05 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_ONETIME, Order::TYPE_NEW_PURCHASE);

        $user->refresh();
        $cycle = $this->currentCycle($user);
        $this->assertNull($user->expired_at);
        $this->assertNull($user->next_reset_at);
        $this->assertNull($cycle->ends_at);
        $this->assertSame(TrafficCycle::REASON_ONETIME, $cycle->start_reason);
        $this->assertSame(TrafficResetLog::REASON_ONETIME_PURCHASE, $this->logsOf($user)[0]->metadata['reason']);
        $timeline = $this->cycles()->timeline($user);
        $this->assertTrue($timeline['current']['is_final']);
        $this->assertSame([], $timeline['upcoming']);
        $this->assertSame('never', $timeline['reset_method']);
    }

    public function test_order_months_are_counted_on_the_site_calendar(): void
    {
        // Carbon 3 reads a bare timestamp as UTC, where 00:30 Beijing time is still the previous day
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-10-01 00:30:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $this->assertSame('2026-11-01 00:30:00', $this->date($user->refresh()->expired_at));

        $this->at('2026-10-20 07:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_RENEWAL);
        $this->assertSame('2026-12-01 00:30:00', $this->date($user->refresh()->expired_at));
    }

    public function test_assigned_orders_wait_expire_hours_and_user_orders_keep_two_hours(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser(['email' => 'pending@cycle.test']);
        $this->actingAsAdmin();
        $now = $this->at('2026-11-01 10:00:00');

        $tradeNo = $this->postJson($this->adminApi('order/assign'), [
            'plan_id' => $plan->id,
            'email' => 'pending@cycle.test',
            'total_amount' => 3000,
            'period' => 'month_price',
            'expire_hours' => 72,
        ])->assertOk()->json('data');
        $assigned = Order::where('trade_no', $tradeNo)->first();
        $this->assertSame($now + 72 * 3600, $assigned->expires_at);

        $this->at('2026-11-01 13:00:00');
        OrderHandleJob::dispatchSync($tradeNo);
        $this->assertSame(Order::STATUS_PENDING, $assigned->refresh()->status);

        $this->at('2026-11-04 10:00:00');
        OrderHandleJob::dispatchSync($tradeNo);
        $this->assertSame(Order::STATUS_CANCELLED, $assigned->refresh()->status);

        // default is 72 hours as well
        $this->at('2026-11-05 10:00:00');
        $tradeNo = $this->postJson($this->adminApi('order/assign'), [
            'plan_id' => $plan->id,
            'email' => 'pending@cycle.test',
            'total_amount' => 3000,
            'period' => 'month_price',
        ])->assertOk()->json('data');
        $this->assertSame($this->ts('2026-11-08 10:00:00'), Order::where('trade_no', $tradeNo)->value('expires_at'));
        $this->postJson($this->adminApi('order/assign'), [
            'plan_id' => $plan->id,
            'email' => 'other@cycle.test',
            'total_amount' => 3000,
            'period' => 'month_price',
            'expire_hours' => 721,
        ])->assertStatus(422);

        // an order the user placed: still two hours
        $this->at('2026-11-06 10:00:00');
        $own = new Order();
        $own->forceFill([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'period' => Plan::PERIOD_MONTHLY,
            'trade_no' => Helper::guid(),
            'total_amount' => 3000,
            'type' => Order::TYPE_NEW_PURCHASE,
            'status' => Order::STATUS_PENDING,
        ])->save();
        $this->assertNull($own->refresh()->expires_at);
        $this->at('2026-11-06 11:59:59');
        OrderHandleJob::dispatchSync($own->trade_no);
        $this->assertSame(Order::STATUS_PENDING, $own->refresh()->status);
        $this->at('2026-11-06 12:00:00');
        OrderHandleJob::dispatchSync($own->trade_no);
        $this->assertSame(Order::STATUS_CANCELLED, $own->refresh()->status);
    }
}
