<?php

namespace App\Services;

use App\Models\User;
use App\Models\Plan;
use App\Models\TrafficResetLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Services\Plugin\HookManager;

/**
 * Service for handling traffic reset.
 */
class TrafficResetService
{
  /**
   * Check if a user's traffic should be reset and perform the reset.
   * With the traffic cycle ledger this rolls the user into the next cycle.
   */
  public function checkAndReset(User $user, string $triggerSource = TrafficResetLog::SOURCE_AUTO): bool
  {
    if (!$user->shouldResetTraffic()) {
      return false;
    }

    $cycles = app(TrafficCycleService::class);
    if ($cycles->enabled()) {
      return $cycles->rolloverVia($user, $triggerSource);
    }

    return $this->performReset($user, $triggerSource);
  }

  /**
   * Clear the user's usage inside the current cycle.
   *
   * $context (reason, order_id, admin_id, cycle_id, note ...) becomes the log metadata (DESIGN §4.2).
   * Nothing to clear means no log row and no reset_count increment.
   */
  public function performReset(User $user, string $triggerSource = TrafficResetLog::SOURCE_MANUAL, array $context = []): bool
  {
    if (!$user->exists) {
      return false;
    }

    try {
      $log = DB::transaction(function () use ($user, $triggerSource, $context) {
        $cycles = app(TrafficCycleService::class);
        $cycles->lockUser($user);
        $oldUpload = (int) ($user->u ?? 0);
        $oldDownload = (int) ($user->d ?? 0);

        $nextResetTime = $this->calculateNextResetTime($user);
        $user->next_reset_at = $nextResetTime ? $nextResetTime->timestamp : null;

        if ($oldUpload === 0 && $oldDownload === 0) {
          $user->save();
          return null;
        }

        $user->u = 0;
        $user->d = 0;
        $user->last_reset_at = Carbon::now()->getTimestamp();
        $user->reset_count = (int) $user->reset_count + 1;
        $user->save();

        if ($context && !isset($context['cycle_id']) && ($cycle = $cycles->openCycle($user))) {
          $context['cycle_id'] = $cycle->id;
        }
        $log = $this->writeLog($user, $triggerSource, $oldUpload, $oldDownload, $context ?: null);

        // a clear that opens a cycle is already explained by the cycle itself
        if ($context && empty($context['cycle_start'])) {
          $cycles->noteUsageCleared(
            $user,
            (int) $log->id,
            $oldUpload + $oldDownload,
            $context['reason'] ?? null,
            $this->eventSource($triggerSource),
            $context['admin_id'] ?? null
          );
        }

        return $log;
      });

      $this->forgetUserCache($user);
      if ($log) {
        HookManager::call('traffic.reset.after', $user);
      }
      return true;
    } catch (\Exception $e) {
      Log::error(__('traffic_reset.reset_failed'), [
        'user_id' => $user->id,
        'email' => $user->email,
        'error' => $e->getMessage(),
        'trigger_source' => $triggerSource,
      ]);

      return false;
    }
  }

  /**
   * Calculate the next traffic reset time for a user.
   * With the ledger it is the end of the current cycle, null for the final cycle.
   */
  public function calculateNextResetTime(User $user): ?Carbon
  {
    $cycles = app(TrafficCycleService::class);
    if ($cycles->enabled()) {
      // read only: partial selects (user/getSubscribe) fall back to next_reset_at, which the ledger keeps in sync
      $next = $cycles->nextResetAt($user);
      return $next === null ? null : Carbon::createFromTimestamp($next, config('app.timezone'));
    }

    if (
      !$user->plan
      || $user->plan->reset_traffic_method === Plan::RESET_TRAFFIC_NEVER
      || ($user->plan->reset_traffic_method === Plan::RESET_TRAFFIC_FOLLOW_SYSTEM
        && (int) admin_setting('reset_traffic_method', Plan::RESET_TRAFFIC_MONTHLY) === Plan::RESET_TRAFFIC_NEVER)
      || $user->expired_at === NULL
    ) {
      return null;
    }

    $resetMethod = $user->plan->reset_traffic_method;

    if ($resetMethod === Plan::RESET_TRAFFIC_FOLLOW_SYSTEM) {
      $resetMethod = (int) admin_setting('reset_traffic_method', Plan::RESET_TRAFFIC_MONTHLY);
    }

    $now = Carbon::now(config('app.timezone'));

    return match ($resetMethod) {
      Plan::RESET_TRAFFIC_FIRST_DAY_MONTH => $this->getNextMonthFirstDay($now),
      Plan::RESET_TRAFFIC_MONTHLY => $this->getNextMonthlyReset($user, $now),
      Plan::RESET_TRAFFIC_FIRST_DAY_YEAR => $this->getNextYearFirstDay($now),
      Plan::RESET_TRAFFIC_YEARLY => $this->getNextYearlyReset($user, $now),
      default => null,
    };
  }

  /**
   * Get the first day of the next month.
   */
  private function getNextMonthFirstDay(Carbon $from): Carbon
  {
    return $from->copy()->addMonth()->startOfMonth();
  }

  /**
   * Get the next monthly reset time based on the user's expiration date.
   *
   * Logic:
   * 1. If the user has no expiration date, reset on the 1st of each month.
   * 2. If the user has an expiration date, use the day of that date as the monthly reset day.
   * 3. Prioritize the reset day in the current month if it has not passed yet.
   * 4. Handle cases where the day does not exist in a month (e.g., 31st in February).
   */
  private function getNextMonthlyReset(User $user, Carbon $from): Carbon
  {
    $expiredAt = Carbon::createFromTimestamp($user->expired_at, config('app.timezone'));
    $resetDay = $expiredAt->day;
    $resetTime = [$expiredAt->hour, $expiredAt->minute, $expiredAt->second];
    
    $currentMonthTarget = $from->copy()->day($resetDay)->setTime(...$resetTime);
    if ($currentMonthTarget->timestamp > $from->timestamp) {
      return $currentMonthTarget;
    }
    
    $nextMonthTarget = $from->copy()->startOfMonth()->addMonths(1)->day($resetDay)->setTime(...$resetTime);
    
    if ($nextMonthTarget->month !== ($from->month % 12) + 1) {
      $nextMonth = ($from->month % 12) + 1;
      $nextYear = $from->year + ($from->month === 12 ? 1 : 0);
      $lastDayOfNextMonth = Carbon::create($nextYear, $nextMonth, 1)->endOfMonth()->day;
      $targetDay = min($resetDay, $lastDayOfNextMonth);
      $nextMonthTarget = Carbon::create($nextYear, $nextMonth, $targetDay)->setTime(...$resetTime);
    }
    
    return $nextMonthTarget;
  }

  /**
   * Get the first day of the next year.
   */
  private function getNextYearFirstDay(Carbon $from): Carbon
  {
    return $from->copy()->addYear()->startOfYear();
  }

  /**
   * Get the next yearly reset time based on the user's expiration date.
   *
   * Logic:
   * 1. If the user has no expiration date, reset on January 1st of each year.
   * 2. If the user has an expiration date, use the month and day of that date as the yearly reset date.
   * 3. Prioritize the reset date in the current year if it has not passed yet.
   * 4. Handle the case of February 29th in a leap year.
   */
  private function getNextYearlyReset(User $user, Carbon $from): Carbon
  {
    $expiredAt = Carbon::createFromTimestamp($user->expired_at, config('app.timezone'));
    $resetMonth = $expiredAt->month;
    $resetDay = $expiredAt->day;
    $resetTime = [$expiredAt->hour, $expiredAt->minute, $expiredAt->second];

    $currentYearTarget = $from->copy()->month($resetMonth)->day($resetDay)->setTime(...$resetTime);
    if ($currentYearTarget->timestamp > $from->timestamp) {
      return $currentYearTarget;
    }
    
    $nextYearTarget = $from->copy()->startOfYear()->addYears(1)->month($resetMonth)->day($resetDay)->setTime(...$resetTime);
    
    if ($nextYearTarget->month !== $resetMonth) {
      $nextYear = $from->year + 1;
      $lastDayOfMonth = Carbon::create($nextYear, $resetMonth, 1)->endOfMonth()->day;
      $targetDay = min($resetDay, $lastDayOfMonth);
      $nextYearTarget = Carbon::create($nextYear, $resetMonth, $targetDay)->setTime(...$resetTime);
    }
    
    return $nextYearTarget;
  }


  /**
   * Record one traffic reset log row. $context null keeps the legacy shape (no metadata).
   * $periodic false marks an edit that is not a periodic reset (reset_type manual).
   */
  public function writeLog(
    User $user,
    string $triggerSource,
    int $oldUpload,
    int $oldDownload,
    ?array $context,
    int $newUpload = 0,
    int $newDownload = 0,
    bool $periodic = true
  ): TrafficResetLog {
    return TrafficResetLog::create([
      'user_id' => $user->id,
      'reset_type' => $periodic ? $this->getResetTypeFromPlan(Plan::find($user->plan_id)) : TrafficResetLog::TYPE_MANUAL,
      'reset_time' => now(),
      'old_upload' => $oldUpload,
      'old_download' => $oldDownload,
      'old_total' => $oldUpload + $oldDownload,
      'new_upload' => $newUpload,
      'new_download' => $newDownload,
      'new_total' => $newUpload + $newDownload,
      'trigger_source' => $triggerSource,
      'metadata' => $context === null ? null : TrafficResetLog::buildMetadata($context),
    ]);
  }

  /**
   * Who a cycle usage_cleared event is attributed to (DESIGN §4.3 `by`).
   */
  private function eventSource(string $triggerSource): string
  {
    return match ($triggerSource) {
      TrafficResetLog::SOURCE_ORDER => 'order',
      TrafficResetLog::SOURCE_GIFT_CARD => 'gift_card',
      TrafficResetLog::SOURCE_MANUAL, TrafficResetLog::SOURCE_API => 'admin',
      default => 'system',
    };
  }

  /**
   * Get the reset type from the user's plan.
   */
  private function getResetTypeFromPlan(?Plan $plan): string
  {
    if (!$plan) {
      return TrafficResetLog::TYPE_MANUAL;
    }

    $resetMethod = $plan->reset_traffic_method;

    if ($resetMethod === Plan::RESET_TRAFFIC_FOLLOW_SYSTEM) {
      $resetMethod = (int) admin_setting('reset_traffic_method', Plan::RESET_TRAFFIC_MONTHLY);
    }

    return match ($resetMethod) {
      Plan::RESET_TRAFFIC_FIRST_DAY_MONTH => TrafficResetLog::TYPE_FIRST_DAY_MONTH,
      Plan::RESET_TRAFFIC_MONTHLY => TrafficResetLog::TYPE_MONTHLY,
      Plan::RESET_TRAFFIC_FIRST_DAY_YEAR => TrafficResetLog::TYPE_FIRST_DAY_YEAR,
      Plan::RESET_TRAFFIC_YEARLY => TrafficResetLog::TYPE_YEARLY,
      Plan::RESET_TRAFFIC_NEVER => TrafficResetLog::TYPE_MANUAL,
      default => TrafficResetLog::TYPE_MANUAL,
    };
  }

  /**
   * Clear user-related cache.
   */
  public function forgetUserCache(User $user): void
  {
    $cacheKeys = [
      "user_traffic_{$user->id}",
      "user_reset_status_{$user->id}",
      "user_subscription_{$user->token}",
    ];

    foreach ($cacheKeys as $key) {
      Cache::forget($key);
    }
  }

  /**
   * Batch check and reset users. Processes all eligible users in batches.
   */
  public function batchCheckReset(int $batchSize = 100, ?callable $progressCallback = null): array
  {
    $startTime = microtime(true);
    $totalResetCount = 0;
    $totalProcessedCount = 0;
    $batchNumber = 1;
    $errors = [];
    $lastProcessedId = 0;

    try {
      do {
        $users = User::where('next_reset_at', '<=', time())
          ->whereNotNull('next_reset_at')
          ->where('id', '>', $lastProcessedId)
          ->where(function ($query) {
            $query->where('expired_at', '>', time())
              ->orWhereNull('expired_at');
          })
          ->where('banned', 0)
          ->whereNotNull('plan_id')
          ->orderBy('id')
          ->limit($batchSize)
          ->get();

        if ($users->isEmpty()) {
          break;
        }

        $batchResetCount = 0;

        if ($progressCallback) {
          $progressCallback([
            'batch_number' => $batchNumber,
            'batch_size' => $users->count(),
            'total_processed' => $totalProcessedCount,
          ]);
        }

        foreach ($users as $user) {
          try {
            if ($this->checkAndReset($user, TrafficResetLog::SOURCE_CRON)) {
              $batchResetCount++;
              $totalResetCount++;
            }
            $totalProcessedCount++;
            $lastProcessedId = $user->id;
          } catch (\Exception $e) {
            $error = [
              'user_id' => $user->id,
              'email' => $user->email,
              'error' => $e->getMessage(),
              'batch' => $batchNumber,
              'timestamp' => now()->toDateTimeString(),
            ];
            $batchErrors[] = $error;
            $errors[] = $error;

            Log::error('User traffic reset failed', $error);

            $totalProcessedCount++;
            $lastProcessedId = $user->id;
          }
        }

        $batchNumber++;

        if ($batchNumber % 10 === 0) {
          gc_collect_cycles();
        }

        if ($batchNumber % 5 === 0) {
          usleep(100000);
        }

      } while (true);

    } catch (\Exception $e) {
      Log::error('Batch traffic reset task failed with an exception', [
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
        'total_processed' => $totalProcessedCount,
        'total_reset' => $totalResetCount,
        'last_processed_id' => $lastProcessedId,
      ]);

      $errors[] = [
        'type' => 'system_error',
        'error' => $e->getMessage(),
        'batch' => $batchNumber,
        'last_processed_id' => $lastProcessedId,
        'timestamp' => now()->toDateTimeString(),
      ];
    }

    $totalDuration = round(microtime(true) - $startTime, 2);

    $result = [
      'total_processed' => $totalProcessedCount,
      'total_reset' => $totalResetCount,
      'total_batches' => $batchNumber - 1,
      'error_count' => count($errors),
      'errors' => $errors,
      'duration' => $totalDuration,
      'batch_size' => $batchSize,
      'last_processed_id' => $lastProcessedId,
      'completed_at' => now()->toDateTimeString(),
    ];

    return $result;
  }

  /**
   * Set the initial reset time for a new user.
   */
  public function setInitialResetTime(User $user): void
  {
    if ($user->next_reset_at !== null) {
      return;
    }

    $nextResetTime = $this->calculateNextResetTime($user);

    if ($nextResetTime) {
      $user->update(['next_reset_at' => $nextResetTime->timestamp]);
    }
  }

  /**
   * Get the user's traffic reset history.
   */
  public function getUserResetHistory(User $user, int $limit = 10): \Illuminate\Database\Eloquent\Collection
  {
    return $user->trafficResetLogs()
      ->orderBy('reset_time', 'desc')
      ->limit($limit)
      ->get();
  }

  /**
   * Check if the user is eligible for traffic reset.
   */
  public function canReset(User $user): bool
  {
    return $user->isActive() && $user->plan !== null;
  }

  /**
   * Manually reset a user's traffic (Admin function).
   * $metadata: admin_id, note (the admin's reason text; legacy callers pass it as `reason`).
   */
  public function manualReset(User $user, array $metadata = []): bool
  {
    if (!$this->canReset($user)) {
      return false;
    }

    return $this->performReset($user, TrafficResetLog::SOURCE_MANUAL, [
      'reason' => TrafficResetLog::REASON_ADMIN_RESET,
      'admin_id' => $metadata['admin_id'] ?? null,
      'note' => $metadata['note'] ?? ($metadata['reason'] ?? null),
    ]);
  }
}