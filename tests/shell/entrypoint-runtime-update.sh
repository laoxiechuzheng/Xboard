#!/bin/sh
set -eu

if [ "${XBOARD_ENTRYPOINT_TEST_DISPOSABLE:-}" != 1 ] || [ ! -e /.dockerenv ]; then
    echo "ERROR: run this destructive fixture test only in a disposable Docker container" >&2
    echo "Set XBOARD_ENTRYPOINT_TEST_DISPOSABLE=1 to acknowledge." >&2
    exit 2
fi

# Run only inside a disposable Linux container. The entrypoint hard-codes /www.
ENTRYPOINT=${1:-/entrypoint.sh}
TEST_ROOT=/tmp/xboard-entrypoint-runtime-update.$$
MOCK_BIN=$TEST_ROOT/bin
PHP_LOG=$TEST_ROOT/php.log
SERVICE_LOG=$TEST_ROOT/service.log
OUTPUT_LOG=$TEST_ROOT/output.log

cleanup() {
    rm -rf "$TEST_ROOT"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$MOCK_BIN"

cat > "$MOCK_BIN/php" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "$PHP_LOG"
EOF

cat > "$MOCK_BIN/chown" <<'EOF'
#!/bin/sh
exit 0
EOF

cat > "$MOCK_BIN/start-service" <<'EOF'
#!/bin/sh
printf 'started\n' >> "$SERVICE_LOG"
EOF

chmod +x "$MOCK_BIN/php" "$MOCK_BIN/chown" "$MOCK_BIN/start-service"

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    [ -f "$OUTPUT_LOG" ] && sed 's/^/  /' "$OUTPUT_LOG" >&2
    exit 1
}

assert_update_ran() {
    grep -Fxq '/www/artisan xboard:update --no-interaction' "$PHP_LOG" ||
        fail "expected xboard:update to run"
}

assert_update_skipped() {
    if grep -q 'xboard:update' "$PHP_LOG"; then
        fail "xboard:update unexpectedly ran"
    fi
}

assert_service_started() {
    grep -qx 'started' "$SERVICE_LOG" ||
        fail "expected the service command to start"
}

assert_service_not_started() {
    [ ! -s "$SERVICE_LOG" ] || fail "service command started after a startup error"
}

reset_fixture() {
    rm -rf /www
    mkdir -p /www/storage/logs /www/storage/theme /www/public/theme
    printf 'INSTALLED=true\n' > /www/.env
    : > "$PHP_LOG"
    : > "$SERVICE_LOG"
    : > "$OUTPUT_LOG"
}

make_theme() {
    theme_dir=/www/storage/theme/$1
    mkdir -p "$theme_dir/assets"
    printf '{"name":"%s"}\n' "$1" > "$theme_dir/config.json"
    printf 'dashboard %s\n' "$1" > "$theme_dir/dashboard.blade.php"
    printf 'asset %s\n' "$1" > "$theme_dir/assets/app.js"
}

run_entrypoint() {
    set -- \
        PATH="$MOCK_BIN:$PATH" \
        PHP_LOG="$PHP_LOG" \
        SERVICE_LOG="$SERVICE_LOG" \
        ENABLE_CADDY=false \
        ENABLE_WEB=false \
        ENABLE_HORIZON=false \
        ENABLE_WS_SERVER=false \
        RESOURCE_PROFILE=minimal

    if [ "${SKIP_APP_UPDATE+x}" = x ]; then
        set -- "$@" "SKIP_APP_UPDATE=$SKIP_APP_UPDATE"
    fi
    if [ "${PUBLISH_USER_THEMES+x}" = x ]; then
        set -- "$@" "PUBLISH_USER_THEMES=$PUBLISH_USER_THEMES"
    fi

    env -i "$@" "$ENTRYPOINT" start-service > "$OUTPUT_LOG" 2>&1
}

run_ok() {
    run_entrypoint || fail "entrypoint exited unexpectedly"
}

run_fail() {
    if run_entrypoint; then
        fail "entrypoint unexpectedly succeeded"
    fi
}

[ -x "$ENTRYPOINT" ] || fail "entrypoint is not executable: $ENTRYPOINT"

for value in true 1; do
    reset_fixture
    SKIP_APP_UPDATE=$value
    unset PUBLISH_USER_THEMES
    run_ok
    assert_update_skipped
    assert_service_started
    grep -q 'Skipping xboard:update (SKIP_APP_UPDATE enabled)' "$OUTPUT_LOG" ||
        fail "expected a clear SKIP_APP_UPDATE message for '$value'"
done

for value in unset '' false 0; do
    reset_fixture
    if [ "$value" = unset ]; then
        unset SKIP_APP_UPDATE
    else
        SKIP_APP_UPDATE=$value
    fi
    unset PUBLISH_USER_THEMES
    run_ok
    assert_update_ran
    assert_service_started
done

for value in yes TRUE tru; do
    reset_fixture
    SKIP_APP_UPDATE=$value
    unset PUBLISH_USER_THEMES
    run_fail
    assert_update_skipped
    assert_service_not_started
done

reset_fixture
make_theme LiquidGlass
unset SKIP_APP_UPDATE PUBLISH_USER_THEMES
run_ok
[ ! -e /www/public/theme/LiquidGlass ] || fail "theme was published without being requested"
assert_service_started

reset_fixture
make_theme LiquidGlass
make_theme Other
SKIP_APP_UPDATE=true
PUBLISH_USER_THEMES=LiquidGlass
run_ok
cmp /www/storage/theme/LiquidGlass/config.json /www/public/theme/LiquidGlass/config.json ||
    fail "theme config.json was not copied"
cmp /www/storage/theme/LiquidGlass/dashboard.blade.php /www/public/theme/LiquidGlass/dashboard.blade.php ||
    fail "theme dashboard.blade.php was not copied"
cmp /www/storage/theme/LiquidGlass/assets/app.js /www/public/theme/LiquidGlass/assets/app.js ||
    fail "theme nested asset was not copied"
[ -f /www/storage/theme/LiquidGlass/config.json ] || fail "persisted theme was removed"
[ ! -e /www/public/theme/Other ] || fail "unrequested theme was published"
assert_service_started

for value in . .. ../LiquidGlass 'Liquid*' 'Liquid/Glass' 'Liquid?Glass'; do
    reset_fixture
    make_theme LiquidGlass
    SKIP_APP_UPDATE=true
    PUBLISH_USER_THEMES=$value
    run_fail
    assert_service_not_started
done

reset_fixture
SKIP_APP_UPDATE=true
PUBLISH_USER_THEMES=MissingTheme
run_fail
assert_service_not_started

for required_file in config.json dashboard.blade.php; do
    reset_fixture
    make_theme BrokenTheme
    rm "/www/storage/theme/BrokenTheme/$required_file"
    SKIP_APP_UPDATE=true
    PUBLISH_USER_THEMES=BrokenTheme
    run_fail
    assert_service_not_started
done

reset_fixture
mkdir -p "$TEST_ROOT/external-theme"
printf '{}\n' > "$TEST_ROOT/external-theme/config.json"
printf 'external\n' > "$TEST_ROOT/external-theme/dashboard.blade.php"
ln -s "$TEST_ROOT/external-theme" /www/storage/theme/LinkedTheme
SKIP_APP_UPDATE=true
PUBLISH_USER_THEMES=LinkedTheme
run_fail
assert_service_not_started

reset_fixture
make_theme LiquidGlass
mkdir -p "$TEST_ROOT/outside-target"
ln -s "$TEST_ROOT/outside-target" /www/public/theme/LiquidGlass
SKIP_APP_UPDATE=true
PUBLISH_USER_THEMES=LiquidGlass
run_fail
assert_service_not_started
[ ! -e "$TEST_ROOT/outside-target/config.json" ] || fail "target symlink was followed"

reset_fixture
make_theme LiquidGlass
printf 'not a directory\n' > /www/public/theme/LiquidGlass
SKIP_APP_UPDATE=true
PUBLISH_USER_THEMES=LiquidGlass
run_fail
assert_service_not_started

printf 'PASS: entrypoint runtime update controls\n'
