<?php

namespace Tests\Unit\Services;

use App\Models\Plan;
use App\Services\TrafficCycleService;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * TrafficCycleService::planEnd (docs/traffic-cycle/DESIGN.md §3.1, §3.2). Pure function, no app.
 */
class TrafficCyclePlanEndTest extends TestCase
{
    private const TZ = 'Asia/Shanghai';
    private const M = 15 * 86400;

    private static function ts(string $datetime): int
    {
        return Carbon::parse($datetime, self::TZ)->getTimestamp();
    }

    private static function end(string $start, ?string $expiredAt, int $method = Plan::RESET_TRAFFIC_MONTHLY, int $minSeconds = self::M): ?string
    {
        $end = TrafficCycleService::planEnd(
            self::ts($start),
            $expiredAt === null ? null : self::ts($expiredAt),
            $method,
            $minSeconds,
            self::TZ
        );

        return $end === null ? null : Carbon::createFromTimestamp($end, self::TZ)->format('Y-m-d H:i:s');
    }

    public function test_month_end_purchase_has_no_reset_one_day_later(): void
    {
        // 10-31 + 1 month overflows to 12-01; the 11-01 boundary is only one day away
        $this->assertSame('2026-12-01 05:42:00', self::end('2026-10-31 05:42:00', '2026-12-01 05:42:00'));
        // ticket #6982: admin set the cycle on 10-31 23:03 with expiry 12-01 23:59:59
        $this->assertSame('2026-12-01 23:59:59', self::end('2026-10-31 23:03:00', '2026-12-01 23:59:59'));
    }

    public function test_quarterly_from_january_31_follows_expiry_boundaries(): void
    {
        $expiry = '2027-05-01 10:00:00';
        $this->assertSame('2027-03-01 10:00:00', self::end('2027-01-31 10:00:00', $expiry));
        $this->assertSame('2027-04-01 10:00:00', self::end('2027-03-01 10:00:00', $expiry));
        $this->assertSame('2027-05-01 10:00:00', self::end('2027-04-01 10:00:00', $expiry));
    }

    public function test_boundaries_clamp_to_month_end_in_leap_and_common_years(): void
    {
        $this->assertSame('2028-02-29 10:00:00', self::end('2028-02-01 10:00:00', '2028-03-31 10:00:00'));
        $this->assertSame('2027-02-28 10:00:00', self::end('2027-02-01 10:00:00', '2027-03-31 10:00:00'));
        // expiry on Feb 29: earlier boundaries keep the 29th where the month has it
        $this->assertSame('2028-01-29 12:00:00', self::end('2027-12-29 12:00:00', '2028-02-29 12:00:00'));
        $this->assertSame('2028-02-29 12:00:00', self::end('2028-01-29 12:00:00', '2028-02-29 12:00:00'));
    }

    public function test_boundary_closer_than_min_cycle_is_skipped(): void
    {
        // 11-20 is only 10 days after the start, so the cycle runs to 12-20
        $this->assertSame('2026-12-20 08:00:00', self::end('2026-11-10 08:00:00', '2027-02-20 08:00:00'));
        // without a minimum the legacy day-of-month boundary is used
        $this->assertSame('2026-11-20 08:00:00', self::end('2026-11-10 08:00:00', '2027-02-20 08:00:00', minSeconds: 0));
        $this->assertSame('2026-11-01 05:42:00', self::end('2026-10-31 05:42:00', '2026-12-01 05:42:00', minSeconds: 0));
    }

    public function test_remainder_shorter_than_min_cycle_is_merged_into_the_cycle(): void
    {
        $forty = 40 * 86400;
        // 12-15 is 44 days after the start, but only 31 days would be left until expiry
        $this->assertSame('2027-01-15 00:00:00', self::end('2026-11-01 00:00:00', '2027-01-15 00:00:00', minSeconds: $forty));
        // expiry closer than the minimum: one cycle until expiry
        $this->assertSame('2026-12-01 00:00:00', self::end('2026-11-25 00:00:00', '2026-12-01 00:00:00'));
    }

    public function test_yearly_method_anchors_on_expiry_and_clamps_february(): void
    {
        $this->assertSame('2027-02-28 12:00:00', self::end('2026-03-10 00:00:00', '2028-02-29 12:00:00', Plan::RESET_TRAFFIC_YEARLY));
        $this->assertSame('2028-02-29 12:00:00', self::end('2027-02-28 12:00:00', '2028-02-29 12:00:00', Plan::RESET_TRAFFIC_YEARLY));
    }

    public function test_first_day_methods_ignore_the_minimum_and_stop_at_expiry(): void
    {
        $this->assertSame('2026-11-01 00:00:00', self::end('2026-10-31 05:42:00', '2027-01-15 00:00:00', Plan::RESET_TRAFFIC_FIRST_DAY_MONTH));
        $this->assertSame('2026-12-01 00:00:00', self::end('2026-11-01 00:00:00', '2027-01-15 00:00:00', Plan::RESET_TRAFFIC_FIRST_DAY_MONTH));
        $this->assertSame('2026-12-25 00:00:00', self::end('2026-12-20 00:00:00', '2026-12-25 00:00:00', Plan::RESET_TRAFFIC_FIRST_DAY_MONTH));
        $this->assertSame('2027-01-01 00:00:00', self::end('2026-05-05 09:00:00', '2028-01-01 00:00:00', Plan::RESET_TRAFFIC_FIRST_DAY_YEAR));
    }

    #[DataProvider('unscheduledCases')]
    public function test_never_method_and_missing_expiry_are_not_scheduled(?string $expiredAt, int $method, ?string $expected): void
    {
        $this->assertSame($expected, self::end('2026-11-01 00:00:00', $expiredAt, $method));
    }

    public static function unscheduledCases(): array
    {
        return [
            'never resets: the cycle runs to expiry' => ['2027-11-01 00:00:00', Plan::RESET_TRAFFIC_NEVER, '2027-11-01 00:00:00'],
            'monthly without expiry' => [null, Plan::RESET_TRAFFIC_MONTHLY, null],
            'first day of month without expiry' => [null, Plan::RESET_TRAFFIC_FIRST_DAY_MONTH, null],
            'never without expiry' => [null, Plan::RESET_TRAFFIC_NEVER, null],
        ];
    }

    public function test_cycles_cover_a_long_subscription_without_gaps(): void
    {
        $start = self::ts('2026-01-31 10:00:00');
        $expiry = self::ts('2027-01-31 10:00:00');
        $ends = [];
        for ($i = 0; $i < 20 && $start < $expiry; $i++) {
            $end = TrafficCycleService::planEnd($start, $expiry, Plan::RESET_TRAFFIC_MONTHLY, self::M, self::TZ);
            $this->assertGreaterThanOrEqual(self::M, $end - $start);
            $ends[] = Carbon::createFromTimestamp($end, self::TZ)->format('m-d');
            $start = $end;
        }
        $this->assertSame(['02-28', '03-31', '04-30', '05-31', '06-30', '07-31', '08-31', '09-30', '10-31', '11-30', '12-31', '01-31'], $ends);
    }
}
