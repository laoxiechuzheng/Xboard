<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService
{
    private User $user;
    private ?int $lastTokenId = null;

    public function __construct(User $user)
    {
        $this->user = $user;
    }

    public function generateAuthData(): array
    {
        // Create a new Sanctum token with device info
        $token = $this->user->createToken(
            Str::random(20), // token name (device identifier)
            ['*'], // abilities
            now()->addYear() // expiration
        );
        $this->lastTokenId = (int) $token->accessToken->getKey();

        // Format token: remove ID prefix and add Bearer
        $tokenParts = explode('|', $token->plainTextToken);
        $formattedToken = 'Bearer ' . ($tokenParts[1] ?? $tokenParts[0]);

        return [
            'token' => $this->user->token,
            'auth_data' => $formattedToken,
            'is_admin' => $this->user->is_admin,
        ];
    }

    /**
     * 最近一次 generateAuthData() 签发的 token id（用于登录记录标记“当前设备”）。
     */
    public function getLastTokenId(): ?int
    {
        return $this->lastTokenId;
    }

    public function getSessions(): array
    {
        return $this->user->tokens()->get()->toArray();
    }

    public function removeSession(string $sessionId): bool
    {
        $this->user->tokens()->where('id', $sessionId)->delete();
        return true;
    }

    public function removeAllSessions(): bool
    {
        $this->user->tokens()->delete();
        return true;
    }

    /**
     * Resolve a Bearer token the same way the sanctum guard would: expired tokens and banned users get null.
     * (Before, an expired token could still mint a quick-login URL and with it a fresh one-year token.)
     */
    public static function findUserByBearerToken(string $bearerToken): ?User
    {
        $token = str_replace('Bearer ', '', $bearerToken);

        $accessToken = PersonalAccessToken::findToken($token);
        if (!$accessToken) {
            return null;
        }

        if ($accessToken->expires_at && $accessToken->expires_at->isPast()) {
            return null;
        }
        $expiration = config('sanctum.expiration');
        if ($expiration && $accessToken->created_at && $accessToken->created_at->lte(now()->subMinutes($expiration))) {
            return null;
        }

        $tokenable = $accessToken->tokenable;
        if (!$tokenable instanceof User || $tokenable->banned) {
            return null;
        }

        return $tokenable;
    }

    /**
     * 解密认证数据
     *
     * @param string $authorization
     * @return array|null 用户数据或null
     */
    public static function decryptAuthData(string $authorization): ?array
    {
        $user = self::findUserByBearerToken($authorization);
        
        if (!$user) {
            return null;
        }
        
        return [
            'id' => $user->id,
            'email' => $user->email,
            'is_admin' => (bool)$user->is_admin,
            'is_staff' => (bool)$user->is_staff
        ];
    }
}
