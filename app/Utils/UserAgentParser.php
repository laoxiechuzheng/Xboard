<?php

namespace App\Utils;

/**
 * 轻量 User-Agent 解析（不引入第三方依赖），用于登录记录展示。
 * 只识别常见系统、浏览器与设备类型，识别不了的返回 null。
 */
class UserAgentParser
{
    /**
     * @return array{type: string, os: ?string, browser: ?string, model: ?string}
     */
    public static function parse(?string $userAgent): array
    {
        $ua = trim((string) $userAgent);
        if ($ua === '') {
            return ['type' => 'unknown', 'os' => null, 'browser' => null, 'model' => null];
        }

        return [
            'type' => self::deviceType($ua),
            'os' => self::os($ua),
            'browser' => self::browser($ua),
            'model' => self::model($ua),
        ];
    }

    private static function deviceType(string $ua): string
    {
        if (preg_match('/bot|spider|crawl|slurp|curl\/|wget\/|python-requests|python-urllib|okhttp|go-http-client|java\//i', $ua)) {
            return 'bot';
        }
        if (preg_match('/iPad|Tablet|PlayBook|Silk|Kindle|SM-T\d|MatePad|HarmonyOS.*Tablet/i', $ua)) {
            return 'tablet';
        }
        if (preg_match('/Android/i', $ua) && !preg_match('/Mobile/i', $ua)) {
            return 'tablet';
        }
        if (preg_match('/Mobi|iPhone|iPod|Android|Windows Phone|HarmonyOS|OpenHarmony/i', $ua)) {
            return 'mobile';
        }
        if (preg_match('/Windows NT|Macintosh|X11|CrOS|Linux/i', $ua)) {
            return 'desktop';
        }
        return 'unknown';
    }

    private static function os(string $ua): ?string
    {
        if (preg_match('/(?:HarmonyOS|OpenHarmony)[ \/]?([\d.]+)?/i', $ua, $m)) {
            return trim('HarmonyOS ' . self::majorMinor($m[1] ?? ''));
        }
        if (preg_match('/Windows NT ([\d.]+)/i', $ua, $m)) {
            return match ($m[1]) {
                '10.0' => 'Windows 10/11',
                '6.3' => 'Windows 8.1',
                '6.2' => 'Windows 8',
                '6.1' => 'Windows 7',
                '6.0' => 'Windows Vista',
                '5.1', '5.2' => 'Windows XP',
                default => 'Windows',
            };
        }
        if (preg_match('/Windows Phone/i', $ua)) {
            return 'Windows Phone';
        }
        if (preg_match('/iPad.*?OS ([\d_]+)/i', $ua, $m)) {
            return 'iPadOS ' . self::majorMinor(str_replace('_', '.', $m[1]));
        }
        if (preg_match('/(?:iPhone|iPod).*?OS ([\d_]+)/i', $ua, $m)) {
            return 'iOS ' . self::majorMinor(str_replace('_', '.', $m[1]));
        }
        if (preg_match('/Android[ \/]?([\d.]+)?/i', $ua, $m)) {
            return trim('Android ' . self::majorMinor($m[1] ?? ''));
        }
        if (preg_match('/CrOS/i', $ua)) {
            return 'ChromeOS';
        }
        if (preg_match('/Mac OS X|Macintosh/i', $ua)) {
            return 'macOS';
        }
        if (preg_match('/Ubuntu/i', $ua)) {
            return 'Ubuntu';
        }
        if (preg_match('/Linux|X11/i', $ua)) {
            return 'Linux';
        }
        return null;
    }

    private static function browser(string $ua): ?string
    {
        // 顺序重要：内嵌浏览器与基于 Chromium 的浏览器必须排在 Chrome / Safari 之前。
        $rules = [
            ['/MicroMessenger\/([\d.]+)/i', '微信'],
            ['/(?:MQQBrowser|QQBrowser)\/([\d.]+)/i', 'QQ浏览器'],
            ['/\bQQ\/([\d.]+)/i', 'QQ'],
            ['/DingTalk\/([\d.]+)/i', '钉钉'],
            ['/AlipayClient\/([\d.]+)/i', '支付宝'],
            ['/Quark\/([\d.]+)/i', '夸克'],
            ['/UCBrowser\/([\d.]+)/i', 'UC浏览器'],
            ['/baiduboxapp\/([\d.]+)/i', '百度'],
            ['/(?:HuaweiBrowser|HBPC)\/([\d.]+)/i', '华为浏览器'],
            ['/MiuiBrowser\/([\d.]+)/i', '小米浏览器'],
            ['/HeyTapBrowser\/([\d.]+)/i', 'OPPO浏览器'],
            ['/VivoBrowser\/([\d.]+)/i', 'vivo浏览器'],
            ['/SamsungBrowser\/([\d.]+)/i', 'Samsung Internet'],
            ['/(?:Edg|EdgA|EdgiOS)\/([\d.]+)/i', 'Edge'],
            ['/(?:OPR|OPiOS)\/([\d.]+)/i', 'Opera'],
            ['/YaBrowser\/([\d.]+)/i', 'Yandex'],
            ['/Vivaldi\/([\d.]+)/i', 'Vivaldi'],
            ['/(?:Firefox|FxiOS)\/([\d.]+)/i', 'Firefox'],
            ['/CriOS\/([\d.]+)/i', 'Chrome'],
            ['/Chrome\/([\d.]+)/i', 'Chrome'],
            ['/Version\/([\d.]+).*Safari/i', 'Safari'],
            ['/(?:MSIE |Trident\/.*rv:)([\d.]+)/i', 'Internet Explorer'],
        ];

        foreach ($rules as [$pattern, $name]) {
            if (preg_match($pattern, $ua, $m)) {
                $version = explode('.', $m[1])[0] ?? '';
                return trim($name . ' ' . $version);
            }
        }
        if (preg_match('/Safari/i', $ua) && preg_match('/iPhone|iPad|Macintosh/i', $ua)) {
            return 'Safari';
        }
        return null;
    }

    private static function model(string $ua): ?string
    {
        if (preg_match('/iPhone/i', $ua)) {
            return 'iPhone';
        }
        if (preg_match('/iPad/i', $ua)) {
            return 'iPad';
        }
        // Android: "...; Android 14; Pixel 8 Build/..." 或 "...; Android 14; SM-S9180) ..."
        if (preg_match('/Android[^;)]*;(?:\s*[a-z]{2}[-_][a-z]{2};)?\s*([^;)]+?)(?:\s+Build\/|\s*\))/i', $ua, $m)) {
            $model = trim($m[1]);
            // Chrome 精简 UA 把型号固定为 "K"，没有意义。
            if ($model !== '' && strcasecmp($model, 'K') !== 0 && !preg_match('/^(?:wv|Linux|U|Mobile)$/i', $model)) {
                return mb_substr($model, 0, 64);
            }
        }
        return null;
    }

    private static function majorMinor(string $version): string
    {
        $parts = array_values(array_filter(explode('.', $version), fn($p) => $p !== ''));
        if (!$parts) {
            return '';
        }
        if (count($parts) === 1 || $parts[1] === '0') {
            return $parts[0];
        }
        return $parts[0] . '.' . $parts[1];
    }
}
