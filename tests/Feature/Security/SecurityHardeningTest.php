<?php

namespace Tests\Feature\Security;

use App\Exceptions\ApiException;
use App\Http\Middleware\Client;
use App\Http\Middleware\TrustProxies;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use App\Services\Auth\LoginService;
use App\Services\AuthService;
use App\Services\LoginLogService;
use App\Services\TicketService;
use App\Utils\CacheKey;
use App\Utils\Helper;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Regression tests for the 2026-11-03 security branch (security-20261103).
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    private const MIRROR = '8.217.95.135';

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        // login logs resolve geo data and the Telegram plugin calls its API over HTTP: never leave the container
        Http::fake(['*' => Http::response(['ok' => true, 'result' => true])]);
    }

    protected function tearDown(): void
    {
        Auth::forgetGuards();
        \App\Services\Plugin\HookManager::reset();
        parent::tearDown();
    }

    // ---- 1. subscription token: no body tokens, no type juggling --------------------------------------

    public function test_subscription_token_validator_accepts_only_plain_strings(): void
    {
        $this->assertSame('0123456789abcdef0123456789abcdef', Helper::validateSubscriptionToken('0123456789abcdef0123456789abcdef'));
        // live tokens include 32-character alphanumerics that are not hex; they must keep working
        $this->assertSame('AbCdEfGhIjKlMnOpQrStUvWxYz012345', Helper::validateSubscriptionToken('AbCdEfGhIjKlMnOpQrStUvWxYz012345'));
        $this->assertSame('short-token', Helper::validateSubscriptionToken('short-token'));

        foreach ([null, '', 0, 7, 1.5, true, [0], ['abc'], str_repeat('a', 65), "abc\0def", "abc\ndef", "\xff\xfe"] as $bad) {
            $this->assertNull(Helper::validateSubscriptionToken($bad), var_export($bad, true));
        }
    }

    public function test_client_middleware_ignores_body_tokens_and_rejects_arrays(): void
    {
        $victim = $this->makeUser();

        // XB-01: a JSON body token [0] used to match every user whose token starts with a letter
        $this->assertClientRejects(Request::create('/api/v1/client/subscribe', 'GET', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['token' => [0]])));
        $this->assertClientRejects(Request::create('/api/v1/client/subscribe', 'GET', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['token' => 7])));
        // even the correct token is not taken from a body any more
        $this->assertClientRejects(Request::create('/api/v1/client/subscribe', 'POST', ['token' => $victim->token]));
        $this->assertClientRejects(Request::create('/api/v1/client/subscribe?token[]=0', 'GET'));
        $this->assertClientRejects(Request::create('/api/v1/client/subscribe?token=0', 'GET'));

        $this->assertSame($victim->id, $this->clientUser(Request::create('/api/v1/client/subscribe?token=' . $victim->token, 'GET')));
    }

    public function test_client_middleware_keeps_route_tokens_and_query_precedence(): void
    {
        $legacy = $this->makeUser(['token' => 'AbCdEfGhIjKlMnOpQrStUvWxYz012345']);
        $other = $this->makeUser();

        $request = Request::create('/s/' . $legacy->token, 'GET');
        $request->setRouteResolver(fn () => $this->routeWithToken($request, $legacy->token));
        $this->assertSame($legacy->id, $this->clientUser($request));

        // as before (input('token', route('token'))), a query token wins over the path token
        $request = Request::create('/s/' . $legacy->token . '?token=' . $other->token, 'GET');
        $request->setRouteResolver(fn () => $this->routeWithToken($request, $legacy->token));
        $this->assertSame($other->id, $this->clientUser($request));
    }

    // ---- 3. email identity -------------------------------------------------------------------------

    public function test_password_failure_counter_is_shared_by_email_case_variants(): void
    {
        admin_setting(['password_limit_enable' => 1, 'password_limit_count' => 3, 'password_limit_expire' => 60]);
        $user = $this->makeUser(['email' => 'victim@example.com']);
        $service = app(LoginService::class);

        foreach (['Victim@example.com', 'VICTIM@EXAMPLE.COM', ' victim@Example.com '] as $variant) {
            [$ok, $result] = $service->login($variant, 'wrong-password');
            $this->assertFalse($ok);
            $this->assertSame(400, $result[0]);
        }

        [$ok, $result] = $service->login('victim@example.com', 'password');
        $this->assertFalse($ok);
        $this->assertSame(429, $result[0]);
        $this->assertSame(3, (int) Cache::get(CacheKey::get('PASSWORD_ERROR_LIMIT', 'victim@example.com')));
        $this->assertNotNull($user->fresh());
    }

    public function test_verify_code_sent_to_a_case_variant_resets_the_password(): void
    {
        $user = $this->makeUser(['email' => 'reset@example.com']);
        Cache::put(CacheKey::get('EMAIL_VERIFY_CODE', User::normalizeEmail('Reset@Example.com')), 654321, 300);

        [$ok] = app(LoginService::class)->resetPassword('RESET@example.com', '654321', 'new-password-1');

        $this->assertTrue($ok);
        $this->assertTrue(password_verify('new-password-1', $user->fresh()->password));
    }

    // ---- 6. reset password revokes sessions ---------------------------------------------------------

    public function test_reset_password_revokes_existing_tokens_and_clears_the_lockout(): void
    {
        $user = $this->makeUser(['email' => 'sessions@example.com']);
        $user->createToken('a');
        $user->createToken('b');
        Cache::put(CacheKey::get('PASSWORD_ERROR_LIMIT', 'sessions@example.com'), 9, 600);
        Cache::put(CacheKey::get('EMAIL_VERIFY_CODE', 'sessions@example.com'), 111222, 300);

        [$ok] = app(LoginService::class)->resetPassword('sessions@example.com', '111222', 'new-password-2');

        $this->assertTrue($ok);
        $this->assertSame(0, $user->tokens()->count());
        $this->assertNull(Cache::get(CacheKey::get('PASSWORD_ERROR_LIMIT', 'sessions@example.com')));
    }

    // ---- 4 + 7. trusted proxies and the per-IP login failure limit -----------------------------------

    public function test_trusted_proxies_default_keeps_the_legacy_behaviour(): void
    {
        config(['trustedproxy.proxies' => null]);
        $this->assertSame(['0.0.0.0/0'], TrustProxies::configuredProxies());
        $this->assertTrue(TrustProxies::trustsEveryone());

        config(['trustedproxy.proxies' => 'private, cloudflare ,' . self::MIRROR]);
        $proxies = TrustProxies::configuredProxies();
        $this->assertFalse(TrustProxies::trustsEveryone());
        $this->assertContains('127.0.0.0/8', $proxies);
        $this->assertContains('172.64.0.0/13', $proxies);
        $this->assertContains(self::MIRROR, $proxies);
    }

    public function test_client_ip_is_the_right_most_untrusted_hop_once_proxies_are_configured(): void
    {
        $this->captureClientIp();

        // legacy: left-most entry, so the client could choose it
        config(['trustedproxy.proxies' => null]);
        $this->assertSame('6.6.6.6', $this->ipFor('6.6.6.6, 1.2.3.4, ' . self::MIRROR));

        config(['trustedproxy.proxies' => 'private,cloudflare,' . self::MIRROR]);
        // spoofed left-most entry is ignored: the mirror appended the real client
        $this->assertSame('1.2.3.4', $this->ipFor('6.6.6.6, 1.2.3.4, ' . self::MIRROR));
        // Cloudflare edge in front of the origin
        $this->assertSame('1.2.3.4', $this->ipFor('1.2.3.4, 172.70.1.1'));
        // somebody hitting the origin directly cannot pretend to be behind the mirror
        $this->assertSame('5.5.5.5', $this->ipFor(self::MIRROR . ', 5.5.5.5'));
        // a mirror that lost the client address resolves to the mirror itself
        $this->assertSame(self::MIRROR, $this->ipFor(self::MIRROR));
    }

    public function test_login_failures_are_limited_per_client_ip_but_never_per_mirror(): void
    {
        config(['trustedproxy.proxies' => 'private,cloudflare,' . self::MIRROR, 'auth.login_ip_throttle.max_failures' => 5]);
        admin_setting(['password_limit_enable' => 0]);
        $this->makeUser(['email' => 'real@example.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->loginVia('1.2.3.4, ' . self::MIRROR, "nobody{$i}@example.com", 'password')->assertStatus(400);
        }
        // the sixth attempt from that client is refused, even with the right password
        $this->loginVia('1.2.3.4, ' . self::MIRROR, 'real@example.com', 'password')->assertStatus(429);
        // another client behind the same mirror is not affected
        $this->loginVia('9.9.9.9, ' . self::MIRROR, 'real@example.com', 'password')->assertOk();

        // traffic that resolves to the mirror itself (client address lost) is never limited
        for ($i = 0; $i < 8; $i++) {
            $this->loginVia(self::MIRROR, "nobody{$i}@example.com", 'password')->assertStatus(400);
        }
        $this->loginVia(self::MIRROR, 'real@example.com', 'password')->assertOk();
    }

    public function test_login_ip_limit_is_off_while_trusted_proxies_is_unset(): void
    {
        config(['trustedproxy.proxies' => null, 'auth.login_ip_throttle.max_failures' => 2]);
        admin_setting(['password_limit_enable' => 0]);
        $this->makeUser(['email' => 'real@example.com']);

        for ($i = 0; $i < 4; $i++) {
            $this->loginVia('1.2.3.4', "nobody{$i}@example.com", 'password')->assertStatus(400);
        }
        $this->loginVia('1.2.3.4', 'real@example.com', 'password')->assertOk();
    }

    public function test_login_log_ignores_cf_connecting_ip_once_proxies_are_configured(): void
    {
        config(['trustedproxy.proxies' => 'private,cloudflare,' . self::MIRROR]);
        $request = Request::create('/', 'POST', [], [], [], [
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_X_FORWARDED_FOR' => '1.2.3.4, ' . self::MIRROR,
            'HTTP_CF_CONNECTING_IP' => '6.6.6.6',
        ]);
        $request->setTrustedProxies(TrustProxies::configuredProxies(), Request::HEADER_X_FORWARDED_FOR);
        $this->assertSame('1.2.3.4', LoginLogService::clientIp($request));

        config(['trustedproxy.proxies' => null]);
        $request->setTrustedProxies(TrustProxies::configuredProxies(), Request::HEADER_X_FORWARDED_FOR);
        $this->assertSame('6.6.6.6', LoginLogService::clientIp($request));
    }

    // ---- 5. bearer tokens -------------------------------------------------------------------------

    public function test_bearer_lookup_rejects_expired_tokens_and_banned_users(): void
    {
        $user = $this->makeUser();
        $valid = $user->createToken('valid', ['*'], now()->addDay())->plainTextToken;
        $expired = $user->createToken('expired', ['*'], now()->subMinute())->plainTextToken;

        $this->assertSame($user->id, AuthService::findUserByBearerToken('Bearer ' . explode('|', $valid)[1])?->id);
        $this->assertNull(AuthService::findUserByBearerToken('Bearer ' . explode('|', $expired)[1]));

        $this->postJson('/api/v1/passport/auth/getQuickLoginUrl', [], ['Authorization' => 'Bearer ' . explode('|', $expired)[1]])
            ->assertStatus(401);
        $this->postJson('/api/v1/passport/auth/getQuickLoginUrl', [], ['Authorization' => 'Bearer ' . explode('|', $valid)[1]])
            ->assertOk();

        $user->forceFill(['banned' => 1])->save();
        $this->assertNull(AuthService::findUserByBearerToken('Bearer ' . explode('|', $valid)[1]));
    }

    public function test_expired_tokens_are_pruned_daily(): void
    {
        $events = collect(app(Schedule::class)->events())->map(fn ($event) => $event->command ?? '');
        $this->assertTrue($events->contains(fn ($command) => str_contains($command, 'sanctum:prune-expired')));

        $user = $this->makeUser();
        $user->createToken('old', ['*'], now()->subDays(3));
        $user->createToken('fresh', ['*'], now()->addDay());
        $this->artisan('sanctum:prune-expired', ['--hours' => 24])->assertSuccessful();
        $this->assertSame(['fresh'], PersonalAccessToken::pluck('name')->all());
    }

    // ---- 8. small input hardening ------------------------------------------------------------------

    public function test_array_inputs_on_quick_login_endpoints_return_422(): void
    {
        $this->getJson('/api/v1/passport/auth/token2Login?verify[]=x')->assertStatus(422);
        $this->getJson('/api/v1/passport/auth/token2Login?token[]=x')->assertStatus(422);
        $this->postJson('/api/v1/passport/auth/getQuickLoginUrl', ['auth_data' => ['x']])->assertStatus(422);
        // plain strings keep the old answers
        $this->getJson('/api/v1/passport/auth/token2Login?verify=nope')->assertStatus(400);
        $this->postJson('/api/v1/passport/auth/getQuickLoginUrl', ['auth_data' => 'Bearer nope'])->assertStatus(401);
    }

    public function test_fetching_another_users_ticket_is_a_400_not_a_500(): void
    {
        $owner = $this->makeUser();
        $other = $this->makeUser();
        $ticket = (new TicketService())->createTicket($owner->id, 'subject', 0, 'hello');

        Sanctum::actingAs($other);
        $this->getJson('/api/v1/user/ticket/fetch?id=' . $ticket->id)->assertStatus(400);

        Sanctum::actingAs($owner);
        $this->getJson('/api/v1/user/ticket/fetch?id=' . $ticket->id)->assertOk();
    }

    public function test_core_telegram_ticket_reply_needs_admin_and_a_bot_message(): void
    {
        require_once base_path('plugins-core/Telegram/Plugin.php');
        admin_setting(['telegram_bot_token' => '123:test']);
        $plugin = new \Plugin\Telegram\Plugin('telegram');
        $plugin->boot();

        $owner = $this->makeUser();
        $ticket = (new TicketService())->createTicket($owner->id, 'subject', 0, 'hello');
        $bound = $this->makeUser(['telegram_id' => 1001]);
        $admin = $this->makeUser(['telegram_id' => 1002, 'is_admin' => 1]);
        $matches = ['📮工单提醒 #' . $ticket->id, '📮工单提醒 #', (string) $ticket->id];
        $count = fn () => TicketMessage::where('ticket_id', $ticket->id)->count();
        $before = $count();

        $plugin->handleTicketReply($this->telegramMsg($bound->telegram_id, true), $matches);
        $this->assertSame($before, $count(), 'a plain bound user must not answer tickets as admin');

        $plugin->handleTicketReply($this->telegramMsg($admin->telegram_id, false), $matches);
        $this->assertSame($before, $count(), 'admins answer by replying to the bot notification only');

        $plugin->handleTicketReply($this->telegramMsg($admin->telegram_id, true), $matches);
        $this->assertSame($before + 1, $count());
        $this->assertNotNull(Ticket::find($ticket->id));
    }

    // ---- helpers -----------------------------------------------------------------------------------

    private function makeUser(array $attributes = []): User
    {
        $user = new User();
        $user->forceFill(array_merge([
            'email' => Str::lower(Str::random(10)) . '@security.test',
            'password' => password_hash('password', PASSWORD_DEFAULT),
            'uuid' => Helper::guid(true),
            'token' => Helper::guid(),
        ], $attributes))->save();

        return $user->refresh();
    }

    private function clientUser(Request $request): ?int
    {
        Auth::forgetGuards();
        return (new Client())->handle($request, fn () => response('ok')) && Auth::user() ? Auth::user()->id : null;
    }

    private function assertClientRejects(Request $request): void
    {
        try {
            (new Client())->handle($request, fn () => $this->fail('request must not pass the client middleware'));
            $this->fail('expected an ApiException');
        } catch (ApiException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }

    private function routeWithToken(Request $request, string $token): \Illuminate\Routing\Route
    {
        $route = new \Illuminate\Routing\Route('GET', '/s/{token}', fn () => null);
        $route->bind($request);
        $this->assertSame($token, $route->parameter('token'));
        return $route;
    }

    private function captureClientIp(): void
    {
        \Illuminate\Support\Facades\Route::get('/__security_test_ip', fn (Request $request) => response($request->ip()));
    }

    private function ipFor(string $forwardedFor): string
    {
        return $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeaders(['X-Forwarded-For' => $forwardedFor])
            ->get('/__security_test_ip')
            ->getContent();
    }

    private function loginVia(string $forwardedFor, string $email, string $password)
    {
        return $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeaders(['X-Forwarded-For' => $forwardedFor])
            ->postJson('/api/v1/passport/auth/login', ['email' => $email, 'password' => $password]);
    }

    private function telegramMsg(int $chatId, bool $replyFromBot): object
    {
        return (object) [
            'command' => 'answer',
            'args' => [],
            'chat_id' => $chatId,
            'message_id' => 1,
            'message_type' => 'reply_message',
            'text' => 'answer from telegram',
            'is_private' => true,
            'reply_text' => '📮工单提醒 #1',
            'reply_from_bot' => $replyFromBot,
        ];
    }
}
