<script setup lang="ts">
// User detail dialog built from the list row (spec §5). Money is already 元 in the row (official bug R-10 fixed).
import { computed } from 'vue'
import { NModal, NTag, NButton } from 'naive-ui'
import type { UserRow } from '@/api/user'
import { formatBytes, formatTime } from '@/utils/format'
import CopyText from '@/components/CopyText.vue'
import ExpireTag from './ExpireTag.vue'
import { commissionTypeLabel, formatAnyTime, formatIp, money, truthy } from './helpers'

const props = defineProps<{ show: boolean; user: UserRow | null }>()
const emit = defineEmits<{ 'update:show': [boolean]; 'filter-email': [string] }>()

const status = computed(() => {
  const u = props.user
  if (!u) return { label: '', type: 'default' as const }
  if (truthy(u.banned)) return { label: '已封禁', type: 'error' as const }
  if (truthy(u.is_admin)) return { label: '管理员', type: 'error' as const }
  if (truthy(u.is_staff)) return { label: '员工', type: 'info' as const }
  return { label: '正常', type: 'success' as const }
})

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v))

function openInviter() {
  const email = props.user?.invite_user?.email
  if (!email) return
  emit('filter-email', email)
  emit('update:show', false)
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="用户详情"
    :style="{ width: 'min(640px, calc(100vw - 24px))' }"
    :bordered="false"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template v-if="user">
      <div class="head">
        <span class="muted">用户ID：<span class="num strong">{{ user.id }}</span></span>
        <n-tag size="small" round :type="status.type" :bordered="false">{{ status.label }}</n-tag>
      </div>

      <section class="group">
        <h4>基本信息</h4>
        <div class="kv"><span class="k">邮箱</span><span class="v"><copy-text :text="user.email" /></span></div>
        <div v-if="user.phone_auth_enabled" class="kv"><span class="k">手机号</span><span class="v">{{ dash(user.phone) }}</span></div>
        <div class="kv"><span class="k">UUID</span><span class="v"><copy-text :text="user.uuid" mono /></span></div>
        <div class="kv"><span class="k">Token</span><span class="v"><copy-text :text="user.token" mono /></span></div>
        <div class="kv"><span class="k">备注</span><span class="v pre">{{ dash(user.remarks) }}</span></div>
        <div class="kv"><span class="k">Telegram ID</span><span class="v num">{{ dash(user.telegram_id) }}</span></div>
      </section>

      <section class="group">
        <h4>订阅信息</h4>
        <div class="kv"><span class="k">订阅套餐</span><span class="v">{{ dash(user.plan?.name) }}</span></div>
        <div class="kv"><span class="k">权限组</span><span class="v">{{ dash(user.group?.name) }}</span></div>
        <div class="kv">
          <span class="k">到期时间</span>
          <span class="v"><expire-tag :expired-at="user.expired_at" :next-reset-at="user.next_reset_at" /></span>
        </div>
        <div class="kv"><span class="k">设备限制</span><span class="v num">{{ user.device_limit ?? '不限' }}</span></div>
        <div class="kv"><span class="k">速度限制</span><span class="v num">{{ user.speed_limit ? `${user.speed_limit} Mbps` : '不限' }}</span></div>
      </section>

      <section class="group">
        <h4>流量信息</h4>
        <div class="kv"><span class="k">总流量</span><span class="v num">{{ user.transfer_enable ? formatBytes(user.transfer_enable) : '-' }}</span></div>
        <div class="kv"><span class="k">上传已用</span><span class="v num">{{ formatBytes(user.u) }}</span></div>
        <div class="kv"><span class="k">下载已用</span><span class="v num">{{ formatBytes(user.d) }}</span></div>
        <div class="kv"><span class="k">总已用</span><span class="v num primary">{{ formatBytes(user.total_used) }}</span></div>
        <div class="sep" />
        <div class="kv"><span class="k">上次重置</span><span class="v num">{{ formatTime(user.last_reset_at) }}</span></div>
        <div class="kv"><span class="k">下次重置</span><span class="v num">{{ formatTime(user.next_reset_at) }}</span></div>
        <div class="kv"><span class="k">重置次数</span><span class="v num">{{ user.reset_count || 0 }}</span></div>
      </section>

      <section class="group">
        <h4>财务信息</h4>
        <div class="kv"><span class="k">余额</span><span class="v num">{{ money(user.balance) }}</span></div>
        <div class="kv"><span class="k">佣金余额</span><span class="v num">{{ money(user.commission_balance) }}</span></div>
        <div class="kv"><span class="k">佣金类型</span><span class="v">{{ commissionTypeLabel(user.commission_type) }}</span></div>
        <div class="kv">
          <span class="k">佣金比例</span>
          <span class="v num">{{ user.commission_rate === null || user.commission_rate === undefined ? '跟随系统' : `${user.commission_rate}%` }}</span>
        </div>
        <div class="kv">
          <span class="k">专享折扣</span>
          <span class="v num">{{ user.discount === null || user.discount === undefined ? '无' : `${user.discount}%` }}</span>
        </div>
      </section>

      <section class="group">
        <h4>活动信息</h4>
        <div class="kv"><span class="k">最后登录</span><span class="v num">{{ formatTime(user.last_login_at) }}</span></div>
        <div class="kv"><span class="k">最后登录IP</span><span class="v num">{{ formatIp(user.last_login_ip) }}</span></div>
        <div class="kv"><span class="k">最后在线</span><span class="v num">{{ formatAnyTime(user.last_online_at) }}</span></div>
        <div class="kv"><span class="k">在线设备</span><span class="v num">{{ user.online_count || 0 }}</span></div>
      </section>

      <section v-if="user.invite_user" class="group">
        <h4>邀请信息</h4>
        <div class="kv">
          <span class="k">邀请人</span>
          <span class="v">
            <n-button text type="primary" @click="openInviter">{{ user.invite_user.email }}</n-button>
          </span>
        </div>
        <div class="kv"><span class="k">邀请人ID</span><span class="v num">{{ user.invite_user.id }}</span></div>
      </section>

      <section class="group">
        <h4>时间信息</h4>
        <div class="kv"><span class="k">创建时间</span><span class="v num">{{ formatTime(user.created_at) }}</span></div>
        <div class="kv"><span class="k">更新时间</span><span class="v num">{{ formatTime(user.updated_at) }}</span></div>
      </section>

      <section v-if="user.subscribe_url" class="group">
        <h4>订阅链接</h4>
        <div class="kv">
          <span class="k">订阅链接</span>
          <span class="v link-wrap">
            <a :href="user.subscribe_url" target="_blank" rel="noopener noreferrer" class="sub-link">{{ user.subscribe_url }}</a>
            <copy-text :text="user.subscribe_url" display="" />
          </span>
        </div>
      </section>
    </template>
  </n-modal>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -4px 0 12px;
}
.strong {
  color: var(--text-strong);
  font-weight: 600;
}
.num {
  font-variant-numeric: tabular-nums;
}
.group {
  padding: 12px 0;
  border-top: 1px solid var(--divider-color);
}
.group h4 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.kv {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 3px 0;
  font-size: 13px;
  line-height: 1.6;
}
.k {
  flex: none;
  width: 104px;
  color: var(--text-muted);
}
.v {
  flex: 1;
  min-width: 0;
  word-break: break-all;
}
.v.pre {
  white-space: pre-wrap;
}
.v.primary {
  color: var(--primary-color);
  font-weight: 600;
}
.sep {
  height: 1px;
  margin: 6px 0;
  background: var(--divider-color);
}
.link-wrap {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.sub-link {
  color: var(--primary-color);
  text-decoration: none;
  word-break: break-all;
  font-family: var(--font-mono);
  font-size: 12px;
}
.sub-link:hover {
  text-decoration: underline;
}
@media (max-width: 480px) {
  .k {
    width: 84px;
  }
}
</style>
