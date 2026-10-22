# Swoole runtime stage adapted from swoole/docker-swoole commit
# 71a1f212a161672d719f8e9d753618339261152d.
# Licensed under Apache-2.0; see .docker/licenses/docker-swoole-LICENSE.
FROM scratch AS sources
ADD --checksum=sha256:5d1d57adf16494f6cbb0211665d8fb7c7e4726c0b81d35e200812df326051e8e https://github.com/swoole/swoole-src/archive/refs/tags/v6.3.0-rc1.tar.gz /swoole-src.tar.gz
ADD --checksum=sha256:8bf25d465abc7973d9e2c9a3039a5f8eea635b23bc1477017ff3999ff95836da https://pecl.php.net/get/igbinary-3.2.16.tgz /igbinary.tgz
ADD --checksum=sha256:0d5141f634bd1db6c1ddcda053d25ecf2c4fc1c395430d534fd3f8d51dd7f0b5 https://pecl.php.net/get/redis-6.3.0.tgz /redis.tgz

FROM php:8.2.35-cli-alpine3.23@sha256:bf07fddaf901c9c336bd557f7a797f8b2945f9021f540aca3551010be50028a0

COPY --from=composer:2.10.3@sha256:da624c2c705d54e2f5a9bb77a5dc6c7d091711433ebefd7035672e84c2010fee /usr/bin/composer /usr/bin/

RUN --mount=type=bind,from=sources,target=/tmp/sources \
    set -ex && \
# Keep only the runtime shared libraries in the final image; the matching "-dev" packages (headers) are
# installed as part of the temporary ".build-deps" virtual package and removed once Swoole is built.
# Package "libucontext" provides the ucontext functions (getcontext/makecontext/swapcontext) that musl does not
# implement. Swoole ships hand-written context-switching assembly for some CPUs only (x86_64, arm64, riscv64,
# mips64, loongarch64); on every other architecture its coroutine scheduler falls back to ucontext, and without
# this package the extension fails to load with "Error relocating swoole.so: getcontext: symbol not found".
# That is what happened to the ppc64le and s390x Alpine images. It is installed unconditionally (the package is
# built for all Alpine architectures) so the images keep working on any architecture Swoole has no assembly for.
    apk add --no-cache c-ares libstdc++ libpq libssh2 libucontext unixodbc && \
    apk add --no-cache --virtual .build-deps $PHPIZE_DEPS curl-dev linux-headers brotli-dev c-ares-dev libpq-dev openssl-dev sqlite-dev zlib-dev zstd-dev libssh2-dev libucontext-dev unixodbc-dev && \
# PHP extension pdo_mysql is included since 4.8.12+ and 5.0.1+.
    docker-php-ext-install pdo_mysql && \
    MAKEFLAGS="-j$(nproc)" pecl install /tmp/sources/igbinary.tgz && \
    MAKEFLAGS="-j$(nproc)" pecl install --configureoptions 'enable-redis-igbinary="yes" enable-redis-lzf="yes" enable-redis-zstd="yes" enable-redis-msgpack="no" enable-redis-lz4="no" with-liblz4="yes"' /tmp/sources/redis.tgz && \
# PHP extension Redis is included since 4.8.12+ and 5.0.1+.
    docker-php-ext-enable igbinary && \
    docker-php-ext-enable redis && \
    docker-php-ext-install sockets && \
    docker-php-source extract && \
    mkdir /usr/src/php/ext/swoole && \
    tar xzf /tmp/sources/swoole-src.tar.gz --strip-components=1 -C /usr/src/php/ext/swoole && \
    export LDFLAGS="${LDFLAGS} -lucontext" && \
    docker-php-ext-configure swoole \
        --enable-brotli \
        --enable-cares \
        --enable-mysqlnd \
        --enable-sockets \
        --enable-swoole-curl \
        --enable-swoole-ftp \
        --enable-swoole-pgsql \
        --enable-swoole-sqlite \
        --enable-zstd \
        --with-swoole-odbc=unixODBC,/usr \
        --with-swoole-ssh2 && \
    docker-php-ext-install -j$(nproc) swoole && \
    docker-php-source delete && \
# Strip debugging symbols from the PECL extensions (extension Swoole is stripped by docker-php-ext-install already), and
# install the packages providing the shared libraries that the PHP extensions link against, so that removing the
# build-only packages can't take any of them along. This is how the official PHP images do it.
    strip --strip-all "$(php-config --extension-dir)"/*.so && \
    runDeps="$( \
        scanelf --needed --nobanner --format '%n#p' --recursive "$(php-config --extension-dir)" \
            | tr ',' '\n' \
            | sort -u \
            | awk 'system("[ -e /usr/local/lib/" $1 " ]") == 0 { next } { print "so:" $1 }' \
    )" && \
    apk add --no-cache --virtual .swoole-rundeps $runDeps && \
    apk del .build-deps && \
    rm -rf /tmp/pear && \
# Fail the build if the extension does not actually load. Swoole is compiled here for every target platform, and
# a library that is missing at runtime (rather than at link time) produces a successful build but an image
# whose Swoole extension cannot be loaded at all. PHP only warns about that and still exits 0, so it has to
# be asserted explicitly; the published ppc64le and s390x Alpine images shipped broken this way. The PECL extensions
# are checked too, since removing the build-only packages could take a runtime library of theirs along.
    php -r 'exit(extension_loaded("swoole") && extension_loaded("igbinary") && extension_loaded("redis") ? 0 : 1);'

COPY --from=mlocati/php-extension-installer:2.12.3@sha256:ac4b252c153a9f6de5578ff2c417790aba836bb49855543144606033eceda253 /usr/bin/install-php-extensions /usr/local/bin/

# Install PHP extensions one by one with lower optimization level for ARM64 compatibility.
RUN CFLAGS="-O0" install-php-extensions pcntl && \
    CFLAGS="-O0 -g0" install-php-extensions bcmath && \
    IPE_PROCESSOR_COUNT=2 install-php-extensions zip && \
    apk --no-cache add shadow sqlite mysql-client mysql-dev mariadb-connector-c git patch supervisor redis=8.4.2-r0 caddy=2.11.4-r0 && \
    addgroup -S -g 1000 www && adduser -S -G www -u 1000 www && \
    (getent group redis || addgroup -S redis) && \
    (getent passwd redis || adduser -S -G redis -H -h /data redis) && \
# Assert the supported PHP branch, compiled extension versions, required extensions, and service binaries.
    php -r 'if (PHP_VERSION_ID < 80235 || PHP_VERSION_ID >= 80300) { fwrite(STDERR, "Unexpected PHP ".PHP_VERSION."\n"); exit(1); } $versions = ["swoole" => "6.3.0RC1", "igbinary" => "3.2.16", "redis" => "6.3.0"]; foreach ($versions as $extension => $version) { if (phpversion($extension) !== $version) { fwrite(STDERR, "Unexpected $extension ".phpversion($extension)."\n"); exit(1); } } $required = ["swoole", "pcntl", "posix", "bcmath", "pdo_mysql", "pdo_sqlite", "sockets", "zip", "igbinary", "redis", "sodium", "curl", "mbstring", "openssl"]; foreach ($required as $extension) { if (!extension_loaded($extension)) { fwrite(STDERR, "Missing PHP extension: $extension\n"); exit(1); } }' && \
    redis-server --version | grep -Eq '(^| )v=8\.4\.2( |$)' && \
    caddy version | grep -Eq '^v2\.11\.4( |$)'

WORKDIR /www

COPY .docker /
# Build from the checked-out fork. Do not fetch application code at build time:
# this keeps the image rebuildable even if the former upstream disappears.
COPY . /www

COPY .docker/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY .docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY .docker/php/zz-xboard.ini /usr/local/etc/php/conf.d/zz-xboard.ini

RUN composer install --no-cache --no-dev --no-security-blocking \
    && php artisan storage:link \
    && chown -R www:www /www \
    && chmod -R 775 /www \
    && mkdir -p /data \
    && chown redis:redis /data

ENV ENABLE_WEB=true \
    ENABLE_HORIZON=true \
    ENABLE_REDIS=true \
    ENABLE_WS_SERVER=true \
    ENABLE_CADDY=true

EXPOSE 7001
COPY .docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
