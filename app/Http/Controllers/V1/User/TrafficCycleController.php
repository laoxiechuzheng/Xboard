<?php

namespace App\Http\Controllers\V1\User;

use App\Http\Controllers\Controller;
use App\Services\TrafficCycleService;
use Illuminate\Http\Request;

class TrafficCycleController extends Controller
{
    /**
     * 当前用户的流量周期时间线（docs/traffic-cycle/DESIGN.md §7.1）。
     */
    public function fetch(Request $request, TrafficCycleService $cycles)
    {
        $request->validate([
            'history_page' => 'nullable|integer|min:1',
            'history_size' => 'nullable|integer|min:1|max:50',
            'events_size' => 'nullable|integer|min:1|max:50',
        ]);
        $size = (int) $request->input('history_size', 10);

        return $this->success($cycles->timeline($request->user(), [
            'history_limit' => $size,
            'history_offset' => ((int) $request->input('history_page', 1) - 1) * $size,
            'events_limit' => (int) $request->input('events_size', 20),
        ]));
    }
}
