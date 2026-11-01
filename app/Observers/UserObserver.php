<?php

namespace App\Observers;

use App\Jobs\NodeUserSyncJob;
use App\Models\User;
use App\Services\TrafficCycleService;
use App\Services\TrafficResetService;
use Illuminate\Support\Facades\Log;

/**
 * Node sync and cycle reconcile run after the surrounding transaction commits. That is done per handler with
 * afterCommit() rather than with the observer-wide $afterCommit flag, because the flag would also defer
 * updating(), which has to see the row before each save.
 */
class UserObserver
{
  private const SYNC_FIELDS = ['group_id', 'uuid', 'speed_limit', 'device_limit', 'banned', 'expired_at', 'transfer_enable', 'u', 'd', 'plan_id'];
  private const CYCLE_FIELDS = ['plan_id', 'expired_at', 'transfer_enable'];

  /**
   * Per model instance, what the saves since the last handled 'updated' changed: the group_id the row had before
   * the first of them, whether any of them touched a sync field, and whether any of them touched a traffic-cycle
   * field. Kept outside the model's attributes so it can never be written to v2_user, and weakly keyed so a
   * dropped instance takes its entry with it.
   *
   * @var \WeakMap<User, array{group_id: mixed, sync: bool, cycle: bool}>|null
   */
  private static ?\WeakMap $pending = null;

  public function __construct(
    private readonly TrafficResetService $trafficResetService,
    private readonly TrafficCycleService $trafficCycleService
  ) {
  }

  /**
   * Runs inside the save, before the row is written. After commit the model's original already holds the new
   * values, and a second save in the same transaction overwrites wasChanged(), so the first-seen group is
   * recorded here.
   */
  public function updating(User $user): void
  {
    $pending = self::$pending ??= new \WeakMap();
    $entry = $pending[$user] ?? ['group_id' => $user->getRawOriginal('group_id'), 'sync' => false, 'cycle' => false];
    $entry['sync'] = $entry['sync'] || $user->isDirty(self::SYNC_FIELDS);
    $entry['cycle'] = $entry['cycle'] || $user->isDirty(self::CYCLE_FIELDS);
    $pending[$user] = $entry;
  }

  public function updated(User $user): void
  {
    $user->getConnection()->afterCommit(fn () => $this->afterUpdated($user));
  }

  public function created(User $user): void
  {
    $user->getConnection()->afterCommit(function () use ($user) {
      $this->syncTrafficCycle($user);
      NodeUserSyncJob::dispatch($user->id, 'created');
    });
  }

  public function deleted(User $user): void
  {
    $user->getConnection()->afterCommit(function () use ($user) {
      if ($user->group_id) {
        NodeUserSyncJob::dispatch($user->id, 'deleted', $user->group_id);
      }
    });
  }

  private function afterUpdated(User $user): void
  {
    // The first callback after commit takes the whole transaction's record; later callbacks for the same
    // instance (one per save) only see their own save through wasChanged().
    $entry = self::takePending($user);
    $oldGroupId = $entry['group_id'] ?? null;
    $groupChanged = $entry !== null && (string) $oldGroupId !== (string) $user->group_id;
    $needsSync = $groupChanged || ($entry['sync'] ?? false) || $user->wasChanged(self::SYNC_FIELDS);

    // As for sync: an earlier save of the transaction may have changed the cycle fields, a later one not.
    if (($entry['cycle'] ?? false) || $user->wasChanged(self::CYCLE_FIELDS)) {
      $this->syncTrafficCycle($user);
    }

    if ($needsSync) {
      // Only a group the user actually left gets a removal; NodeUserSyncJob then adds the user to its current group.
      NodeUserSyncJob::dispatch($user->id, 'updated', $groupChanged && $oldGroupId !== null ? (int) $oldGroupId : null);
    }
  }

  /**
   * @return array{group_id: mixed, sync: bool, cycle: bool}|null
   */
  private static function takePending(User $user): ?array
  {
    if (self::$pending === null || !isset(self::$pending[$user])) {
      return null;
    }
    $entry = self::$pending[$user];
    unset(self::$pending[$user]);
    return $entry;
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
