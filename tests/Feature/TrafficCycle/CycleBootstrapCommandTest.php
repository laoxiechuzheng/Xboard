<?php

namespace Tests\Feature\TrafficCycle;

use App\Models\AdminAuditLog;
use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\TrafficResetLog;
use App\Models\User;
use App\Utils\Helper;
use Carbon\Carbon;
use Illuminate\Support\Facades\File;

/**
 * traffic:cycle-bootstrap (DESIGN §10.2) and the JSONL import (§4.2) on synthetic legacy data.
 */
class CycleBootstrapCommandTest extends TrafficCycleTestCase
{
    private string $dir;
    private Plan $plan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = storage_path('framework/testing/cycle-bootstrap-' . uniqid());
        File::ensureDirectoryExists($this->dir);
        $this->plan = $this->makePlan();
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->dir);
        parent::tearDown();
    }

    /**
     * A user written before the ledger existed (no model events, so no cycle).
     */
    private function legacyUser(string $email, array $attributes): User
    {
        return User::withoutEvents(fn() => $this->makeUser(array_merge(
            ['email' => $email, 'plan_id' => $this->plan->id, 'transfer_enable' => 100 * self::GB],
            $attributes
        )));
    }

    private function seedLegacy(): array
    {
        $this->at('2026-09-15 10:00:00');
        $normal = $this->legacyUser('boot-normal@cycle.test', [
            'expired_at' => $this->ts('2026-12-15 10:00:00'),
            'next_reset_at' => $this->ts('2026-11-15 10:00:00'),
        ]);
        $this->completedOrder($normal, Order::TYPE_NEW_PURCHASE, '2026-09-15 10:00:00');
        TrafficResetLog::create([
            'user_id' => $normal->id,
            'reset_type' => TrafficResetLog::TYPE_MONTHLY,
            'reset_time' => Carbon::parse('2026-10-15 10:00:01', self::TZ),
            'old_total' => 50 * self::GB,
            'old_download' => 50 * self::GB,
            'trigger_source' => TrafficResetLog::SOURCE_CRON,
        ]);

        // ticket #6982 before the interim fix: expiry set by the admin, legacy reset the next day
        $short = $this->legacyUser('boot-short@cycle.test', [
            'transfer_enable' => 40 * self::GB,
            'expired_at' => $this->ts('2026-12-01 23:59:59'),
            'next_reset_at' => $this->ts('2026-11-01 23:59:59'),
        ]);
        $this->completedOrder($short, Order::TYPE_NEW_PURCHASE, '2026-10-01 10:00:00');
        $this->adminEdit($short, '2026-10-20 09:00:00', ['expired_at' => $this->ts('2026-11-01 10:00:00'), 'remarks' => 'a']);
        $this->adminEdit($short, '2026-10-31 23:03:00', ['expired_at' => $this->ts('2026-12-01 23:59:59'), 'transfer_enable' => 40 * self::GB, 'remarks' => 'a']);

        // an unrelated later admin edit must not move the start of a regular cycle
        $edited = $this->legacyUser('boot-edited@cycle.test', [
            'expired_at' => $this->ts('2027-01-20 08:00:00'),
            'next_reset_at' => $this->ts('2026-11-05 08:00:00'),
        ]);
        $this->completedOrder($edited, Order::TYPE_NEW_PURCHASE, '2026-07-20 08:00:00');
        $this->adminEdit($edited, '2026-09-01 08:00:00', ['expired_at' => $this->ts('2027-01-20 08:00:00'), 'transfer_enable' => 100 * self::GB, 'remarks' => 'x']);
        $this->adminEdit($edited, '2026-10-28 08:00:00', ['expired_at' => $this->ts('2027-01-20 08:00:00'), 'transfer_enable' => 100 * self::GB, 'remarks' => 'y']);

        $final = $this->legacyUser('boot-final@cycle.test', [
            'expired_at' => $this->ts('2026-11-20 10:00:00'),
            'next_reset_at' => $this->ts('2026-11-20 10:00:00'),
        ]);
        $onetime = $this->legacyUser('boot-onetime@cycle.test', ['expired_at' => null]);
        $this->legacyUser('boot-expired@cycle.test', ['expired_at' => $this->ts('2026-10-01 00:00:00')]);

        $this->at('2026-10-05 10:00:00');
        $existing = $this->makeUser(['email' => 'boot-existing@cycle.test']);
        $this->openOrder($existing, $this->plan, Plan::PERIOD_QUARTERLY, Order::TYPE_NEW_PURCHASE);

        return compact('normal', 'short', 'edited', 'final', 'onetime', 'existing');
    }

    private function completedOrder(User $user, int $type, string $paidAt): void
    {
        $order = new Order();
        $order->forceFill([
            'user_id' => $user->id,
            'plan_id' => $this->plan->id,
            'period' => Plan::PERIOD_MONTHLY,
            'trade_no' => Helper::guid(),
            'total_amount' => 1000,
            'type' => $type,
            'status' => Order::STATUS_COMPLETED,
            'paid_at' => $this->ts($paidAt),
        ])->save();
    }

    private function adminEdit(User $user, string $at, array $data): void
    {
        AdminAuditLog::insert([
            'admin_id' => 1,
            'action' => 'user.update',
            'method' => 'POST',
            'uri' => '/api/v2/secure/user/update',
            'request_data' => json_encode(['id' => $user->id, 'plan_id' => $this->plan->id] + $data),
            'ip' => '127.0.0.1',
            'created_at' => $this->ts($at),
            'updated_at' => $this->ts($at),
        ]);
    }

    private function report(array $options): array
    {
        $path = $this->dir . '/report-' . uniqid() . '.json';
        $this->artisan('traffic:cycle-bootstrap', $options + ['--report' => $path])->assertSuccessful();

        return json_decode(File::get($path), true);
    }

    private function row(array $report, User $user): array
    {
        return collect($report['users'])->firstWhere('user_id', $user->id);
    }

    public function test_dry_run_reports_without_writing_and_apply_creates_the_cycles(): void
    {
        $users = $this->seedLegacy();
        $now = $this->at('2026-11-01 00:30:00');
        $cyclesBefore = TrafficCycle::count();

        $dry = $this->report(['--fix-short' => true]);
        $this->assertSame('dry-run', $dry['mode']);
        $this->assertSame(TrafficCycle::count(), $cyclesBefore);
        $this->assertSame(6, $dry['summary']['users_scanned']);
        $this->assertSame(1, $dry['summary']['skipped_existing']);
        $this->assertSame(5, $dry['summary']['cycles']);
        $this->assertSame(1, $dry['summary']['short_fixed']);
        $this->assertSame($this->ts('2026-11-01 23:59:59'), $users['short']->refresh()->next_reset_at);

        $short = $this->row($dry, $users['short']);
        $this->assertSame('admin_update', $short['start_source']);
        $this->assertSame($this->ts('2026-10-31 23:03:00'), $short['started_at']);
        $this->assertSame(['ends_before' => $this->ts('2026-11-01 23:59:59'), 'ends_after' => $this->ts('2026-12-01 23:59:59')], $short['short_fix']);
        $this->assertTrue($short['is_final']);
        $this->assertNull($short['next_reset_after']);

        $normal = $this->row($dry, $users['normal']);
        $this->assertSame('scheduled_reset', $normal['start_source']);
        $this->assertSame($this->ts('2026-11-15 10:00:00'), $normal['ends_at']);
        $this->assertSame($normal['next_reset_before'], $normal['next_reset_after']);

        $edited = $this->row($dry, $users['edited']);
        $this->assertSame('admin_update', $edited['start_source']);
        $this->assertSame($this->ts('2026-09-01 08:00:00'), $edited['started_at']);
        $this->assertNull($edited['short_fix']);
        $this->assertSame($this->ts('2026-11-05 08:00:00'), $edited['next_reset_after']);

        $this->assertTrue($this->row($dry, $users['final'])['is_final']);
        $this->assertNull($this->row($dry, $users['final'])['next_reset_after']);
        $this->assertNull($this->row($dry, $users['onetime'])['ends_at']);

        $applied = $this->report(['--apply' => true, '--fix-short' => true]);
        $this->assertSame(5, $applied['summary']['cycles']);
        foreach (['normal', 'short', 'edited', 'final', 'onetime'] as $key) {
            $cycle = $this->currentCycle($users[$key]);
            $this->assertNotNull($cycle, $key);
            $this->assertSame(TrafficCycle::REASON_BOOTSTRAP, $cycle->start_reason);
            $this->assertSame($this->row($applied, $users[$key])['cycle_id'], $cycle->id);
        }
        $shortCycle = $this->currentCycle($users['short']);
        $this->assertSame($this->ts('2026-12-01 23:59:59'), $shortCycle->ends_at);
        $this->assertSame(40 * self::GB, $shortCycle->quota);
        $this->assertSame('short_fix', collect($shortCycle->events)->last()['why']);
        $this->assertNull($users['short']->refresh()->next_reset_at);
        $this->assertNull($users['final']->refresh()->next_reset_at);
        $this->assertSame($this->ts('2026-11-15 10:00:00'), $users['normal']->refresh()->next_reset_at);
        $this->assertNull(TrafficCycle::where('user_id', User::where('email', 'boot-expired@cycle.test')->value('id'))->first());

        // idempotent
        $again = $this->report(['--apply' => true, '--fix-short' => true]);
        $this->assertSame($now, $again['generated_at']);
        $this->assertSame(0, $again['summary']['cycles']);
        $this->assertSame(6, $again['summary']['skipped_existing']);
    }

    public function test_an_advance_by_the_old_plugin_starts_the_cycle(): void
    {
        // yearly plan reset on the 20th; TrafficReset 1.1.x advanced the user on 11-01 01:36 and,
        // reading the day in UTC (31) with month overflow, moved the expiry to 12-02 00:09:44
        $this->at('2026-10-20 00:10:29');
        $user = $this->legacyUser('boot-plugin@cycle.test', [
            'expired_at' => $this->ts('2026-12-02 00:09:44'),
            'next_reset_at' => $this->ts('2026-11-02 00:09:44'),
            'transfer_enable' => 50 * self::GB,
        ]);
        $row = ['user_id' => $user->id, 'reset_type' => TrafficResetLog::TYPE_MONTHLY, 'old_download' => 0];
        TrafficResetLog::create($row + ['reset_time' => Carbon::parse('2026-10-20 00:10:29', self::TZ), 'old_total' => 28 * self::GB, 'trigger_source' => TrafficResetLog::SOURCE_CRON]);
        TrafficResetLog::create($row + ['reset_time' => Carbon::parse('2026-11-01 01:36:57', self::TZ), 'old_total' => 0, 'trigger_source' => TrafficResetLog::SOURCE_MANUAL]);

        $this->at('2026-11-01 03:00:00');
        $report = $this->report(['--apply' => true, '--fix-short' => true]);
        $row = $this->row($report, $user);
        $this->assertSame('plugin_advance', $row['start_source']);
        $this->assertSame($this->ts('2026-11-01 01:36:57'), $row['started_at']);
        $this->assertSame($this->ts('2026-12-02 00:09:44'), $row['ends_at']);
        $this->assertTrue($row['is_final']);
        $this->assertNull($user->refresh()->next_reset_at);
    }

    public function test_without_fix_short_the_promised_reset_is_kept(): void
    {
        $users = $this->seedLegacy();
        $this->at('2026-11-01 00:30:00');
        $report = $this->report(['--apply' => true]);
        $row = $this->row($report, $users['short']);
        $this->assertNull($row['short_fix']);
        $this->assertContains('short_cycle', $row['notes']);
        $this->assertSame($this->ts('2026-11-01 23:59:59'), $this->currentCycle($users['short'])->ends_at);
        $this->assertSame($this->ts('2026-11-01 23:59:59'), $users['short']->refresh()->next_reset_at);
    }

    public function test_import_jsonl_backfills_the_plugin_advances(): void
    {
        $this->at('2026-10-20 12:00:03');
        $user = $this->legacyUser('jsonl1@cycle.test', ['expired_at' => $this->ts('2026-12-31 10:00:00')]);
        $other = $this->legacyUser('jsonl2@cycle.test', ['expired_at' => $this->ts('2026-12-31 10:00:00')]);
        $legacy = [
            'reset_type' => TrafficResetLog::TYPE_MONTHLY,
            'old_total' => 0,
            'trigger_source' => TrafficResetLog::SOURCE_MANUAL,
        ];
        $matched = TrafficResetLog::create($legacy + ['user_id' => $user->id, 'reset_time' => Carbon::parse('2026-10-20 12:00:03', self::TZ)]);
        $tooFar = TrafficResetLog::create($legacy + ['user_id' => $other->id, 'reset_time' => Carbon::parse('2026-10-21 08:00:10', self::TZ)]);

        $event = fn(int $userId, string $at, array $before, array $after) => json_encode([
            'event_id' => 'evt-' . $userId . '-' . substr($at, 11, 2),
            'event_type' => 'traffic_reset',
            'plugin' => 'traffic_reset',
            'plugin_version' => '1.1.0',
            'triggered_at' => $at,
            'result' => 'success',
            'result_reason' => 'traffic_limit_reached',
            'user_id' => $userId,
            'trigger' => ['source' => 'traffic_report', 'server_id' => 3],
            'before' => $before,
            'after' => $after,
        ], JSON_UNESCAPED_SLASHES);
        $jsonl = $this->dir . '/traffic_reset';
        File::ensureDirectoryExists($jsonl);
        File::put($jsonl . '/2026-10-20.jsonl', implode("\n", [
            $event($user->id, '2026-10-20T12:00:00+08:00',
                ['u' => 2 * self::GB, 'd' => 38 * self::GB, 'used_traffic' => 40 * self::GB, 'transfer_enable' => 40 * self::GB, 'expired_at' => $this->ts('2027-01-01 23:59:59')],
                ['u' => 0, 'd' => 0, 'used_traffic' => 0, 'transfer_enable' => 40 * self::GB, 'expired_at' => $this->ts('2026-12-21 12:00:00')]),
            '{not json',
            json_encode(['event_id' => 'skip', 'triggered_at' => '2026-10-20T13:00:00+08:00', 'result' => 'skipped', 'user_id' => $user->id]),
        ]) . "\n");
        File::put($jsonl . '/2026-10-21.jsonl', $event($other->id, '2026-10-21T08:00:00+08:00',
            ['u' => 0, 'd' => self::GB, 'used_traffic' => self::GB, 'transfer_enable' => 100 * self::GB, 'expired_at' => $this->ts('2026-12-31 10:00:00')],
            ['u' => 0, 'd' => 0, 'used_traffic' => 0, 'transfer_enable' => 100 * self::GB, 'expired_at' => $this->ts('2026-12-20 10:00:00')]) . "\n");

        $this->at('2026-11-01 00:30:00');
        $dry = $this->report(['--import-jsonl' => true, '--jsonl-dir' => $jsonl]);
        $this->assertSame(['files' => 2, 'events' => 2, 'matched' => 1, 'already_imported' => 0, 'unmatched' => 1, 'invalid_lines' => 1],
            array_intersect_key($dry['jsonl'], array_flip(['files', 'events', 'matched', 'already_imported', 'unmatched', 'invalid_lines'])));
        $this->assertNull($matched->refresh()->metadata);
        $this->assertTrue($matched->isNoise());

        $applied = $this->report(['--apply' => true, '--import-jsonl' => true, '--jsonl-dir' => $jsonl]);
        $this->assertSame(1, $applied['jsonl']['matched']);
        $matched->refresh();
        $this->assertSame(TrafficResetLog::REASON_AUTO_ADVANCE, $matched->metadata['reason']);
        $this->assertSame(40 * self::GB, $matched->metadata['cleared']);
        $this->assertSame($this->ts('2027-01-01 23:59:59') - $this->ts('2026-12-21 12:00:00'), $matched->metadata['shift_seconds']);
        $this->assertSame('evt-' . $user->id . '-12', $matched->metadata['trigger']['event_id']);
        $this->assertSame(0, (int) $matched->old_total);
        $this->assertFalse($matched->isNoise());
        $this->assertSame(40 * self::GB, $matched->cycleFields()['cleared']);
        $this->assertNull($tooFar->refresh()->metadata);

        $again = $this->report(['--apply' => true, '--import-jsonl' => true, '--jsonl-dir' => $jsonl]);
        $this->assertSame(0, $again['jsonl']['matched']);
        $this->assertSame(1, $again['jsonl']['already_imported']);
    }
}
