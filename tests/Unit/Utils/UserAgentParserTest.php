<?php

namespace Tests\Unit\Utils;

use App\Utils\UserAgentParser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class UserAgentParserTest extends TestCase
{
    public static function userAgents(): array
    {
        return [
            'windows edge' => [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
                ['type' => 'desktop', 'os' => 'Windows 10/11', 'browser' => 'Edge 129', 'model' => null],
            ],
            'mac safari' => [
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
                ['type' => 'desktop', 'os' => 'macOS', 'browser' => 'Safari 17', 'model' => null],
            ],
            'iphone safari' => [
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
                ['type' => 'mobile', 'os' => 'iOS 17.5', 'browser' => 'Safari 17', 'model' => 'iPhone'],
            ],
            'ipad chrome' => [
                'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
                ['type' => 'tablet', 'os' => 'iPadOS 16.6', 'browser' => 'Chrome 120', 'model' => 'iPad'],
            ],
            'android wechat' => [
                'Mozilla/5.0 (Linux; Android 14; 23127PN0CC Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0 Mobile Safari/537.36 MicroMessenger/8.0.47',
                ['type' => 'mobile', 'os' => 'Android 14', 'browser' => '微信 8', 'model' => '23127PN0CC'],
            ],
            'android reduced ua' => [
                'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
                ['type' => 'mobile', 'os' => 'Android 10', 'browser' => 'Chrome 126', 'model' => null],
            ],
            'android locale model' => [
                'Mozilla/5.0 (Linux; U; Android 4.4.2; zh-cn; SM-G9006V Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0 Mobile Safari/537.36',
                ['type' => 'mobile', 'os' => 'Android 4.4', 'browser' => 'Chrome 30', 'model' => 'SM-G9006V'],
            ],
            'android tablet' => [
                'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ['type' => 'tablet', 'os' => 'Android 13', 'browser' => 'Chrome 120', 'model' => 'SM-X710'],
            ],
            'harmonyos' => [
                'Mozilla/5.0 (Phone; OpenHarmony 4.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile HuaweiBrowser/5.0.4.300',
                ['type' => 'mobile', 'os' => 'HarmonyOS 4.1', 'browser' => '华为浏览器 5', 'model' => null],
            ],
            'linux firefox' => [
                'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
                ['type' => 'desktop', 'os' => 'Ubuntu', 'browser' => 'Firefox 130', 'model' => null],
            ],
            'curl' => [
                'curl/8.5.0',
                ['type' => 'bot', 'os' => null, 'browser' => null, 'model' => null],
            ],
            'empty' => [
                '',
                ['type' => 'unknown', 'os' => null, 'browser' => null, 'model' => null],
            ],
        ];
    }

    #[DataProvider('userAgents')]
    public function test_parse(string $ua, array $expected): void
    {
        $this->assertSame($expected, UserAgentParser::parse($ua));
    }
}
