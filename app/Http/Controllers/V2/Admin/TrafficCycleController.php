<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\User;
use App\Services\TrafficCycleService;
use Illuminate\Http\Request;

/**
 * 流量周期账本（docs/traffic-cycle/DESIGN.md §7.2）
 */
class TrafficCycleController extends Controller
{
    /**
     * 用户的周期时间线：同用户端，额外带噪声行、metadata 原文、admin_id 和用户字段。
     */
    public function fetch(Request $request, TrafficCycleService $cycles)
    {
        $request->validate([
            'user_id' => 'required|integer|min:1',
            'history_page' => 'nullable|integer|min:1',
            'history_size' => 'nullable|integer|min:1|max:50',
            'events_size' => 'nullable|integer|min:1|max:50',
        ]);
        $user = User::find($request->input('user_id'));
        if (!$user) {
            return $this->fail([400202, '用户不存在']);
        }
        $size = (int) $request->input('history_size', 10);

        return $this->success($cycles->timeline($user, [
            'history_limit' => $size,
            'history_offset' => ((int) $request->input('history_page', 1) - 1) * $size,
            'events_limit' => (int) $request->input('events_size', 20),
            'admin' => true,
        ]));
    }

    /**
     * user/update 会对周期做什么（DESIGN §3.6）。只计算，不落库；GET 是为了不写审计日志。
     * plan_id / expired_at 传空字符串或 null 表示无套餐 / 长期有效，不传表示不改。
     */
    public function preview(Request $request, TrafficCycleService $cycles)
    {
        $request->validate([
            'id' => 'required|integer|min:1',
            'plan_id' => ['nullable', 'regex:/^(\d+|null)$/'],
            'transfer_enable' => 'nullable|numeric|min:0',
            'expired_at' => ['nullable', 'regex:/^(\d+|null)$/'],
            'u' => 'nullable|integer|min:0',
            'd' => 'nullable|integer|min:0',
            'cycle_mode' => 'nullable|in:keep,restart',
            'cycle_quota_scope' => 'nullable|in:cycle,standing',
            'cycle_ends_at' => 'nullable|integer|min:0',
            'cycle_note' => 'nullable|string|max:120',
        ]);
        $user = User::find($request->input('id'));
        if (!$user) {
            return $this->fail([400202, '用户不存在']);
        }

        $changes = [];
        foreach (['plan_id', 'expired_at'] as $key) {
            if ($request->exists($key)) {
                $value = $request->input($key);
                $changes[$key] = $value === null || $value === '' || $value === 'null' ? null : (int) $value;
            }
        }
        foreach (['transfer_enable', 'u', 'd'] as $key) {
            if ($request->filled($key)) {
                $changes[$key] = $request->input($key);
            }
        }
        if (isset($changes['plan_id']) && !Plan::find($changes['plan_id'])) {
            return $this->fail([400202, '订阅计划不存在']);
        }

        return $this->success($cycles->previewAdminUpdate($user, $changes, [
            'cycle_mode' => $request->input('cycle_mode'),
            'cycle_quota_scope' => $request->input('cycle_quota_scope'),
            'cycle_ends_at' => $request->input('cycle_ends_at'),
            'cycle_note' => $request->input('cycle_note'),
            'cycle_note_set' => $request->exists('cycle_note'),
        ]));
    }
}
