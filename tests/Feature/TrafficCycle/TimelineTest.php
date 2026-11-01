<?php

namespace Tests\Feature\TrafficCycle;

use App\Models\Order;
use App\Models\Plan;
use App\Models\User;
use App\Services\Plugin\HookManager;
use Laravel\Sanctum\Sanctum;

/**
 * Timeline JSON (DESIGN §7.1, §7.2) and the advance section fed by the plugin hook (§6).
 */
class TimelineTest extends TrafficCycleTestCase
{
    private const CYCLE_KEYS = [
        'id', 'seq', 'kind', 'plan_id', 'plan_name', 'quota', 'next_quota', 'u', 'd', 'used', 'remaining',
        'started_at', 'ends_at', 'ended_at', 'is_final', 'start_reason', 'end_reason', 'order_id', 'note', 'events',
    ];

    private const EVENT_KEYS = [
        'id', 'at', 'reason', 'legacy', 'trigger_source', 'cleared', 'cleared_upload', 'cleared_download', 'carried',
        'quota_before', 'quota_after', 'expired_before', 'expired_after', 'shift_seconds', 'cycle_id', 'order_id', 'note',
    ];

    private function subscribedUser(): User
    {
        $plan = $this->makePlan(['id' => 19]);
        $user = $this->makeUser();
        $this->at('2026-01-10 08:00:00');
        $this->openOrder($user, $plan, Plan::PERIOD_YEARLY, Order::TYPE_NEW_PURCHASE);
        $this->useTraffic($user, self::GB, 9 * self::GB);
        $this->at('2026-02-10 08:00:30');
        $this->artisan('reset:traffic')->assertSuccessful();
        $this->useTraffic($user, 0, 4 * self::GB);
        $this->at('2026-03-10 08:00:30');
        $this->artisan('reset:traffic')->assertSuccessful();
        $this->useTraffic($user, 0, 2 * self::GB);
        $this->at('2026-03-20 12:00:00');

        return $user->refresh();
    }

    public function test_user_timeline_matches_the_design_shape(): void
    {
        $user = $this->subscribedUser();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/user/trafficCycle/fetch?history_size=1&events_size=1')
            ->assertOk()
            ->assertJsonStructure([
                'status',
                'data' => [
                    'now', 'user_id', 'plan' => ['id', 'name', 'quota'], 'expired_at', 'reset_method', 'min_cycle_days',
                    'current' => self::CYCLE_KEYS,
                    'upcoming' => [['index', 'starts_at', 'ends_at', 'quota', 'is_final']],
                    'advance' => ['enabled', 'reason'],
                    'history' => [self::CYCLE_KEYS],
                    'history_total',
                    'events' => [self::EVENT_KEYS],
                    'events_total',
                ],
            ]);
        $data = $response->json('data');

        $this->assertSame($this->ts('2026-03-20 12:00:00'), $data['now']);
        $this->assertSame($user->id, $data['user_id']);
        $this->assertSame(['id' => 19, 'name' => '天穹旗舰 · 三网巅峰入口', 'quota' => 100 * self::GB], $data['plan']);
        $this->assertSame('monthly', $data['reset_method']);
        $this->assertSame(15, $data['min_cycle_days']);
        $this->assertSame(3, $data['current']['seq']);
        $this->assertSame(2 * self::GB, $data['current']['used']);
        $this->assertSame(98 * self::GB, $data['current']['remaining']);
        $this->assertSame('2026-04-10 08:00:00', $this->date($data['current']['ends_at']));
        $this->assertFalse($data['current']['is_final']);
        // 04-10 … 2027-01-10: nine more cycles, the last one is final
        $this->assertCount(9, $data['upcoming']);
        $this->assertTrue(end($data['upcoming'])['is_final']);
        $this->assertSame($data['expired_at'], end($data['upcoming'])['ends_at']);
        $this->assertSame(['enabled' => false, 'reason' => 'disabled'], $data['advance']);
        $this->assertSame(2, $data['history_total']);
        $this->assertCount(1, $data['history']);
        $this->assertSame(2, $data['history'][0]['seq']);
        $this->assertSame(4 * self::GB, $data['history'][0]['used']);
        $this->assertSame('rollover', $data['history'][0]['end_reason']);
        $this->assertSame(2, $data['events_total']);
        $this->assertSame('cycle_rollover', $data['events'][0]['reason']);
        $this->assertFalse($data['events'][0]['legacy']);
        $this->assertSame(4 * self::GB, $data['events'][0]['cleared']);

        $page2 = $this->getJson('/api/v1/user/trafficCycle/fetch?history_size=1&history_page=2')->json('data.history');
        $this->assertSame(1, $page2[0]['seq']);
        $this->getJson('/api/v1/user/trafficCycle/fetch?history_size=51')->assertStatus(422);
    }

    public function test_user_timeline_hides_admin_ids_and_has_no_expiry_without_a_plan(): void
    {
        $user = $this->subscribedUser();
        $admin = $this->makeAdmin();
        Sanctum::actingAs($admin);
        $this->postJson($this->adminApi('user/update'), [
            'id' => $user->id,
            'transfer_enable' => 150 * self::GB,
            'cycle_quota_scope' => 'cycle',
            'cycle_note' => '补偿',
        ])->assertOk();

        $adminEvents = $this->cycles()->timeline($user->refresh(), ['admin' => true])['current']['events'];
        $this->assertSame($admin->id, collect($adminEvents)->firstWhere('type', 'quota_changed')['admin_id']);
        $userEvents = $this->cycles()->timeline($user)['current']['events'];
        $this->assertNotEmpty($userEvents);
        foreach ($userEvents as $event) {
            $this->assertArrayNotHasKey('admin_id', $event);
        }

        // the column default 0 of a user who never subscribed is not a date
        $timeline = $this->cycles()->timeline($this->makeUser(['expired_at' => 0]));
        $this->assertNull($timeline['plan']);
        $this->assertNull($timeline['expired_at']);
        $this->assertNull($timeline['current']);
    }

    public function test_advance_section_follows_the_plugin_policy(): void
    {
        $user = $this->subscribedUser();

        // the core passes the user as the hook's extra argument: HookManager::filter($hook, null, $user)
        HookManager::registerFilter('traffic_cycle.advance_policy', fn($policy, $subject = null) => $subject instanceof User
            ? ['enabled' => true, 'min_remaining_days' => 30]
            : null);
        $advance = $this->cycles()->timeline($user)['advance'];
        $this->assertSame(true, $advance['enabled']);
        $this->assertSame(30, $advance['min_remaining_days']);
        $this->assertTrue($advance['eligible_if_exhausted']);
        $this->assertSame('eligible', $advance['reason']);
        $shift = $this->ts('2026-04-10 08:00:00') - $this->ts('2026-03-20 12:00:00');
        $this->assertSame($shift, $advance['shift_seconds']);
        $this->assertSame(100 * self::GB, $advance['next_quota']);
        $this->assertSame($this->ts('2027-01-10 08:00:00') - $shift, $advance['expired_after']);

        // eligibility reasons
        $this->assertSame('remaining_too_short', $this->cycles()->advanceEligibility($user, 400)['reason']);
        $this->at('2026-12-20 00:00:00');
        $this->artisan('reset:traffic')->assertSuccessful();
        $this->assertSame('final_cycle', $this->cycles()->advanceEligibility($user->refresh(), 1)['reason']);
        $noPlan = $this->makeUser();
        $this->assertSame('no_cycle', $this->cycles()->advanceEligibility($noPlan, 30)['reason']);
        $refused = $this->cycles()->advance($noPlan, ['source' => 'test'], 30);
        $this->assertFalse($refused['ok']);
        $this->assertSame($refused['before'], $refused['after']);
        $this->assertNull($refused['reset_log_id']);
    }
}
