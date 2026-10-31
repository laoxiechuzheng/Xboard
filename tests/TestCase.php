<?php

namespace Tests;

use App\Support\Setting;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = parent::createApplication();

        // config/database.php prefixes DB_DATABASE with base_path(), so phpunit.xml cannot ask for ':memory:' by itself
        if (env('DB_CONNECTION') === 'sqlite' && env('DB_DATABASE') === ':memory:') {
            $app['config']->set('database.connections.sqlite.database', ':memory:');
            $app['db']->purge('sqlite');
        }

        // admin_setting() and the default cache use the redis store; tests have no redis server
        $app['config']->set('cache.stores.redis', ['driver' => 'array', 'serialize' => false]);
        $app['cache']->forgetDriver('redis');
        $app->forgetInstance(Setting::class);

        return $app;
    }
}
