<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 流量周期账本（docs/traffic-cycle/DESIGN.md §4.1）
 *
 * @property int $id
 * @property int $user_id
 * @property int $seq 该用户第几个周期
 * @property int|null $plan_id
 * @property string $kind standard / special
 * @property int $quota 本周期额度（字节）
 * @property int|null $next_quota 下一周期额度；null = 同 quota
 * @property int $started_at
 * @property int|null $ends_at 计划结束；null = 不排期
 * @property int|null $ended_at 实际结束；null = 当前周期
 * @property string $start_reason
 * @property string|null $end_reason
 * @property int|null $order_id
 * @property int|null $u_end
 * @property int|null $d_end
 * @property int|null $expired_at_start
 * @property string|null $note
 * @property array|null $events
 * @property int $created_at
 * @property int $updated_at
 *
 * @property-read User $user
 * @property-read Plan|null $plan
 */
class TrafficCycle extends Model
{
    public const KIND_STANDARD = 'standard';
    public const KIND_SPECIAL = 'special';

    // start / end reasons (DESIGN §5)
    public const REASON_PURCHASE = 'purchase';
    public const REASON_UPGRADE = 'upgrade';
    public const REASON_ONETIME = 'onetime';
    public const REASON_ROLLOVER = 'rollover';
    public const REASON_CATCH_UP = 'catch_up';
    public const REASON_ADVANCE = 'advance';
    public const REASON_ADVANCED = 'advanced';
    public const REASON_ADMIN = 'admin';
    public const REASON_BOOTSTRAP = 'bootstrap';
    public const REASON_REPLACED = 'replaced';
    public const REASON_EXPIRED = 'expired';

    public const MAX_EVENTS = 50;

    protected $table = 'v2_traffic_cycle';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = [
        'user_id' => 'integer',
        'seq' => 'integer',
        'plan_id' => 'integer',
        'quota' => 'integer',
        'next_quota' => 'integer',
        'started_at' => 'integer',
        'ends_at' => 'integer',
        'ended_at' => 'integer',
        'order_id' => 'integer',
        'u_end' => 'integer',
        'd_end' => 'integer',
        'expired_at_start' => 'integer',
        'events' => 'array',
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id', 'id');
    }

    /**
     * Append a lifecycle event (DESIGN §4.3), keeping only the newest MAX_EVENTS.
     */
    public function pushEvent(array $event): void
    {
        $events = $this->events ?? [];
        $events[] = $event;
        if (count($events) > self::MAX_EVENTS) {
            $events = array_slice($events, -self::MAX_EVENTS);
        }
        $this->events = array_values($events);
    }
}
