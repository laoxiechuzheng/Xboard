<?php

return [
    /*
    | Proxies whose X-Forwarded-* headers are believed (App\Http\Middleware\TrustProxies).
    | Comma-separated addresses / CIDR ranges plus the keywords "private" (loopback, RFC 1918, link-local,
    | IPv6 ULA) and "cloudflare" (Cloudflare's published ranges), for example:
    |   TRUSTED_PROXIES=private,cloudflare,203.0.113.10,198.51.100.0/28
    | Unset or empty keeps the historical behaviour of trusting every IPv4 hop (0.0.0.0/0).
    */
    'proxies' => env('TRUSTED_PROXIES'),
];
