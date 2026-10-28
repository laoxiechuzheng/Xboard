<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>{{ $title }}</title>
  <script>
    window.settings = {
      base_url: "/",
      title: @json($title),
      version: @json($version),
      logo: @json($logo),
      secure_path: @json($secure_path),
      legacy_admin_url: @json('/' . $secure_path),
    };
  </script>
  @php
    // Built by admin-next/ (vite build) into public/assets/admin-next; see docs/admin-next/README.md.
    $manifestPath = public_path('assets/admin-next/manifest.json');
    $manifest = file_exists($manifestPath) ? json_decode(file_get_contents($manifestPath), true) : null;
    $entry = is_array($manifest) ? ($manifest['index.html'] ?? null) : null;
    $styles = [];
    $preloads = [];

    if (is_array($entry)) {
      $visited = [];
      $collect = function ($name) use (&$collect, &$manifest, &$visited, &$styles, &$preloads) {
        if (isset($visited[$name]) || !isset($manifest[$name]) || !is_array($manifest[$name])) {
          return;
        }
        $visited[$name] = true;
        $chunk = $manifest[$name];
        foreach (($chunk['css'] ?? []) as $css) {
          $styles[$css] = $css;
        }
        foreach (($chunk['imports'] ?? []) as $import) {
          if (!empty($manifest[$import]['file'])) {
            $preloads[$manifest[$import]['file']] = $manifest[$import]['file'];
          }
          $collect($import);
        }
      };
      $collect('index.html');
    }
  @endphp
  @if($entry && !empty($entry['file']))
    @foreach($styles as $css)
      <link rel="stylesheet" href="/assets/admin-next/{{ $css }}" />
    @endforeach
    @foreach($preloads as $js)
      <link rel="modulepreload" href="/assets/admin-next/{{ $js }}" />
    @endforeach
    <script type="module" src="/assets/admin-next/{{ $entry['file'] }}"></script>
  @endif
</head>
<body>
  @if(!$entry || empty($entry['file']))
    <p style="font-family:sans-serif;padding:24px">新版后台资源未构建：请在 admin-next 目录执行 <code>pnpm build</code>。</p>
  @endif
  <noscript>此管理后台需要启用 JavaScript。</noscript>
  <div id="app"></div>
</body>
</html>
