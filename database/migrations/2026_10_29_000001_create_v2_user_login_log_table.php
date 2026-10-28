<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('v2_user_login_log')) {
            return;
        }

        Schema::create('v2_user_login_log', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('type', 32)->comment('login / register / mail_link (邮件或快速登录链接)');
            $table->boolean('success')->default(true)->comment('false = wrong password attempt');
            $table->string('ip', 64)->nullable();
            $table->unsignedTinyInteger('geo_status')->default(0)->comment('0 pending, 1 resolved, 2 private/reserved, 3 lookup failed');
            $table->string('country', 64)->nullable();
            $table->string('country_code', 8)->nullable();
            $table->string('region', 128)->nullable();
            $table->string('city', 128)->nullable();
            $table->string('isp', 191)->nullable();
            $table->unsignedInteger('asn')->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('device_type', 16)->nullable()->comment('desktop / mobile / tablet / bot / unknown');
            $table->string('os', 64)->nullable();
            $table->string('browser', 64)->nullable();
            $table->string('device_model', 64)->nullable();
            $table->string('origin', 191)->nullable()->comment('Origin / Referer host the request came from');
            $table->unsignedBigInteger('token_id')->nullable()->comment('Sanctum personal_access_tokens.id issued by this login');
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');

            $table->index(['user_id', 'created_at']);
            $table->index('ip');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_user_login_log');
    }
};
