<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('v2_traffic_cycle')) {
            return;
        }

        Schema::create('v2_traffic_cycle', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('seq')->comment('该用户第几个周期，从 1 开始');
            $table->unsignedInteger('plan_id')->nullable();
            $table->string('kind', 16)->default('standard')->comment('standard / special');
            $table->unsignedBigInteger('quota')->default(0)->comment('本周期额度（字节）');
            $table->unsignedBigInteger('next_quota')->nullable()->comment('下一周期额度；null = 同 quota');
            $table->unsignedInteger('started_at');
            // derived from v2_user.expired_at (bigint): an admin may type a far-future expiry
            $table->unsignedBigInteger('ends_at')->nullable()->comment('计划结束；null = 不排期');
            $table->unsignedInteger('ended_at')->nullable()->comment('实际结束；null = 当前周期');
            $table->string('start_reason', 32);
            $table->string('end_reason', 32)->nullable();
            $table->unsignedInteger('order_id')->nullable();
            $table->unsignedBigInteger('u_end')->nullable();
            $table->unsignedBigInteger('d_end')->nullable();
            $table->unsignedBigInteger('expired_at_start')->nullable()->comment('周期开始时的订阅到期时间');
            $table->string('note', 255)->nullable()->comment('管理员备注（用户可见）');
            $table->json('events')->nullable();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');

            $table->index(['user_id', 'ended_at']);
            $table->unique(['user_id', 'seq']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_traffic_cycle');
    }
};
