<?php

namespace Tests\Feature\NodeSync;

use App\Console\Commands\CheckExpiredUsers;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * check:expired-users: a subscription running out writes nothing, so the scan syncs every user whose expiry
 * passed since the previous scan.
 */
class CheckExpiredUsersTest extends NodeSyncTestCase
{
    private function expiringAt(int $expiredAt, array $attributes = []): User
    {
        return $this->makeServableUser(1, array_merge(['expired_at' => $expiredAt], $attributes));
    }

    private function syncedIds(): array
    {
        $ids = array_map(fn(array $sync) => $sync[0], $this->updatedSyncs());
        sort($ids);

        return $ids;
    }

    public function test_the_first_scan_only_looks_back_the_first_window(): void
    {
        $now = $this->at('2026-11-01 12:00:00');
        $recent = $this->expiringAt($now - 120);
        $this->expiringAt($now - CheckExpiredUsers::FIRST_WINDOW - 60); // older: the nodes' pull already dropped it
        $this->expiringAt($now - 60, ['banned' => 1]);
        $this->expiringAt($now - 60, ['group_id' => null]);
        $this->expiringAt($now + 60);
        $this->expiringAt($now); // still in the full list this second (expired_at >= now)
        $this->makeServableUser(1);
        $this->makeServableUser(1, ['expired_at' => 0]);

        $this->artisan('check:expired-users')->assertSuccessful();

        $this->assertSame([$recent->id], $this->syncedIds());
        $this->assertSame([[$recent->id, null]], $this->updatedSyncs());
        $this->assertSame($now, Cache::get(CheckExpiredUsers::CURSOR_KEY));
    }

    public function test_the_next_scan_starts_from_the_cursor_with_a_small_overlap(): void
    {
        $first = $this->at('2026-11-01 12:00:00');
        $synced = $this->expiringAt($first - 120);
        $atCursor = $this->expiringAt($first);
        $this->artisan('check:expired-users')->assertSuccessful();
        $this->assertSame([$synced->id], $this->syncedIds());

        $now = $this->at('2026-11-01 12:05:00');
        $lateCommit = $this->expiringAt($first - 30); // written after the first scan, inside the overlap
        $between = $this->expiringAt($first + 100);
        $this->expiringAt($now + 1);

        $this->artisan('check:expired-users')->assertSuccessful();

        // the first scan's user is not synced again; the second scan adds the users expired since
        $this->assertSame([$synced->id, $atCursor->id, $lateCommit->id, $between->id], $this->syncedIds());
        $this->assertSame($now, Cache::get(CheckExpiredUsers::CURSOR_KEY));
    }

    public function test_a_stale_cursor_is_capped_to_the_max_window(): void
    {
        $now = $this->at('2026-11-01 12:00:00');
        Cache::forever(CheckExpiredUsers::CURSOR_KEY, $now - 86400);
        $this->expiringAt($now - CheckExpiredUsers::MAX_WINDOW - 60);
        $inWindow = $this->expiringAt($now - 1800);

        $this->artisan('check:expired-users')->assertSuccessful();

        $this->assertSame([$inWindow->id], $this->syncedIds());
    }

    public function test_it_is_scheduled_every_minute(): void
    {
        $events = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())
            ->filter(fn($event) => str_contains((string) $event->command, 'check:expired-users'));

        $this->assertCount(1, $events);
        $this->assertSame('* * * * *', $events->first()->expression);
    }
}
