<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('v2_order', 'expires_at')) {
            return;
        }

        Schema::table('v2_order', function (Blueprint $table) {
            $table->unsignedInteger('expires_at')->nullable()->after('paid_at')
                ->comment('待支付订单截止时间；null = created_at + 2 小时');
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('v2_order', 'expires_at')) {
            return;
        }

        Schema::table('v2_order', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });
    }
};
