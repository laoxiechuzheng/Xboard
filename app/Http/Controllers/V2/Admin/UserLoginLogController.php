<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserLoginLog;
use App\Services\LoginLogService;
use Illuminate\Http\Request;

class UserLoginLogController extends Controller
{
    /**
     * 登录 / 注册记录（全站或指定用户）。
     * 筛选：user_id、email（模糊）、ip（前缀）、type、success、start_at / end_at（unix 秒）。
     * 分页参数与用户列表一致：current、pageSize；返回 paginate() 结构。
     */
    public function fetch(Request $request)
    {
        $request->validate([
            'current' => 'nullable|integer|min:1',
            'pageSize' => 'nullable|integer|min:1|max:200',
            'user_id' => 'nullable|integer|min:1',
            'email' => 'nullable|string|max:191',
            'ip' => 'nullable|string|max:64',
            'type' => 'nullable|string|in:login,register,mail_link',
            'success' => 'nullable|in:0,1,true,false',
            'start_at' => 'nullable|integer|min:0',
            'end_at' => 'nullable|integer|min:0',
        ]);

        $builder = UserLoginLog::query()->with('user:id,email');

        if ($request->filled('user_id')) {
            $builder->where('user_id', (int) $request->input('user_id'));
        }
        if ($request->filled('email')) {
            $email = (string) $request->input('email');
            $builder->whereIn('user_id', User::where('email', 'like', '%' . addcslashes($email, '%_\\') . '%')->select('id'));
        }
        if ($request->filled('ip')) {
            $builder->where('ip', 'like', addcslashes((string) $request->input('ip'), '%_\\') . '%');
        }
        if ($request->filled('type')) {
            $builder->where('type', $request->input('type'));
        }
        if ($request->filled('success')) {
            $builder->where('success', filter_var($request->input('success'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('start_at')) {
            $builder->where('created_at', '>=', (int) $request->input('start_at'));
        }
        if ($request->filled('end_at')) {
            $builder->where('created_at', '<=', (int) $request->input('end_at'));
        }

        $logs = $builder->orderBy('created_at', 'DESC')
            ->orderBy('id', 'DESC')
            ->paginate((int) $request->input('pageSize', 20), ['*'], 'page', (int) $request->input('current', 1));

        $logs->getCollection()->transform(function (UserLoginLog $log): array {
            return array_merge(LoginLogService::present($log), [
                'user_id' => $log->user_id,
                'email' => $log->user?->email,
            ]);
        });

        return $this->paginate($logs);
    }
}
