<?php

namespace App\Protocols;

use App\Support\AbstractProtocol;
use App\Models\Server;

class QuantumultX extends AbstractProtocol
{
    public $flags = ['quantumult%20x', 'quantumult-x'];
    
    public $allowedProtocols = [
        Server::TYPE_SHADOWSOCKS,
        Server::TYPE_VMESS,
        Server::TYPE_TROJAN,
        Server::TYPE_HYSTERIA,
        Server::TYPE_VLESS,
    ];

    public function handle()
    {
        $servers = $this->servers;
        $user = $this->user;
        $uri = '';
        
        foreach ($servers as $item) {
            if ($item['type'] === Server::TYPE_SHADOWSOCKS) {
                $uri .= self::buildShadowsocks($item['password'], $item);
            }
            if ($item['type'] === Server::TYPE_VMESS) {
                $uri .= self::buildVmess($item['password'], $item);
            }
            if ($item['type'] === Server::TYPE_TROJAN) {
                $uri .= self::buildTrojan($item['password'], $item);
            }
            if ($item['type'] === Server::TYPE_VLESS) {
                $uri .= self::buildVless($item['password'], $item);
            }
            if ($item['type'] === Server::TYPE_HYSTERIA) {
                $uri .= self::buildHysteria($item['password'], $item);
            }
        }
        
        return response(base64_encode($uri))
            ->header('content-type', 'text/plain')
            ->header('subscription-userinfo', "upload={$user['u']}; download={$user['d']}; total={$user['transfer_enable']}; expire={$user['expired_at']}");
    }

    public static function buildShadowsocks($password, $server)
    {
        $protocol_settings = $server['protocol_settings'];
        $config = [
            "shadowsocks={$server['host']}:{$server['port']}",
            "method={$protocol_settings['cipher']}",
            "password={$password}",
            'fast-open=true',
            'udp-relay=true',
            "tag={$server['name']}"
        ];
        if (data_get($protocol_settings, 'plugin') && data_get($protocol_settings, 'plugin_opts')) {
            $plugin = data_get($protocol_settings, 'plugin');
            $pluginOpts = data_get($protocol_settings, 'plugin_opts', '');
            $parsedOpts = collect(explode(';', $pluginOpts))->filter()->mapWithKeys(function ($pair) {
                    if (!str_contains($pair, '=')) return [];
                    [$key, $value] = explode('=', $pair, 2);
                    return [trim($key) => trim($value)];
                })->all();
            if ($plugin === 'obfs') {
                $config[] = "obfs={$parsedOpts['obfs']}";
                if (isset($parsedOpts['obfs-host'])) $config[] = "obfs-host={$parsedOpts['obfs-host']}";
                if (isset($parsedOpts['path'])) $config[] = "obfs-uri={$parsedOpts['path']}";
            }
        }
        return implode(',', $config) . "\r\n";
    }

    public static function buildVmess($uuid, $server)
    {
        $protocol_settings = $server['protocol_settings'];
        $config = ["vmess={$server['host']}:{$server['port']}", 'method=chacha20-poly1305', "password={$uuid}", 'fast-open=true', 'udp-relay=true', "tag={$server['name']}"];
        if (data_get($protocol_settings, 'tls')) {
            $config[] = (data_get($protocol_settings, 'network') === 'ws') ? 'obfs=wss' : 'obfs=over-tls';
            if ($sni = data_get($protocol_settings, 'tls_settings.server_name')) $config[] = "obfs-host={$sni}";
        }
        if (data_get($protocol_settings, 'network') === 'ws' && !data_get($protocol_settings, 'tls')) $config[] = 'obfs=ws';
        if ($path = data_get($protocol_settings, 'network_settings.path')) $config[] = "obfs-uri={$path}";
        
        return implode(',', $config) . "\r\n";
    }

    public static function buildTrojan($password, $server)
    {
        $protocol_settings = $server['protocol_settings'];
        $config = [
            "trojan={$server['host']}:{$server['port']}",
            "password={$password}",
            'over-tls=true',
            data_get($protocol_settings, 'server_name') ? "tls-host={$protocol_settings['server_name']}" : "",
            data_get($protocol_settings, 'allow_insecure') ? 'tls-verification=false' : 'tls-verification=true',
            'fast-open=true',
            'udp-relay=true',
            "tag={$server['name']}"
        ];
        return implode(',', array_filter($config)) . "\r\n";
    }

    public static function buildVless($uuid, $server)
    {
        $protocol_settings = $server['protocol_settings'];
        $isReality = (data_get($protocol_settings, 'tls') && data_get($protocol_settings, 'flow') === 'xtls-rprx-vision');

        $config = [
            "vless={$server['host']}:{$server['port']}",
            "method=none",
            "password={$uuid}",
            "fast-open=true",
            "udp-relay=true",
            "tag={$server['name']}"
        ];

        if ($isReality) {
             $realitySettings = data_get($protocol_settings, 'reality_settings', []);
             $tlsSettings = data_get($protocol_settings, 'tls_settings', []);
             $sni = data_get($tlsSettings, 'server_name') ?: data_get($realitySettings, 'server_name') ?: $server['host'];
             
             $config[] = "obfs=over-tls";
             $config[] = "obfs-host={$sni}";
             $config[] = "reality-base64-pubkey=" . data_get($realitySettings, 'public_key');
             $config[] = "reality-hex-shortid=" . data_get($realitySettings, 'short_id');
             $config[] = "vless-flow=xtls-rprx-vision";
        } else if (data_get($protocol_settings, 'tls')) {
             $config[] = "obfs=over-tls";
             if ($sni = data_get($protocol_settings, 'tls_settings.server_name')) $config[] = "obfs-host={$sni}";
        }
        return implode(',', $config) . "\r\n";
    }

    public static function buildHysteria($password, $server)
    {
        $protocol_settings = $server['protocol_settings'];
        if ($protocol_settings['version'] != 2) return '';
        $config = ["hysteria2={$server['host']}:{$server['port']}", "password={$password}", "fast-open=true", "udp-relay=true", "tag={$server['name']}"];
        if ($sni = data_get($protocol_settings, 'tls.server_name')) $config[] = "sni={$sni}";
        return implode(',', $config) . "\r\n";
    }
}