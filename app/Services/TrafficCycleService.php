<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\Plan;
use App\Models\TrafficCycle;
use App\Models\TrafficResetLog;
use App\Models\User;
use App\Services\Plugin\HookManager;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 流量周期账本（docs/traffic-cycle/DESIGN.md）。
 *
 * 插件只依赖 DESIGN §6 列出的公开方法；其余 public 方法供核心（订单、后台、命令）调用。
 * 所有写操作都在锁住 v2_user 行的事务里进行。
 */
class TrafficCycleService
{
    public const GB = 1073741824;
    public const UPCOMING_LIMIT = 12;

    public const METHOD_NAMES = [
        Plan::RESET_TRAFFIC_FIRST_DAY_MONTH => 'first_day_month',
        Plan::RESET_TRAFFIC_MONTHLY => 'monthly',
        Plan::RESET_TRAFFIC_NEVER => 'never',
        Plan::RESET_TRAFFIC_FIRST_DAY_YEAR => 'first_day_year',
        Plan::RESET_TRAFFIC_YEARLY => 'yearly',
    ];

    private static bool $tableReady = false;

    /** @var array<int, Plan|null> */
    private array $plans = [];

    /**
     * The ledger table exists. Old migrations call reset:traffic before it is created.
     */
    public function enabled(): bool
    {
        if (self::$tableReady) {
            return true;
        }
        try {
            return self::$tableReady = Schema::hasTable('v2_traffic_cycle');
        } catch (\Throwable) {
            return false;
        }
    }

    // ---------------------------------------------------------------------
    // Stable API (DESIGN §6)
    // ---------------------------------------------------------------------

    /**
     * Current cycle after a light reconcile; bootstraps one when the user has none.
     */
    public function current(User $user, ?int $now = null): ?TrafficCycle
    {
        if (!$this->enabled() || !$user->getKey()) {
            return null;
        }
        $now ??= $this->now();

        return DB::transaction(function () use ($user, $now) {
            $this->lockUser($user);
            return $this->reconcileLocked($user, $now);
        });
    }

    public function timeline(User $user, array $opts = [], ?int $now = null): array
    {
        $now ??= $this->now();
        $admin = !empty($opts['admin']);
        $historyLimit = max(0, min(50, (int) ($opts['history_limit'] ?? 10)));
        $historyOffset = max(0, (int) ($opts['history_offset'] ?? 0));
        $eventsLimit = max(0, min(50, (int) ($opts['events_limit'] ?? 20)));

        $cycle = $this->current($user, $now);
        $plan = $this->plan($user->plan_id);
        $expiredAt = $this->expiry($user);
        $method = $this->resetMethod($plan);

        $history = [];
        $historyTotal = 0;
        if ($this->enabled()) {
            $historyQuery = TrafficCycle::where('user_id', $user->id)->whereNotNull('ended_at');
            $historyTotal = (clone $historyQuery)->count();
            $history = $historyQuery->orderByDesc('seq')
                ->offset($historyOffset)
                ->limit($historyLimit)
                ->get()
                ->map(fn(TrafficCycle $item) => $this->presentCycle($item, $expiredAt, null, $admin))
                ->all();
        }

        $eventQuery = TrafficResetLog::where('user_id', $user->id);
        if (!$admin) {
            $eventQuery->meaningful();
        }
        $eventsTotal = (clone $eventQuery)->count();
        $events = $eventQuery->orderByDesc('reset_time')
            ->orderByDesc('id')
            ->limit($eventsLimit)
            ->get()
            ->map(fn(TrafficResetLog $log) => $this->presentLog($log, $admin))
            ->all();

        $data = [
            'now' => $now,
            'user_id' => (int) $user->id,
            'plan' => $plan ? [
                'id' => (int) $plan->id,
                'name' => $plan->name,
                'quota' => (int) $plan->transfer_enable * self::GB,
            ] : null,
            // a user who never had a plan keeps the column default 0, which is not a date
            'expired_at' => $plan === null && $expiredAt !== null && $expiredAt <= 0 ? null : $expiredAt,
            'reset_method' => self::METHOD_NAMES[$method] ?? 'never',
            'min_cycle_days' => intdiv($this->minSeconds(), 86400),
            'current' => $cycle ? $this->presentCycle($cycle, $expiredAt, $user, $admin) : null,
            'upcoming' => $cycle ? $this->upcoming(
                $cycle->ends_at,
                $expiredAt,
                $method,
                (int) ($cycle->next_quota ?? $cycle->quota)
            ) : [],
            'advance' => $this->advanceSection($user, $cycle, $now),
            'history' => $history,
            'history_total' => $historyTotal,
            'events' => $events,
            'events_total' => $eventsTotal,
        ];

        if ($admin) {
            $data['user'] = [
                'id' => (int) $user->id,
                'email' => $user->email,
                'transfer_enable' => (int) $user->transfer_enable,
                'u' => (int) $user->u,
                'd' => (int) $user->d,
                'expired_at' => $expiredAt,
                'next_reset_at' => $this->intOrNull($user->next_reset_at),
                'last_reset_at' => $this->intOrNull($user->last_reset_at),
                'reset_count' => (int) $user->reset_count,
            ];
        }

        return $data;
    }

    public function advanceEligibility(User $user, int $minRemainingDays, ?int $now = null): array
    {
        $now ??= $this->now();
        $cycle = $this->current($user, $now);
        return $this->eligibility($user, $cycle, $minRemainingDays, $now);
    }

    /**
     * 换时：结束本周期并立即开启下一周期，到期时间前移本周期未用完的时长（DESIGN §3.7）。
     */
    public function advance(User $user, array $trigger, int $minRemainingDays = 30, ?int $now = null): array
    {
        $now ??= $this->now();
        $snapshot = $this->snapshot($user);
        $refused = fn(string $reason, array $before) => [
            'ok' => false,
            'reason' => $reason,
            'before' => $before,
            'after' => $before,
            'shift_seconds' => 0,
            'closed_cycle_id' => null,
            'new_cycle_id' => null,
            'reset_log_id' => null,
        ];
        if (!$this->enabled() || !$user->getKey()) {
            return $refused('no_cycle', $snapshot);
        }

        $result = DB::transaction(function () use ($user, $trigger, $minRemainingDays, $now, $refused) {
            $this->lockUser($user);
            $before = $this->snapshot($user);
            $cycle = $this->reconcileLocked($user, $now);
            $check = $this->eligibility($user, $cycle, $minRemainingDays, $now);
            if (!$check['eligible']) {
                return $refused($check['reason'], $before);
            }

            $upload = (int) $user->u;
            $download = (int) $user->d;
            $quotaBefore = (int) $user->transfer_enable;
            // a caller that says how much traffic is about to be added gets exhaustion re-checked under the
            // row lock, so a stale or duplicate trigger cannot burn the cycle it just opened
            if (array_key_exists('pending_bytes', $trigger)
                && $upload + $download + (int) $trigger['pending_bytes'] < $quotaBefore) {
                return $refused('not_exhausted', $before);
            }
            $expiredBefore = $this->expiry($user);
            $quota = (int) $check['next_quota'];

            $this->finish($cycle, $now, TrafficCycle::REASON_ADVANCED, $upload, $download);
            $user->expired_at = $check['expired_after'];
            $next = $this->createCycle($user, [
                'started_at' => $now,
                'ends_at' => $check['cycle_ends_at'],
                'quota' => $quota,
                'next_quota' => $quota,
                'kind' => TrafficCycle::KIND_STANDARD,
                'start_reason' => TrafficCycle::REASON_ADVANCE,
            ]);

            $logId = $this->clearUsage($user, $now, TrafficResetLog::SOURCE_AUTO, [
                'reason' => TrafficResetLog::REASON_AUTO_ADVANCE,
                'cycle_id' => $next->id,
                'prev_cycle_id' => $cycle->id,
                'quota_before' => $quotaBefore,
                'quota_after' => $quota,
                'expired_before' => $expiredBefore,
                'expired_after' => $check['expired_after'],
                'shift_seconds' => $check['shift_seconds'],
                'trigger' => $trigger ?: null,
            ], $upload, $download, true, true);
            $user->transfer_enable = $quota;
            $user->save();

            return [
                'ok' => true,
                'reason' => 'eligible',
                'before' => $before,
                'after' => $this->snapshot($user),
                'shift_seconds' => (int) $check['shift_seconds'],
                'closed_cycle_id' => (int) $cycle->id,
                'new_cycle_id' => (int) $next->id,
                'reset_log_id' => $logId,
            ];
        });

        if ($result['ok']) {
            $this->afterReset($user);
        }

        return $result;
    }

    public function rollover(User $user, ?int $now = null): bool
    {
        return $this->rolloverVia($user, TrafficResetLog::SOURCE_AUTO, $now);
    }

    /**
     * 让当前周期与用户数据一致（幂等）：没有周期就建一个，额度跟随 transfer_enable，到期变化按 §3.3 重排。
     */
    public function reconcile(User $user, ?int $now = null): void
    {
        if (!$this->enabled() || !$user->getKey()) {
            return;
        }
        $now ??= $this->now();

        DB::transaction(function () use ($user, $now) {
            $this->lockUser($user);
            $this->reconcileLocked($user, $now);
        });
    }

    /**
     * 本周期结束时间（DESIGN §3.1、§3.2）。纯函数。
     */
    public static function planEnd(int $start, ?int $expiredAt, int $method, int $minSeconds, string $tz): ?int
    {
        if ($expiredAt === null) {
            return null;
        }

        return match ($method) {
            Plan::RESET_TRAFFIC_MONTHLY => self::anchoredEnd($start, $expiredAt, 1, $minSeconds, $tz),
            Plan::RESET_TRAFFIC_YEARLY => self::anchoredEnd($start, $expiredAt, 12, $minSeconds, $tz),
            Plan::RESET_TRAFFIC_FIRST_DAY_MONTH => min(
                $expiredAt,
                Carbon::createFromTimestamp($start, $tz)->startOfMonth()->addMonthNoOverflow()->getTimestamp()
            ),
            Plan::RESET_TRAFFIC_FIRST_DAY_YEAR => min(
                $expiredAt,
                Carbon::createFromTimestamp($start, $tz)->startOfYear()->addYearNoOverflow()->getTimestamp()
            ),
            default => $expiredAt,
        };
    }

    // ---------------------------------------------------------------------
    // Core integration (not part of the plugin contract)
    // ---------------------------------------------------------------------

    /**
     * Rollover with the reset log trigger_source of the caller (cron / auto / user_access).
     */
    public function rolloverVia(User $user, string $triggerSource, ?int $now = null): bool
    {
        if (!$this->enabled() || !$user->getKey()) {
            return false;
        }
        $now ??= $this->now();

        $done = DB::transaction(function () use ($user, $triggerSource, $now) {
            $this->lockUser($user);
            if ($user->banned) {
                return false;
            }
            $cycle = $this->reconcileLocked($user, $now);
            $expiredAt = $this->expiry($user);
            if (!$cycle || $this->isFinal($cycle->ends_at, $expiredAt) || $cycle->ends_at > $now) {
                return false;
            }

            $method = $this->methodFor($user);
            $minSeconds = $this->minSeconds();
            $tz = $this->timezone();
            $start = (int) $cycle->ends_at;
            $endsAt = self::planEnd($start, $expiredAt, $method, $minSeconds, $tz);
            $reason = TrafficCycle::REASON_ROLLOVER;
            // the cron did not run for a while: start from the last boundary that has passed
            for ($guard = 0; $endsAt !== null && $endsAt <= $now && $endsAt > $start
                && !$this->isFinal($endsAt, $expiredAt) && $guard < 1200; $guard++) {
                $start = $endsAt;
                $endsAt = self::planEnd($start, $expiredAt, $method, $minSeconds, $tz);
                $reason = TrafficCycle::REASON_CATCH_UP;
            }

            $upload = (int) $user->u;
            $download = (int) $user->d;
            $quotaBefore = (int) $user->transfer_enable;
            $quota = (int) ($cycle->next_quota ?? $cycle->quota);

            $this->finish($cycle, (int) $cycle->ends_at, TrafficCycle::REASON_ROLLOVER, $upload, $download);
            $next = $this->createCycle($user, [
                'started_at' => $start,
                'ends_at' => $endsAt,
                'quota' => $quota,
                'next_quota' => $quota,
                'kind' => TrafficCycle::KIND_STANDARD,
                'start_reason' => $reason,
            ]);

            $this->clearUsage($user, $now, $triggerSource, [
                'reason' => TrafficResetLog::REASON_CYCLE_ROLLOVER,
                'cycle_id' => $next->id,
                'prev_cycle_id' => $cycle->id,
                'quota_before' => $quotaBefore,
                'quota_after' => $quota,
                'expired_before' => $expiredAt,
                'expired_after' => $expiredAt,
            ], $upload, $download, true);
            $user->transfer_enable = $quota;
            $user->save();

            return true;
        });

        if ($done) {
            $this->afterReset($user);
        }

        return $done;
    }

    /**
     * Open cycle without reconciling (read paths such as next_reset_at calculation).
     */
    public function openCycle(User $user): ?TrafficCycle
    {
        if (!$user->getKey() || !$this->enabled()) {
            return null;
        }
        return $this->openCycleFor((int) $user->getKey());
    }

    /**
     * 新购 / 换套餐 / 一次性订单：关闭当前周期，开一个新周期。
     * Called inside OrderService::open after the user's plan, expiry and quota were set for the order.
     *
     * @return array reset log context for the usage clear that follows
     */
    public function openForOrder(User $user, Order $order, string $startReason, ?int $now = null): array
    {
        if (!$this->enabled() || !$user->getKey()) {
            return ['order_id' => $order->id];
        }
        $now ??= $this->now();

        return DB::transaction(function () use ($user, $order, $startReason, $now) {
            $this->lockUser($user);
            $previous = $this->openCycleFor((int) $user->id);
            if ($previous) {
                $this->closeForReplacement($previous, $user, $now);
            }
            $quota = $this->bytes($user->transfer_enable);
            $cycle = $this->createCycle($user, [
                'started_at' => $now,
                'quota' => $quota,
                'next_quota' => $quota,
                'kind' => TrafficCycle::KIND_STANDARD,
                'start_reason' => $startReason,
                'order_id' => $order->id,
            ]);

            return [
                'order_id' => $order->id,
                'cycle_id' => $cycle->id,
                'prev_cycle_id' => $previous?->id,
                'quota_before' => $previous ? (int) $previous->quota : null,
                'quota_after' => $quota,
                'cycle_start' => true,
            ];
        });
    }

    /**
     * 续费：当前周期不重开。特殊周期保留本周期额度，只把下周期额度设为套餐流量。
     * Called inside OrderService::open with the user's new expiry already set.
     *
     * @return int the transfer_enable the user keeps
     */
    public function renewForOrder(User $user, Order $order, int $planQuota, ?int $expiredBefore, ?int $now = null): int
    {
        if (!$this->enabled() || !$user->getKey()) {
            return $planQuota;
        }
        $now ??= $this->now();

        return DB::transaction(function () use ($user, $order, $planQuota, $expiredBefore, $now) {
            $this->lockUser($user);
            $expiredAfter = $this->expiry($user);
            $cycle = $this->openCycleFor((int) $user->id);
            $known = $cycle ? $this->knownExpiry($cycle) : null;

            if (!$cycle || ($known !== null && $known <= $now)) {
                // nothing to keep (no ledger yet, or the subscription had already lapsed)
                if ($cycle) {
                    $this->closeForReplacement($cycle, $user, $now);
                }
                $this->createCycle($user, [
                    'started_at' => $now,
                    'quota' => $planQuota,
                    'next_quota' => $planQuota,
                    'kind' => TrafficCycle::KIND_STANDARD,
                    'start_reason' => TrafficCycle::REASON_PURCHASE,
                    'order_id' => $order->id,
                ]);
                return $planQuota;
            }

            $transfer = $planQuota;
            if ($cycle->kind === TrafficCycle::KIND_SPECIAL) {
                $transfer = $this->bytes($user->getOriginal('transfer_enable'));
                $cycle->next_quota = $planQuota;
            } else {
                if ((int) $cycle->quota !== $planQuota) {
                    $cycle->pushEvent($this->event($now, 'quota_changed', ['by' => 'order', 'order_id' => $order->id], [
                        'before' => (int) $cycle->quota,
                        'after' => $planQuota,
                        'scope' => 'standing',
                    ]));
                }
                $cycle->quota = $planQuota;
                $cycle->next_quota = $planQuota;
            }
            if ((int) $cycle->plan_id !== (int) $user->plan_id) {
                $cycle->pushEvent($this->event($now, 'plan_changed', ['by' => 'order', 'order_id' => $order->id], [
                    'from' => $cycle->plan_id,
                    'to' => $user->plan_id,
                ]));
                $cycle->plan_id = $user->plan_id;
            }
            $cycle->pushEvent($this->event($now, 'renewal', ['by' => 'order', 'order_id' => $order->id], [
                'expired_before' => $expiredBefore,
                'expired_after' => $expiredAfter,
            ]));
            $this->applyExpiryRule($cycle, $expiredAfter, $now, ['by' => 'order', 'order_id' => $order->id]);
            $cycle->save();
            $user->next_reset_at = $this->nextResetFor($cycle->ends_at, $expiredAfter);

            return $transfer;
        });
    }

    /**
     * 管理员 user/update（DESIGN §3.6），与用户字段在同一事务里保存。
     *
     * @param array $options cycle_mode, cycle_quota_scope, cycle_ends_at, cycle_note, cycle_note_set
     */
    public function adminUpdate(User $user, array $params, array $options, ?int $adminId = null, ?int $now = null): void
    {
        if (!$this->enabled()) {
            $user->update($params);
            return;
        }
        $now ??= $this->now();

        DB::transaction(function () use ($user, $params, $options, $adminId, $now) {
            $this->lockUser($user);
            $cycle = $this->reconcileLocked($user, $now);
            $before = $this->stateOf($user);
            $user->fill($params);
            $after = $this->stateOf($user);

            $change = $this->computeAdminChange($cycle, $before, $after, $options, $now);
            if ($change['errors']) {
                throw new ApiException($change['errors'][0], 422);
            }
            $this->applyAdminChange($user, $cycle, $change, $before, $adminId, $now);
            $user->save();
        });
    }

    /**
     * GET user/trafficCycle/preview：按 user/update 的参数计算，不落库。
     *
     * @param array $changes plan_id / transfer_enable / expired_at / u / d that the admin is about to save
     */
    public function previewAdminUpdate(User $user, array $changes, array $options, ?int $now = null): array
    {
        $now ??= $this->now();
        if (!$this->enabled()) {
            return ['current' => null, 'upcoming' => [], 'effects' => [], 'warnings' => []];
        }

        DB::beginTransaction();
        try {
            $this->lockUser($user);
            $existed = $this->openCycleFor((int) $user->id);
            $cycle = $this->reconcileLocked($user, $now);
            $before = $this->stateOf($user);
            $after = array_merge($before, array_intersect_key($changes, $before));
            $after = $this->normalizeState($after);
            $change = $this->computeAdminChange($cycle, $before, $after, $options, $now);
            if (!$existed && $change['cycle'] && !$change['restart']) {
                // bootstrapped only inside this rolled back transaction
                $change['cycle']['id'] = null;
            }
        } finally {
            DB::rollBack();
        }

        $plan = $this->plan($after['plan_id']);
        $current = null;
        $upcoming = [];
        if ($change['cycle']) {
            $attrs = $change['cycle'];
            [$upload, $download] = $change['usage'];
            $current = $this->presentCycleAttributes($attrs, $after['expired_at'], $upload, $download);
            $upcoming = $this->upcoming(
                $attrs['ends_at'],
                $after['expired_at'],
                $this->resetMethod($plan),
                (int) ($attrs['next_quota'] ?? $attrs['quota'])
            );
        }

        return [
            'current' => $current,
            'upcoming' => $upcoming,
            'effects' => $change['effects'],
            'warnings' => array_merge($change['warnings'], array_map(
                fn(string $error) => ['type' => 'invalid', 'message' => $error],
                $change['errors']
            )),
        ];
    }

    /**
     * 套餐重置方式变化：按新方式从周期起点重新排期（DESIGN §3.3）。
     */
    public function reschedule(User $user, string $why, ?int $now = null): void
    {
        if (!$this->enabled() || !$user->getKey()) {
            return;
        }
        $now ??= $this->now();

        DB::transaction(function () use ($user, $why, $now) {
            $this->lockUser($user);
            $cycle = $this->reconcileLocked($user, $now);
            if (!$cycle) {
                return;
            }
            $expiredAt = $this->expiry($user);
            $endsAt = self::planEnd((int) $cycle->started_at, $expiredAt, $this->methodFor($user), $this->minSeconds(), $this->timezone());
            if ($endsAt !== $cycle->ends_at) {
                $cycle->pushEvent($this->event($now, 'schedule_changed', ['by' => 'system'], [
                    'ends_before' => $cycle->ends_at,
                    'ends_after' => $endsAt,
                    'why' => $why,
                ]));
                $cycle->ends_at = $endsAt;
                $cycle->save();
            }
            $this->persistNextReset($user, $this->nextResetFor($cycle->ends_at, $expiredAt));
        });
    }

    /**
     * Record an in-cycle usage clear on the current cycle (reset package, renewal reset, admin reset ...).
     */
    public function noteUsageCleared(User $user, int $logId, int $cleared, ?string $reason, string $by, ?int $adminId = null, ?int $now = null): void
    {
        $cycle = $this->openCycle($user);
        if (!$cycle) {
            return;
        }
        $cycle->pushEvent($this->event($now ?? $this->now(), 'usage_cleared', ['by' => $by, 'admin_id' => $adminId], [
            'log_id' => $logId,
            'cleared' => $cleared,
            'reason' => $reason,
        ]));
        $cycle->save();
    }

    /**
     * Users already over quota who could advance now: open cycle not due and not the final one, at least
     * $minRemainingDays left. Nodes drop a user once u + d reaches the quota, so the report-time trigger
     * never fires again for a user who became eligible later (renewal, admin edit, a node whose rate is
     * above 1 adds more than it reported, the plugin switched on later). The plugin sweeps these.
     *
     * @return \Illuminate\Support\Collection<int, User>
     */
    public function exhaustedCandidates(int $minRemainingDays, int $limit = 200, ?int $now = null): \Illuminate\Support\Collection
    {
        if (!$this->enabled()) {
            return collect();
        }
        $now ??= $this->now();

        return User::query()
            ->select('v2_user.*')
            ->join('v2_traffic_cycle as cycle', function ($join) {
                $join->on('cycle.user_id', '=', 'v2_user.id')->whereNull('cycle.ended_at');
            })
            ->whereNotNull('v2_user.plan_id')
            ->where('v2_user.banned', 0)
            ->where('v2_user.transfer_enable', '>', 0)
            ->whereRaw('v2_user.u + v2_user.d >= v2_user.transfer_enable')
            ->where('v2_user.expired_at', '>=', $now + max(0, $minRemainingDays) * 86400)
            ->whereNotNull('cycle.ends_at')
            ->where('cycle.ends_at', '>', $now)
            ->whereColumn('cycle.ends_at', '<', 'v2_user.expired_at')
            ->orderBy('v2_user.id')
            ->limit($limit)
            ->get();
    }

    /**
     * Ledger bootstrap for one user (traffic:cycle-bootstrap). Returns the report row, or null when the
     * user already has a current cycle.
     *
     * @param array $start ['at' => int, 'source' => string] estimated start of the running cycle
     */
    public function bootstrapUser(User $user, array $start, bool $fixShort, bool $apply, ?int $now = null): ?array
    {
        $now ??= $this->now();

        $run = function () use ($user, $start, $fixShort, $apply, $now) {
            if ($apply) {
                $this->lockUser($user);
            }
            if ($this->openCycleFor((int) $user->id)) {
                return null;
            }
            $expiredAt = $this->expiry($user);
            $nextBefore = $this->intOrNull($user->next_reset_at);
            $startedAt = min((int) $start['at'], $now);
            [$endsAt, $final] = $this->legacySchedule($nextBefore, $expiredAt);
            $shortFix = null;
            $minSeconds = $this->minSeconds();
            if ($fixShort && !$final && $endsAt !== null && $endsAt - $startedAt < $minSeconds) {
                $planned = self::planEnd($startedAt, $expiredAt, $this->methodFor($user), $minSeconds, $this->timezone());
                if ($planned !== $endsAt) {
                    $shortFix = ['ends_before' => $endsAt, 'ends_after' => $planned];
                    $endsAt = $planned;
                }
            }
            if ($endsAt !== null) {
                $startedAt = min($startedAt, $endsAt);
            }
            $nextAfter = $this->nextResetFor($endsAt, $expiredAt);
            $plan = $this->plan($user->plan_id);
            $quota = $this->bytes($user->transfer_enable);

            $row = [
                'user_id' => (int) $user->id,
                'plan_id' => $this->intOrNull($user->plan_id),
                'started_at' => $startedAt,
                'start_source' => $start['source'],
                'ends_at' => $endsAt,
                'expired_at' => $expiredAt,
                'is_final' => $this->isFinal($endsAt, $expiredAt),
                'next_reset_before' => $nextBefore,
                'next_reset_after' => $nextAfter,
                'short_fix' => $shortFix,
                'custom_quota' => $plan && $quota !== (int) $plan->transfer_enable * self::GB,
                'quota' => $quota,
                'cycle_id' => null,
            ];
            if (!$apply) {
                return $row;
            }

            $cycle = $this->createCycle($user, [
                'started_at' => $startedAt,
                'ends_at' => $endsAt,
                'quota' => $quota,
                'next_quota' => $quota,
                'kind' => TrafficCycle::KIND_STANDARD,
                'start_reason' => TrafficCycle::REASON_BOOTSTRAP,
            ]);
            if ($shortFix) {
                $cycle->pushEvent($this->event($now, 'schedule_changed', ['by' => 'system'], $shortFix + ['why' => 'short_fix']));
                $cycle->save();
            }
            $this->persistNextReset($user, $nextAfter);
            $row['cycle_id'] = (int) $cycle->id;

            return $row;
        };

        return $apply ? DB::transaction($run) : $run();
    }

    /**
     * Next reset without writing (subscription info, reset day): the open cycle's end, or the stored
     * next_reset_at for a user the ledger has not seen yet. Null for the final cycle.
     */
    public function nextResetAt(User $user): ?int
    {
        $expiredAt = $this->expiry($user);
        $cycle = $user->getKey() && $this->enabled() ? $this->openCycleFor((int) $user->getKey()) : null;
        if ($cycle) {
            return $this->nextResetFor($cycle->ends_at, $expiredAt);
        }
        [$endsAt, $final] = $this->legacySchedule($this->intOrNull($user->next_reset_at), $expiredAt);

        return $final ? null : $endsAt;
    }

    public function nextResetFor(?int $endsAt, ?int $expiredAt): ?int
    {
        return $this->isFinal($endsAt, $expiredAt) ? null : $endsAt;
    }

    public function isFinal(?int $endsAt, ?int $expiredAt): bool
    {
        return $endsAt === null || ($expiredAt !== null && $endsAt >= $expiredAt);
    }

    public function resetMethod(?Plan $plan): int
    {
        if (!$plan) {
            return Plan::RESET_TRAFFIC_NEVER;
        }
        $method = $plan->reset_traffic_method;
        if ($method === null) {
            $method = (int) admin_setting('reset_traffic_method', Plan::RESET_TRAFFIC_MONTHLY);
        }
        return (int) $method;
    }

    public function minSeconds(): int
    {
        return max(0, (int) admin_setting('traffic_cycle_min_days', 15)) * 86400;
    }

    /**
     * Lock the user row for the running transaction and reload it, keeping attributes the caller set
     * but has not saved yet (OrderService fills the user before saving).
     */
    public function lockUser(User $user): void
    {
        $row = User::query()->whereKey($user->getKey())->lockForUpdate()->first();
        if (!$row) {
            throw new \RuntimeException('User ' . $user->getKey() . ' not found');
        }
        $dirty = $user->getDirty();
        $user->setRawAttributes($row->getAttributes(), true);
        if ($dirty) {
            $user->setRawAttributes(array_merge($row->getAttributes(), $dirty));
        }
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    private static function anchoredEnd(int $start, int $expiredAt, int $stepMonths, int $minSeconds, string $tz): int
    {
        if ($expiredAt - $start < max($minSeconds, 1)) {
            return $expiredAt;
        }
        // boundaries B_k = E - k steps, day clamped to month end and E's time of day kept;
        // B_k can only be on or after start + M while its month is not before that moment's month
        $anchor = Carbon::createFromTimestamp($expiredAt, $tz);
        $threshold = Carbon::createFromTimestamp($start + max($minSeconds, 1), $tz);
        $months = ($anchor->year - $threshold->year) * 12 + $anchor->month - $threshold->month;
        $boundary = $expiredAt;
        for ($k = intdiv(max(0, $months), $stepMonths); $k > 0; $k--) {
            $candidate = $anchor->copy()->subMonthsNoOverflow($k * $stepMonths)->getTimestamp();
            if ($candidate > $start && $candidate - $start >= $minSeconds) {
                $boundary = $candidate;
                break;
            }
        }
        // a remainder shorter than M is merged into this cycle
        return $expiredAt - $boundary < $minSeconds ? $expiredAt : $boundary;
    }

    private function reconcileLocked(User $user, int $now): ?TrafficCycle
    {
        $cycle = $this->openCycleFor((int) $user->id);
        $expiredAt = $this->expiry($user);
        $active = $user->plan_id !== null && ($expiredAt === null || $expiredAt > $now);

        if ($cycle) {
            $known = $this->knownExpiry($cycle);
            if ($user->plan_id === null) {
                $this->finish($cycle, $now, TrafficCycle::REASON_REPLACED, (int) $user->u, (int) $user->d);
                $cycle = null;
            } elseif (!$active || ($known !== null && $known <= $now)) {
                // the subscription ran out while this cycle was open
                $this->finishExpired($cycle, $known !== null && $known <= $now ? $known : $expiredAt, $user);
                $cycle = null;
            }
        }

        if (!$active) {
            $this->persistNextReset($user, null);
            return null;
        }

        if (!$cycle) {
            $cycle = $this->bootstrapLive($user, $now);
        } else {
            $this->followUser($cycle, $user, $now);
        }
        $this->persistNextReset($user, $this->nextResetFor($cycle->ends_at, $expiredAt));

        return $cycle;
    }

    /**
     * Cycle for a user that has none (new user, ledger not bootstrapped yet, renewed after expiry).
     * A next_reset_at that was already promised is kept.
     */
    private function bootstrapLive(User $user, int $now): TrafficCycle
    {
        $expiredAt = $this->expiry($user);
        $next = $this->intOrNull($user->next_reset_at);
        if ($next !== null && ($expiredAt === null || $next < $expiredAt)) {
            // a due one is rolled over right after this
            $endsAt = $next;
            $start = $now;
            foreach ([$user->last_reset_at, $user->created_at] as $candidate) {
                $candidate = $this->intOrNull($candidate);
                if ($candidate !== null && $candidate <= $now) {
                    $start = $candidate;
                    break;
                }
            }
            $start = min($start, $endsAt);
        } else {
            $endsAt = self::planEnd($now, $expiredAt, $this->methodFor($user), $this->minSeconds(), $this->timezone());
            $start = $now;
        }
        $quota = $this->bytes($user->transfer_enable);

        return $this->createCycle($user, [
            'started_at' => $start,
            'ends_at' => $endsAt,
            'quota' => $quota,
            'next_quota' => $quota,
            'kind' => TrafficCycle::KIND_STANDARD,
            'start_reason' => TrafficCycle::REASON_BOOTSTRAP,
        ]);
    }

    /**
     * Ledger bootstrap schedule (DESIGN §10.2): keep the promised next_reset_at; no reset scheduled
     * (or one at / after expiry) means this is the final cycle.
     *
     * @return array{0: ?int, 1: bool} [ends_at, is_final]
     */
    private function legacySchedule(?int $nextResetAt, ?int $expiredAt): array
    {
        if ($nextResetAt !== null && ($expiredAt === null || $nextResetAt < $expiredAt)) {
            return [$nextResetAt, false];
        }
        return [$expiredAt, true];
    }

    /**
     * Bring the open cycle in line with the user row after a change that bypassed the explicit paths
     * (gift cards, trial, plan force update, direct saves). Events are attributed to the system.
     */
    private function followUser(TrafficCycle $cycle, User $user, int $now): void
    {
        $by = ['by' => 'system'];
        $quota = $this->bytes($user->transfer_enable);
        if ((int) $cycle->quota !== $quota) {
            $standard = $cycle->kind !== TrafficCycle::KIND_SPECIAL;
            $cycle->pushEvent($this->event($now, 'quota_changed', $by, [
                'before' => (int) $cycle->quota,
                'after' => $quota,
                'scope' => $standard ? 'standing' : 'cycle',
            ]));
            $cycle->quota = $quota;
            if ($standard) {
                $cycle->next_quota = $quota;
            }
        }

        $expiredAt = $this->expiry($user);
        $known = $this->knownExpiry($cycle);
        if ($known !== $expiredAt) {
            $cycle->pushEvent($this->event($now, 'expiry_changed', $by, ['before' => $known, 'after' => $expiredAt]));
            $this->applyExpiryRule($cycle, $expiredAt, $now, $by);
        }

        if ($this->intOrNull($cycle->plan_id) !== $this->intOrNull($user->plan_id)) {
            $this->changePlan($cycle, $user, $now, $by);
        }

        if ($cycle->isDirty()) {
            $cycle->save();
        }
    }

    private function changePlan(TrafficCycle $cycle, User $user, int $now, array $by): void
    {
        $oldMethod = $this->resetMethod($this->plan($cycle->plan_id));
        $cycle->pushEvent($this->event($now, 'plan_changed', $by, ['from' => $cycle->plan_id, 'to' => $user->plan_id]));
        $cycle->plan_id = $user->plan_id;
        $newMethod = $this->methodFor($user);
        if ($oldMethod !== $newMethod) {
            $endsAt = self::planEnd((int) $cycle->started_at, $this->expiry($user), $newMethod, $this->minSeconds(), $this->timezone());
            $this->setEnds($cycle, $endsAt, 'method_changed', $now, $by);
        }
    }

    /**
     * 到期时间变化时对当前周期重新评估（DESIGN §3.3 第 2 条），null 视为无限远。
     */
    private function applyExpiryRule(TrafficCycle $cycle, ?int $expiredAt, int $now, array $by): void
    {
        $endsAt = $cycle->ends_at;
        if ($expiredAt === null) {
            return;
        }
        if ($endsAt === null || $expiredAt <= $endsAt) {
            $this->setEnds($cycle, $expiredAt, 'expiry_shrunk', $now, $by);
        } elseif ($expiredAt - $endsAt < $this->minSeconds()) {
            $this->setEnds($cycle, $expiredAt, 'tail_merged', $now, $by);
        }
    }

    private function setEnds(TrafficCycle $cycle, ?int $endsAt, string $why, int $now, array $by): void
    {
        if ($endsAt === $cycle->ends_at) {
            return;
        }
        $cycle->pushEvent($this->event($now, 'schedule_changed', $by, [
            'ends_before' => $cycle->ends_at,
            'ends_after' => $endsAt,
            'why' => $why,
        ]));
        $cycle->ends_at = $endsAt;
    }

    /**
     * The expiry the ledger last saw for this cycle: latest renewal / expiry_changed event, else the
     * expiry when the cycle started.
     */
    private function knownExpiry(TrafficCycle $cycle): ?int
    {
        foreach (array_reverse($cycle->events ?? []) as $event) {
            $type = $event['type'] ?? null;
            if ($type === 'renewal' && array_key_exists('expired_after', $event)) {
                return $this->intOrNull($event['expired_after']);
            }
            if ($type === 'expiry_changed' && array_key_exists('after', $event)) {
                return $this->intOrNull($event['after']);
            }
        }
        return $this->intOrNull($cycle->expired_at_start);
    }

    private function eligibility(User $user, ?TrafficCycle $cycle, int $minRemainingDays, int $now): array
    {
        $result = [
            'eligible' => false,
            'reason' => 'no_cycle',
            'shift_seconds' => 0,
            'next_quota' => $this->bytes($user->transfer_enable),
            'expired_after' => null,
            'cycle_ends_at' => null,
        ];
        if (!$cycle) {
            return $result;
        }
        $result['next_quota'] = (int) ($cycle->next_quota ?? $cycle->quota);
        $expiredAt = $this->expiry($user);
        if ($expiredAt === null) {
            return ['reason' => 'no_expiry'] + $result;
        }
        if ($this->isFinal($cycle->ends_at, $expiredAt)) {
            return ['reason' => 'final_cycle'] + $result;
        }

        $shift = max(0, (int) $cycle->ends_at - $now);
        $expiredAfter = $expiredAt - $shift;
        $result['shift_seconds'] = $shift;
        $result['expired_after'] = $expiredAfter;
        $result['cycle_ends_at'] = self::planEnd($now, $expiredAfter, $this->methodFor($user), $this->minSeconds(), $this->timezone());
        if ($expiredAt - $now < $minRemainingDays * 86400) {
            return ['reason' => 'remaining_too_short'] + $result;
        }

        return ['eligible' => true, 'reason' => 'eligible'] + $result;
    }

    private function advanceSection(User $user, ?TrafficCycle $cycle, int $now): array
    {
        $policy = HookManager::filter('traffic_cycle.advance_policy', null, $user);
        if (!is_array($policy) || empty($policy['enabled'])) {
            $section = ['enabled' => false, 'reason' => 'disabled'];
            if (is_array($policy) && isset($policy['min_remaining_days'])) {
                $section['min_remaining_days'] = (int) $policy['min_remaining_days'];
            }
            return $section;
        }

        $minDays = (int) ($policy['min_remaining_days'] ?? 30);
        $check = $this->eligibility($user, $cycle, $minDays, $now);

        return [
            'enabled' => true,
            'min_remaining_days' => $minDays,
            'eligible_if_exhausted' => $check['eligible'],
            'reason' => $check['reason'],
            'shift_seconds' => $check['shift_seconds'],
            'next_quota' => $check['next_quota'],
            'expired_after' => $check['expired_after'],
        ];
    }

    /**
     * Compute (without writing) what an admin user/update does to the current cycle.
     */
    private function computeAdminChange(?TrafficCycle $cycle, array $before, array $after, array $options, int $now): array
    {
        $mode = ($options['cycle_mode'] ?? null) === 'restart' ? 'restart' : 'keep';
        $scope = ($options['cycle_quota_scope'] ?? null) === 'cycle' ? 'cycle' : 'standing';
        $customEnds = isset($options['cycle_ends_at']) && $options['cycle_ends_at'] !== '' ? (int) $options['cycle_ends_at'] : null;
        $noteSet = !empty($options['cycle_note_set']);
        $note = $noteSet ? ($options['cycle_note'] ?? null) : null;
        $note = $note === '' ? null : $note;

        $expiredAt = $after['expired_at'];
        $plan = $this->plan($after['plan_id']);
        $planQuota = $plan ? (int) $plan->transfer_enable * self::GB : null;
        $method = $this->resetMethod($plan);
        $minSeconds = $this->minSeconds();
        $tz = $this->timezone();
        $active = $after['plan_id'] !== null && ($expiredAt === null || $expiredAt > $now);
        $quotaChanged = $after['transfer_enable'] !== $before['transfer_enable'];
        $planChanged = $after['plan_id'] !== $before['plan_id'];
        $usageEdited = $after['u'] !== $before['u'] || $after['d'] !== $before['d'];

        $effects = [];
        $warnings = [];
        $errors = [];
        if ($planChanged) {
            $effects[] = ['type' => 'plan_changed', 'from' => $before['plan_id'], 'to' => $after['plan_id']];
        }
        if ($expiredAt !== $before['expired_at']) {
            $effects[] = ['type' => 'expiry_changed', 'before' => $before['expired_at'], 'after' => $expiredAt];
        }
        if ($after['plan_id'] === null) {
            $warnings[] = ['type' => 'no_plan'];
        }
        if ($customEnds !== null && $mode !== 'restart') {
            $errors[] = '只有选择“从现在重新开始”时才能指定本周期结束时间';
        }

        $restart = $active && ($mode === 'restart' || !$cycle);
        $close = $cycle && (!$active || $restart);
        $events = [];
        $attrs = null;

        if ($restart) {
            $effects[] = ['type' => 'cycle_restart'];
            $kind = TrafficCycle::KIND_STANDARD;
            $nextQuota = $after['transfer_enable'];
            if ($quotaChanged && $scope === 'cycle') {
                $kind = TrafficCycle::KIND_SPECIAL;
                $nextQuota = $planQuota ?? $this->standingQuota($cycle, $before);
            } elseif (!$quotaChanged && $cycle && $cycle->kind === TrafficCycle::KIND_SPECIAL) {
                $kind = TrafficCycle::KIND_SPECIAL;
                $nextQuota = $planChanged && $planQuota !== null ? $planQuota : (int) ($cycle->next_quota ?? $cycle->quota);
            }
            $endsAt = self::planEnd($now, $expiredAt, $method, $minSeconds, $tz);
            if ($customEnds !== null) {
                $endsAt = $customEnds;
                if ($customEnds <= $now) {
                    $warnings[] = ['type' => 'ends_before_now', 'ends_at' => $customEnds];
                    $errors[] = '本周期结束时间必须晚于当前时间';
                }
                if ($expiredAt !== null && $customEnds > $expiredAt) {
                    $warnings[] = ['type' => 'ends_after_expiry', 'ends_at' => $customEnds, 'expired_at' => $expiredAt];
                    $errors[] = '本周期结束时间不能晚于订阅到期时间';
                    $endsAt = $expiredAt;
                }
            }
            if ($cycle && $endsAt !== $cycle->ends_at) {
                $effects[] = ['type' => 'ends_changed', 'before' => $cycle->ends_at, 'after' => $endsAt, 'why' => 'restart'];
            }
            $attrs = [
                'id' => null,
                'seq' => $cycle ? (int) $cycle->seq + 1 : null,
                'plan_id' => $after['plan_id'],
                'kind' => $kind,
                'quota' => $after['transfer_enable'],
                'next_quota' => $nextQuota,
                'started_at' => $now,
                'ends_at' => $endsAt,
                'start_reason' => TrafficCycle::REASON_ADMIN,
                'order_id' => null,
                'note' => $noteSet ? $note : ($cycle?->note),
                'events' => [],
            ];
        } elseif ($active && $cycle) {
            $probe = $cycle->replicate();
            $probe->events = [];
            if ($quotaChanged) {
                $probe->quota = $after['transfer_enable'];
                if ($scope === 'cycle') {
                    $probe->kind = TrafficCycle::KIND_SPECIAL;
                    $probe->next_quota = $planQuota ?? $this->standingQuota($cycle, $before);
                } else {
                    $probe->kind = TrafficCycle::KIND_STANDARD;
                    $probe->next_quota = $after['transfer_enable'];
                }
                $probe->pushEvent($this->event($now, 'quota_changed', ['by' => 'admin'], [
                    'before' => $before['transfer_enable'],
                    'after' => $after['transfer_enable'],
                    'scope' => $scope,
                ]));
            } elseif ($planChanged && $probe->kind === TrafficCycle::KIND_SPECIAL && $planQuota !== null) {
                $probe->next_quota = $planQuota;
            }
            if ($expiredAt !== $before['expired_at']) {
                $probe->pushEvent($this->event($now, 'expiry_changed', ['by' => 'admin'], [
                    'before' => $before['expired_at'],
                    'after' => $expiredAt,
                ]));
                $this->applyExpiryRule($probe, $expiredAt, $now, ['by' => 'admin']);
            }
            if ($planChanged) {
                $probe->pushEvent($this->event($now, 'plan_changed', ['by' => 'admin'], [
                    'from' => $before['plan_id'],
                    'to' => $after['plan_id'],
                ]));
                $probe->plan_id = $after['plan_id'];
                if ($this->resetMethod($this->plan($before['plan_id'])) !== $method) {
                    $this->setEnds($probe, self::planEnd((int) $probe->started_at, $expiredAt, $method, $minSeconds, $tz), 'method_changed', $now, ['by' => 'admin']);
                }
            }
            if ($noteSet && $note !== $cycle->note) {
                $probe->note = $note;
                $probe->pushEvent($this->event($now, 'note_changed', ['by' => 'admin'], []));
            }
            if ($probe->ends_at !== $cycle->ends_at) {
                $last = null;
                foreach ($probe->events ?? [] as $event) {
                    if (($event['type'] ?? null) === 'schedule_changed') {
                        $last = $event['why'] ?? null;
                    }
                }
                $effects[] = ['type' => 'ends_changed', 'before' => $cycle->ends_at, 'after' => $probe->ends_at, 'why' => $last];
            }
            $events = $probe->events ?? [];
            $attrs = [
                'id' => (int) $cycle->id,
                'seq' => (int) $cycle->seq,
                'plan_id' => $probe->plan_id,
                'kind' => $probe->kind,
                'quota' => (int) $probe->quota,
                'next_quota' => $probe->next_quota,
                'started_at' => (int) $cycle->started_at,
                'ends_at' => $probe->ends_at,
                'start_reason' => $cycle->start_reason,
                'order_id' => $cycle->order_id,
                'note' => $probe->note,
                'events' => array_merge($cycle->events ?? [], $events),
            ];
        }

        if ($quotaChanged && $attrs) {
            $effects[] = [
                'type' => $attrs['kind'] === TrafficCycle::KIND_SPECIAL && $scope === 'cycle' ? 'quota_cycle_only' : 'quota_standing',
                'before' => $before['transfer_enable'],
                'after' => $after['transfer_enable'],
                'next_quota' => $attrs['next_quota'],
            ];
        }

        $usage = [$after['u'], $after['d']];
        $clear = null;
        $zeroed = $after['u'] === 0 && $after['d'] === 0;
        // restarting clears the usage; an admin who also typed 0 into the usage fields means the same
        if ($restart && $mode === 'restart' && (!$usageEdited || $zeroed) && ($before['u'] !== 0 || $before['d'] !== 0)) {
            $usage = [0, 0];
            $clear = TrafficResetLog::REASON_ADMIN_RESTART;
        } elseif ($usageEdited && $after['u'] + $after['d'] < $before['u'] + $before['d']) {
            $clear = TrafficResetLog::REASON_ADMIN_USAGE_EDIT;
        }
        if ($clear) {
            $effects[] = [
                'type' => 'usage_cleared',
                'reason' => $clear,
                'cleared' => $before['u'] + $before['d'] - $usage[0] - $usage[1],
            ];
        }

        if ($attrs) {
            if ($after['transfer_enable'] < $usage[0] + $usage[1]) {
                $warnings[] = ['type' => 'quota_below_used', 'quota' => $after['transfer_enable'], 'used' => $usage[0] + $usage[1]];
            }
            if (!$this->isFinal($attrs['ends_at'], $expiredAt) && $attrs['ends_at'] > $attrs['started_at']
                && $attrs['ends_at'] - $attrs['started_at'] < $minSeconds) {
                $warnings[] = ['type' => 'short_cycle', 'seconds' => $attrs['ends_at'] - $attrs['started_at'], 'min_seconds' => $minSeconds];
            }
        }

        return [
            'restart' => $restart,
            'close' => $close,
            'active' => $active,
            'cycle' => $attrs,
            'new_events' => $events,
            'usage' => $usage,
            'clear' => $clear,
            'note_set' => $noteSet,
            'note' => $note,
            'effects' => $effects,
            'warnings' => $warnings,
            'errors' => $errors,
        ];
    }

    private function applyAdminChange(User $user, ?TrafficCycle $cycle, array $change, array $before, ?int $adminId, int $now): void
    {
        $expiredAt = $this->expiry($user);
        $closedId = null;
        if ($change['close'] && $cycle) {
            if ($change['active']) {
                $this->finish($cycle, $now, TrafficCycle::REASON_REPLACED, $before['u'], $before['d']);
            } elseif ($user->plan_id === null) {
                $this->finish($cycle, $now, TrafficCycle::REASON_REPLACED, $before['u'], $before['d']);
            } else {
                $this->finishExpired($cycle, $expiredAt, $user, $before['u'], $before['d']);
            }
            $closedId = (int) $cycle->id;
        }

        $current = null;
        $attrs = $change['cycle'];
        if ($attrs && $change['restart']) {
            $current = $this->createCycle($user, [
                'started_at' => $now,
                'ends_at' => $attrs['ends_at'],
                'quota' => $attrs['quota'],
                'next_quota' => $attrs['next_quota'],
                'kind' => $attrs['kind'],
                'start_reason' => TrafficCycle::REASON_ADMIN,
                'note' => $attrs['note'],
            ]);
        } elseif ($attrs && $cycle) {
            $current = $cycle;
            foreach (['plan_id', 'kind', 'quota', 'next_quota', 'ends_at', 'note'] as $key) {
                $current->{$key} = $attrs[$key];
            }
            foreach ($change['new_events'] as $event) {
                if ($adminId !== null) {
                    $event['admin_id'] = $adminId;
                }
                $current->pushEvent($event);
            }
            $current->save();
        }

        [$upload, $download] = $change['usage'];
        $user->u = $upload;
        $user->d = $download;
        if ($change['clear']) {
            $restart = $change['clear'] === TrafficResetLog::REASON_ADMIN_RESTART;
            $log = app(TrafficResetService::class)->writeLog($user, TrafficResetLog::SOURCE_MANUAL, $before['u'], $before['d'], [
                'reason' => $change['clear'],
                'cycle_id' => $current?->id,
                'prev_cycle_id' => $closedId,
                'admin_id' => $adminId,
                'quota_before' => $before['transfer_enable'],
                'quota_after' => $this->bytes($user->transfer_enable),
                'expired_before' => $before['expired_at'],
                'expired_after' => $expiredAt,
                'note' => $change['note'],
            ], $upload, $download, $restart);
            if ($restart) {
                $user->last_reset_at = $now;
                $user->reset_count = (int) $user->reset_count + 1;
            } elseif ($current) {
                $current->pushEvent($this->event($now, 'usage_cleared', ['by' => 'admin', 'admin_id' => $adminId], [
                    'log_id' => (int) $log->id,
                    'cleared' => (int) $log->old_total - (int) $log->new_total,
                    'reason' => $change['clear'],
                ]));
                $current->save();
            }
        }

        $user->next_reset_at = $current ? $this->nextResetFor($current->ends_at, $expiredAt) : null;
    }

    private function standingQuota(?TrafficCycle $cycle, array $before): int
    {
        if ($cycle) {
            return (int) ($cycle->next_quota ?? $cycle->quota);
        }
        return $before['transfer_enable'];
    }

    private function stateOf(User $user): array
    {
        return $this->normalizeState([
            'plan_id' => $user->plan_id,
            'transfer_enable' => $user->transfer_enable,
            'expired_at' => $user->expired_at,
            'u' => $user->u,
            'd' => $user->d,
        ]);
    }

    private function normalizeState(array $state): array
    {
        return [
            'plan_id' => $this->intOrNull($state['plan_id']),
            'transfer_enable' => $this->bytes($state['transfer_enable']),
            'expired_at' => $this->intOrNull($state['expired_at']),
            'u' => (int) ($state['u'] ?? 0),
            'd' => (int) ($state['d'] ?? 0),
        ];
    }

    /**
     * Zero the usage, write the log when something was cleared and count the reset.
     * $alwaysLog: an advance moves the expiry even when nothing was used, so it is always logged.
     *
     * @return int|null reset log id
     */
    private function clearUsage(User $user, int $now, string $triggerSource, array $metadata, int $upload, int $download, bool $countReset = true, bool $alwaysLog = false): ?int
    {
        $user->u = 0;
        $user->d = 0;
        $user->last_reset_at = $now;
        if ($upload === 0 && $download === 0 && !$alwaysLog) {
            return null;
        }
        if ($countReset) {
            $user->reset_count = (int) $user->reset_count + 1;
        }
        $log = app(TrafficResetService::class)->writeLog($user, $triggerSource, $upload, $download, $metadata);
        return (int) $log->id;
    }

    private function afterReset(User $user): void
    {
        app(TrafficResetService::class)->forgetUserCache($user);
        HookManager::call('traffic.reset.after', $user);
    }

    /**
     * Close a cycle that is being replaced; one whose subscription had already lapsed ends as expired.
     */
    private function closeForReplacement(TrafficCycle $cycle, User $user, int $now): void
    {
        $known = $this->knownExpiry($cycle);
        $upload = (int) $user->getOriginal('u');
        $download = (int) $user->getOriginal('d');
        if ($known !== null && $known <= $now) {
            $this->finishExpired($cycle, $known, $user, $upload, $download);
            return;
        }
        $this->finish($cycle, $now, TrafficCycle::REASON_REPLACED, $upload, $download);
    }

    private function finishExpired(TrafficCycle $cycle, ?int $expiredAt, User $user, ?int $upload = null, ?int $download = null): void
    {
        $endedAt = $expiredAt ?? $this->now();
        if ($cycle->ends_at !== null) {
            $endedAt = min($endedAt, (int) $cycle->ends_at);
        }
        $this->finish(
            $cycle,
            max((int) $cycle->started_at, $endedAt),
            TrafficCycle::REASON_EXPIRED,
            $upload ?? (int) $user->u,
            $download ?? (int) $user->d
        );
    }

    private function finish(TrafficCycle $cycle, int $endedAt, string $reason, int $upload, int $download): void
    {
        $cycle->ended_at = $endedAt;
        $cycle->end_reason = $reason;
        $cycle->u_end = max(0, $upload);
        $cycle->d_end = max(0, $download);
        $cycle->save();
    }

    /**
     * Open a new cycle for the user (seq + 1). ends_at defaults to planEnd(started_at, E); the user's
     * next_reset_at is set in memory, the caller saves the user.
     */
    private function createCycle(User $user, array $attrs): TrafficCycle
    {
        $expiredAt = $this->expiry($user);
        $start = (int) $attrs['started_at'];
        $endsAt = array_key_exists('ends_at', $attrs)
            ? $attrs['ends_at']
            : self::planEnd($start, $expiredAt, $this->methodFor($user), $this->minSeconds(), $this->timezone());
        if ($endsAt !== null && $expiredAt !== null && $endsAt > $expiredAt) {
            $endsAt = $expiredAt;
        }

        $cycle = new TrafficCycle([
            'user_id' => (int) $user->id,
            'seq' => (int) TrafficCycle::where('user_id', $user->id)->max('seq') + 1,
            'plan_id' => $this->intOrNull($user->plan_id),
            'kind' => $attrs['kind'] ?? TrafficCycle::KIND_STANDARD,
            'quota' => max(0, (int) $attrs['quota']),
            'next_quota' => isset($attrs['next_quota']) ? max(0, (int) $attrs['next_quota']) : null,
            'started_at' => $start,
            'ends_at' => $endsAt,
            'start_reason' => $attrs['start_reason'],
            'order_id' => $attrs['order_id'] ?? null,
            'expired_at_start' => $expiredAt,
            'note' => $attrs['note'] ?? null,
            'events' => [],
        ]);
        $cycle->save();
        $user->next_reset_at = $this->nextResetFor($endsAt, $expiredAt);

        return $cycle;
    }

    /**
     * Write next_reset_at without saving other pending attributes or firing model events.
     */
    private function persistNextReset(User $user, ?int $nextResetAt): void
    {
        if ($this->intOrNull($user->getOriginal('next_reset_at')) === $nextResetAt
            && $this->intOrNull($user->next_reset_at) === $nextResetAt) {
            return;
        }
        User::query()->whereKey($user->getKey())->toBase()->update(['next_reset_at' => $nextResetAt]);
        $user->next_reset_at = $nextResetAt;
        $user->syncOriginalAttribute('next_reset_at');
    }

    private function openCycleFor(int $userId): ?TrafficCycle
    {
        return TrafficCycle::where('user_id', $userId)
            ->whereNull('ended_at')
            ->orderByDesc('seq')
            ->first();
    }

    private function upcoming(?int $from, ?int $expiredAt, int $method, int $quota): array
    {
        if ($this->isFinal($from, $expiredAt) || $expiredAt === null) {
            return [];
        }
        $list = [];
        $minSeconds = $this->minSeconds();
        $tz = $this->timezone();
        $start = $from;
        while (count($list) < self::UPCOMING_LIMIT) {
            $end = self::planEnd($start, $expiredAt, $method, $minSeconds, $tz);
            if ($end === null || $end <= $start) {
                break;
            }
            $final = $end >= $expiredAt;
            $list[] = [
                'index' => count($list) + 1,
                'starts_at' => $start,
                'ends_at' => $end,
                'quota' => $quota,
                'is_final' => $final,
            ];
            if ($final) {
                break;
            }
            $start = $end;
        }
        return $list;
    }

    private function presentCycle(TrafficCycle $cycle, ?int $expiredAt, ?User $user = null, bool $admin = false): array
    {
        $current = $cycle->ended_at === null;
        $upload = $current ? (int) ($user?->u ?? 0) : (int) $cycle->u_end;
        $download = $current ? (int) ($user?->d ?? 0) : (int) $cycle->d_end;
        $events = $cycle->events ?? [];
        if (!$admin) {
            // which admin made a change is internal
            $events = array_map(static function (array $event) {
                unset($event['admin_id']);
                return $event;
            }, $events);
        }

        return $this->presentCycleAttributes([
            'id' => (int) $cycle->id,
            'seq' => (int) $cycle->seq,
            'plan_id' => $cycle->plan_id,
            'kind' => $cycle->kind,
            'quota' => (int) $cycle->quota,
            'next_quota' => $cycle->next_quota,
            'started_at' => (int) $cycle->started_at,
            'ends_at' => $cycle->ends_at,
            'ended_at' => $cycle->ended_at,
            'start_reason' => $cycle->start_reason,
            'end_reason' => $cycle->end_reason,
            'order_id' => $cycle->order_id,
            'note' => $cycle->note,
            'events' => $events,
            'u_end' => $cycle->u_end,
            'd_end' => $cycle->d_end,
        ], $current ? $expiredAt : null, $upload, $download);
    }

    /**
     * Cycle structure of DESIGN §7.1 (also used for preview cycles that are not saved).
     */
    private function presentCycleAttributes(array $attrs, ?int $expiredAt, int $upload, int $download): array
    {
        $endedAt = $attrs['ended_at'] ?? null;
        $quota = (int) $attrs['quota'];
        $used = $upload + $download;
        $isFinal = $endedAt === null
            ? $this->isFinal($attrs['ends_at'], $expiredAt)
            : ($attrs['end_reason'] ?? null) === TrafficCycle::REASON_EXPIRED;

        return [
            'id' => $attrs['id'],
            'seq' => $attrs['seq'],
            'kind' => $attrs['kind'],
            'plan_id' => $this->intOrNull($attrs['plan_id']),
            'plan_name' => $this->plan($attrs['plan_id'])?->name,
            'quota' => $quota,
            'next_quota' => $this->intOrNull($attrs['next_quota']),
            'u' => $upload,
            'd' => $download,
            'used' => $used,
            'remaining' => max(0, $quota - $used),
            'u_end' => $this->intOrNull($attrs['u_end'] ?? null),
            'd_end' => $this->intOrNull($attrs['d_end'] ?? null),
            'started_at' => (int) $attrs['started_at'],
            'ends_at' => $this->intOrNull($attrs['ends_at']),
            'ended_at' => $this->intOrNull($endedAt),
            'is_final' => $isFinal,
            'start_reason' => $attrs['start_reason'],
            'end_reason' => $attrs['end_reason'] ?? null,
            'order_id' => $this->intOrNull($attrs['order_id'] ?? null),
            'note' => $attrs['note'] ?? null,
            'events' => array_values($attrs['events'] ?? []),
        ];
    }

    private function presentLog(TrafficResetLog $log, bool $admin): array
    {
        $fields = $log->cycleFields();
        // users see the cycle note an admin restart / usage edit carried; a manual reset's reason text stays internal
        if (!$admin && !in_array($fields['reason'], [TrafficResetLog::REASON_ADMIN_RESTART, TrafficResetLog::REASON_ADMIN_USAGE_EDIT], true)) {
            $fields['note'] = null;
        }
        $row = [
            'id' => (int) $log->id,
            'at' => $log->reset_time?->getTimestamp(),
            'reason' => $fields['reason'],
            'legacy' => $fields['legacy'],
            'trigger_source' => $log->trigger_source,
            'cleared' => $fields['cleared'],
            'cleared_upload' => $fields['cleared_upload'],
            'cleared_download' => $fields['cleared_download'],
            'quota_before' => $fields['quota_before'],
            'quota_after' => $fields['quota_after'],
            'expired_before' => $fields['expired_before'],
            'expired_after' => $fields['expired_after'],
            'shift_seconds' => $fields['shift_seconds'],
            'cycle_id' => $fields['cycle_id'],
            'order_id' => $fields['order_id'],
            'note' => $fields['note'],
        ];
        if ($admin) {
            $row['is_noise'] = $fields['is_noise'];
            $row['admin_id'] = $fields['admin_id'];
            $row['metadata'] = $log->metadata;
        }
        return $row;
    }

    private function snapshot(User $user): array
    {
        $upload = (int) $user->u;
        $download = (int) $user->d;

        return [
            'id' => $this->intOrNull($user->id),
            'email' => $user->email,
            'plan_id' => $this->intOrNull($user->plan_id),
            'plan_name' => $this->plan($user->plan_id)?->name,
            'u' => $upload,
            'd' => $download,
            'used_traffic' => $upload + $download,
            'transfer_enable' => (int) $user->transfer_enable,
            'expired_at' => $this->expiry($user),
            'next_reset_at' => $this->intOrNull($user->next_reset_at),
            'last_reset_at' => $this->intOrNull($user->last_reset_at),
            'reset_count' => (int) $user->reset_count,
        ];
    }

    private function event(int $at, string $type, array $by, array $fields): array
    {
        $event = ['at' => $at, 'type' => $type, 'by' => $by['by'] ?? 'system'];
        foreach (['admin_id', 'order_id'] as $key) {
            if (isset($by[$key])) {
                $event[$key] = $by[$key];
            }
        }
        return $event + $fields;
    }

    private function methodFor(User $user): int
    {
        return $this->resetMethod($this->plan($user->plan_id));
    }

    private function plan(mixed $planId): ?Plan
    {
        $planId = $this->intOrNull($planId);
        if ($planId === null) {
            return null;
        }
        if (!array_key_exists($planId, $this->plans)) {
            $this->plans[$planId] = Plan::find($planId);
        }
        return $this->plans[$planId];
    }

    private function expiry(User $user): ?int
    {
        return $this->intOrNull($user->expired_at);
    }

    private function bytes(mixed $value): int
    {
        return max(0, (int) round((float) $value));
    }

    private function intOrNull(mixed $value): ?int
    {
        return $value === null || $value === '' ? null : (int) $value;
    }

    private function timezone(): string
    {
        return (string) config('app.timezone', 'UTC');
    }

    private function now(): int
    {
        return Carbon::now()->getTimestamp();
    }
}
