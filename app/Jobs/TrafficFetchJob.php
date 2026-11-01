<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\Plugin\HookManager;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class TrafficFetchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    protected $data;
    protected $server;
    protected $protocol;
    protected $timestamp;
    public $tries = 1;
    public $timeout = 20;

    public function __construct(array $server, array $data, $protocol, int $timestamp)
    {
        $this->onQueue('traffic_fetch');
        $this->server = $server;
        $this->data = $data;
        $this->protocol = $protocol;
        $this->timestamp = $timestamp;
    }

    public function handle(): void
    {
        $userIds = array_keys($this->data);

        foreach ($this->data as $uid => $v) {
            User::where('id', $uid)
                ->incrementEach(
                    [
                        'u' => $v[0] * $this->server['rate'],
                        'd' => $v[1] * $this->server['rate'],
                    ],
                    ['t' => time()]
                );
        }

        if (!empty($userIds)) {
            Redis::sadd('traffic:pending_check', ...$userIds);
        }

        // 流量已记账后通知插件（TrafficReset 据此判断用尽并换时，docs/traffic-cycle/DESIGN.md §3.7、§6）。
        // 插件出错只记日志：已记的流量不能丢，任务也不能因此失败（tries = 1，重跑会重复记账）
        try {
            HookManager::call('traffic.process.after', [$this->server, $this->protocol, $this->data]);
        } catch (\Throwable $e) {
            Log::error('traffic.process.after hook failed', [
                'server_id' => $this->server['id'] ?? null,
                'users' => count($userIds),
                'error' => $e->getMessage(),
            ]);
        }
    }
}
