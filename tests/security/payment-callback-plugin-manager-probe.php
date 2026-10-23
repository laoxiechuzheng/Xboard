<?php

declare(strict_types=1);

namespace {
    $root = dirname(__DIR__, 2);
    $base = sys_get_temp_dir() . '/xboard-plugin-priority-' . bin2hex(random_bytes(8));
    $coreDir = $base . '/plugins-core/Epay';
    $userDir = $base . '/plugins/Epay';
    $coreFile = $coreDir . '/Plugin.php';
    $userFile = $userDir . '/Plugin.php';

    $GLOBALS['plugin_probe_root'] = $root;
    $GLOBALS['plugin_probe_base'] = $base;
    $GLOBALS['plugin_probe_user_file'] = $userFile;

    register_shutdown_function(static function () use ($coreFile, $userFile, $coreDir, $userDir, $base): void {
        if (is_file($coreFile)) {
            unlink($coreFile);
        }
        if (is_file($userFile)) {
            unlink($userFile);
        }
        if (is_dir($coreDir)) {
            rmdir($coreDir);
        }
        if (is_dir($userDir)) {
            rmdir($userDir);
        }
        if (is_dir($base . '/plugins-core')) {
            rmdir($base . '/plugins-core');
        }
        if (is_dir($base . '/plugins')) {
            rmdir($base . '/plugins');
        }
        if (is_dir($base)) {
            rmdir($base);
        }
    });

    if (!mkdir($coreDir, 0777, true) && !is_dir($coreDir)) {
        fwrite(STDERR, "FIXTURE: cannot create core directory\n");
        exit(2);
    }
    if (!mkdir($userDir, 0777, true) && !is_dir($userDir)) {
        fwrite(STDERR, "FIXTURE: cannot create user directory\n");
        exit(2);
    }

    $source = $root . '/plugins-core/Epay/Plugin.php';
    if (!is_file($source) || !copy($source, $coreFile)) {
        fwrite(STDERR, "FIXTURE: cannot copy core plugin\n");
        exit(2);
    }

    $legacyPlugin = <<<'PHP'
<?php
namespace Plugin\Epay;
class Plugin extends \App\Services\Plugin\AbstractPlugin implements \App\Contracts\PaymentInterface
{
    public function form(): array { return []; }
    public function pay($order): array { return []; }
    public function notify($params): array|bool { return false; }
}
PHP;

    if (file_put_contents($userFile, $legacyPlugin) === false) {
        fwrite(STDERR, "FIXTURE: cannot write legacy plugin\n");
        exit(2);
    }
}

namespace App\Contracts {
    interface PaymentInterface
    {
        public function form(): array;

        public function pay($order): array;

        public function notify($params);
    }
}

namespace App\Services\Plugin {
    abstract class AbstractPlugin
    {
        protected array $config = [];
        protected string $pluginCode;

        public function __construct(string $pluginCode)
        {
            $this->pluginCode = $pluginCode;
        }

        public function getPluginCode(): string
        {
            return $this->pluginCode;
        }

        public function setConfig(array $config): void
        {
            $this->config = $config;
        }

        public function getConfig(?string $key = null, $default = null): mixed
        {
            return $key === null ? $this->config : ($this->config[$key] ?? $default);
        }

        protected function filter(string $hook, callable $callback, int $priority = 20): void
        {
        }
    }
}

namespace App\Models {
    class Plugin
    {
    }
}

namespace Illuminate\Support {
    class Str
    {
        public static function studly(string $value): string
        {
            return str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $value)));
        }
    }
}

namespace Illuminate\Support\Facades {
    class File
    {
        public static function exists(string $path): bool
        {
            return is_file($path);
        }

        public static function isDirectory(string $path): bool
        {
            return is_dir($path);
        }
    }

    class Log
    {
        public static function warning(string $message): void
        {
        }

        public static function error(string $message): void
        {
        }

        public static function info(string $message): void
        {
        }
    }
}

namespace {
    function base_path(string $path = ''): string
    {
        return rtrim($GLOBALS['plugin_probe_base'], '/\\') . '/' . trim($path, '/\\');
    }

    require_once $GLOBALS['plugin_probe_root'] . '/app/Services/Plugin/PluginManager.php';

    final class PluginManagerProbe extends \App\Services\Plugin\PluginManager
    {
        public function loadForProbe(string $pluginCode): ?\App\Services\Plugin\AbstractPlugin
        {
            return $this->loadPlugin($pluginCode);
        }
    }

    spl_autoload_register(static function (string $class): void {
        if ($class === 'Plugin\\Epay\\Plugin') {
            require_once $GLOBALS['plugin_probe_user_file'];
        }
    });

    try {
        $manager = new PluginManagerProbe();
        $plugin = $manager->loadForProbe('epay');
        if ($plugin === null) {
            echo "NULL\n";
            exit(1);
        }

        $loadedFile = (new \ReflectionClass($plugin))->getFileName();
        $coreFile = realpath($GLOBALS['plugin_probe_base'] . '/plugins-core/Epay/Plugin.php');
        $loadedFile = $loadedFile === false ? false : realpath($loadedFile);

        if ($coreFile !== false && $loadedFile === $coreFile) {
            echo "CORE:{$loadedFile}\n";
            exit(0);
        }

        echo 'USER:' . ($loadedFile === false ? 'unknown' : $loadedFile) . "\n";
        exit(1);
    } catch (\Throwable $error) {
        fwrite(STDERR, 'ERROR:' . $error::class . ':' . $error->getMessage() . "\n");
        exit(2);
    }
}
