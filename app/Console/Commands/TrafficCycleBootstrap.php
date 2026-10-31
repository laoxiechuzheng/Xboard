<?php

namespace App\Console\Commands;

use App\Models\AdminAuditLog;
use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficResetLog;
use App\Models\User;
use App\Services\TrafficCycleService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 启用流量周期账本（docs/traffic-cycle/DESIGN.md §10.2）。
 */
class TrafficCycleBootstrap extends Command
{
    protected $signature = 'traffic:cycle-bootstrap
        {--dry-run : 只出报告，不写库（默认）}
        {--apply : 执行}
        {--fix-short : 周期起点到 next_reset_at 不足最短周期时改为 planEnd(S, E)}
        {--import-jsonl : 导入 TrafficReset 插件的 JSONL 审计日志，回填历史换时记录（DESIGN §4.2）}
        {--jsonl-dir= : JSONL 目录，默认 storage/logs/traffic_reset}
        {--report= : 把 JSON 报告写到这个文件}';

    protected $description = '为现有用户建立当前流量周期（默认只出报告，--apply 执行）';

    private const JSONL_WINDOW_SECONDS = 5;

    public function handle(TrafficCycleService $cycles): int
    {
        if (!$cycles->enabled()) {
            $this->error('v2_traffic_cycle 表不存在，请先执行 php artisan migrate');
            return self::FAILURE;
        }
        $apply = (bool) $this->option('apply');
        if ($apply && $this->option('dry-run')) {
            $this->error('--apply 与 --dry-run 不能同时使用');
            return self::FAILURE;
        }
        $fixShort = (bool) $this->option('fix-short');
        $now = Carbon::now()->getTimestamp();
        $this->info($apply ? '执行模式（--apply）' : '只出报告（dry-run），确认后加 --apply 执行');

        $report = [
            'generated_at' => $now,
            'mode' => $apply ? 'apply' : 'dry-run',
            'fix_short' => $fixShort,
            'min_cycle_days' => intdiv($cycles->minSeconds(), 86400),
            'summary' => [
                'users_scanned' => 0,
                'skipped_existing' => 0,
                'cycles' => 0,
                'final_cycles' => 0,
                'next_reset_changed' => 0,
                'short_fixed' => 0,
                'custom_quota' => 0,
                'unscheduled_periodic' => 0,
                'errors' => 0,
            ],
            'users' => [],
            'errors' => [],
            'jsonl' => null,
        ];

        User::query()
            ->whereNotNull('plan_id')
            ->where(fn($query) => $query->whereNull('expired_at')->orWhere('expired_at', '>', $now))
            ->lazyById(500)
            ->each(function (User $user) use ($cycles, $fixShort, $apply, $now, &$report) {
                $report['summary']['users_scanned']++;
                try {
                    $row = $cycles->bootstrapUser($user, $this->estimateStart($user, $now), $fixShort, $apply, $now);
                } catch (\Throwable $e) {
                    $report['summary']['errors']++;
                    $report['errors'][] = ['user_id' => (int) $user->id, 'error' => $e->getMessage()];
                    return;
                }
                if ($row === null) {
                    $report['summary']['skipped_existing']++;
                    return;
                }
                $row['notes'] = $this->notes($cycles, $user, $row);
                $report['summary']['cycles']++;
                $report['summary']['final_cycles'] += (int) $row['is_final'];
                $report['summary']['next_reset_changed'] += (int) ($row['next_reset_before'] !== $row['next_reset_after']);
                $report['summary']['short_fixed'] += (int) ($row['short_fix'] !== null);
                $report['summary']['custom_quota'] += (int) $row['custom_quota'];
                $report['summary']['unscheduled_periodic'] += (int) in_array('unscheduled_periodic', $row['notes'], true);
                $report['users'][] = $row;
            });

        if ($this->option('import-jsonl')) {
            $report['jsonl'] = $this->importJsonl($apply);
        }

        $this->printReport($report);

        if ($path = $this->option('report')) {
            $json = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (@file_put_contents($path, $json . PHP_EOL) === false) {
                $this->error("报告写入失败：{$path}");
                return self::FAILURE;
            }
            $this->info("报告：{$path}");
        }

        return $report['summary']['errors'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Start of the running cycle: the latest of the last new purchase / plan change order, the last
     * scheduled reset and the last admin change that touched the subscription.
     *
     * @return array{at: int, source: string}
     */
    private function estimateStart(User $user, int $now): array
    {
        $candidates = [];

        $order = Order::where('user_id', $user->id)
            ->where('status', Order::STATUS_COMPLETED)
            ->whereIn('type', [Order::TYPE_NEW_PURCHASE, Order::TYPE_UPGRADE])
            ->orderByDesc('id')
            ->first(['paid_at', 'created_at']);
        if ($order) {
            $candidates['order'] = (int) ($order->paid_at ?: $order->created_at);
        }

        $reset = TrafficResetLog::where('user_id', $user->id)
            ->whereIn('trigger_source', [
                TrafficResetLog::SOURCE_CRON,
                TrafficResetLog::SOURCE_AUTO,
                TrafficResetLog::SOURCE_USER_ACCESS,
            ])
            ->orderByDesc('reset_time')
            ->first(['reset_time']);
        if ($reset?->reset_time) {
            $candidates['scheduled_reset'] = $reset->reset_time->getTimestamp();
        }

        // TrafficReset 1.1.x moved the expiry and started a new cycle; it cleared the usage itself before
        // calling performReset, so its row is a manual reset of 0 B
        $advance = TrafficResetLog::where('user_id', $user->id)
            ->where('trigger_source', TrafficResetLog::SOURCE_MANUAL)
            ->where('old_total', 0)
            ->orderByDesc('reset_time')
            ->first(['reset_time']);
        if ($advance?->reset_time) {
            $candidates['plugin_advance'] = $advance->reset_time->getTimestamp();
        }

        if ($admin = $this->lastAdminChange((int) $user->id)) {
            $candidates['admin_update'] = $admin;
        }

        $candidates = array_filter($candidates, fn($at) => $at > 0 && $at <= $now);
        if (!$candidates) {
            $fallback = (int) ($user->last_reset_at ?: $user->created_at ?: $now);
            return ['at' => min($fallback, $now), 'source' => $user->last_reset_at ? 'last_reset_at' : 'created_at'];
        }
        arsort($candidates);

        return ['at' => (int) reset($candidates), 'source' => (string) key($candidates)];
    }

    /**
     * Latest admin user/update that changed expiry, plan or quota (compared with the admin's previous
     * update of the same user). Edits that only touched other fields do not restart a cycle.
     */
    private function lastAdminChange(int $userId): ?int
    {
        $entries = AdminAuditLog::where('action', 'user.update')
            ->where(function ($query) use ($userId) {
                $query->where('request_data', 'like', '%"id":' . $userId . ',%')
                    ->orWhere('request_data', 'like', '%"id":' . $userId . '}%')
                    ->orWhere('request_data', 'like', '%"id":"' . $userId . '"%');
            })
            ->orderByDesc('id')
            ->limit(20)
            ->get(['request_data', 'created_at']);

        $keys = ['expired_at', 'plan_id', 'transfer_enable'];
        $requests = [];
        foreach ($entries as $entry) {
            $data = json_decode((string) $entry->request_data, true);
            if (is_array($data) && (int) ($data['id'] ?? 0) === $userId) {
                $requests[] = ['at' => (int) $entry->created_at, 'data' => $data];
            }
        }
        foreach ($requests as $index => $request) {
            $previous = $requests[$index + 1] ?? null;
            foreach ($keys as $key) {
                if (!array_key_exists($key, $request['data'])) {
                    continue;
                }
                if ($previous === null || (string) ($previous['data'][$key] ?? '') !== (string) $request['data'][$key]) {
                    return $request['at'];
                }
            }
        }

        return null;
    }

    private function notes(TrafficCycleService $cycles, User $user, array $row): array
    {
        $notes = [];
        $method = $cycles->resetMethod(Plan::find($user->plan_id));
        if ($row['is_final'] && $row['expired_at'] !== null && $method !== Plan::RESET_TRAFFIC_NEVER
            && $row['next_reset_before'] === null && $row['expired_at'] - $row['started_at'] > 31 * 86400) {
            // legacy data never scheduled a reset for this periodic plan; kept as is (no promise to keep)
            $notes[] = 'unscheduled_periodic';
        }
        if ($row['next_reset_before'] !== null && $row['next_reset_before'] <= $row['started_at']) {
            $notes[] = 'reset_overdue';
        }
        if ($row['short_fix'] === null && !$row['is_final'] && $row['ends_at'] - $row['started_at'] < $cycles->minSeconds()) {
            $notes[] = 'short_cycle';
        }

        return $notes;
    }

    /**
     * DESIGN §4.2: legacy rows of the TrafficReset plugin 1.1.0 (manual, 0 B, no reason) within 5 s of a
     * successful JSONL event get metadata.reason = auto_advance and the real cleared amount.
     */
    private function importJsonl(bool $apply): array
    {
        $dir = rtrim((string) ($this->option('jsonl-dir') ?: storage_path('logs/traffic_reset')), '/');
        $files = glob($dir . '/*.jsonl') ?: [];
        sort($files);
        $tz = (string) config('app.timezone');
        $result = [
            'dir' => $dir,
            'files' => count($files),
            'events' => 0,
            'matched' => 0,
            'already_imported' => 0,
            'unmatched' => 0,
            'invalid_lines' => 0,
            'rows' => [],
        ];
        $used = [];

        foreach ($files as $file) {
            $handle = @fopen($file, 'r');
            if (!$handle) {
                continue;
            }
            while (($line = fgets($handle)) !== false) {
                $line = trim($line);
                if ($line === '') {
                    continue;
                }
                $event = json_decode($line, true);
                $at = is_array($event) ? strtotime((string) ($event['triggered_at'] ?? '')) : false;
                if (!is_array($event) || $at === false || empty($event['user_id'])) {
                    $result['invalid_lines']++;
                    continue;
                }
                // ledger-mode events (plugin 1.2.0+) already have a proper log written by the panel
                if (($event['result'] ?? null) !== 'success' || isset($event['cycle'])) {
                    continue;
                }
                $result['events']++;
                $userId = (int) $event['user_id'];
                $row = ['event_id' => $event['event_id'] ?? null, 'user_id' => $userId, 'triggered_at' => $at];

                $candidates = TrafficResetLog::where('user_id', $userId)
                    ->where('trigger_source', TrafficResetLog::SOURCE_MANUAL)
                    ->where('old_total', 0)
                    ->whereBetween('reset_time', [
                        Carbon::createFromTimestamp($at - self::JSONL_WINDOW_SECONDS, $tz),
                        Carbon::createFromTimestamp($at + self::JSONL_WINDOW_SECONDS, $tz),
                    ])
                    ->get()
                    ->reject(fn(TrafficResetLog $log) => isset($used[$log->id]))
                    ->sortBy(fn(TrafficResetLog $log) => abs($log->reset_time->getTimestamp() - $at));
                $log = $candidates->first();
                if (!$log) {
                    $result['unmatched']++;
                    $result['rows'][] = $row + ['status' => 'unmatched'];
                    continue;
                }
                $used[$log->id] = true;
                $row += ['log_id' => (int) $log->id, 'diff_seconds' => $log->reset_time->getTimestamp() - $at];
                if (!$log->isLegacy()) {
                    $result['already_imported']++;
                    $result['rows'][] = $row + ['status' => 'already_imported'];
                    continue;
                }

                $metadata = $this->advanceMetadata($event);
                $result['matched']++;
                $result['rows'][] = $row + ['status' => $apply ? 'updated' : 'matched', 'cleared' => $metadata['cleared']];
                if ($apply) {
                    // only metadata is written; the original columns (and updated_at) stay as they were.
                    // reset_time is assigned to itself: on a MySQL with explicit_defaults_for_timestamp off the
                    // first TIMESTAMP column auto-updates on any change, which would move the reset to now
                    TrafficResetLog::whereKey($log->id)->toBase()->update([
                        'metadata' => json_encode(array_merge($log->metadata ?? [], $metadata), JSON_UNESCAPED_UNICODE),
                        'reset_time' => DB::raw('reset_time'),
                    ]);
                }
            }
            fclose($handle);
        }

        return $result;
    }

    private function advanceMetadata(array $event): array
    {
        $before = is_array($event['before'] ?? null) ? $event['before'] : [];
        $after = is_array($event['after'] ?? null) ? $event['after'] : [];
        $int = static fn($value) => $value === null || $value === '' ? null : (int) $value;
        $upload = (int) ($before['u'] ?? 0);
        $download = (int) ($before['d'] ?? 0);
        $expiredBefore = $int($before['expired_at'] ?? null);
        $expiredAfter = $int($after['expired_at'] ?? null);
        $trigger = is_array($event['trigger'] ?? null) ? $event['trigger'] : [];

        return TrafficResetLog::buildMetadata([
            'reason' => TrafficResetLog::REASON_AUTO_ADVANCE,
            'quota_before' => $int($before['transfer_enable'] ?? null),
            'quota_after' => $int($after['transfer_enable'] ?? null),
            'expired_before' => $expiredBefore,
            'expired_after' => $expiredAfter,
            'shift_seconds' => $expiredBefore !== null && $expiredAfter !== null ? $expiredBefore - $expiredAfter : null,
            'trigger' => $trigger + ['event_id' => $event['event_id'] ?? null],
            'cleared' => (int) ($before['used_traffic'] ?? ($upload + $download)),
            'cleared_upload' => $upload,
            'cleared_download' => $download,
            'imported_from' => 'traffic_reset_jsonl',
        ]);
    }

    private function printReport(array $report): void
    {
        $summary = $report['summary'];
        $verb = $report['mode'] === 'apply' ? '已建立' : '将建立';
        $this->line("扫描有套餐且未过期的用户 {$summary['users_scanned']} 个，已有当前周期跳过 {$summary['skipped_existing']} 个");
        $this->line("{$verb}周期 {$summary['cycles']} 个，其中最终周期 {$summary['final_cycles']} 个；next_reset_at 变化 {$summary['next_reset_changed']} 个；自定义常备额度 {$summary['custom_quota']} 个");
        if ($summary['unscheduled_periodic'] > 0) {
            $this->warn("按周期重置的套餐但原 next_reset_at 为空（保持不重置）：{$summary['unscheduled_periodic']} 个，见报告 notes");
        }

        $fixes = array_values(array_filter($report['users'], fn($row) => $row['short_fix'] !== null));
        if ($fixes) {
            $this->line(($report['mode'] === 'apply' ? '已修正' : '将修正') . "过短周期 {$summary['short_fixed']} 个：");
            $format = fn(?int $at) => $at === null ? '-' : Carbon::createFromTimestamp($at, config('app.timezone'))->format('Y-m-d H:i:s');
            $this->table(['user_id', '周期起点', '起点依据', '原结束', '新结束', '到期'], array_map(fn($row) => [
                $row['user_id'],
                $format($row['started_at']),
                $row['start_source'],
                $format($row['short_fix']['ends_before']),
                $format($row['short_fix']['ends_after']),
                $format($row['expired_at']),
            ], $fixes));
        } elseif ($report['fix_short']) {
            $this->line('没有需要修正的过短周期');
        }

        if ($jsonl = $report['jsonl']) {
            $this->line("JSONL：{$jsonl['dir']}，文件 {$jsonl['files']} 个，换时事件 {$jsonl['events']} 条；"
                . ($report['mode'] === 'apply' ? '已回填' : '可回填') . " {$jsonl['matched']} 条，已导入过 {$jsonl['already_imported']} 条，"
                . "未匹配 {$jsonl['unmatched']} 条，无法解析 {$jsonl['invalid_lines']} 行");
        }
        foreach ($report['errors'] as $error) {
            $this->error("用户 {$error['user_id']}：{$error['error']}");
        }
    }
}
