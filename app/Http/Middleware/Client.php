<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Utils\Helper;
use Closure;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class Client
{
    /**
     * Handle an incoming request.
     *
     * The subscription token comes from the query string or the route only, never from a request body:
     * a JSON body can carry arrays or numbers, and binding those into where('token', ...) matched other users.
     * Query before route keeps the previous precedence of input('token', route('token')).
     *
     * @param \Illuminate\Http\Request $request
     * @param \Closure $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        $token = $request->query('token', $request->route('token'));
        if ($token === null || $token === '') {
            throw new ApiException('token is null',403);
        }
        $token = Helper::validateSubscriptionToken($token);
        if ($token === null) {
            throw new ApiException('token is error',403);
        }
        $user = User::where('token', $token)->first();
        if (!$user) {
            throw new ApiException('token is error',403);
        }

        Auth::setUser($user);
        return $next($request);
    }
}
