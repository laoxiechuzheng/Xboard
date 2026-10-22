# PHP Runtime Security Update

Last verified source configuration: 2026-10-22. Deployment results must be recorded in each installation's own maintenance documents.

## Runtime Baseline

This build addresses CVE-2026-109618 and CVE-2026-109619 with PHP 8.2.35. It keeps the Alpine 3.23 branch and pins Swoole 6.3.0RC1, igbinary 3.2.16, phpredis 6.3.0, Redis 8.4.2, and Caddy 2.11.4. The Swoole build recipe comes from upstream commit `71a1f212a161672d719f8e9d753618339261152d`; its downloaded sources have checksum verification and its license is retained under `.docker/licenses/`.

The application is built from this fork's checked-out source and existing `composer.lock`. Do not replace a customized deployment with an upstream application image solely to update PHP. Do not build from an old deployment directory without first confirming that it matches the running image revision.

## Build and Release

The GitHub Actions workflow supports an optional `image_tag` input for a candidate release. It first loads and tests an amd64 image, checks Composer platform requirements, and runs the entrypoint behavior tests in disposable containers without a network. It then builds and publishes amd64 and arm64 images by default. A candidate branch may select `linux/amd64` for an architecture-specific deployment. Master rejects single-architecture builds, so `latest` and `new` retain both architectures.

Use an immutable published digest for deployment and record the old digest before changing anything. A container restart alone does not replace its image. `pull: true` in the build workflow refreshes the explicitly selected build inputs; the digest pins control which inputs may be used.

## Runtime-Only Startup

The default entrypoint behavior is unchanged: installed applications run `xboard:update`. That command can run database migrations, install default plugins, refresh themes, and terminate Horizon.

For a PHP-only update that deliberately preserves the application schema and plugin configuration:

```yaml
services:
  xboard:
    environment:
      SKIP_APP_UPDATE: "true"
      PUBLISH_USER_THEMES: "YourTheme"
```

`SKIP_APP_UPDATE` accepts `true`, `1`, `false`, `0`, or an empty value. An unrecognized value fails startup. When enabled, `xboard:update` is never invoked by the entrypoint.

`PUBLISH_USER_THEMES` is an optional space-separated list of persistent user theme directory names. Only named themes are copied from `/www/storage/theme/<name>` into `/www/public/theme/<name>`. Each source must contain `config.json` and `dashboard.blade.php`. Invalid names, missing sources, or directory symlinks fail startup before the services begin. The persistent source is retained.

Keep these settings explicit in deployment configuration. Before a later application upgrade that requires schema or plugin changes, review its migrations and deliberately restore the appropriate application-update process. Do not leave migrations disabled by accident and assume a newer application version is compatible with the old schema.

## Deployment and Rollback

1. Record the existing image, containers, mounted files, named volumes, and effective Compose configuration. Save configuration and consistent database/Redis backups in the installation's own backup directory.
2. Check PHP and extension versions, Redis snapshot compatibility, Swoole capabilities, and startup controls in a disposable candidate environment. Never run the destructive fixture test in a production container or with production mounts.
3. Preserve the original Compose project name, ports, bind mounts, and named volumes. Do not run `docker compose down -v` or prune images/volumes during the update.
4. Update one Web service at a time with its explicit candidate digest. Use `--no-deps` when independent queue workers are intentionally retained. Keep retained worker image references pinned so a later general Compose update cannot silently replace them.
5. If an independent Laravel queue worker shares the Web container's Redis service, pause new job consumption with `SIGUSR2`, wait for in-flight jobs to finish, and resume with `SIGCONT` after Redis and the Web service are ready. Confirm the installed Laravel version supports these signals. Always resume a paused worker on success or rollback.
6. Validate actual PHP/extension versions, HTTP entrypoints and assets, Redis/Horizon/WebSocket processes, queue connectivity, and persistent custom files. Compare migration metadata to the baseline for a runtime-only deployment.
7. On failure, restore the previous image and Compose configuration. Do not automatically restore older database or Redis snapshots over live business data. Investigate any unexpected schema change before continuing.

## Verification Boundaries

The entrypoint fixture test requires `XBOARD_ENTRYPOINT_TEST_DISPOSABLE=1` and a Docker container marker because it deliberately replaces `/www` inside its disposable container. The workflow copies the test outside `/www` before invoking it. It must never receive production mounts or credentials.

A queue worker with no business listener or published HTTP port does not have the same request entrypoint as an HTTP-serving PHP installation. Assess its actual execution path for these CVEs; absence of a listener is not a general claim that an old PHP version has no vulnerabilities.

The repository's existing application test harness is incomplete. The runtime workflow does not claim a full application test-suite pass. Each deployment still needs service and application checks appropriate to its plugins and integrations.

## References

- https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w
- https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp
- https://github.com/swoole/docker-swoole/blob/71a1f212a161672d719f8e9d753618339261152d/dockerfiles/6.3.0-rc1/php8.2/alpine/Dockerfile
