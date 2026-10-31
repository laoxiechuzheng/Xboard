<?php

namespace Tests\Feature\TrafficCycle;

use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficResetLog;
use App\Models\User;

/**
 * Guards around advance (DESIGN §3.7): stale triggers, traceability, and the users the plugin sweeps.
 */
class AdvanceGuardTest extends TrafficCycleTestCase
{
    private Plan $plan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->plan = $this->makePlan();
    }

    /**
     * Quarterly from 09-15 10:00 (expiry 12-15 10:00), cycles end on the 15th; at 09-25 10:00 the
     * user has 81 days left.
     */
    private function subscriber(string $period = Plan::PERIOD_QUARTERLY, int $used = 100): User
    {
        $this->at('2026-09-15 10:00:00');
        $user = $this->makeUser();
        $this->openOrder($user, $this->plan, $period, Order::TYPE_NEW_PURCHASE);

        return $this->useTraffic($user, 10 * self::GB, ($used - 10) * self::GB);
    }

    public function test_a_stale_trigger_cannot_burn_the_cycle_it_just_opened(): void
    {
        $user = $this->subscriber();
        $this->at('2026-09-25 10:00:00');
        // a second node report read the user row before the first one advanced it
        $stale = User::find($user->id);

        $first = $this->cycles()->advance($user, ['source' => 'traffic_report', 'pending_bytes' => 0], 30);
        $this->assertTrue($first['ok']);
        $expiry = (int) $user->refresh()->expired_at;
        $this->assertSame('2026-11-25 10:00:00', $this->date($expiry));

        $second = $this->cycles()->advance($stale, ['source' => 'traffic_report', 'pending_bytes' => self::GB], 30);
        $this->assertFalse($second['ok']);
        $this->assertSame('not_exhausted', $second['reason']);
        $this->assertSame($expiry, (int) $user->refresh()->expired_at);
        $this->assertSame($first['new_cycle_id'], $this->currentCycle($user)->id);
        $this->assertCount(1, $this->logsOf($user));

        // the report that crosses the quota counts: 99.5 GB stored + 1 GB about to be added
        $this->useTraffic($user, 0, 99 * self::GB + 512 * 1048576);
        $third = $this->cycles()->advance($user->refresh(), ['source' => 'traffic_report', 'pending_bytes' => self::GB], 30);
        $this->assertTrue($third['ok']);
    }

    public function test_an_advance_is_logged_even_when_nothing_was_used(): void
    {
        $user = $this->subscriber(Plan::PERIOD_QUARTERLY, 0);
        $this->at('2026-09-25 10:00:00');
        // a caller that does not pass pending_bytes vouches for the exhaustion itself
        $result = $this->cycles()->advance($user, ['source' => 'test'], 30);
        $this->assertTrue($result['ok']);

        $log = TrafficResetLog::find($result['reset_log_id']);
        $this->assertNotNull($log);
        $this->assertSame(0, (int) $log->old_total);
        $this->assertSame(TrafficResetLog::REASON_AUTO_ADVANCE, $log->metadata['reason']);
        $this->assertSame($result['shift_seconds'], $log->metadata['shift_seconds']);
        $this->assertFalse($log->isNoise());
        // the expiry moved, so the user sees the row
        $this->assertSame('auto_advance', $this->cycles()->timeline($user->refresh())['events'][0]['reason']);
    }

    public function test_exhausted_candidates_are_the_users_who_could_advance_now(): void
    {
        $eligible = $this->subscriber();
        $light = $this->subscriber(Plan::PERIOD_QUARTERLY, 10);
        $banned = $this->subscriber();
        User::whereKey($banned->id)->update(['banned' => 1]);
        // one month bought, then extended by 10 days: the remainder is merged, so the cycle is the final one
        $final = $this->subscriber(Plan::PERIOD_MONTHLY);
        User::whereKey($final->id)->update(['expired_at' => $this->ts('2026-10-25 10:00:00')]);
        $this->cycles()->reconcile($final->refresh());
        $this->assertSame('2026-10-25 10:00:00', $this->date($this->currentCycle($final)->ends_at));
        $this->at('2026-09-25 10:00:00');

        $ids = fn(int $days) => $this->cycles()->exhaustedCandidates($days)->pluck('id')->all();
        $this->assertSame([$eligible->id], $ids(30));
        // 81 days left
        $this->assertSame([], $ids(90));

        $this->cycles()->advance($eligible, ['source' => 'sweep', 'pending_bytes' => 0], 30);
        $this->assertSame([], $ids(30));
        $this->assertNotContains($light->id, $ids(0));
    }
}
