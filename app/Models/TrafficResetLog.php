<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 流量重置记录模型
 * 
 * @property int $id
 * @property int $user_id 用户ID
 * @property string $reset_type 重置类型
 * @property \Carbon\Carbon $reset_time 重置时间
 * @property int $old_upload 重置前上传流量
 * @property int $old_download 重置前下载流量
 * @property int $old_total 重置前总流量
 * @property int $new_upload 重置后上传流量
 * @property int $new_download 重置后下载流量
 * @property int $new_total 重置后总流量
 * @property string $trigger_source 触发来源
 * @property array|null $metadata 额外元数据
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * 
 * @property-read User $user 关联用户
 */
class TrafficResetLog extends Model
{
    protected $table = 'v2_traffic_reset_logs';

    protected $fillable = [
        'user_id',
        'reset_type',
        'reset_time',
        'old_upload',
        'old_download',
        'old_total',
        'new_upload',
        'new_download',
        'new_total',
        'trigger_source',
        'metadata',
    ];

    protected $casts = [
        'reset_time' => 'datetime',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // 重置类型常量
    public const TYPE_MONTHLY = 'monthly';
    public const TYPE_FIRST_DAY_MONTH = 'first_day_month';
    public const TYPE_YEARLY = 'yearly';
    public const TYPE_FIRST_DAY_YEAR = 'first_day_year';
    public const TYPE_MANUAL = 'manual';
    public const TYPE_PURCHASE = 'purchase';

    // 触发来源常量
    public const SOURCE_AUTO = 'auto';
    public const SOURCE_MANUAL = 'manual';
    public const SOURCE_API = 'api';
    public const SOURCE_CRON = 'cron';
    public const SOURCE_USER_ACCESS = 'user_access';
    public const SOURCE_ORDER = 'order';
    public const SOURCE_GIFT_CARD = 'gift_card';

    // metadata.reason（docs/traffic-cycle/DESIGN.md §5）
    public const REASON_CYCLE_ROLLOVER = 'cycle_rollover';
    public const REASON_AUTO_ADVANCE = 'auto_advance';
    public const REASON_NEW_PURCHASE = 'new_purchase';
    public const REASON_PLAN_CHANGE = 'plan_change';
    public const REASON_ONETIME_PURCHASE = 'onetime_purchase';
    public const REASON_RENEWAL_RESET = 'renewal_reset';
    public const REASON_RESET_PACKAGE = 'reset_package';
    public const REASON_GIFT_CARD_RESET = 'gift_card_reset';
    public const REASON_ADMIN_RESET = 'admin_reset';
    public const REASON_ADMIN_RESTART = 'admin_restart';
    public const REASON_ADMIN_USAGE_EDIT = 'admin_usage_edit';
    public const REASON_ORDER_RESET = 'order_reset';

    // 旧行（metadata 没有 reason）按触发来源推断原因
    public const LEGACY_REASON_BY_SOURCE = [
        self::SOURCE_CRON => self::REASON_CYCLE_ROLLOVER,
        self::SOURCE_AUTO => self::REASON_CYCLE_ROLLOVER,
        self::SOURCE_USER_ACCESS => self::REASON_CYCLE_ROLLOVER,
        self::SOURCE_ORDER => self::REASON_ORDER_RESET,
        self::SOURCE_MANUAL => self::REASON_ADMIN_RESET,
        self::SOURCE_API => self::REASON_ADMIN_RESET,
        self::SOURCE_GIFT_CARD => self::REASON_GIFT_CARD_RESET,
    ];

    // metadata 的固定字段，新行总是全部写出（DESIGN §4.2）
    public const METADATA_KEYS = [
        'reason',
        'cycle_id',
        'prev_cycle_id',
        'order_id',
        'admin_id',
        'quota_before',
        'quota_after',
        'expired_before',
        'expired_after',
        'shift_seconds',
        'note',
        'trigger',
    ];

    /**
     * 获取重置类型的多语言名称
     */
    public static function getResetTypeNames(): array
    {
        return [
            self::TYPE_MONTHLY => __('traffic_reset.reset_type.monthly'),
            self::TYPE_FIRST_DAY_MONTH => __('traffic_reset.reset_type.first_day_month'),
            self::TYPE_YEARLY => __('traffic_reset.reset_type.yearly'),
            self::TYPE_FIRST_DAY_YEAR => __('traffic_reset.reset_type.first_day_year'),
            self::TYPE_MANUAL => __('traffic_reset.reset_type.manual'),
            self::TYPE_PURCHASE => __('traffic_reset.reset_type.purchase'),
        ];
    }

    /**
     * 获取触发来源的多语言名称
     */
    public static function getSourceNames(): array
    {
        return [
            self::SOURCE_AUTO => __('traffic_reset.source.auto'),
            self::SOURCE_MANUAL => __('traffic_reset.source.manual'),
            self::SOURCE_API => __('traffic_reset.source.api'),
            self::SOURCE_CRON => __('traffic_reset.source.cron'),
            self::SOURCE_USER_ACCESS => __('traffic_reset.source.user_access'),
            self::SOURCE_ORDER => __('traffic_reset.source.order'),
            self::SOURCE_GIFT_CARD => __('traffic_reset.source.gift_card'),
        ];
    }

    public static function reasonCodes(): array
    {
        return [
            self::REASON_CYCLE_ROLLOVER,
            self::REASON_AUTO_ADVANCE,
            self::REASON_NEW_PURCHASE,
            self::REASON_PLAN_CHANGE,
            self::REASON_ONETIME_PURCHASE,
            self::REASON_RENEWAL_RESET,
            self::REASON_RESET_PACKAGE,
            self::REASON_GIFT_CARD_RESET,
            self::REASON_ADMIN_RESET,
            self::REASON_ADMIN_RESTART,
            self::REASON_ADMIN_USAGE_EDIT,
            self::REASON_ORDER_RESET,
        ];
    }

    /**
     * Full metadata for a new row: every DESIGN §4.2 key, plus any extra keys the caller passed.
     */
    public static function buildMetadata(array $context): array
    {
        $metadata = [];
        foreach (self::METADATA_KEYS as $key) {
            $metadata[$key] = $context[$key] ?? null;
        }
        foreach ($context as $key => $value) {
            if (!array_key_exists($key, $metadata) && $key !== 'cycle_start') {
                $metadata[$key] = $value;
            }
        }
        // MySQL reads a JSON null reason back as the string "null", which would turn the row
        // into a "meaningful" one in SQL while PHP still treats it as legacy; leave the key out
        if ($metadata['reason'] === null) {
            unset($metadata['reason']);
        }
        return $metadata;
    }

    /**
     * 有意义的记录：清零量不为 0，或者带了原因（新行、JSONL 回填的换时行）。
     */
    public function scopeMeaningful(Builder $query): void
    {
        $query->where(function (Builder $query) {
            $query->where('old_total', '!=', 0)->orWhereNotNull('metadata->reason');
        });
    }

    public function scopeNoise(Builder $query): void
    {
        $query->where('old_total', 0)->whereNull('metadata->reason');
    }

    /**
     * 按原因筛选，旧行按触发来源推断。
     */
    public function scopeReason(Builder $query, string $reason): void
    {
        $sources = array_keys(self::LEGACY_REASON_BY_SOURCE, $reason, true);
        $query->where(function (Builder $query) use ($reason, $sources) {
            $query->where('metadata->reason', $reason);
            if ($sources) {
                $query->orWhere(function (Builder $query) use ($sources) {
                    $query->whereNull('metadata->reason')->whereIn('trigger_source', $sources);
                });
            }
        });
    }

    public function isLegacy(): bool
    {
        return empty($this->metadata['reason']);
    }

    /**
     * 旧代码在新购、换时插件里会写“清除 0 B”的冗余行。
     */
    public function isNoise(): bool
    {
        return (int) $this->old_total === 0 && $this->isLegacy();
    }

    public function reasonCode(): ?string
    {
        if (!$this->isLegacy()) {
            return (string) $this->metadata['reason'];
        }
        return self::LEGACY_REASON_BY_SOURCE[$this->trigger_source] ?? null;
    }

    /**
     * 流量周期账本给每行补充的字段（DESIGN §7.1 events、§7.2 traffic-reset/logs）。
     */
    public function cycleFields(): array
    {
        $meta = is_array($this->metadata) ? $this->metadata : [];
        $int = static fn($value) => $value === null || $value === '' ? null : (int) $value;
        $reason = $this->reasonCode();

        return [
            'reason' => $reason,
            'legacy' => $this->isLegacy(),
            'is_noise' => $this->isNoise(),
            'cleared' => (int) ($meta['cleared'] ?? ((int) $this->old_total - (int) $this->new_total)),
            'cleared_upload' => (int) ($meta['cleared_upload'] ?? ((int) $this->old_upload - (int) $this->new_upload)),
            'cleared_download' => (int) ($meta['cleared_download'] ?? ((int) $this->old_download - (int) $this->new_download)),
            // 换时把超出旧额度的部分计入新周期（DESIGN §3.7），记在 new_total；其他行的 new_total 不是“带入”
            'carried' => $reason === self::REASON_AUTO_ADVANCE ? max(0, (int) ($meta['carried'] ?? $this->new_total)) : 0,
            'quota_before' => $int($meta['quota_before'] ?? null),
            'quota_after' => $int($meta['quota_after'] ?? null),
            'expired_before' => $int($meta['expired_before'] ?? null),
            'expired_after' => $int($meta['expired_after'] ?? null),
            'shift_seconds' => $int($meta['shift_seconds'] ?? null),
            'cycle_id' => $int($meta['cycle_id'] ?? null),
            'order_id' => $int($meta['order_id'] ?? null),
            'admin_id' => $int($meta['admin_id'] ?? null),
            'note' => isset($meta['note']) && $meta['note'] !== '' ? (string) $meta['note'] : null,
        ];
    }

    /**
     * 关联用户
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /**
     * 获取重置类型名称
     */
    public function getResetTypeName(): string
    {
        return self::getResetTypeNames()[$this->reset_type] ?? $this->reset_type;
    }

    /**
     * 获取触发来源名称
     */
    public function getSourceName(): string
    {
        return self::getSourceNames()[$this->trigger_source] ?? $this->trigger_source;
    }

    /**
     * 获取重置的流量差值
     */
    public function getTrafficDiff(): array
    {
        return [
            'upload_diff' => $this->new_upload - $this->old_upload,
            'download_diff' => $this->new_download - $this->old_download,
            'total_diff' => $this->new_total - $this->old_total,
        ];
    }

    /**
     * 格式化流量大小
     */
    public function formatTraffic(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);

        $bytes /= (1 << (10 * $pow));

        return round($bytes, 2) . ' ' . $units[$pow];
    }
}