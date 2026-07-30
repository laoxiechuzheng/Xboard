<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="robots" content="noindex,nofollow">
    <title>{{ $title }} · 自主后台预览</title>
    <script>
        window.xboardAdmin = {
            title: @json($title),
            version: @json($version),
            logo: @json($logo),
            securePath: @json($secure_path)
        };
    </script>
    <link rel="stylesheet" href="/assets/console/app.css">
    <script type="module" src="/assets/console/app.js"></script>
</head>
<body>
    <noscript>此管理中心需要启用 JavaScript。</noscript>
    <div id="app"></div>
</body>
</html>
