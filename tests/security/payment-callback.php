<?php

declare(strict_types=1);

namespace {
    final class SecurityAssertionFailed extends \RuntimeException
    {
    }

    $GLOBALS['security_tests'] = [];
    $GLOBALS['security_app_bindings'] = [];

    function app(string $abstract): mixed
    {
        if (!array_key_exists($abstract, $GLOBALS['security_app_bindings'])) {
            throw new \RuntimeException("No test binding registered for {$abstract}");
        }

        return $GLOBALS['security_app_bindings'][$abstract];
    }

    function security_bind(string $abstract, mixed $instance): void
    {
        $GLOBALS['security_app_bindings'][$abstract] = $instance;
    }

    function security_test(string $name, callable $run): void
    {
        $GLOBALS['security_tests'][] = ['name' => $name, 'run' => $run];
    }

    function security_fail(string $message): never
    {
        throw new SecurityAssertionFailed($message);
    }

    function security_value(mixed $value): string
    {
        if (is_object($value)) {
            return get_debug_type($value);
        }

        $rendered = var_export($value, true);

        return strlen($rendered) > 500 ? substr($rendered, 0, 500) . '...' : $rendered;
    }

    function security_same(mixed $expected, mixed $actual, string $message): void
    {
        if ($expected !== $actual) {
            security_fail(
                "{$message}\n  expected: " . security_value($expected) .
                "\n  actual:   " . security_value($actual)
            );
        }
    }

    function security_true(bool $condition, string $message): void
    {
        if (!$condition) {
            security_fail($message);
        }
    }

    function security_without_warnings(callable $run, string $context): mixed
    {
        $warnings = [];
        set_error_handler(
            static function (int $severity, string $message, string $file, int $line) use (&$warnings): bool {
                $warnings[] = "{$message} ({$file}:{$line})";

                return true;
            }
        );

        try {
            $result = $run();
        } finally {
            restore_error_handler();
        }

        security_same([], $warnings, "{$context} must not emit PHP warnings or notices");

        return $result;
    }
}

namespace App\Exceptions {
    class ApiException extends \Exception
    {
        public function __construct($message = null, $code = 400, $errors = null)
        {
            parent::__construct((string) $message, (int) $code);
        }
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
            if ($key === null) {
                return $this->config;
            }

            return $this->config[$key] ?? $default;
        }

        protected function filter(string $hook, callable $callback, int $priority = 20): void
        {
        }
    }

    class PluginManager
    {
        public array $plugins = [];

        public function initializeEnabledPlugins(): void
        {
        }

        public function getEnabledPlugins(): array
        {
            return $this->plugins;
        }

        public function getEnabledPluginsByType(string $type): array
        {
            return $this->plugins;
        }

        public function getEnabledPaymentPlugins(): array
        {
            return $this->plugins;
        }
    }

    class HookManager
    {
        public static array $paymentMethods = [];
        public static array $calls = [];

        public static function filter(string $hook, mixed $value, mixed ...$args): mixed
        {
            if ($hook === 'available_payment_methods') {
                return self::$paymentMethods;
            }

            return $value;
        }

        public static function call(string $hook, mixed $payload = null): void
        {
            self::$calls[] = ['hook' => $hook, 'payload' => $payload];
        }
    }
}

namespace App\Models {
    final class PaymentRecord
    {
        public function __construct(
            public int $id,
            public string $uuid,
            public string $payment,
            public bool $enable,
            public array|string $config,
            public string $notifyDomain = ''
        ) {
        }

        public function makeVisible(string $attribute): self
        {
            return $this;
        }

        public function toArray(): array
        {
            return [
                'id' => $this->id,
                'uuid' => $this->uuid,
                'payment' => $this->payment,
                'enable' => $this->enable,
                'config' => $this->config,
                'notify_domain' => $this->notifyDomain,
            ];
        }
    }

    final class PaymentQuery
    {
        private array $conditions = [];

        public function __construct(private array $records)
        {
        }

        public function where(string $column, mixed $value): self
        {
            $this->conditions[] = [$column, $value];

            return $this;
        }

        public function first(): ?PaymentRecord
        {
            foreach ($this->records as $record) {
                $matches = true;
                foreach ($this->conditions as [$column, $value]) {
                    $actual = match ($column) {
                        'id' => $record->id,
                        'uuid' => $record->uuid,
                        'payment' => $record->payment,
                        'enable' => $record->enable,
                        default => null,
                    };
                    if ($actual != $value) {
                        $matches = false;
                        break;
                    }
                }

                if ($matches) {
                    return $record;
                }
            }

            return null;
        }
    }

    class Payment
    {
        public static array $records = [];

        public static function clear(): void
        {
            self::$records = [];
        }

        public static function seed(
            int $id,
            string $uuid,
            string $payment,
            array $config,
            bool $enable = true
        ): PaymentRecord {
            $record = new PaymentRecord($id, $uuid, $payment, $enable, $config);
            self::$records[] = $record;

            return $record;
        }

        public static function find(int|string $id): ?PaymentRecord
        {
            foreach (self::$records as $record) {
                if ((string) $record->id === (string) $id) {
                    return $record;
                }
            }

            return null;
        }

        public static function where(string $column, mixed $value): PaymentQuery
        {
            return (new PaymentQuery(self::$records))->where($column, $value);
        }
    }

    class Order
    {
        public const STATUS_PENDING = 0;
        public const STATUS_PROCESSING = 1;
        public const STATUS_COMPLETED = 3;

        public static array $records = [];

        public function __construct(
            public string $trade_no,
            public int $status,
            public ?int $payment_id,
            public int $total_amount,
            public ?int $handling_amount
        ) {
        }

        public static function clear(): void
        {
            self::$records = [];
        }

        public static function seed(
            string $tradeNo,
            ?int $paymentId,
            int $totalAmount,
            ?int $handlingAmount,
            int $status = self::STATUS_PENDING
        ): self {
            $order = new self($tradeNo, $status, $paymentId, $totalAmount, $handlingAmount);
            self::$records[] = $order;

            return $order;
        }

        public static function where(string $column, mixed $value): OrderQuery
        {
            return (new OrderQuery(self::$records))->where($column, $value);
        }
    }

    final class OrderQuery
    {
        private array $conditions = [];

        public function __construct(private array $records)
        {
        }

        public function where(string $column, mixed $value): self
        {
            $this->conditions[] = [$column, $value];

            return $this;
        }

        public function first(): ?Order
        {
            foreach ($this->records as $order) {
                $matches = true;
                foreach ($this->conditions as [$column, $value]) {
                    $actual = match ($column) {
                        'trade_no' => $order->trade_no,
                        'payment_id' => $order->payment_id,
                        'status' => $order->status,
                        default => null,
                    };
                    if ($actual != $value) {
                        $matches = false;
                        break;
                    }
                }

                if ($matches) {
                    return $order;
                }
            }

            return null;
        }
    }
}

namespace App\Services {
    use App\Models\Order;

    class OrderService
    {
        public static array $paidCallbacks = [];

        public function __construct(private Order $order)
        {
        }

        public static function reset(): void
        {
            self::$paidCallbacks = [];
        }

        public function paid($callbackNo): bool
        {
            self::$paidCallbacks[] = $callbackNo;
            $this->order->status = Order::STATUS_COMPLETED;

            return true;
        }
    }
}

namespace Illuminate\Http {
    class Request
    {
        public function __construct(private array $parameters = [])
        {
        }

        public function input(?string $key = null, mixed $default = null): mixed
        {
            if ($key === null) {
                return $this->parameters;
            }

            return $this->parameters[$key] ?? $default;
        }
    }
}

namespace Illuminate\Support\Facades {
    class Log
    {
        public static array $errors = [];

        public static function reset(): void
        {
            self::$errors = [];
        }

        public static function error(mixed $error): void
        {
            self::$errors[] = $error;
        }
    }
}

namespace App\Http\Controllers {
    class Controller
    {
        public function fail(array $response): array
        {
            return ['status' => 'fail', 'response' => $response];
        }
    }
}

namespace {
    use App\Models\Order;
    use App\Services\PaymentService;
    use App\Services\OrderService;
    use App\Services\Plugin\HookManager;
    use App\Services\Plugin\PluginManager;
    use Illuminate\Http\Request;
    use Illuminate\Support\Facades\Log;
    use Plugin\Epay\Plugin as EpayPlugin;

    $root = dirname(__DIR__, 2);

    require_once $root . '/app/Services/PaymentService.php';
    require_once $root . '/app/Http/Controllers/V1/Guest/PaymentController.php';
    require_once $root . '/plugins-core/Mgate/Plugin.php';
    require_once $root . '/plugins-core/Epay/Plugin.php';

    function security_reset_harness(): void
    {
        $GLOBALS['security_app_bindings'] = [];
        HookManager::$paymentMethods = [];
        HookManager::$calls = [];
        \App\Models\Payment::clear();
        Order::clear();
        OrderService::reset();
        Log::reset();
    }

    function security_install_payment_plugins(): array
    {
        $epay = new EpayPlugin('epay');
        $mgate = new \Plugin\Mgate\Plugin('mgate');
        $manager = new PluginManager();
        $manager->plugins = [$epay, $mgate];
        security_bind(PluginManager::class, $manager);

        HookManager::$paymentMethods = [
            'EPay' => ['plugin_code' => 'epay'],
            'MGate' => ['plugin_code' => 'mgate'],
        ];

        return [$epay, $mgate];
    }

    function security_seed_epay_payment(
        string $uuid = 'epay-uuid',
        int $id = 77,
        string $key = 'merchant-secret',
        string $method = 'EPay'
    ): void {
        \App\Models\Payment::seed($id, $uuid, $method, [
            'enabled' => true,
            'pid' => '1001',
            'key' => $key,
            'url' => 'https://epay.invalid',
            'type' => 'alipay',
        ]);
    }

    function security_seed_order(
        string $tradeNo = 'ORDER-0001',
        ?int $paymentId = 77,
        int $totalAmount = 1000,
        ?int $handlingAmount = 234
    ): Order {
        return Order::seed($tradeNo, $paymentId, $totalAmount, $handlingAmount);
    }

    function security_epay_sign(array $params, string $key): string
    {
        ksort($params);

        return md5(stripslashes(urldecode(http_build_query($params))) . $key);
    }

    /**
     * Test fixture only: synthesize a protocol-valid callback for the real plugin
     * under test. This helper is never used as the verification implementation.
     */
    function security_epay_callback(
        string $key,
        array $overrides = [],
        array $omit = []
    ): array {
        $params = array_replace([
            'pid' => '1001',
            'trade_no' => 'EPAY-CALLBACK-0001',
            'out_trade_no' => 'ORDER-0001',
            'trade_status' => 'TRADE_SUCCESS',
            'type' => 'alipay',
            'name' => 'Monthly plan',
            'money' => '12.34',
            'param' => 'opaque-order-token',
        ], $overrides);

        foreach ($omit as $field) {
            unset($params[$field]);
        }

        if (!in_array('sign', $omit, true)) {
            $params['sign'] = security_epay_sign($params, $key);
        }
        $params['sign_type'] = 'MD5';

        return $params;
    }

    function security_mgate_callback(array $params, string $secret = ''): array
    {
        ksort($params);
        $params['sign'] = md5(http_build_query($params) . $secret);

        return $params;
    }

    function security_notify_controller(string $method, string $uuid, array $params): mixed
    {
        $controller = new \App\Http\Controllers\V1\Guest\PaymentController();

        return $controller->notify($method, $uuid, new Request($params));
    }

    function security_assert_epay_rejected(
        EpayPlugin $plugin,
        array $params,
        string $message
    ): void {
        $result = security_without_warnings(
            static fn () => $plugin->notify($params),
            $message
        );
        security_same(false, $result, $message);
    }

    function security_assert_mgate_rejected(
        \Plugin\Mgate\Plugin $plugin,
        array $params,
        string $message
    ): void {
        $result = security_without_warnings(
            static fn () => $plugin->notify($params),
            $message
        );
        security_same(false, $result, $message);
    }

    function security_run_plugin_manager_probe(): void
    {
        $probe = __DIR__ . '/payment-callback-plugin-manager-probe.php';
        security_true(is_file($probe), 'PluginManager regression probe is missing');

        $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($probe);
        $output = [];
        $status = 0;
        exec($command, $output, $status);
        $rendered = implode("\n", $output);

        security_same(0, $status, "PluginManager regression probe failed: {$rendered}");
        security_true(
            str_starts_with($rendered, 'CORE:'),
            "PluginManager must load plugins-core before a Composer-autoloaded user copy: {$rendered}"
        );
    }

    security_test('EPay payment UUID cannot be dispatched through MGate', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment();
        $order = security_seed_order();
        $params = security_mgate_callback([
            'out_trade_no' => 'ORDER-0001',
            'trade_no' => 'MGATE-CALLBACK-0001',
        ]);

        security_notify_controller('MGate', 'epay-uuid', $params);

        security_same([], OrderService::$paidCallbacks, 'Cross-channel EPay UUID must not enter OrderService::paid');
        security_same(Order::STATUS_PENDING, $order->status, 'Cross-channel EPay UUID must leave the order pending');
    });

    security_test('Admin payment form preview may switch method for an existing channel', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment();

        $service = new PaymentService('MGate', 77);
        $form = $service->form();

        security_true(isset($form['mgate_url']), 'Previewing MGate for an EPay channel must return the MGate form');
        security_true(isset($form['mgate_app_id']), 'Preview must use the selected plugin rather than reject in the constructor');
    });

    security_test('Unknown payment methods fail explicitly', function (): void {
        security_install_payment_plugins();
        \App\Models\Payment::seed(99, 'unknown-uuid', 'Unknown', []);

        try {
            new PaymentService('Unknown', null, 'unknown-uuid');
        } catch (\App\Exceptions\ApiException) {
            return;
        }

        security_fail('An unknown payment method must throw ApiException');
    });

    security_test('EPay rejects callbacks when the merchant key is missing', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001']);
        $callback = security_epay_callback('', [
            'trade_no' => 'EPAY-CALLBACK-NO-KEY',
            'out_trade_no' => 'ORDER-NO-KEY',
        ]);

        security_assert_epay_rejected(
            $epay,
            $callback,
            'A mathematically matching callback with a missing key must be rejected'
        );
    });

    security_test('EPay rejects callbacks when the merchant key is empty', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001', 'key' => '']);
        $callback = security_epay_callback('', [
            'trade_no' => 'EPAY-CALLBACK-EMPTY-KEY',
            'out_trade_no' => 'ORDER-EMPTY-KEY',
        ]);

        security_assert_epay_rejected(
            $epay,
            $callback,
            'A mathematically matching callback with an empty key must be rejected'
        );
    });

    security_test('MGate rejects callbacks when the app secret is missing', function (): void {
        [, $mgate] = security_install_payment_plugins();
        $mgate->setConfig([]);
        $callback = security_mgate_callback([
            'out_trade_no' => 'ORDER-NO-MGATE-SECRET',
            'trade_no' => 'MGATE-CALLBACK-NO-SECRET',
        ]);

        security_assert_mgate_rejected(
            $mgate,
            $callback,
            'A mathematically matching MGate callback with a missing secret must be rejected'
        );
    });

    security_test('MGate rejects callbacks when the app secret is empty', function (): void {
        [, $mgate] = security_install_payment_plugins();
        $mgate->setConfig(['mgate_app_secret' => '']);
        $callback = security_mgate_callback([
            'out_trade_no' => 'ORDER-EMPTY-MGATE-SECRET',
            'trade_no' => 'MGATE-CALLBACK-EMPTY-SECRET',
        ]);

        security_assert_mgate_rejected(
            $mgate,
            $callback,
            'A mathematically matching MGate callback with an empty secret must be rejected'
        );
    });

    security_test('MGate accepts a valid signed callback with a configured secret', function (): void {
        [, $mgate] = security_install_payment_plugins();
        $mgate->setConfig(['mgate_app_secret' => 'mgate-secret']);
        $callback = security_mgate_callback([
            'out_trade_no' => 'ORDER-MGATE-VALID',
            'trade_no' => 'MGATE-CALLBACK-VALID',
        ], 'mgate-secret');

        $verified = $mgate->notify($callback);

        security_true(is_array($verified), 'A valid signed MGate callback must verify');
        security_same('ORDER-MGATE-VALID', $verified['trade_no'] ?? null, 'Verified MGate trade_no must be preserved');
        security_same('MGATE-CALLBACK-VALID', $verified['callback_no'] ?? null, 'MGate callback_no must be preserved');
    });

    security_test('EPay accepts a real signed success callback and returns integer cents', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001', 'key' => 'merchant-secret']);
        $callback = security_epay_callback('merchant-secret', [
            'trade_no' => 'EPAY-CALLBACK-VALID',
            'out_trade_no' => 'ORDER-VALID',
            'money' => '12.34',
        ]);

        $verified = $epay->notify($callback);

        security_true(is_array($verified), 'A valid signed EPay callback must verify');
        security_same('ORDER-VALID', $verified['trade_no'] ?? null, 'Verified EPay trade_no must be preserved');
        security_same('EPAY-CALLBACK-VALID', $verified['callback_no'] ?? null, 'EPay callback_no must be preserved');
        security_same(1234, $verified['total_amount'] ?? null, 'EPay money 12.34 must map to integer cents 1234');
        security_true(is_int($verified['total_amount'] ?? null), 'Verified EPay total_amount must be an integer');
    });

    security_test('EPay parses integer and decimal money strings into exact cents', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001', 'key' => 'merchant-secret']);

        foreach (['10' => 1000, '10.01' => 1001, '0.10' => 10] as $money => $expectedCents) {
            $callback = security_epay_callback('merchant-secret', ['money' => (string) $money]);
            $verified = $epay->notify($callback);

            security_true(is_array($verified), "EPay money string {$money} must verify");
            security_same(
                $expectedCents,
                $verified['total_amount'] ?? null,
                "EPay money string {$money} must map to exact integer cents"
            );
        }
    });

    security_test('Controller completes matching EPay order and preserves callback_no', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment();
        $order = security_seed_order();
        $callback = security_epay_callback('merchant-secret', [
            'trade_no' => 'EPAY-CALLBACK-ORDER',
            'out_trade_no' => 'ORDER-0001',
            'money' => '12.34',
        ]);

        $result = security_notify_controller('EPay', 'epay-uuid', $callback);

        security_same('success', $result, 'A matching, amount-correct EPay callback must be acknowledged');
        security_same(['EPAY-CALLBACK-ORDER'], OrderService::$paidCallbacks, 'OrderService::paid must receive the gateway callback number');
        security_same(Order::STATUS_COMPLETED, $order->status, 'A matching EPay callback must complete the order');
    });

    security_test('Controller rejects a matching callback for an order with NULL payment_id', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment();
        $order = security_seed_order('ORDER-NULL-PAYMENT', null);
        $callback = security_epay_callback('merchant-secret', [
            'trade_no' => 'EPAY-CALLBACK-NULL-PAYMENT',
            'out_trade_no' => 'ORDER-NULL-PAYMENT',
        ]);

        security_notify_controller('EPay', 'epay-uuid', $callback);

        security_same([], OrderService::$paidCallbacks, 'An order with NULL payment_id must not enter OrderService::paid');
        security_same(Order::STATUS_PENDING, $order->status, 'An order with NULL payment_id must remain pending');
    });

    security_test('Controller rejects a matching callback for a different payment_id', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment();
        $order = security_seed_order('ORDER-WRONG-PAYMENT', 78);
        $callback = security_epay_callback('merchant-secret', [
            'trade_no' => 'EPAY-CALLBACK-WRONG-PAYMENT',
            'out_trade_no' => 'ORDER-WRONG-PAYMENT',
        ]);

        security_notify_controller('EPay', 'epay-uuid', $callback);

        security_same([], OrderService::$paidCallbacks, 'An order for another payment channel must not enter OrderService::paid');
        security_same(Order::STATUS_PENDING, $order->status, 'An order for another payment channel must remain pending');
    });

    security_test('Controller rejects EPay callback amount that differs from order total', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment();
        $order = security_seed_order('ORDER-BASE-AMOUNT', 77, 1000, 0);
        $callback = security_epay_callback('merchant-secret', [
            'trade_no' => 'EPAY-CALLBACK-BASE-AMOUNT',
            'out_trade_no' => 'ORDER-BASE-AMOUNT',
            'money' => '9.99',
        ]);

        security_notify_controller('EPay', 'epay-uuid', $callback);

        security_same([], OrderService::$paidCallbacks, 'A callback below the order total must not enter OrderService::paid');
        security_same(Order::STATUS_PENDING, $order->status, 'A callback below the order total must leave the order pending');
    });

    security_test('Controller rejects EPay callback that omits the handling fee', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment();
        $order = security_seed_order('ORDER-HANDLING', 77, 1000, 234);
        $callback = security_epay_callback('merchant-secret', [
            'trade_no' => 'EPAY-CALLBACK-HANDLING',
            'out_trade_no' => 'ORDER-HANDLING',
            'money' => '10.00',
        ]);

        security_notify_controller('EPay', 'epay-uuid', $callback);

        security_same([], OrderService::$paidCallbacks, 'A callback omitting the handling fee must not enter OrderService::paid');
        security_same(Order::STATUS_PENDING, $order->status, 'A callback omitting the handling fee must leave the order pending');
    });

    security_test('EPay rejects unsuccessful trade status', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001', 'key' => 'merchant-secret']);
        $callback = security_epay_callback('merchant-secret', [
            'trade_status' => 'WAIT_BUYER_PAY',
        ]);

        security_assert_epay_rejected($epay, $callback, 'A non-success EPay trade status must be rejected');
    });

    security_test('EPay rejects mismatched merchant PID', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001', 'key' => 'merchant-secret']);
        $callback = security_epay_callback('merchant-secret', [
            'pid' => '9999',
        ]);

        security_assert_epay_rejected($epay, $callback, 'An EPay callback for another merchant PID must be rejected');
    });

    security_test('EPay rejects malformed callback amounts', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001', 'key' => 'merchant-secret']);

        foreach (['12.345', 'not-money', '-1.00'] as $money) {
            $callback = security_epay_callback('merchant-secret', ['money' => $money]);
            security_assert_epay_rejected(
                $epay,
                $callback,
                "Malformed EPay amount {$money} must be rejected"
            );
        }
    });

    security_test('EPay rejects missing required fields without PHP warnings', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001', 'key' => 'merchant-secret']);

        foreach (['sign', 'pid', 'trade_no', 'out_trade_no', 'trade_status', 'money'] as $field) {
            $callback = security_epay_callback('merchant-secret', [], [$field]);
            security_assert_epay_rejected(
                $epay,
                $callback,
                "Missing EPay field {$field} must be rejected without warnings"
            );
        }
    });

    security_test('EPay rejects array callback fields without PHP warnings', function (): void {
        [$epay] = security_install_payment_plugins();
        $epay->setConfig(['pid' => '1001', 'key' => 'merchant-secret']);

        foreach (['pid', 'trade_no', 'out_trade_no', 'trade_status', 'money'] as $field) {
            $callback = security_epay_callback('merchant-secret', [$field => ['attacker']]);
            security_assert_epay_rejected(
                $epay,
                $callback,
                "Array-valued EPay field {$field} must be rejected without warnings"
            );
        }

        $callback = security_epay_callback('merchant-secret');
        $callback['sign'] = ['attacker'];
        security_assert_epay_rejected(
            $epay,
            $callback,
            'Array-valued EPay sign must be rejected without warnings'
        );
    });

    security_test('MGate rejects missing required fields without PHP warnings', function (): void {
        [, $mgate] = security_install_payment_plugins();
        $mgate->setConfig(['mgate_app_secret' => 'mgate-secret']);
        $base = ['out_trade_no' => 'ORDER-MGATE-FIELDS', 'trade_no' => 'MGATE-CALLBACK-FIELDS'];

        foreach (['sign', 'out_trade_no', 'trade_no'] as $field) {
            $callback = $base;
            unset($callback[$field]);
            if ($field !== 'sign') {
                $callback = security_mgate_callback($callback, 'mgate-secret');
            }
            security_assert_mgate_rejected(
                $mgate,
                $callback,
                "Missing MGate field {$field} must be rejected without warnings"
            );
        }
    });

    security_test('MGate rejects array callback fields without PHP warnings', function (): void {
        [, $mgate] = security_install_payment_plugins();
        $mgate->setConfig(['mgate_app_secret' => 'mgate-secret']);

        foreach (['out_trade_no', 'trade_no'] as $field) {
            $callback = security_mgate_callback([
                'out_trade_no' => 'ORDER-MGATE-ARRAY',
                'trade_no' => 'MGATE-CALLBACK-ARRAY',
                $field => ['attacker'],
            ], 'mgate-secret');
            security_assert_mgate_rejected(
                $mgate,
                $callback,
                "Array-valued MGate field {$field} must be rejected without warnings"
            );
        }

        $callback = security_mgate_callback([
            'out_trade_no' => 'ORDER-MGATE-ARRAY-SIGN',
            'trade_no' => 'MGATE-CALLBACK-ARRAY-SIGN',
        ], 'mgate-secret');
        $callback['sign'] = ['attacker'];
        security_assert_mgate_rejected(
            $mgate,
            $callback,
            'Array-valued MGate sign must be rejected without warnings'
        );
    });

    security_test('Repeated matching EPay notification is idempotent', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment();
        $order = security_seed_order('ORDER-IDEMPOTENT');
        $callback = security_epay_callback('merchant-secret', [
            'trade_no' => 'EPAY-CALLBACK-IDEMPOTENT',
            'out_trade_no' => 'ORDER-IDEMPOTENT',
            'money' => '12.34',
        ]);

        $first = security_notify_controller('EPay', 'epay-uuid', $callback);
        $second = security_notify_controller('EPay', 'epay-uuid', $callback);

        security_same('success', $first, 'The first matching EPay notification must be acknowledged');
        security_same('success', $second, 'A repeated matching EPay notification must be acknowledged');
        security_same(['EPAY-CALLBACK-IDEMPOTENT'], OrderService::$paidCallbacks, 'A repeated callback must call OrderService::paid only once');
        security_same(Order::STATUS_COMPLETED, $order->status, 'A repeated callback must leave the order completed');
    });

    security_test('PaymentService clones plugins so channel config does not leak', function (): void {
        security_install_payment_plugins();
        security_seed_epay_payment('epay-a', 77, 'key-a');
        security_seed_epay_payment('epay-b', 88, 'key-b');

        $serviceA = new PaymentService('EPay', null, 'epay-a');
        $serviceB = new PaymentService('EPay', null, 'epay-b');
        $callbackA = security_epay_callback('key-a', [
            'trade_no' => 'EPAY-CALLBACK-A',
            'out_trade_no' => 'ORDER-A',
        ]);

        $verifiedA = $serviceA->notify($callbackA);
        security_true(is_array($verifiedA), 'Creating a second channel must not replace the first channel key');
        security_same('ORDER-A', $verifiedA['trade_no'] ?? null, 'Channel A must verify with channel A config');

        $callbackB = security_epay_callback('key-b', [
            'trade_no' => 'EPAY-CALLBACK-B',
            'out_trade_no' => 'ORDER-B',
        ]);
        $verifiedB = $serviceB->notify($callbackB);
        security_true(is_array($verifiedB), 'Channel B must verify with channel B config');
        security_same('ORDER-B', $verifiedB['trade_no'] ?? null, 'Channel B must verify with channel B config');
    });

    security_test('PluginManager prefers plugins-core over a Composer-autoloaded user copy', function (): void {
        security_run_plugin_manager_probe();
    });

    $total = count($GLOBALS['security_tests']);
    $failures = 0;

    echo "TAP version 13\n";
    echo "1..{$total}\n";

    foreach ($GLOBALS['security_tests'] as $index => $test) {
        security_reset_harness();
        $number = $index + 1;

        try {
            ($test['run'])();
            echo "ok {$number} - {$test['name']}\n";
        } catch (\Throwable $error) {
            $failures++;
            echo "not ok {$number} - {$test['name']}\n";
            echo '  ' . str_replace("\n", "\n  ", $error::class . ': ' . $error->getMessage()) . "\n";
            echo "  at {$error->getFile()}:{$error->getLine()}\n";
        }
    }

    if ($failures > 0) {
        fwrite(STDERR, "payment callback security tests: FAILED ({$failures}/{$total})\n");
        exit(1);
    }

    echo "payment callback security tests: PASS ({$total}/{$total})\n";
}
