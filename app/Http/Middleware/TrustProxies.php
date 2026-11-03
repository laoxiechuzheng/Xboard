<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TrustProxies extends Middleware
{
    /**
     * Used while TRUSTED_PROXIES is unset: trust every IPv4 hop, exactly what this fork always did.
     * Request::ip() is then the left-most X-Forwarded-For entry, which any client can write.
     */
    public const LEGACY_TRUST_ALL = ['0.0.0.0/0'];

    /**
     * Keywords accepted in TRUSTED_PROXIES next to plain addresses and CIDR ranges.
     */
    public const PRIVATE_RANGES = [
        '127.0.0.0/8', '::1/128', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
        '169.254.0.0/16', 'fc00::/7', 'fe80::/10',
    ];

    // https://www.cloudflare.com/ips-v4 and /ips-v6
    public const CLOUDFLARE_RANGES = [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
        '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
        '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
        '2a06:98c0::/29', '2c0f:f248::/32',
    ];

    /**
     * The headers that should be used to detect proxies.
     *
     * @var int
     */
    protected $headers =
    Request::HEADER_X_FORWARDED_FOR |
    Request::HEADER_X_FORWARDED_HOST |
    Request::HEADER_X_FORWARDED_PORT |
    Request::HEADER_X_FORWARDED_PROTO |
    Request::HEADER_X_FORWARDED_AWS_ELB;

    /**
     * Trusted proxies come from config('trustedproxy.proxies') (env TRUSTED_PROXIES): a comma-separated list
     * of addresses, CIDR ranges and the keywords "private" and "cloudflare". Symfony then walks
     * X-Forwarded-For from the right and Request::ip() is the first hop that is not trusted.
     */
    protected function proxies()
    {
        return static::$alwaysTrustProxies ?: self::configuredProxies();
    }

    /**
     * Entries that mean "trust every hop". Symfony does not understand '*' / '**' inside a list, so they fall
     * back to the legacy mode instead of silently becoming a bogus entry that leaves 127.0.0.1 untrusted.
     */
    private const TRUST_ALL_ENTRIES = ['*', '**', '0.0.0.0/0'];

    /** @var array<string, true> warnings already logged by this worker (configuredProxies() runs per request) */
    private static array $warned = [];

    public static function configuredProxies(): array
    {
        $configured = config('trustedproxy.proxies');
        $items = is_array($configured) ? $configured : explode(',', (string) $configured);

        $proxies = [];
        foreach ($items as $item) {
            $item = strtolower(trim((string) $item));
            if ($item === '') {
                continue;
            }
            if (in_array($item, self::TRUST_ALL_ENTRIES, true)) {
                self::warnOnce("TRUSTED_PROXIES contains '{$item}': trusting every IPv4 hop as before (legacy mode, per-IP login limit off).");
                return self::LEGACY_TRUST_ALL;
            }
            if ($item === 'private') {
                array_push($proxies, ...self::PRIVATE_RANGES);
            } elseif ($item === 'cloudflare') {
                array_push($proxies, ...self::CLOUDFLARE_RANGES);
            } elseif (self::isIpOrCidr($item)) {
                $proxies[] = $item;
            } else {
                self::warnOnce("TRUSTED_PROXIES entry '{$item}' is neither an IP, a CIDR range nor a known keyword (private, cloudflare); ignored.");
            }
        }

        return $proxies ? array_values(array_unique($proxies)) : self::LEGACY_TRUST_ALL;
    }

    private static function isIpOrCidr(string $item): bool
    {
        $parts = explode('/', $item, 2);
        $ip = $parts[0];
        if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return false;
        }
        if (!isset($parts[1])) {
            return true;
        }
        $max = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false ? 128 : 32;
        return ctype_digit($parts[1]) && (int) $parts[1] <= $max;
    }

    private static function warnOnce(string $message): void
    {
        if (isset(self::$warned[$message])) {
            return;
        }
        self::$warned[$message] = true;
        try {
            Log::warning($message);
        } catch (\Throwable) {
            // logging must never break request handling
        }
    }

    /**
     * True while no TRUSTED_PROXIES list is configured, i.e. client IPs can be written by the client.
     */
    public static function trustsEveryone(): bool
    {
        return self::configuredProxies() === self::LEGACY_TRUST_ALL;
    }
}
