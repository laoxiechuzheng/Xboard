<?php

namespace App\Observers;

use App\Jobs\NodeUserSyncJob;
use App\Models\User;
use App\Services\TrafficCycleService;
use App\Services\TrafficResetService;
use Illuminate\Support\Facades\Log;

class UserObserver
{
  public bool $afterCommit = true;

  public function __construct(
    private readonly TrafficResetService $trafficResetService,
    private readonly TrafficCycleService $trafficCycleService
  ) {
  }

  public function updated(User $user): void
  {
    // With $afterCommit = true, isDirty() is always false after commit.
    // Use wasChanged() to detect what was actually modified.
    $syncFields = ['group_id', 'uuid', 'speed_limit', 'device_limit', 'banned', 'expired_at', 'transfer_enable', 'u', 'd', 'plan_id'];
    $needsSync = $user->wasChanged($syncFields);
    $oldGroupId = $user->wasChanged('group_id') ? $user->getOriginal('group_id') : null;

    if ($user->wasChanged(['plan_id', 'expired_at', 'transfer_enable'])) {
      $this->syncTrafficCycle($user);
    }

    if ($needsSync) {
      NodeUserSyncJob::dispatch($user->id, 'updated', $oldGroupId);
    }
  }

  public function created(User $user): void
  {
    $this->syncTrafficCycle($user);
    NodeUserSyncJob::dispatch($user->id, 'created');
  }

  public function deleted(User $user): void
  {
    if ($user->group_id) {
      NodeUserSyncJob::dispatch($user->id, 'deleted', $user->group_id);
    }
  }

  /**
   * Paths that write v2_user directly (gift cards, trial, generate, plain saves) are reconciled here;
   * orders and admin edits update the cycle explicitly and this is then a no-op.
   */
  private function syncTrafficCycle(User $user): void
  {
    if ($this->trafficCycleService->enabled()) {
      try {
        $this->trafficCycleService->reconcile($user);
      } catch (\Throwable $e) {
        Log::error('Traffic cycle reconcile failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
      }
      return;
    }

    $this->recalculateNextResetAt($user);
  }

  /**
   * 根据当前用户状态重新计算 next_reset_at（周期账本表不存在时）
   */
  private function recalculateNextResetAt(User $user): void
  {
    $user->refresh();
    User::withoutEvents(function () use ($user) {
      $nextResetTime = $this->trafficResetService->calculateNextResetTime($user);
      $user->next_reset_at = $nextResetTime?->timestamp;
      $user->save();
    });
  }
}
