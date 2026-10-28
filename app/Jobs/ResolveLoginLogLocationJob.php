<?php

namespace App\Jobs;

use App\Models\UserLoginLog;
use App\Services\LoginLogService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * 异步解析登录记录的 IP 归属地（ip.sb，失败回退 ip-api.com）。
 * 同一 IP 仍处于待解析状态的其他记录会一并补全。
 */
class ResolveLoginLogLocationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 20;
    public $backoff = [90, 300];

    protected int $logId;

    public function __construct(int $logId)
    {
        $this->onQueue('default');
        $this->logId = $logId;
    }

    public function handle(): void
    {
        $log = UserLoginLog::find($this->logId);
        if (!$log || $log->geo_status !== UserLoginLog::GEO_PENDING || !$log->ip) {
            return;
        }

        $geo = LoginLogService::lookup($log->ip);
        if (!$geo) {
            if ($this->attempts() >= $this->tries) {
                $this->markFailed($log->ip);
                return;
            }
            $this->release($this->backoff[$this->attempts() - 1] ?? 300);
            return;
        }

        UserLoginLog::where('ip', $log->ip)
            ->where('geo_status', UserLoginLog::GEO_PENDING)
            ->update(array_merge($geo, [
                'geo_status' => UserLoginLog::GEO_RESOLVED,
                'updated_at' => time(),
            ]));
    }

    public function failed(\Throwable $e): void
    {
        $log = UserLoginLog::find($this->logId);
        if ($log && $log->ip) {
            $this->markFailed($log->ip);
        }
    }

    private function markFailed(string $ip): void
    {
        UserLoginLog::where('ip', $ip)
            ->where('geo_status', UserLoginLog::GEO_PENDING)
            ->update(['geo_status' => UserLoginLog::GEO_FAILED, 'updated_at' => time()]);
    }
}
