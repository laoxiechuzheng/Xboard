<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>{{ $title }} · 自主管理后台</title>
    <script>
        window.xboardAdmin = {
            title: @json($title),
            securePath: @json($secure_path)
        };
    </script>
    <link rel="stylesheet" href="/assets/admin-v2/app.css">
    <script type="module" src="/assets/admin-v2/app.js"></script>
</head>
<body>
    <noscript>此管理后台需要启用 JavaScript。</noscript>
    <div id="app"></div>
</body>
</html>
