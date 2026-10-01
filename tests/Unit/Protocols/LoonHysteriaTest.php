<?php

namespace Tests\Unit\Protocols;

use App\Protocols\Loon;
use PHPUnit\Framework\TestCase;

class LoonHysteriaTest extends TestCase
{
    public function test_disabled_obfuscation_does_not_export_a_retained_password(): void
    {
        $server = $this->server();
        $server['protocol_settings']['obfs']['open'] = false;

        $line = Loon::buildHysteria('user-password', $server, []);

        $this->assertSame($this->lineWithoutObfuscation(), $line);
    }

    public function test_missing_obfuscation_switch_keeps_the_node_without_obfuscation(): void
    {
        $server = $this->server();
        unset($server['protocol_settings']['obfs']['open']);

        $line = Loon::buildHysteria('user-password', $server, []);

        $this->assertSame($this->lineWithoutObfuscation(), $line);
    }

    public function test_enabled_obfuscation_preserves_the_existing_export(): void
    {
        $line = Loon::buildHysteria('user-password', $this->server(), []);

        $this->assertSame(
            'Test=Hysteria2,example.com,20543,"user-password",sni=example.com,skip-cert-verify=false,download-bandwidth=1000,salamander-password=obfs-password,udp=true' . "\r\n",
            $line
        );
    }

    public function test_zero_string_is_a_valid_obfuscation_password(): void
    {
        $server = $this->server();
        $server['protocol_settings']['obfs']['password'] = '0';

        $line = Loon::buildHysteria('user-password', $server, []);

        $this->assertStringContainsString('salamander-password=0,', $line);
    }

    public function test_obfuscation_password_with_a_comma_is_quoted(): void
    {
        $server = $this->server();
        $server['protocol_settings']['obfs']['password'] = 'first,second';

        $line = Loon::buildHysteria('user-password', $server, []);

        $this->assertStringContainsString('salamander-password="first,second",', $line);
    }

    public function test_empty_obfuscation_password_is_not_exported(): void
    {
        $server = $this->server();
        $server['protocol_settings']['obfs']['password'] = '';

        $line = Loon::buildHysteria('user-password', $server, []);

        $this->assertSame($this->lineWithoutObfuscation(), $line);
    }

    private function lineWithoutObfuscation(): string
    {
        return 'Test=Hysteria2,example.com,20543,"user-password",sni=example.com,skip-cert-verify=false,download-bandwidth=1000,udp=true' . "\r\n";
    }

    private function server(): array
    {
        return [
            'name' => 'Test',
            'host' => 'example.com',
            'port' => '20543',
            'protocol_settings' => [
                'version' => 2,
                'bandwidth' => ['up' => 1000, 'down' => 1000],
                'tls' => ['server_name' => 'example.com', 'allow_insecure' => false],
                'obfs' => ['open' => true, 'type' => 'salamander', 'password' => 'obfs-password'],
            ],
        ];
    }
}
