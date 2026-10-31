<script setup lang="ts">
// 流量周期 drawer (user list row action, user detail dialog, reset log page).
// Contract: props { show, userId, email?, highlightCycleId? }, emits update:show. Loads only while open;
// a 404 means the panel backend has no traffic cycle ledger yet and is shown as such (no error toast).
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NDrawer, NDrawerContent, NEmpty, NIcon, NSpin, NSwitch, NTag, NTooltip } from 'naive-ui'
import {
  CheckmarkCircleOutline,
  CloseCircleOutline,
  CloudOfflineOutline,
  ListOutline,
  PauseCircleOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import { fetchPlanOptions, type PlanBrief } from '@/api/common'
import { ApiError } from '@/api/http'
import {
  fetchUserTrafficCycle,
  isLedgerMissing,
  type CycleTimeline,
  type TrafficCycle,
} from '@/api/trafficCycle'
import { appState } from '@/stores/app'
import { formatBytes, formatRemaining, formatTime, nowSeconds } from '@/utils/format'
import { shortTime } from '../login-log/meta'
import { normalizeCycleEvent } from '../traffic-reset/normalize'
import CycleCurrentCard from './CycleCurrentCard.vue'
import CycleUpcoming from './CycleUpcoming.vue'
import CycleHistory from './CycleHistory.vue'
import CycleResetEvents from './CycleResetEvents.vue'
import { advanceReasonText, durationText, resetMethodHint, resetMethodText } from './meta'

const props = withDefaults(
  defineProps<{ show: boolean; userId: number | null; email?: string; highlightCycleId?: number | null }>(),
  { email: '', highlightCycleId: null },
)
const emit = defineEmits<{ 'update:show': [boolean] }>()
const router = useRouter()

const HISTORY_SIZE = 10
const timeline = shallowRef<CycleTimeline | null>(null)
const history = shallowRef<TrafficCycle[]>([])
const plans = shallowRef<PlanBrief[]>([])
const loading = ref(false)
const moreLoading = ref(false)
const error = shallowRef<unknown>(null)
const eventsSize = ref(20)
const showNoise = ref(false)
let historyPage = 1
let seq = 0

async function load() {
  if (!props.userId) return
  const my = ++seq
  loading.value = true
  try {
    const res = await fetchUserTrafficCycle(
      props.userId,
      { history_page: 1, history_size: HISTORY_SIZE, events_size: eventsSize.value },
      { silent: true },
    )
    if (my !== seq) return
    timeline.value = res
    history.value = res.history ?? []
    historyPage = 1
    error.value = null
  } catch (e) {
    if (my !== seq) return
    timeline.value = null
    history.value = []
    error.value = e
  } finally {
    if (my === seq) loading.value = false
  }
}

async function loadMoreHistory() {
  if (!props.userId || moreLoading.value) return
  const my = seq
  moreLoading.value = true
  try {
    const res = await fetchUserTrafficCycle(
      props.userId,
      { history_page: historyPage + 1, history_size: HISTORY_SIZE, events_size: 1 },
      { silent: true },
    )
    if (my !== seq) return
    historyPage += 1
    history.value = [...history.value, ...(res.history ?? [])]
  } catch {
    /* keep what is shown; the button stays for a retry */
  } finally {
    moreLoading.value = false
  }
}

function showMoreEvents() {
  eventsSize.value = 50
  void load()
}

watch(
  () => [props.show, props.userId] as const,
  ([show]) => {
    if (!show) return
    eventsSize.value = 20
    showNoise.value = false
    timeline.value = null
    history.value = []
    error.value = null
    void load()
    fetchPlanOptions({ silent: true })
      .then((list) => (plans.value = list))
      .catch(() => undefined)
  },
  { immediate: true },
)

function close() {
  emit('update:show', false)
}

function openLogs() {
  if (!props.userId) return
  close()
  void router.push({ path: '/user/traffic-reset-logs', query: { user_id: String(props.userId) } })
}

const now = computed(() => timeline.value?.now ?? nowSeconds())
const email = computed(() => props.email || timeline.value?.user?.email || '')
const planQuota = computed(() => timeline.value?.plan?.quota ?? null)
const current = computed(() => timeline.value?.current ?? null)

function planName(id: unknown): string {
  if (id === null || id === undefined || id === '') return '无套餐'
  if (typeof id === 'string' && !/^\d+$/.test(id)) return id
  const n = Number(id)
  return plans.value.find((p) => p.id === n)?.name ?? (timeline.value?.plan?.id === n ? timeline.value.plan.name : `套餐 #${n}`)
}

const expiry = computed(() => {
  const exp = timeline.value?.expired_at ?? null
  if (exp === null) return { main: '长期有效', sub: '不会到期' }
  const left = exp - now.value
  return { main: formatTime(exp), sub: left > 0 ? `剩余 ${formatRemaining(left)}` : `已过期 ${formatRemaining(-left)}` }
})

const noCurrentText = computed(() => {
  const t = timeline.value
  if (!t) return ''
  if (!t.plan) return '用户没有套餐，没有进行中的周期。'
  if (t.expired_at !== null && t.expired_at <= now.value) return '订阅已过期，没有进行中的周期。'
  // The backend bootstraps a cycle for every active user, so none at all means the ledger table is missing.
  return '没有进行中的周期。面板刚升级时，可能还没有执行数据库迁移（周期数据表未建立）。'
})

const scheduleEmptyText = computed(() => {
  const c = current.value
  if (!c) return ''
  if (!c.ends_at) return timeline.value?.reset_method === 'never' ? '该套餐不重置流量，不排期。' : '长期有效，不排期。'
  if (c.is_final) return '本周期就是最后一个周期，到期后不再重置。'
  // Changed to 长期有效 during this cycle: the promised reset still happens (DESIGN §3.3).
  return timeline.value?.expired_at === null ? '订阅长期有效：本周期到点照常重置，之后不再排期。' : '暂无后续排期。'
})

const advance = computed(() => {
  const a = timeline.value?.advance
  if (!a) return null
  if (!a.enabled) {
    return {
      enabled: false,
      rule: '换时未启用：流量用尽后需要等本周期结束（或购买流量重置包）才会恢复。',
      ok: false,
      status: advanceReasonText(a.reason),
    }
  }
  const min = a.min_remaining_days ?? null
  const rule = `流量用尽且剩余有效期${min !== null ? ` ≥ ${min} 天` : '足够'}时，系统立即开启下一周期，到期时间前移本周期未用完的时长。`
  if (a.eligible_if_exhausted) {
    const parts = ['当前若用尽：可以换时']
    if (a.shift_seconds) parts.push(`到期前移 ${durationText(a.shift_seconds)}${a.expired_after ? ` 至 ${formatTime(a.expired_after)}` : ''}`)
    if (a.next_quota !== null && a.next_quota !== undefined) parts.push(`新周期额度 ${formatBytes(a.next_quota)}`)
    return { enabled: true, rule, ok: true, status: `${parts.join('，')}。` }
  }
  const extra = a.reason === 'remaining_too_short' && min !== null ? `（需 ≥ ${min} 天）` : ''
  return { enabled: true, rule, ok: false, status: `当前若用尽：不能换时，${advanceReasonText(a.reason)}${extra}。` }
})

const events = computed(() => (timeline.value?.events ?? []).map((e) => normalizeCycleEvent(e, props.userId ?? 0)))
const noiseCount = computed(() => events.value.filter((e) => e.noise).length)
const visibleEvents = computed(() => (showNoise.value ? events.value : events.value.filter((e) => !e.noise)))
const eventsTotal = computed(() => timeline.value?.events_total ?? events.value.length)

const missing = computed(() => isLedgerMissing(error.value))
const errorText = computed(() => {
  const e = error.value
  if (!e || missing.value) return ''
  if (e instanceof ApiError && e.status === 404) return '用户不存在或已被删除'
  return e instanceof Error && e.message ? e.message : '流量周期加载失败'
})

const drawerWidth = computed(() => (appState.isMobile ? '100%' : 760))
</script>

<template>
  <n-drawer :show="show" :width="drawerWidth" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content closable :native-scrollbar="false" body-content-class="cycle-drawer-body">
      <template #header>
        <div class="drawer-head">
          <span class="title">流量周期</span>
          <n-tag v-if="userId" size="small" round :bordered="false" class="mono">#{{ userId }}</n-tag>
          <span v-if="email" class="head-email" :title="email">{{ email }}</span>
          <span v-else class="grow" />
          <n-tooltip>
            <template #trigger>
              <n-button quaternary circle size="small" aria-label="刷新" :loading="loading" @click="load">
                <template #icon><n-icon><refresh-outline /></n-icon></template>
              </n-button>
            </template>
            刷新
          </n-tooltip>
          <n-button text size="small" type="primary" class="head-link" @click="openLogs">
            <template #icon><n-icon><list-outline /></n-icon></template>
            {{ appState.isMobile ? '记录' : '重置记录' }}
          </n-button>
        </div>
      </template>

      <n-spin :show="loading && !!timeline" :delay="150">
        <div v-if="missing" class="state-block">
          <span class="state-icon"><n-icon :size="26"><cloud-offline-outline /></n-icon></span>
          <div class="state-title">当前面板还没有流量周期接口</div>
          <div class="state-desc">后端未升级（缺少 user/trafficCycle 接口或周期数据表）。升级面板并执行迁移后即可查看周期、排期与换时规则。</div>
          <n-button size="small" secondary @click="openLogs">查看该用户的重置记录</n-button>
        </div>
        <div v-else-if="errorText" class="state-block">
          <span class="state-icon"><n-icon :size="26"><cloud-offline-outline /></n-icon></span>
          <div class="state-title">流量周期加载失败</div>
          <div class="state-desc">{{ errorText }}</div>
          <n-button size="small" secondary @click="load">重试</n-button>
        </div>
        <div v-else-if="!timeline" class="loading-block">
          <n-spin size="small" />
          <span>正在读取流量周期…</span>
        </div>

        <div v-else class="content">
          <div class="overview">
            <div class="ov">
              <span class="k">套餐</span>
              <span class="v clamp" :title="timeline.plan?.name">{{ timeline.plan?.name ?? '无套餐' }}</span>
              <span v-if="timeline.plan" class="s num">标准额度 {{ formatBytes(timeline.plan.quota) }}</span>
            </div>
            <div class="ov">
              <span class="k">重置方式</span>
              <span class="v">{{ resetMethodText(timeline.reset_method) }}</span>
              <span class="s">{{ resetMethodHint(timeline.reset_method, timeline.min_cycle_days) }}</span>
            </div>
            <div class="ov">
              <span class="k">订阅到期</span>
              <span class="v num">{{ expiry.main }}</span>
              <span class="s">{{ expiry.sub }}</span>
            </div>
            <div class="ov">
              <span class="k">已重置</span>
              <span class="v num">{{ timeline.user?.reset_count ?? '—' }} 次</span>
              <span class="s num">
                {{ timeline.user?.last_reset_at ? `上次 ${shortTime(timeline.user.last_reset_at)}` : '从未重置' }}
              </span>
            </div>
          </div>

          <section class="sec">
            <h4>当前周期</h4>
            <cycle-current-card
              v-if="current"
              :cycle="current"
              :now="now"
              :plan-quota="planQuota"
              :plan-name="planName"
              :highlight="highlightCycleId !== null && current.id === highlightCycleId"
            />
            <div v-else class="empty-line">{{ noCurrentText }}</div>
          </section>

          <section v-if="current" class="sec">
            <h4>后续排期 <span v-if="timeline.upcoming.length" class="count">{{ timeline.upcoming.length }}</span></h4>
            <cycle-upcoming v-if="timeline.upcoming.length" :items="timeline.upcoming" :base-quota="current.quota" />
            <div v-else class="empty-line">{{ scheduleEmptyText }}</div>
          </section>

          <section v-if="advance" class="sec">
            <h4>换时规则</h4>
            <div class="advance" :class="{ off: !advance.enabled }">
              <p class="rule">{{ advance.rule }}</p>
              <p class="status" :class="advance.enabled ? (advance.ok ? 'ok' : 'no') : 'off'">
                <n-icon :size="16">
                  <checkmark-circle-outline v-if="advance.ok" />
                  <pause-circle-outline v-else-if="!advance.enabled" />
                  <close-circle-outline v-else />
                </n-icon>
                <span>{{ advance.status }}</span>
              </p>
            </div>
          </section>

          <section class="sec">
            <h4>历史周期 <span v-if="timeline.history_total" class="count">{{ timeline.history_total }}</span></h4>
            <cycle-history
              v-if="history.length"
              :items="history"
              :total="timeline.history_total"
              :loading="moreLoading"
              :highlight-id="highlightCycleId"
              @more="loadMoreHistory"
            />
            <div v-else class="empty-line">还没有已结束的周期（启用周期记录之前的情况见下方重置记录）。</div>
          </section>

          <section class="sec">
            <div class="sec-head">
              <h4>重置记录 <span v-if="eventsTotal" class="count">{{ eventsTotal }}</span></h4>
              <span v-if="noiseCount" class="noise-switch">
                <n-switch v-model:value="showNoise" size="small" aria-label="显示冗余记录" />
                <span @click="showNoise = !showNoise">显示冗余记录（{{ noiseCount }}）</span>
              </span>
            </div>
            <cycle-reset-events v-if="visibleEvents.length" :items="visibleEvents" />
            <n-empty v-else size="small" description="暂无有意义的重置记录" class="events-empty" />
            <div v-if="eventsTotal > events.length" class="events-more">
              <n-button v-if="eventsSize < 50" size="small" secondary :loading="loading" @click="showMoreEvents">显示更多</n-button>
              <n-button size="small" text type="primary" @click="openLogs">在重置记录页查看全部 {{ eventsTotal }} 条</n-button>
            </div>
          </section>
        </div>
      </n-spin>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.drawer-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
}
.title {
  flex: none;
}
/* width: 0 keeps a long email out of the header's min-content, so the close button stays on screen. */
.head-email {
  flex: 1 1 auto;
  width: 0;
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grow {
  flex: 1;
}
.head-link {
  margin-right: 8px;
  font-size: 13px;
}
.mono {
  font-family: var(--font-mono);
}
.num {
  font-variant-numeric: tabular-nums;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.overview {
  display: grid;
  /* Plan names are the longest values; the reset count the shortest. */
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr);
  gap: 10px;
}
.ov {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--hover-color);
}
.k {
  font-size: 12px;
  color: var(--text-muted);
}
.v {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Plan names are long ("天穹旗舰 · 三网巅峰入口"): two lines instead of an ellipsis. */
.v.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
  word-break: break-word;
  line-height: 1.35;
}
.s {
  font-size: 12px;
  color: var(--text-muted);
}
.sec h4 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.count {
  min-width: 18px;
  padding: 0 6px;
  border-radius: 9px;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 18px;
  text-align: center;
  color: var(--text-muted);
  background: var(--hover-color);
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.sec-head h4 {
  margin: 0;
}
.noise-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-color);
  cursor: pointer;
  user-select: none;
}
.empty-line {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-muted);
  background: var(--hover-color);
}
.advance {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--divider-color);
}
.advance p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}
.rule {
  color: var(--text-color);
}
.status {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px !important;
  font-weight: 500;
}
.status .n-icon {
  flex: none;
  margin-top: 2px;
}
.status.ok {
  color: var(--success-color);
}
.status.no {
  color: var(--warning-color);
}
.status.off {
  color: var(--text-muted);
}
.events-empty {
  padding: 12px 0;
}
.events-more {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.loading-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 0;
  font-size: 13px;
  color: var(--text-muted);
}
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 12px;
  text-align: center;
}
.state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 4px;
  border-radius: 16px;
  color: var(--warning-color);
  background: color-mix(in srgb, var(--warning-color) 12%, transparent);
}
.state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}
.state-desc {
  max-width: 440px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
@media (max-width: 767px) {
  .overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .head-link {
    margin-right: 4px;
  }
}
</style>
