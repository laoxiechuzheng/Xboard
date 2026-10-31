<?php

namespace Tests\Feature\TrafficCycle;

use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\TrafficResetLog;
use App\Models\User;
use App\Services\OrderService;
use App\Services\Plugin\HookManager;
use App\Services\TrafficCycleService;
use App\Utils\Helper;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Scenario helpers for the traffic cycle ledger (docs/traffic-cycle/DESIGN.md). Time is driven with
 * Carbon::setTestNow in Asia/Shanghai, like production.
 */
abstract class TrafficCycleTestCase extends TestCase
{
    use RefreshDatabase;

    protected const GB = 1073741824;
    protected const TZ = 'Asia/Shanghai';

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        HookManager::reset();
        parent::tearDown();
    }

    protected function at(string $datetime): int
    {
        $now = Carbon::parse($datetime, self::TZ);
        Carbon::setTestNow($now);

        return $now->getTimestamp();
    }

    protected function ts(string $datetime): int
    {
        return Carbon::parse($datetime, self::TZ)->getTimestamp();
    }

    protected function date(?int $timestamp): ?string
    {
        return $timestamp === null ? null : Carbon::createFromTimestamp($timestamp, self::TZ)->format('Y-m-d H:i:s');
    }

    protected function makePlan(array $attributes = []): Plan
    {
        $plan = new Plan();
        $plan->forceFill(array_merge([
            'group_id' => 1,
            'transfer_enable' => 100,
            'name' => '天穹旗舰 · 三网巅峰入口',
            'prices' => ['monthly' => 30, 'quarterly' => 85, 'yearly' => 300, 'reset_traffic' => 10],
            'reset_traffic_method' => Plan::RESET_TRAFFIC_MONTHLY,
            'sell' => true,
            'show' => true,
            'renew' => true,
        ], $attributes))->save();

        return $plan->refresh();
    }

    protected function makeUser(array $attributes = []): User
    {
        $user = new User();
        $user->forceFill(array_merge([
            'email' => Str::lower(Str::random(8)) . '@cycle.test',
            'password' => password_hash('password', PASSWORD_DEFAULT),
            'uuid' => Helper::guid(true),
            'token' => Helper::guid(),
        ], $attributes))->save();

        return $user->refresh();
    }

    protected function makeAdmin(): User
    {
        return $this->makeUser(['email' => 'admin@cycle.test', 'is_admin' => 1]);
    }

    protected function actingAsAdmin(): User
    {
        $admin = $this->makeAdmin();
        Sanctum::actingAs($admin);

        return $admin;
    }

    protected function adminApi(string $path): string
    {
        return '/api/v2/' . hash('crc32b', config('app.key')) . '/' . ltrim($path, '/');
    }

    /**
     * Pay-and-open an order the way OrderHandleJob does.
     */
    protected function openOrder(User $user, Plan $plan, string $period, int $type, array $attributes = []): Order
    {
        $order = new Order();
        $order->forceFill(array_merge([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'period' => $period,
            'trade_no' => Helper::guid(),
            'total_amount' => 1000,
            'type' => $type,
            'status' => Order::STATUS_PROCESSING,
            'paid_at' => Carbon::now()->getTimestamp(),
        ], $attributes))->save();
        (new OrderService($order))->open();

        return $order->refresh();
    }

    /**
     * Usage reported by nodes is a bulk increment (TrafficFetchJob): no model events.
     */
    protected function useTraffic(User $user, int $upload, int $download): User
    {
        User::whereKey($user->id)->update(['u' => $upload, 'd' => $download]);

        return $user->refresh();
    }

    protected function cycles(): TrafficCycleService
    {
        return app(TrafficCycleService::class);
    }

    protected function currentCycle(User $user): ?TrafficCycle
    {
        return TrafficCycle::where('user_id', $user->id)->whereNull('ended_at')->first();
    }

    protected function cyclesOf(User $user): array
    {
        return TrafficCycle::where('user_id', $user->id)->orderBy('seq')->get()->all();
    }

    /**
     * @return TrafficResetLog[]
     */
    protected function logsOf(User $user): array
    {
        return TrafficResetLog::where('user_id', $user->id)->orderBy('id')->get()->all();
    }

    protected function enableAdvancePolicy(int $minRemainingDays = 30): void
    {
        HookManager::registerFilter('traffic_cycle.advance_policy', fn($policy, $user = null) => [
            'enabled' => true,
            'min_remaining_days' => $minRemainingDays,
        ]);
    }
}
