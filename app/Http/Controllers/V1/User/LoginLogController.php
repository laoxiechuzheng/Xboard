<?php

namespace App\Http\Controllers\V1\User;

use App\Http\Controllers\Controller;
use App\Models\UserLoginLog;
use App\Services\LoginLogService;
use Illuminate\Http\Request;

class LoginLogController extends Controller
{
    /**
     * 当前用户的登录 / 注册记录（分页，最新在前）。
     * 返回格式与 invite/details 一致：{ data: [...], total }。
     */
    public function fetch(Request $request)
    {
        $request->validate([
            'current' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
        ]);
        $current = (int) $request->input('current', 1);
        $pageSize = (int) $request->input('page_size', 15);

        $builder = UserLoginLog::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'DESC')
            ->orderBy('id', 'DESC');
        $total = $builder->count();
        $logs = $builder->forPage($current, $pageSize)->get();

        $currentTokenId = $request->user()->currentAccessToken()?->id;
        $currentTokenId = $currentTokenId !== null ? (int) $currentTokenId : null;

        return response([
            'data' => $logs->map(fn(UserLoginLog $log) => LoginLogService::present($log, $currentTokenId))->values(),
            'total' => $total,
        ]);
    }
}
