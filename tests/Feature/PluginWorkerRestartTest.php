<?php

namespace Tests\Feature;

use App\Services\Plugin\PluginConfigService;
use App\Services\Plugin\PluginManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * Queue workers boot the enabled plugins once; a plugin change in the admin asks them to restart
 * (the queue:restart signal) so their hooks and config follow it.
 */
class PluginWorkerRestartTest extends TestCase
{
    use RefreshDatabase;

    private const CODE = 'worker_restart_probe';
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = base_path('plugins/WorkerRestartProbe');
        File::ensureDirectoryExists($this->dir);
        File::put($this->dir . '/config.json', json_encode([
            'name' => 'Worker restart probe',
            'code' => self::CODE,
            'version' => '1.0.0',
            'config' => ['flag' => ['type' => 'boolean', 'label' => 'flag', 'default' => false]],
        ]));
        DB::table('v2_plugins')->insert([
            'name' => 'Worker restart probe',
            'code' => self::CODE,
            'version' => '1.0.0',
            'is_enabled' => true,
            'config' => '{}',
        ]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->dir);
        parent::tearDown();
    }

    public function test_saving_a_plugin_config_signals_the_queue_workers(): void
    {
        Cache::forget('illuminate:queue:restart');

        app(PluginConfigService::class)->updateConfig(self::CODE, ['flag' => true, 'unknown' => 1]);

        $this->assertSame(['flag' => true], json_decode(DB::table('v2_plugins')->where('code', self::CODE)->value('config'), true));
        $this->assertIsInt(Cache::get('illuminate:queue:restart'));
    }

    public function test_the_signal_moves_forward_like_queue_restart(): void
    {
        Cache::forever('illuminate:queue:restart', 1);

        PluginManager::restartQueueWorkers();

        $this->assertGreaterThan(1, Cache::get('illuminate:queue:restart'));
    }
}
