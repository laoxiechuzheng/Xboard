<?php

namespace App\Services\Auth;

use App\Http\Middleware\TrustProxies;
use App\Models\User;
use App\Models\UserLoginLog;
use App\Services\LoginLogService;
use App\Services\Plugin\HookManager;
use App\Utils\CacheKey;
use App\Utils\Helper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\IpUtils;

class LoginService
{
    /**
     * 处理用户登录
     *
     * @param string $email 用户邮箱
     * @param string $password 用户密码
     * @param string|null $throttleIp 客户端 IP（见 throttleIp()）；null 表示不做按 IP 限制
     * @return array [成功状态, 用户对象或错误信息]
     */
    public function login(string $email, string $password, ?string $throttleIp = null): array
    {
        // 计数键与查询统一用规范化邮箱，大小写变体共用一个错误计数
        $email = User::normalizeEmail($email);

        // 按客户端 IP 的失败次数限制（只计失败，不影响成功登录）
        if ($throttleIp !== null && ($limited = $this->ipThrottleError($throttleIp))) {
            return [false, $limited];
        }

        // 检查密码错误限制
        if ((int) admin_setting('password_limit_enable', true)) {
            $passwordErrorCount = (int) Cache::get(CacheKey::get('PASSWORD_ERROR_LIMIT', $email), 0);
            if ($passwordErrorCount >= (int) admin_setting('password_limit_count', 5)) {
                return [
                    false,
                    [
                        429,
                        __('There are too many password errors, please try again after :minute minutes.', [
                            'minute' => admin_setting('password_limit_expire', 60)
                        ])
                    ]
                ];
            }
        }

        // 查找用户
        $user = User::byEmail($email)->first();
        if (!$user) {
            $this->hitIpThrottle($throttleIp);
            return [false, [400, __('Incorrect email or password')]];
        }

        // 验证密码
        if (
            !Helper::multiPasswordVerify(
                $user->password_algo,
                $user->password_salt,
                $password,
                $user->password
            )
        ) {
            // 增加密码错误计数
            if ((int) admin_setting('password_limit_enable', true)) {
                $passwordErrorCount = (int) Cache::get(CacheKey::get('PASSWORD_ERROR_LIMIT', $email), 0);
                Cache::put(
                    CacheKey::get('PASSWORD_ERROR_LIMIT', $email),
                    (int) $passwordErrorCount + 1,
                    60 * (int) admin_setting('password_limit_expire', 60)
                );
            }
            $this->hitIpThrottle($throttleIp);
            // 记录密码错误的尝试，用户可在登录记录里发现异常登录
            app(LoginLogService::class)->record($user, UserLoginLog::TYPE_LOGIN, false);
            return [false, [400, __('Incorrect email or password')]];
        }

        // 检查账户状态
        if ($user->banned) {
            return [false, [400, __('Your account has been suspended')]];
        }

        // 更新最后登录时间
        $user->last_login_at = time();
        $user->save();

        HookManager::call('user.login.after', $user);
        return [true, $user];
    }

    /**
     * 处理密码重置
     *
     * @param string $email 用户邮箱
     * @param string $emailCode 邮箱验证码
     * @param string $password 新密码
     * @return array [成功状态, 结果或错误信息]
     */
    public function resetPassword(string $email, string $emailCode, string $password): array
    {
        $email = User::normalizeEmail($email);

        // 检查重置请求限制
        $forgetRequestLimitKey = CacheKey::get('FORGET_REQUEST_LIMIT', $email);
        $forgetRequestLimit = (int) Cache::get($forgetRequestLimitKey);
        if ($forgetRequestLimit >= 3) {
            return [false, [429, __('Reset failed, Please try again later')]];
        }

        // 验证邮箱验证码
        $cachedEmailCode = Cache::get(CacheKey::get('EMAIL_VERIFY_CODE', $email));
        if ($cachedEmailCode === null || !hash_equals((string) $cachedEmailCode, $emailCode)) {
            Cache::put($forgetRequestLimitKey, $forgetRequestLimit ? $forgetRequestLimit + 1 : 1, 300);
            return [false, [400, __('Incorrect email verification code')]];
        }

        // 查找用户
        $user = User::byEmail($email)->first();
        if (!$user) {
            return [false, [400, __('This email is not registered in the system')]];
        }

        // 更新密码
        $user->password = password_hash($password, PASSWORD_DEFAULT);
        $user->password_algo = NULL;
        $user->password_salt = NULL;

        if (!$user->save()) {
            return [false, [500, __('Reset failed')]];
        }

        // 找回密码后旧会话全部失效（与修改密码一致），并解除该邮箱的密码错误锁定
        $user->tokens()->delete();
        Cache::forget(CacheKey::get('PASSWORD_ERROR_LIMIT', $email));

        HookManager::call('user.password.reset.after', $user);

        // 清除邮箱验证码
        Cache::forget(CacheKey::get('EMAIL_VERIFY_CODE', $email));

        return [true, true];
    }


    /**
     * The client IP the login failure limit applies to, or null when it must not apply.
     *
     * Mirrors, CDNs and the panel's own proxies put many users behind one address. A request resolves to such
     * an address only when no untrusted hop is left in X-Forwarded-For (for example a mirror that did not
     * forward the client IP), so trusted proxies and loopback/private addresses are never limited. While TRUSTED_PROXIES is unset the client
     * IP is whatever the client wrote into X-Forwarded-For, so the limit stays off (no behaviour change).
     */
    public static function throttleIp(Request $request): ?string
    {
        if (TrustProxies::trustsEveryone()) {
            return null;
        }
        $ip = $request->ip();
        if (!is_string($ip) || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return null;
        }
        // Loopback / private addresses are this host's own nginx, Caddy and docker hops. They are exempt whatever
        // TRUSTED_PROXIES says, so a list that forgets "private" cannot put every user on one 127.0.0.1 counter.
        if (IpUtils::checkIp($ip, TrustProxies::PRIVATE_RANGES)) {
            return null;
        }
        $trusted = Request::getTrustedProxies();
        if ($trusted && IpUtils::checkIp($ip, $trusted)) {
            return null;
        }
        return $ip;
    }

    private function ipThrottleKey(string $ip): string
    {
        return 'login_ip_failures:' . $ip;
    }

    private function ipThrottleMax(): int
    {
        return (int) config('auth.login_ip_throttle.max_failures', 30);
    }

    private function ipThrottleError(string $ip): ?array
    {
        $max = $this->ipThrottleMax();
        if ($max <= 0 || !RateLimiter::tooManyAttempts($this->ipThrottleKey($ip), $max)) {
            return null;
        }
        $minutes = max(1, (int) ceil(RateLimiter::availableIn($this->ipThrottleKey($ip)) / 60));
        return [429, __('There are too many password errors, please try again after :minute minutes.', ['minute' => $minutes])];
    }

    private function hitIpThrottle(?string $ip): void
    {
        if ($ip === null || $this->ipThrottleMax() <= 0) {
            return;
        }
        RateLimiter::hit($this->ipThrottleKey($ip), max(60, (int) config('auth.login_ip_throttle.decay_seconds', 600)));
    }

    /**
     * 生成临时登录令牌和快速登录URL
     *
     * @param User $user 用户对象
     * @param string $redirect 重定向路径
     * @return string|null 快速登录URL
     */
    public function generateQuickLoginUrl(User $user, ?string $redirect = null): ?string
    {
        if (!$user || !$user->exists) {
            return null;
        }

        $code = Helper::guid();
        $key = CacheKey::get('TEMP_TOKEN', $code);

        Cache::put($key, $user->id, 60);

        $redirect = $redirect ?: 'dashboard';
        $loginRedirect = '/#/login?verify=' . $code . '&redirect=' . rawurlencode($redirect);

        if (admin_setting('app_url')) {
            $url = admin_setting('app_url') . $loginRedirect;
        } else {
            $url = url($loginRedirect);
        }

        return $url;
    }
}