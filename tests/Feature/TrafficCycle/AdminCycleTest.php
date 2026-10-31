<?php

namespace Tests\Feature\TrafficCycle;

use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\TrafficResetLog;
use App\Models\User;
use Carbon\Carbon;

/**
 * Admin paths: DESIGN §3.6, §7.2.
 */
class AdminCycleTest extends TrafficCycleTestCase
{
    private Plan $plan;
    private User $user;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->plan = $this->makePlan();
        $this->user = $this->makeUser();
        $this->at('2026-09-15 10:00:00');
        $this->openOrder($this->user, $this->plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);
        $this->useTraffic($this->user, 10 * self::GB, 20 * self::GB);
        $this->admin = $this->actingAsAdmin();
        $this->at('2026-09-20 10:00:00');
    }

    private function update(array $params): \Illuminate\Testing\TestResponse
    {
        return $this->postJson($this->adminApi('user/update'), ['id' => $this->user->id] + $params);
    }

    public function test_official_admin_edit_keeps_the_cycle_and_changes_the_standing_quota(): void
    {
        $cycle = $this->currentCycle($this->user);
        // the official admin sends the whole form, no cycle options
        $this->update([
            'email' => $this->user->email,
            'plan_id' => $this->plan->id,
            'transfer_enable' => 150 * self::GB,
            'expired_at' => $this->user->refresh()->expired_at,
            'u' => 10 * self::GB,
            'd' => 20 * self::GB,
            'banned' => 0,
        ])->assertOk();

        $cycle->refresh();
        $this->assertSame($cycle->id, $this->currentCycle($this->user)->id);
        $this->assertSame(TrafficCycle::KIND_STANDARD, $cycle->kind);
        $this->assertSame(150 * self::GB, $cycle->quota);
        $this->assertSame(150 * self::GB, $cycle->next_quota);
        $this->assertSame('2026-10-15 10:00:00', $this->date($cycle->ends_at));
        $event = collect($cycle->events)->last();
        $this->assertSame(['quota_changed', 'admin', 'standing'], [$event['type'], $event['by'], $event['scope']]);
        $this->assertSame($this->admin->id, $event['admin_id']);
        $this->assertSame(30 * self::GB, $this->user->refresh()->u + $this->user->d);
        $this->assertSame([], $this->logsOf($this->user));
    }

    public function test_cycle_scope_makes_a_special_cycle_that_rolls_back_to_the_plan_quota(): void
    {
        $this->update(['transfer_enable' => 50 * self::GB, 'cycle_quota_scope' => 'cycle', 'cycle_note' => '补偿'])->assertOk();
        $cycle = $this->currentCycle($this->user);
        $this->assertSame(TrafficCycle::KIND_SPECIAL, $cycle->kind);
        $this->assertSame(50 * self::GB, $cycle->quota);
        $this->assertSame(100 * self::GB, $cycle->next_quota);
        $this->assertSame('补偿', $cycle->note);
        $this->assertSame(30 * self::GB, $this->user->refresh()->u + $this->user->d);

        $this->at('2026-10-15 10:00:30');
        $this->artisan('reset:traffic')->assertSuccessful();
        $next = $this->currentCycle($this->user);
        $this->assertSame(TrafficCycle::KIND_STANDARD, $next->kind);
        $this->assertSame(100 * self::GB, $next->quota);
        $this->assertSame(100 * self::GB, (int) $this->user->refresh()->transfer_enable);
    }

    public function test_restart_keeps_a_special_cycle_special_and_clears_usage(): void
    {
        $this->update(['transfer_enable' => 50 * self::GB, 'cycle_quota_scope' => 'cycle'])->assertOk();
        $special = $this->currentCycle($this->user);
        $resetCount = (int) $this->user->refresh()->reset_count;

        $now = $this->at('2026-09-25 08:00:00');
        $this->update(['cycle_mode' => 'restart'])->assertOk();

        $special->refresh();
        $restarted = $this->currentCycle($this->user);
        $this->user->refresh();
        $this->assertSame(TrafficCycle::REASON_REPLACED, $special->end_reason);
        $this->assertSame(TrafficCycle::REASON_ADMIN, $restarted->start_reason);
        $this->assertSame(TrafficCycle::KIND_SPECIAL, $restarted->kind);
        $this->assertSame(50 * self::GB, $restarted->quota);
        $this->assertSame(100 * self::GB, $restarted->next_quota);
        $this->assertSame($now, $restarted->started_at);
        // planEnd(now, 12-15 10:00): 10-15 is 20 days away
        $this->assertSame('2026-10-15 10:00:00', $this->date($restarted->ends_at));
        $this->assertSame(0, $this->user->u + $this->user->d);
        $this->assertSame($resetCount + 1, (int) $this->user->reset_count);
        $log = collect($this->logsOf($this->user))->last();
        $this->assertSame(TrafficResetLog::REASON_ADMIN_RESTART, $log->metadata['reason']);
        $this->assertSame(30 * self::GB, (int) $log->old_total);
        $this->assertSame($this->admin->id, $log->metadata['admin_id']);
    }

    public function test_restart_with_standing_quota_and_custom_end(): void
    {
        $endsAt = $this->ts('2026-11-01 00:00:00');
        $this->update([
            'transfer_enable' => 200 * self::GB,
            'cycle_mode' => 'restart',
            'cycle_quota_scope' => 'standing',
            'cycle_ends_at' => $endsAt,
        ])->assertOk();

        $cycle = $this->currentCycle($this->user);
        $this->assertSame(TrafficCycle::KIND_STANDARD, $cycle->kind);
        $this->assertSame(200 * self::GB, $cycle->quota);
        $this->assertSame(200 * self::GB, $cycle->next_quota);
        $this->assertSame($endsAt, $cycle->ends_at);
        $this->assertSame($endsAt, $this->user->refresh()->next_reset_at);
    }

    public function test_lowering_usage_writes_an_admin_usage_edit_log(): void
    {
        $cycle = $this->currentCycle($this->user);
        $this->update(['u' => 0, 'd' => 10 * self::GB])->assertOk();

        $this->user->refresh();
        $this->assertSame(10 * self::GB, $this->user->u + $this->user->d);
        $this->assertSame(0, (int) $this->user->reset_count);
        $log = $this->logsOf($this->user)[0];
        $this->assertSame(TrafficResetLog::REASON_ADMIN_USAGE_EDIT, $log->metadata['reason']);
        $this->assertSame(TrafficResetLog::TYPE_MANUAL, $log->reset_type);
        $this->assertSame(30 * self::GB, (int) $log->old_total);
        $this->assertSame(10 * self::GB, (int) $log->new_total);
        $this->assertSame(20 * self::GB, $log->cycleFields()['cleared']);
        $event = collect($cycle->refresh()->events)->last();
        $this->assertSame(['usage_cleared', 20 * self::GB, $log->id], [$event['type'], $event['cleared'], $event['log_id']]);
        $this->assertSame($cycle->id, $this->currentCycle($this->user)->id);
    }

    public function test_restart_with_usage_typed_as_zero_is_a_restart(): void
    {
        // ticket #6982: quota changed, "已用" typed as 0 and the cycle restarted in one save
        $old = $this->currentCycle($this->user);
        $this->update([
            'u' => 0,
            'd' => 0,
            'transfer_enable' => 40 * self::GB,
            'cycle_mode' => 'restart',
            'cycle_quota_scope' => 'cycle',
        ])->assertOk();

        $this->user->refresh();
        $this->assertSame(0, $this->user->u + $this->user->d);
        $this->assertSame(1, (int) $this->user->reset_count);
        $this->assertSame($this->ts('2026-09-20 10:00:00'), (int) $this->user->last_reset_at);
        $logs = $this->logsOf($this->user);
        $this->assertCount(1, $logs);
        $this->assertSame(TrafficResetLog::REASON_ADMIN_RESTART, $logs[0]->metadata['reason']);
        $this->assertSame(30 * self::GB, (int) $logs[0]->old_total);
        $this->assertSame($old->id, $logs[0]->metadata['prev_cycle_id']);

        // a usage other than 0 typed while restarting is still an edit of the usage
        $this->useTraffic($this->user, 0, 20 * self::GB);
        $this->update(['u' => 0, 'd' => 5 * self::GB, 'cycle_mode' => 'restart'])->assertOk();
        $this->assertSame(TrafficResetLog::REASON_ADMIN_USAGE_EDIT, collect($this->logsOf($this->user))->last()->metadata['reason']);
        $this->assertSame(5 * self::GB, $this->user->refresh()->u + $this->user->d);
    }

    public function test_an_end_before_now_is_reported_once_in_plain_words(): void
    {
        $endsAt = $this->ts('2026-09-19 00:00:00');
        $warnings = $this->getJson($this->adminApi('user/trafficCycle/preview') . '?' . http_build_query([
            'id' => $this->user->id,
            'cycle_mode' => 'restart',
            'cycle_ends_at' => $endsAt,
        ]))->assertOk()->json('data.warnings');
        $this->assertSame(['ends_before_now', 'invalid'], array_column($warnings, 'type'));
        $this->assertSame('本周期结束时间必须晚于当前时间', $warnings[1]['message']);

        $this->update(['cycle_mode' => 'restart', 'cycle_ends_at' => $endsAt])
            ->assertStatus(422)
            ->assertJsonPath('message', '本周期结束时间必须晚于当前时间');
        $this->update(['cycle_ends_at' => $this->ts('2026-10-01 00:00:00')])
            ->assertStatus(422)
            ->assertJsonPath('message', '只有选择“从现在重新开始”时才能指定本周期结束时间');
    }

    public function test_reset_logs_can_be_filtered_by_order_and_gift_card_sources(): void
    {
        $this->legacyLogs();
        $orders = $this->getJson($this->adminApi('traffic-reset/logs') . '?trigger_source=order')->assertOk()->json();
        $this->assertSame(1, $orders['pagination']['total']);
        $this->assertNotSame('order', $orders['data'][0]['trigger_source_name']);
        $gifts = $this->getJson($this->adminApi('traffic-reset/logs') . '?trigger_source=gift_card')->assertOk()->json();
        $this->assertSame(0, $gifts['pagination']['total']);
    }

    public function test_invalid_cycle_options_change_nothing(): void
    {
        $cycle = $this->currentCycle($this->user)->getAttributes();
        $row = User::find($this->user->id)->getAttributes();
        $expiry = $this->user->refresh()->expired_at;

        $this->update(['cycle_ends_at' => $expiry])->assertStatus(422);
        $this->update(['cycle_mode' => 'restart', 'cycle_ends_at' => $expiry + 86400])->assertStatus(422);
        $this->update(['cycle_mode' => 'restart', 'cycle_ends_at' => $this->ts('2026-09-19 00:00:00')])->assertStatus(422);
        $this->update(['cycle_mode' => 'later'])->assertStatus(422);
        $this->update(['cycle_note' => str_repeat('注', 121)])->assertStatus(422);

        $this->assertSame($cycle, $this->currentCycle($this->user)->getAttributes());
        $this->assertSame($row, User::find($this->user->id)->getAttributes());
    }

    public function test_preview_reports_effects_without_writing(): void
    {
        $before = [
            'cycles' => TrafficCycle::count(),
            'cycle' => $this->currentCycle($this->user)->getAttributes(),
            'logs' => TrafficResetLog::count(),
            'user' => User::find($this->user->id)->getAttributes(),
        ];
        $endsAt = $this->ts('2026-12-01 23:59:59');

        $data = $this->getJson($this->adminApi('user/trafficCycle/preview') . '?' . http_build_query([
            'id' => $this->user->id,
            'transfer_enable' => 40 * self::GB,
            'expired_at' => $endsAt,
            'cycle_mode' => 'restart',
            'cycle_quota_scope' => 'cycle',
            'cycle_ends_at' => $endsAt,
            'cycle_note' => '中型芒果剩余价值等值转换',
        ]))->assertOk()->json('data');

        $this->assertSame('special', $data['current']['kind']);
        $this->assertNull($data['current']['id']);
        $this->assertSame(40 * self::GB, $data['current']['quota']);
        $this->assertSame(100 * self::GB, $data['current']['next_quota']);
        $this->assertSame(0, $data['current']['used']);
        $this->assertSame($endsAt, $data['current']['ends_at']);
        $this->assertTrue($data['current']['is_final']);
        $this->assertSame([], $data['upcoming']);
        $types = array_column($data['effects'], 'type');
        foreach (['cycle_restart', 'quota_cycle_only', 'expiry_changed', 'usage_cleared', 'ends_changed'] as $type) {
            $this->assertContains($type, $types);
        }
        $this->assertSame([], $data['warnings']);

        $this->assertSame($before, [
            'cycles' => TrafficCycle::count(),
            'cycle' => $this->currentCycle($this->user)->getAttributes(),
            'logs' => TrafficResetLog::count(),
            'user' => User::find($this->user->id)->getAttributes(),
        ]);

        $warnings = $this->getJson($this->adminApi('user/trafficCycle/preview') . '?' . http_build_query([
            'id' => $this->user->id,
            'transfer_enable' => 20 * self::GB,
            'cycle_mode' => 'restart',
            'cycle_ends_at' => $this->ts('2026-09-25 10:00:00'),
            'u' => 30 * self::GB,
        ]))->assertOk()->json('data.warnings');
        $this->assertSame(['quota_below_used', 'short_cycle'], array_column($warnings, 'type'));

        $plan = $this->getJson($this->adminApi('user/trafficCycle/preview') . '?' . http_build_query([
            'id' => $this->user->id,
            'plan_id' => '',
        ]))->assertOk()->json('data');
        $this->assertNull($plan['current']);
        $this->assertSame(['no_plan'], array_column($plan['warnings'], 'type'));

        $this->assertSame($before['cycles'], TrafficCycle::count());
    }

    public function test_admin_timeline_shows_noise_rows_and_the_user_block(): void
    {
        $this->legacyLogs();
        $data = $this->getJson($this->adminApi('user/trafficCycle/fetch') . '?user_id=' . $this->user->id)
            ->assertOk()
            ->assertJsonStructure(['data' => [
                'now', 'user_id', 'plan', 'expired_at', 'reset_method', 'min_cycle_days', 'current', 'upcoming',
                'advance', 'history', 'history_total', 'events' => [['id', 'reason', 'is_noise', 'admin_id', 'metadata', 'cleared']],
                'events_total',
                'user' => ['id', 'email', 'transfer_enable', 'u', 'd', 'expired_at', 'next_reset_at', 'last_reset_at', 'reset_count'],
            ]])
            ->json('data');
        $this->getJson($this->adminApi('user/trafficCycle/fetch') . '?user_id=999999')->assertStatus(400);

        $this->assertSame($this->user->email, $data['user']['email']);
        $this->assertSame(30 * self::GB, $data['user']['u'] + $data['user']['d']);
        $this->assertSame(3, $data['events_total']);
        $noise = collect($data['events'])->where('is_noise', true);
        $this->assertCount(2, $noise);
        $this->assertArrayHasKey('metadata', $data['events'][0]);
        $this->assertArrayHasKey('admin_id', $data['events'][0]);

        // the user sees only the meaningful row
        \Laravel\Sanctum\Sanctum::actingAs($this->user);
        $user = $this->getJson('/api/v1/user/trafficCycle/fetch')->assertOk()->json('data');
        $this->assertSame(1, $user['events_total']);
        $this->assertSame('cycle_rollover', $user['events'][0]['reason']);
        $this->assertTrue($user['events'][0]['legacy']);
        $this->assertArrayNotHasKey('is_noise', $user['events'][0]);
        $this->assertArrayNotHasKey('user', $user);
    }

    public function test_reset_logs_endpoint_hides_noise_and_filters_by_reason(): void
    {
        $this->legacyLogs();
        TrafficResetLog::create([
            'user_id' => $this->user->id,
            'reset_type' => TrafficResetLog::TYPE_MONTHLY,
            'reset_time' => Carbon::now(),
            'old_upload' => 0,
            'old_download' => 0,
            'old_total' => 0,
            'trigger_source' => TrafficResetLog::SOURCE_MANUAL,
            'metadata' => TrafficResetLog::buildMetadata(['reason' => 'auto_advance', 'cleared' => 40 * self::GB, 'shift_seconds' => 993599]),
        ]);

        $all = $this->getJson($this->adminApi('traffic-reset/logs'))->assertOk()->json();
        $this->assertSame(4, $all['pagination']['total']);
        $row = $all['data'][0];
        foreach (['id', 'user_email', 'reset_type_name', 'old_traffic', 'trigger_source_name', 'metadata', 'reason', 'is_noise', 'cycle_id', 'order_id', 'admin_id', 'note', 'cleared', 'quota_before', 'quota_after', 'expired_before', 'expired_after', 'shift_seconds'] as $key) {
            $this->assertArrayHasKey($key, $row);
        }
        $this->assertSame('auto_advance', $row['reason']);
        $this->assertSame(40 * self::GB, $row['cleared']);
        $this->assertFalse($row['is_noise']);

        $visible = $this->getJson($this->adminApi('traffic-reset/logs') . '?hide_noise=1')->assertOk()->json();
        $this->assertSame(2, $visible['pagination']['total']);
        $this->assertSame(['auto_advance', 'cycle_rollover'], array_column($visible['data'], 'reason'));

        $rollovers = $this->getJson($this->adminApi('traffic-reset/logs') . '?reason=cycle_rollover')->assertOk()->json();
        $this->assertSame(1, $rollovers['pagination']['total']);
        $orders = $this->getJson($this->adminApi('traffic-reset/logs') . '?reason=order_reset&hide_noise=0')->assertOk()->json();
        $this->assertSame(1, $orders['pagination']['total']);
        $this->assertTrue($orders['data'][0]['is_noise']);
        $this->getJson($this->adminApi('traffic-reset/logs') . '?reason=unknown')->assertStatus(422);
    }

    public function test_manual_reset_records_the_admin_and_the_reason_text(): void
    {
        $cycle = $this->currentCycle($this->user);
        $this->postJson($this->adminApi('traffic-reset/reset-user'), [
            'user_id' => $this->user->id,
            'reason' => '工单 #7001 补偿',
        ])->assertOk();

        $log = $this->logsOf($this->user)[0];
        $this->assertSame(TrafficResetLog::REASON_ADMIN_RESET, $log->metadata['reason']);
        $this->assertSame($this->admin->id, $log->metadata['admin_id']);
        $this->assertSame('工单 #7001 补偿', $log->metadata['note']);
        $this->assertSame($cycle->id, $log->metadata['cycle_id']);
        $event = collect($cycle->refresh()->events)->last();
        $this->assertSame(['usage_cleared', 'admin', $this->admin->id], [$event['type'], $event['by'], $event['admin_id']]);

        // the reason text is for admins; the user timeline shows the row without it
        $this->assertSame('工单 #7001 补偿', $this->cycles()->timeline($this->user, ['admin' => true])['events'][0]['note']);
        $userEvent = $this->cycles()->timeline($this->user)['events'][0];
        $this->assertSame('admin_reset', $userEvent['reason']);
        $this->assertNull($userEvent['note']);
    }

    private function legacyLogs(): void
    {
        $base = [
            'user_id' => $this->user->id,
            'reset_type' => TrafficResetLog::TYPE_MONTHLY,
            'old_upload' => 0,
            'old_download' => 0,
            'new_upload' => 0,
            'new_download' => 0,
            'new_total' => 0,
        ];
        // new purchase reset twice (0 B), the plugin's 0 B row, one real rollover
        TrafficResetLog::create($base + ['reset_time' => Carbon::parse('2026-07-15 10:00:00', self::TZ), 'old_total' => 0, 'trigger_source' => TrafficResetLog::SOURCE_ORDER]);
        TrafficResetLog::create($base + ['reset_time' => Carbon::parse('2026-08-02 12:00:00', self::TZ), 'old_total' => 0, 'trigger_source' => TrafficResetLog::SOURCE_MANUAL]);
        TrafficResetLog::create(['old_download' => 70 * self::GB] + $base + ['reset_time' => Carbon::parse('2026-08-15 10:00:00', self::TZ), 'old_total' => 70 * self::GB, 'trigger_source' => TrafficResetLog::SOURCE_CRON]);
    }
}
