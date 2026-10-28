<script setup lang="ts">
// Usage record details: rewards given, inviter rewards and multiplier (not rendered by the official UI).
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NDescriptions, NDescriptionsItem, NDrawer, NDrawerContent, NEmpty, NIcon, NTag } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import { asObject, type GiftCardRewards, type GiftCardUsage } from '@/api/giftCard'
import { appState } from '@/stores/app'
import { copyText } from '@/utils/clipboard'
import { formatTime } from '@/utils/format'
import { formatMultiplier, formatRate, randomItemText, rewardItems } from './helpers'

const props = defineProps<{
  show: boolean
  usage: GiftCardUsage | null
  planName?: (id: number) => string
}>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const given = computed(() => {
  const r = asObject<GiftCardRewards>(props.usage?.rewards_given ?? null)
  // `random_rewards` is the whole pool copied from the template, not what was granted, and
  // `invite_reward_rate` is the inviter's ratio (shown under 邀请奖励), not a reward to the user.
  const rest: GiftCardRewards = { ...r }
  delete rest.random_rewards
  delete rest.invite_reward_rate
  return rewardItems(rest, props.planName)
})
/** Ratio applied to the inviter's reward at redemption time (after any festival multiplier). */
const inviteRate = computed<number | null>(() => {
  const v = asObject<GiftCardRewards>(props.usage?.rewards_given ?? null).invite_reward_rate
  const n = Number(v)
  return v === undefined || v === null || !Number.isFinite(n) ? null : n
})
const pool = computed(() => {
  const r = asObject<GiftCardRewards>(props.usage?.rewards_given ?? null)
  return Array.isArray(r.random_rewards) ? r.random_rewards : []
})
const inviteItems = computed(() => rewardItems(asObject<GiftCardRewards>(props.usage?.invite_rewards ?? null)))

const router = useRouter()
function openUser(email: string) {
  emit('update:show', false)
  void router.push({ path: '/user/manage', query: { email } })
}
const raw = computed(() => (props.usage ? JSON.stringify(props.usage, null, 2) : ''))
</script>

<template>
  <n-drawer :show="show" :width="appState.isMobile ? '100%' : 520" @update:show="emit('update:show', $event)">
    <n-drawer-content title="使用记录详情" closable :native-scrollbar="false">
      <template v-if="usage">
        <n-descriptions :column="1" label-placement="left" bordered size="small" label-class="desc-label">
          <n-descriptions-item label="记录 ID"><span class="mono">{{ usage.id }}</span></n-descriptions-item>
          <n-descriptions-item label="兑换码">
            <span v-if="usage.code" class="code-line">
              <span class="mono">{{ usage.code }}</span>
              <n-button text size="tiny" title="复制" aria-label="复制兑换码" @click="copyText(usage.code, '复制成功')">
                <template #icon><n-icon><copy-outline /></n-icon></template>
              </n-button>
            </span>
            <span v-else class="muted">兑换码已删除</span>
          </n-descriptions-item>
          <n-descriptions-item label="模板名称">{{ usage.template_name || '-' }}</n-descriptions-item>
          <n-descriptions-item label="用户邮箱">
            <n-button v-if="usage.user_email" text type="primary" @click="openUser(usage.user_email)">{{ usage.user_email }}</n-button>
            <span v-else class="muted">用户已删除</span>
          </n-descriptions-item>
          <n-descriptions-item label="邀请人">{{ usage.invite_user_email || '无' }}</n-descriptions-item>
          <n-descriptions-item label="倍数加成">
            <span class="mono">{{ formatMultiplier(usage.multiplier_applied) }}</span>
          </n-descriptions-item>
          <n-descriptions-item label="使用时间"><span class="mono">{{ formatTime(usage.created_at) }}</span></n-descriptions-item>
        </n-descriptions>

        <h4 class="block-title">获得奖励</h4>
        <div v-if="given.length" class="tags">
          <n-tag v-for="t in given" :key="t" size="small" type="success" :bordered="false">{{ t }}</n-tag>
        </div>
        <span v-else class="muted small">无</span>

        <template v-if="pool.length">
          <h4 class="block-title">模板奖池（兑换时）</h4>
          <ol class="pool">
            <li v-for="(it, i) in pool" :key="i">
              <span class="mono muted">权重 {{ it.weight }}</span>
              <span>{{ randomItemText(it as unknown as Record<string, unknown>) }}</span>
            </li>
          </ol>
        </template>

        <h4 class="block-title">邀请奖励</h4>
        <div v-if="inviteItems.length" class="tags">
          <n-tag v-for="t in inviteItems" :key="t" size="small" type="info" :bordered="false">{{ t }}</n-tag>
        </div>
        <span v-else class="muted small">无</span>
        <p v-if="inviteRate !== null" class="muted small rate-line">
          返利比例 <span class="mono">{{ formatRate(inviteRate) }}</span>{{ usage.invite_user_email || inviteItems.length ? '' : '（无邀请人，未发放）' }}
        </p>

        <h4 class="block-title">原始数据</h4>
        <pre class="raw">{{ raw }}</pre>
      </template>
      <n-empty v-else description="暂无数据" />
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
:deep(.desc-label) {
  width: 96px;
  white-space: nowrap;
}
.code-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow-wrap: anywhere;
}
.block-title {
  margin: 18px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.small {
  font-size: 12px;
}
.rate-line {
  margin: 6px 0 0;
}
.pool {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.8;
}
.pool li span + span {
  margin-left: 8px;
}
.raw {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--code-bg);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 320px;
}
</style>
