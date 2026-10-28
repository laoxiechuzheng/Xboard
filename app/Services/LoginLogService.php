<?php

namespace App\Services;

use App\Jobs\ResolveLoginLogLocationJob;
use App\Models\User;
use App\Models\UserLoginLog;
use App\Utils\UserAgentParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * 登录 / 注册记录：记录 IP、设备、时间，并异步通过 ip.sb 解析归属地。
 * 记录失败只写日志，绝不影响登录本身。
 */
class LoginLogService
{
    private const GEO_CACHE_PREFIX = 'login_log_geo:';
    private const GEO_CACHE_TTL = 7 * 86400;
    private const GEO_FAIL_TTL = 60;
    private const GEO_STATUS_NAMES = [
        UserLoginLog::GEO_PENDING => 'pending',
        UserLoginLog::GEO_RESOLVED => 'resolved',
        UserLoginLog::GEO_PRIVATE => 'private',
        UserLoginLog::GEO_FAILED => 'failed',
    ];

    public function record(User $user, string $type, bool $success = true, ?int $tokenId = null, ?Request $request = null): ?UserLoginLog
    {
        try {
            $request = $request ?? request();
            $ip = $request ? self::clientIp($request) : null;
            $userAgent = $request ? mb_substr((string) $request->userAgent(), 0, 512) : null;
            $device = UserAgentParser::parse($userAgent);

            $attributes = [
                'user_id' => $user->id,
                'type' => $type,
                'success' => $success,
                'ip' => $ip,
                'geo_status' => UserLoginLog::GEO_PENDING,
                'user_agent' => $userAgent ?: null,
                'device_type' => $device['type'],
                'os' => $device['os'],
                'browser' => $device['browser'],
                'device_model' => $device['model'],
                'origin' => $request ? self::origin($request) : null,
                'token_id' => $tokenId,
            ];

            if (!$ip || !self::isPublicIp($ip)) {
                $attributes['geo_status'] = UserLoginLog::GEO_PRIVATE;
            } elseif ($geo = Cache::get(self::GEO_CACHE_PREFIX . $ip)) {
                $attributes = array_merge($attributes, $geo, ['geo_status' => UserLoginLog::GEO_RESOLVED]);
            }

            $log = UserLoginLog::create($attributes);

            if ($log->geo_status === UserLoginLog::GEO_PENDING) {
                ResolveLoginLogLocationJob::dispatch($log->id);
            }

            return $log;
        } catch (\Throwable $e) {
            Log::warning('login log record failed: ' . $e->getMessage(), ['user_id' => $user->id, 'type' => $type]);
            return null;
        }
    }

    /**
     * 解析 IP 归属地：优先 ip.sb，失败时回退 ip-api.com。结果缓存 7 天，失败缓存 1 分钟（任务重试间隔比它长）。
     *
     * @return array{country: ?string, country_code: ?string, region: ?string, city: ?string, isp: ?string, asn: ?int}|null
     */
    public static function lookup(string $ip): ?array
    {
        $key = self::GEO_CACHE_PREFIX . $ip;
        if ($cached = Cache::get($key)) {
            return $cached;
        }
        if (Cache::has($key . ':fail')) {
            return null;
        }

        $geo = self::lookupIpSb($ip) ?? self::lookupIpApi($ip);
        if ($geo) {
            Cache::put($key, $geo, self::GEO_CACHE_TTL);
        } else {
            Cache::put($key . ':fail', 1, self::GEO_FAIL_TTL);
        }
        return $geo;
    }

    private static function lookupIpSb(string $ip): ?array
    {
        try {
            $response = Http::timeout(5)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; Xboard-LoginLog/1.0)'])
                ->get('https://api.ip.sb/geoip/' . rawurlencode($ip));
            $data = $response->successful() ? $response->json() : null;
            if (!is_array($data) || empty($data['country_code'])) {
                return null;
            }
            return self::normalizeGeo([
                'country' => $data['country'] ?? null,
                'country_code' => $data['country_code'] ?? null,
                'region' => $data['region'] ?? null,
                'city' => $data['city'] ?? null,
                'isp' => $data['isp'] ?? ($data['organization'] ?? ($data['asn_organization'] ?? null)),
                'asn' => $data['asn'] ?? null,
            ]);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function lookupIpApi(string $ip): ?array
    {
        try {
            $response = Http::timeout(5)->get('http://ip-api.com/json/' . rawurlencode($ip), [
                'fields' => 'status,country,countryCode,regionName,city,isp,as',
            ]);
            $data = $response->successful() ? $response->json() : null;
            if (!is_array($data) || ($data['status'] ?? '') !== 'success') {
                return null;
            }
            $asn = null;
            if (preg_match('/^AS(\d+)/', (string) ($data['as'] ?? ''), $m)) {
                $asn = (int) $m[1];
            }
            return self::normalizeGeo([
                'country' => $data['country'] ?? null,
                'country_code' => $data['countryCode'] ?? null,
                'region' => $data['regionName'] ?? null,
                'city' => $data['city'] ?? null,
                'isp' => $data['isp'] ?? null,
                'asn' => $asn,
            ]);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function normalizeGeo(array $geo): array
    {
        $limits = ['country' => 64, 'country_code' => 8, 'region' => 128, 'city' => 128, 'isp' => 191];
        foreach ($limits as $field => $limit) {
            $value = isset($geo[$field]) ? trim((string) $geo[$field]) : '';
            $geo[$field] = $value === '' ? null : mb_substr($value, 0, $limit);
        }
        if ($geo['country_code']) {
            $geo['country_code'] = strtoupper($geo['country_code']);
        }
        $geo['asn'] = is_numeric($geo['asn'] ?? null) ? (int) $geo['asn'] : null;
        return $geo;
    }

    /**
     * 真实客户端 IP：经 Cloudflare 时取 CF-Connecting-IP，否则取 X-Forwarded-For 最左侧（TrustProxies 信任全部代理）。
     */
    public static function clientIp(Request $request): ?string
    {
        $cf = trim((string) $request->header('CF-Connecting-IP'));
        if ($cf !== '' && filter_var($cf, FILTER_VALIDATE_IP)) {
            return $cf;
        }
        $ip = $request->ip();
        return $ip && filter_var($ip, FILTER_VALIDATE_IP) ? $ip : null;
    }

    public static function isPublicIp(string $ip): bool
    {
        return (bool) filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }

    private static function origin(Request $request): ?string
    {
        foreach (['Origin', 'Referer'] as $header) {
            $value = (string) $request->header($header);
            if ($value === '' || $value === 'null') {
                continue;
            }
            $parts = parse_url($value);
            if (!empty($parts['host'])) {
                $host = $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
                return mb_substr($host, 0, 191);
            }
        }
        return null;
    }

    /**
     * 统一的接口输出格式（用户端与后台共用）。
     */
    public static function present(UserLoginLog $log, ?int $currentTokenId = null): array
    {
        $location = null;
        if ($log->geo_status === UserLoginLog::GEO_RESOLVED) {
            $location = [
                'country' => $log->country,
                'country_code' => $log->country_code,
                'region' => $log->region,
                'city' => $log->city,
                'isp' => $log->isp,
                'asn' => $log->asn,
            ];
        }

        return [
            'id' => $log->id,
            'type' => $log->type,
            'success' => (bool) $log->success,
            'ip' => $log->ip,
            'geo_status' => self::GEO_STATUS_NAMES[$log->geo_status] ?? 'pending',
            'location' => $location,
            'device' => [
                'type' => $log->device_type ?: 'unknown',
                'os' => $log->os,
                'browser' => $log->browser,
                'model' => $log->device_model,
            ],
            'origin' => $log->origin,
            'user_agent' => $log->user_agent,
            'is_current' => $currentTokenId !== null && $log->token_id !== null && (int) $log->token_id === $currentTokenId,
            'created_at' => (int) $log->created_at,
        ];
    }
}
