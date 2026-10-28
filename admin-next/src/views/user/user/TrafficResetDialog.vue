<script setup lang="ts">
// Manual traffic reset dialog with history tab (spec §11).
// Contract: props { show, user }, emits update:show, success (after a reset).
import { computed, ref, watch } from 'vue'
import { NModal, NTabs, NTabPane, NInput, NButton, NAlert, NTag, NSpin, NEmpty, NIcon, NScrollbar } from 'naive-ui'
import { RefreshOutline, WarningOutline } from '@vicons/ionicons5'
import type { UserRow } from '@/api/user'
import {
  fetchUserResetHistory,
  resetUserTraffic,
  resetTypeLabel,
  triggerSourceLabel,
  type UserResetHistory,
} from '@/api/trafficReset'
import { formatBytes, formatTime } from '@/utils/format'
import { message } from '@/utils/discrete'
import { truthy } from './helpers'

const props = defineProps<{ show: boolean; user: UserRow | null }>()
const emit = defineEmits<{ 'update:show': [boolean]; success: [] }>()

const tab = ref<'reset' | 'history'>('reset')
const reason = ref('')
const submitting = ref(false)
const history = ref<UserResetHistory | null>(null)
const historyLoading = ref(false)
// Updated locally after a successful reset so the info card does not show stale usage.
const resetDone = ref(false)

let historySeq = 0

async function loadHistory() {
  if (!props.user) return
  const my = ++historySeq
  historyLoading.value = true
  try {
    const res = await fetchUserResetHistory(props.user.id, 10)
    if (my === historySeq) history.value = res
  } catch {
    if (my === historySeq) history.value = null
  } finally {
    if (my === historySeq) historyLoading.value = false
  }
}

watch(
  () => [props.show, props.user?.id] as const,
  ([v]) => {
    if (!v) return
    tab.value = 'reset'
    reason.value = ''
    resetDone.value = false
    history.value = null
    // Always refetch (official cached history across opens).
    void loadHistory()
  },
  { immediate: true },
)

/** Mirrors TrafficResetService::canReset (active user with an existing plan). */
const blockReason = computed(() => {
  const u = props.user
  if (!u) return ''
  if (truthy(u.banned)) return '用户已被封禁'
  if (u.expired_at !== null && u.expired_at !== undefined && Number(u.expired_at) * 1000 <= Date.now()) return '用户订阅已过期'
  if (u.plan_id === null || u.plan_id === undefined) return '用户没有订阅套餐'
  if (!u.plan) return '用户的订阅套餐已不存在'
  return ''
})

async function submit() {
  if (!props.user || blockReason.value) return
  submitting.value = true
  try {
    const res = await resetUserTraffic(props.user.id, reason.value)
    message.success(res?.message || '流量重置成功')
    resetDone.value = true
    reason.value = ''
    emit('success')
    emit('update:show', false)
  } catch {
    /* 400 / 500 messages are toasted by the http client */
  } finally {
    submitting.value = false
  }
}

const historyItems = computed(() => history.value?.history ?? [])
const summary = computed(() => history.value?.user)
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="流量重置"
    :bordered="false"
    :style="{ width: 'min(820px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template v-if="user">
      <n-tabs v-model:value="tab" type="line" animated>
        <n-tab-pane name="reset" tab="重置流量">
          <div class="card">
            <div class="card-title">用户信息</div>
            <div class="info-grid">
              <div class="info"><span class="k">邮箱</span><span class="v">{{ user.email }}</span></div>
              <div class="info">
                <span class="k">已用流量</span>
                <span class="v num danger">{{ resetDone ? '0 B' : formatBytes(user.total_used) }}</span>
              </div>
              <div class="info"><span class="k">总流量</span><span class="v num">{{ formatBytes(user.transfer_enable) }}</span></div>
              <div class="info">
                <span class="k">到期时间</span>
                <span class="v num">{{ user.expired_at === null ? '长期有效' : formatTime(user.expired_at) }}</span>
              </div>
            </div>
          </div>

          <div class="warn-card">
            <div class="warn-title">
              <n-icon :size="16"><warning-outline /></n-icon>
              重要提醒
            </div>
            <ul>
              <li>流量重置操作不可逆，请谨慎操作</li>
              <li>重置后用户的上传和下载流量将清零，重置次数 +1，并重新计算下次重置时间</li>
              <li>所有重置操作都会被记录在流量重置日志中</li>
            </ul>
          </div>

          <n-alert v-if="blockReason" type="error" :show-icon="true" class="mb">
            该用户当前不能重置流量：{{ blockReason }}。仅未封禁、未过期且有有效套餐的用户可以重置。
          </n-alert>

          <div class="field-label">重置原因</div>
          <n-input
            v-model:value="reason"
            type="textarea"
            placeholder="请输入重置流量的原因（可选）"
            :maxlength="255"
            show-count
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
          <div class="hint">此字段为可选项。注意：当前后端版本不会把原因写入重置日志。</div>
        </n-tab-pane>

        <n-tab-pane name="history" tab="重置历史">
          <n-spin :show="historyLoading">
            <div class="card">
              <div class="card-title-row">
                <span class="card-title">重置概览</span>
                <n-button text size="small" :disabled="historyLoading" @click="loadHistory">
                  <template #icon><n-icon><refresh-outline /></n-icon></template>
                  刷新
                </n-button>
              </div>
              <div class="info-grid three">
                <div class="info">
                  <span class="k">重置次数</span>
                  <span class="v num strong">{{ summary?.reset_count ?? user.reset_count ?? 0 }}</span>
                </div>
                <div class="info">
                  <span class="k">最后重置</span>
                  <span class="v num">{{ summary?.last_reset_at ? formatTime(summary.last_reset_at) : '从未重置' }}</span>
                </div>
                <div class="info">
                  <span class="k">下次重置</span>
                  <span class="v num">{{ summary?.next_reset_at ? formatTime(summary.next_reset_at) : '无定时重置' }}</span>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-title">重置记录 <span class="muted small">最近10次重置记录</span></div>
              <n-scrollbar style="max-height: 300px">
                <div v-if="historyItems.length" class="records">
                  <div v-for="item in historyItems" :key="item.id" class="record">
                    <div class="record-tags">
                      <n-tag size="small" round>{{ resetTypeLabel(item.reset_type, item.reset_type_name) }}</n-tag>
                      <n-tag size="small" round :bordered="false" type="info">
                        {{ triggerSourceLabel(item.trigger_source, item.trigger_source_name) }}
                      </n-tag>
                    </div>
                    <div class="record-meta">
                      <span><span class="muted">重置时间</span> <span class="num">{{ formatTime(item.reset_time) }}</span></span>
                      <span><span class="muted">清除流量</span> <span class="num danger">{{ item.old_traffic.formatted }}</span></span>
                    </div>
                    <div v-if="item.metadata && item.metadata.reason" class="record-reason muted">原因：{{ item.metadata.reason }}</div>
                  </div>
                </div>
                <n-empty v-else-if="!historyLoading" description="暂无重置记录" size="small" class="empty" />
              </n-scrollbar>
            </div>
          </n-spin>
        </n-tab-pane>
      </n-tabs>
    </template>

    <template #footer>
      <div class="footer">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="error" :loading="submitting" :disabled="!!blockReason || !user" @click="submit">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          确认重置
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.card {
  padding: 12px 14px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-strong);
}
.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.card-title-row .card-title {
  margin-bottom: 0;
}
.small {
  font-size: 12px;
  font-weight: 400;
  margin-left: 6px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px 16px;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.k {
  font-size: 12px;
  color: var(--text-muted);
}
.v {
  font-size: 14px;
  word-break: break-all;
}
.num {
  font-variant-numeric: tabular-nums;
}
.strong {
  font-weight: 600;
}
.danger {
  color: var(--error-color);
}
.warn-card {
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--warning-color) 45%, transparent);
  background: color-mix(in srgb, var(--warning-color) 10%, transparent);
  font-size: 13px;
}
.warn-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--warning-color);
}
.warn-card ul {
  margin: 6px 0 0;
  padding-left: 20px;
  line-height: 1.7;
}
.mb {
  margin-bottom: 12px;
}
.field-label {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}
.hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.records {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 8px;
}
.record {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--hover-color);
}
.record-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.record-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  font-size: 13px;
}
.record-reason {
  margin-top: 4px;
  font-size: 12px;
}
.empty {
  padding: 24px 0;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
