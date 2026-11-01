<?php

namespace Tests\Feature\TrafficCycle;

use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\User;
use App\Services\TrafficCycleService;

/**
 * Expiry changes on plans that never reset (DESIGN §3.3) and the expiry the ledger remembers when the
 * cycle's event list is trimmed (§4.3).
 */
class ExpiryFollowTest extends TrafficCycleTestCase
{
    public function test_renewing_a_never_reset_plan_keeps_the_cycle_final(): void
    {
        $plan = $this->makePlan(['reset_traffic_method' => Plan::RESET_TRAFFIC_NEVER]);
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $cycle = $this->currentCycle($user);
        $this->assertSame('2026-10-15 10:00:00', $this->date($cycle->ends_at));
        $this->assertNull($user->refresh()->next_reset_at);
        $this->useTraffic($user, 0, 30 * self::GB);

        $this->at('2026-10-01 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_RENEWAL);
        $user->refresh();
        $cycle->refresh();
        $this->assertSame('2026-11-15 10:00:00', $this->date($user->expired_at));
        $this->assertSame($cycle->id, $this->currentCycle($user)->id);
        // the cycle ends with the subscription; the old expiry is not a reset point
        $this->assertSame((int) $user->expired_at, $cycle->ends_at);
        $this->assertNull($user->next_reset_at);
        $this->assertContains('renewal', collect($cycle->events)->pluck('type')->all());
        $this->assertNotContains('schedule_changed', collect($cycle->events)->pluck('type')->all());
        $this->assertTrue($this->cycles()->timeline($user)['current']['is_final']);

        $this->at('2026-10-15 10:05:00');
        $this->artisan('reset:traffic')->assertSuccessful();
        $user->refresh();
        $this->assertSame(30 * self::GB, $user->u + $user->d);
        $this->assertCount(1, $this->cyclesOf($user));
        $this->assertSame([], $this->logsOf($user));
    }

    public function test_a_plan_following_the_never_reset_setting_follows_admin_and_direct_expiry_changes(): void
    {
        admin_setting(['reset_traffic_method' => Plan::RESET_TRAFFIC_NEVER]);
        $plan = $this->makePlan(['reset_traffic_method' => null]);
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $this->useTraffic($user, 0, 30 * self::GB);
        $cycle = $this->currentCycle($user);
        $this->assertSame('2026-10-15 10:00:00', $this->date($cycle->ends_at));
        $this->actingAsAdmin();
        $this->at('2026-09-20 10:00:00');

        // the admin extends the subscription by two months
        $extended = $this->ts('2026-12-15 10:00:00');
        $this->postJson($this->adminApi('user/update'), ['id' => $user->id, 'expired_at' => $extended])->assertOk();
        $cycle->refresh();
        $this->assertSame($cycle->id, $this->currentCycle($user)->id);
        $this->assertSame($extended, $cycle->ends_at);
        $this->assertNull($user->refresh()->next_reset_at);

        // ... then makes it long-term: the cycle stays unscheduled
        $this->postJson($this->adminApi('user/update'), ['id' => $user->id, 'expired_at' => null])->assertOk();
        $cycle->refresh();
        $this->assertSame($cycle->id, $this->currentCycle($user)->id);
        $this->assertNull($user->refresh()->expired_at);
        $this->assertNull($cycle->ends_at);
        $this->assertNull($user->next_reset_at);

        // a direct write (gift card, plain save) gives it a date again
        $dated = $this->ts('2027-01-15 10:00:00');
        User::whereKey($user->id)->update(['expired_at' => $dated]);
        $this->cycles()->reconcile($user->refresh());
        $cycle->refresh();
        $this->assertSame($dated, $cycle->ends_at);
        $this->assertNull($user->refresh()->next_reset_at);

        // none of the old expiries clears the usage
        foreach (['2026-10-15 10:05:00', '2026-12-15 10:05:00'] as $moment) {
            $this->at($moment);
            $this->artisan('reset:traffic')->assertSuccessful();
        }
        $user->refresh();
        $this->assertSame(30 * self::GB, $user->u + $user->d);
        $this->assertCount(1, $this->cyclesOf($user));
        $this->assertSame([], $this->logsOf($user));
    }

    public function test_extending_a_monthly_plan_still_turns_the_old_expiry_into_a_reset(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_NEW_PURCHASE);
        $this->at('2026-10-01 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_RENEWAL);
        $user->refresh();
        $this->assertSame('2026-10-15 10:00:00', $this->date($this->currentCycle($user)->ends_at));
        $this->assertSame($this->ts('2026-10-15 10:00:00'), (int) $user->next_reset_at);
    }

    public function test_trimming_events_keeps_the_expiry_the_ledger_last_saw(): void
    {
        $plan = $this->makePlan();
        $user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);
        $this->at('2026-10-01 10:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_MONTHLY, Order::TYPE_RENEWAL);
        $user->refresh();
        $this->assertSame('2027-01-15 10:00:00', $this->date($user->expired_at));
        $cycle = $this->currentCycle($user);
        $this->assertSame(['renewal'], collect($cycle->events)->pluck('type')->all());

        $base = $this->ts('2026-10-02 10:00:00');
        for ($i = 1; $i <= 60; $i++) {
            $cycle->pushEvent(['at' => $base + $i, 'type' => 'usage_cleared', 'by' => 'order', 'log_id' => $i, 'cleared' => self::GB, 'reason' => 'reset_package']);
        }
        $cycle->save();
        $cycle->refresh();

        $events = $cycle->events;
        $this->assertCount(TrafficCycle::MAX_EVENTS, $events);
        // the renewal survives, the oldest other events went first
        $this->assertSame('renewal', $events[0]['type']);
        $this->assertSame(12, $events[1]['log_id']);
        $this->assertSame(60, end($events)['log_id']);
        $known = (new \ReflectionMethod(TrafficCycleService::class, 'knownExpiry'))->invoke($this->cycles(), $cycle);
        $this->assertSame((int) $user->expired_at, $known);

        // the ledger sees no expiry change, so the schedule stays as it was
        $this->cycles()->reconcile($user);
        $cycle->refresh();
        $this->assertNotContains('expiry_changed', collect($cycle->events)->pluck('type')->all());
        $this->assertSame('2026-10-15 10:00:00', $this->date($cycle->ends_at));
        $this->assertCount(TrafficCycle::MAX_EVENTS, $cycle->events);
    }
}
