<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 用户登录 / 注册记录
 *
 * @property int $id
 * @property int $user_id
 * @property string $type login|register|mail_link
 * @property bool $success
 * @property string|null $ip
 * @property int $geo_status
 * @property int|null $token_id
 * @property int $created_at
 */
class UserLoginLog extends Model
{
    public const TYPE_LOGIN = 'login';
    public const TYPE_REGISTER = 'register';
    public const TYPE_MAIL_LINK = 'mail_link';

    public const GEO_PENDING = 0;
    public const GEO_RESOLVED = 1;
    public const GEO_PRIVATE = 2;
    public const GEO_FAILED = 3;

    protected $table = 'v2_user_login_log';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = [
        'success' => 'boolean',
        'geo_status' => 'integer',
        'asn' => 'integer',
        'token_id' => 'integer',
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
