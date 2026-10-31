<script setup lang="ts">
// 流量周期与重置 (spec users.md §12 / §18). Every row says why traffic was cleared, how much, and how quota and
// expiry changed; noise rows (old 0 B duplicates) are hidden server-side by default. Older panels without the
// traffic cycle backend still work: reasons are inferred from the trigger source and noise rows are only faded.
// Deep links: ?user_id= / ?user_email=.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NEmpty,
  NIcon,
  NInput,
  NPagination,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
  NTooltip,
} from 'naive-ui'
import {
  CloseOutline,
  CloudOfflineOutline,
  DownloadOutline,
  EyeOffOutline,
  PlaySkipForwardOutline,
  RefreshOutline,
  SearchOutline,
  ShieldCheckmarkOutline,
  SyncOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import { fetchTrafficResetLogs, type TrafficResetLog, type TrafficResetLogQuery } from '@/api/trafficReset'
import { appState } from '@/stores/app'
import { saveFile } from '@/utils/clipboard'
import { message } from '@/utils/discrete'
import { formatBytes, formatNumber, formatTime } from '@/utils/format'
import { isFutureDay } from './login-log/meta'
import { REASON_OPTIONS, SOURCE_FILTER_OPTIONS, durationText, reasonMeta, sourceLabel } from './traffic-cycle/meta'
import TrafficCycleDrawer from './traffic-cycle/TrafficCycleDrawer.vue'
import { buildResetLogColumns, resetLogRowClass, resetLogScrollX } from './traffic-reset/columns'
import { hasCycleFields, normalizeResetLog, type ResetLogView } from './traffic-reset/normalize'
import ResetLogCard from './traffic-reset/ResetLogCard.vue'

const ROUTE_PATH = '/user/traffic-reset-logs'
const route = useRoute()
const router = useRouter()

// ------------------------------------------------------------------ filters

const keyword = ref('')
const email = ref('')
const userId = ref<number | null>(null)
/** Email shown in the user chip (from the clicked row or the loaded data). */
const userLabel = ref('')
const reason = ref<string | null>(null)
const source = ref<string | null>(null)
const dateRange = ref<[number, number] | null>(null)
const showNoise = ref(false)

/** "#123" in the search box filters by user id; anything else is an email fragment. */
function applyKeyword() {
  const v = keyword.value.trim()
  const id = v.match(/^#(\d+)$/)
  if (id) {
    keyword.value = ''
    email.value = ''
    setUser(Number(id[1]), '')
    return
  }
  email.value = v
}
let kwTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, () => {
  clearTimeout(kwTimer)
  kwTimer = setTimeout(applyKeyword, 400)
})
function flushKeyword() {
  clearTimeout(kwTimer)
  applyKeyword()
}
onBeforeUnmount(() => clearTimeout(kwTimer))

const DAY_MS = 86400000
function todayStartMs() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function ymd(ms: number) {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const last30 = (): [number, number] => [todayStartMs() - 29 * DAY_MS, todayStartMs()]
const dateShortcuts = {
  今天: () => [todayStartMs(), todayStartMs()] as [number, number],
  最近7天: () => [todayStartMs() - 6 * DAY_MS, todayStartMs()] as [number, number],
  最近30天: last30,
}

/** Server-side filters (the backend compares dates in its own time zone). */
const filterQuery = computed<Omit<TrafficResetLogQuery, 'page' | 'per_page'>>(() => ({
  user_id: userId.value,
  user_email: email.value || null,
  reason: reason.value,
  trigger_source: source.value,
  start_date: dateRange.value ? ymd(dateRange.value[0]) : null,
  end_date: dateRange.value ? ymd(dateRange.value[1]) : null,
  hide_noise: showNoise.value ? null : 1,
}))
const hasFilters = computed(
  () => !!(userId.value || email.value || reason.value || source.value || dateRange.value),
)
function toggleNoise() {
  if (cycleBackend.value !== false) showNoise.value = !showNoise.value
}

/** null until a response shows whether the backend knows reasons / noise (traffic cycle ledger). */
const cycleBackend = ref<boolean | null>(null)
function noteBackend(rows: TrafficResetLog[]) {
  if (rows.length) cycleBackend.value = rows.some(hasCycleFields)
}

const table = usePagedTable<ResetLogView>(
  async (q) => {
    const res = await fetchTrafficResetLogs(
      { ...filterQuery.value, page: q.current, per_page: q.pageSize },
      { silent: true },
    )
    const rows = res.data ?? []
    noteBackend(rows)
    return { data: rows.map(normalizeResetLog), total: res.pagination?.total ?? 0 }
  },
  { pageSize: 20, pageSizes: [10, 20, 50, 100], immediate: false },
)
table.pagination.showQuickJumper = true
table.pagination.prefix = ({ itemCount }) => `共 ${formatNumber(itemCount ?? 0)} 条`

watch(
  () => JSON.stringify(filterQuery.value),
  () => void table.search(),
)

// Fill the user chip label from loaded rows (deep links only carry the id).
watch(
  () => table.data.value,
  (rows) => {
    if (!userId.value || userLabel.value) return
    const hit = rows.find((r) => r.userId === userId.value && r.email)
    if (hit?.email) userLabel.value = hit.email
  },
)

// ------------------------------------------------------------------ URL

/** Query this page wrote itself (user chip / reset); see applyQuery. */
let ownQuery: LocationQuery | null = null

function sameQuery(a: LocationQuery, b: LocationQuery) {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => k in b && String(a[k]) === String(b[k]))
}

function replaceQuery(query: LocationQuery) {
  if (sameQuery(query, route.query)) return
  ownQuery = query
  void router.replace({ query })
}

function setUser(id: number | null, label: string) {
  userId.value = id
  userLabel.value = label
  const rest = { ...route.query }
  delete rest.user_id
  delete rest.user_email
  replaceQuery(id ? { ...rest, user_id: String(id) } : rest)
}

function resetFilters() {
  clearTimeout(kwTimer)
  keyword.value = ''
  email.value = ''
  userId.value = null
  userLabel.value = ''
  reason.value = null
  source.value = null
  dateRange.value = null
  replaceQuery({})
}

/**
 * On mount and on navigation from outside the page (user list action, sidebar, back/forward) the URL is the whole
 * filter state; the page's own writes only keep user_id in sync.
 */
function applyQuery(q: LocationQuery, own = false) {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? String(v[0] ?? '').trim() : '')
  const id = str(q.user_id)
  const nextId = /^\d+$/.test(id) && Number(id) > 0 ? Number(id) : null
  if (nextId !== userId.value) userLabel.value = ''
  userId.value = nextId
  if (own) return
  clearTimeout(kwTimer)
  keyword.value = str(q.user_email)
  email.value = keyword.value
  reason.value = null
  source.value = null
  dateRange.value = null
}

watch(
  () => route.query,
  (q) => {
    if (route.path !== ROUTE_PATH) return
    const own = ownQuery !== null && sameQuery(q, ownQuery)
    ownQuery = null
    applyQuery(q, own)
  },
)

// ------------------------------------------------------------------ last 30 days overview (noise excluded)

type PresetKey = 'valid' | 'rollover' | 'advance' | 'noise'
const stats = shallowRef<Record<PresetKey, number | null>>({ valid: null, rollover: null, advance: null, noise: null })
const statsLoading = ref(false)

async function loadStats() {
  statsLoading.value = true
  const since = ymd(last30()[0])
  const count = (extra: Partial<TrafficResetLogQuery>) =>
    fetchTrafficResetLogs({ page: 1, per_page: 1, start_date: since, ...extra }, { silent: true }).then((r) => {
      noteBackend(r.data ?? [])
      return Number(r.pagination?.total ?? 0)
    })
  const settled = await Promise.allSettled([
    count({ hide_noise: 1 }),
    count({ hide_noise: 1, reason: 'cycle_rollover' }),
    count({ hide_noise: 1, reason: 'auto_advance' }),
    count({}),
  ])
  const val = (i: number) => (settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<number>).value : null)
  const all = val(3)
  const valid = val(0)
  stats.value = {
    valid,
    rollover: val(1),
    advance: val(2),
    noise: all !== null && valid !== null ? Math.max(0, all - valid) : null,
  }
  statsLoading.value = false
}

const statCards: { key: PresetKey; label: string; hint: string; icon: Component; tone: string }[] = [
  { key: 'valid', label: '有效重置', hint: '近 30 天，不含冗余记录', icon: ShieldCheckmarkOutline, tone: 'primary' },
  { key: 'rollover', label: '周期到期', hint: '到点自动清零进入新周期', icon: SyncOutline, tone: 'info' },
  { key: 'advance', label: '提前换时', hint: '流量用尽提前开启下一周期', icon: PlaySkipForwardOutline, tone: 'warning' },
  { key: 'noise', label: '冗余记录', hint: '清零 0 B，默认隐藏', icon: EyeOffOutline, tone: 'neutral' },
]

function isLast30(range: [number, number] | null) {
  const [a, b] = last30()
  return !!range && range[0] === a && range[1] === b
}
const activePreset = computed<PresetKey | null>(() => {
  if (userId.value || email.value || source.value || !isLast30(dateRange.value)) return null
  if (!reason.value) return showNoise.value ? 'noise' : 'valid'
  if (showNoise.value) return null
  if (reason.value === 'cycle_rollover') return 'rollover'
  if (reason.value === 'auto_advance') return 'advance'
  return null
})

function applyPreset(key: PresetKey) {
  clearTimeout(kwTimer)
  keyword.value = ''
  email.value = ''
  userId.value = null
  userLabel.value = ''
  source.value = null
  dateRange.value = last30()
  reason.value = key === 'rollover' ? 'cycle_rollover' : key === 'advance' ? 'auto_advance' : null
  showNoise.value = key === 'noise'
  replaceQuery({})
}

function refresh() {
  void table.reload()
  void loadStats()
}

// ------------------------------------------------------------------ cycle drawer

const cycleShow = ref(false)
const cycleUserId = ref<number | null>(null)
const cycleEmail = ref('')
const cycleHighlight = ref<number | null>(null)

function openUser(log: ResetLogView, highlight: number | null = null) {
  cycleUserId.value = log.userId
  cycleEmail.value = log.email ?? ''
  cycleHighlight.value = highlight
  cycleShow.value = true
}

const columns = buildResetLogColumns({
  onOpenUser: (l) => openUser(l),
  onOpenCycle: (l) => openUser(l, l.cycleId),
})

const errorInfo = computed(() => {
  const e = table.error.value
  if (!e) return null
  return { title: '重置记录加载失败', desc: e instanceof Error && e.message ? e.message : '请稍后重试' }
})
const emptyText = computed(() => (hasFilters.value ? '没有符合条件的重置记录' : '暂无重置记录'))

const pageCount = computed(() =>
  Math.max(1, Math.ceil((table.pagination.itemCount ?? 0) / (table.pagination.pageSize ?? 20))),
)
function goPage(p: number) {
  table.pagination.page = p
  void table.reload()
}

// ------------------------------------------------------------------ export

const exporting = ref(false)
const EXPORT_LIMIT = 10000

function csvCell(v: unknown) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function exportLogs() {
  if (exporting.value) return
  exporting.value = true
  try {
    const res = await fetchTrafficResetLogs({ ...filterQuery.value, page: 1, per_page: EXPORT_LIMIT })
    const rows = (res.data ?? []).map(normalizeResetLog)
    if (!rows.length) {
      message.warning('没有可导出的记录')
      return
    }
    const head = [
      '日志ID', '时间', '用户邮箱', '用户ID', '原因', '原因说明', '冗余记录', '触发来源', '清零流量', '清零(字节)',
      '额度(改前)', '额度(改后)', '到期(改前)', '到期(改后)', '到期前移', '周期ID', '订单ID', '管理员ID', '备注',
    ]
    const lines = [head.join(',')]
    for (const r of rows) {
      const m = reasonMeta(r.reason)
      lines.push(
        [
          r.id,
          formatTime(r.at),
          r.email ?? '',
          r.userId,
          m.label,
          r.inferred ? `${m.desc}（按触发来源推断）` : m.desc,
          r.noise ? '是' : '否',
          sourceLabel(r.source, r.sourceName),
          formatBytes(r.cleared),
          r.cleared,
          r.quotaBefore === null ? '' : formatBytes(r.quotaBefore),
          r.quotaAfter === null ? '' : formatBytes(r.quotaAfter),
          r.expiredBefore === null ? '' : formatTime(r.expiredBefore),
          r.expiredAfter === null ? '' : formatTime(r.expiredAfter),
          r.shift ? durationText(r.shift) : '',
          r.cycleId ?? '',
          r.orderId ?? '',
          r.adminId ?? '',
          r.note ?? '',
        ]
          .map(csvCell)
          .join(','),
      )
    }
    saveFile('﻿' + lines.join('\r\n'), `traffic-reset-logs-${ymd(Date.now())}.csv`, 'text/csv;charset=utf-8')
    const total = res.pagination?.total ?? rows.length
    if (total > rows.length) message.warning(`导出成功，共 ${total} 条，仅导出了前 ${rows.length} 条`)
    else message.success(`导出成功，共 ${rows.length} 条`)
  } catch {
    /* toast handled by the http client */
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  // A changed filter triggers the filterQuery watcher; only search explicitly when nothing changed.
  const before = JSON.stringify(filterQuery.value)
  applyQuery(route.query)
  if (JSON.stringify(filterQuery.value) === before) void table.search()
  void loadStats()
})
</script>

<template>
  <page-container
    title="流量周期与重置"
    description="每次已用流量清零的原因、清零量，以及额度和到期时间的变化；点击用户查看完整的周期时间线。没有实际清零的冗余记录默认隐藏。"
  >
    <template #extra>
      <n-button :loading="exporting" @click="exportLogs">
        <template #icon><n-icon><download-outline /></n-icon></template>
        {{ exporting ? '导出中...' : '导出记录' }}
      </n-button>
    </template>

    <div v-if="cycleBackend !== false" class="stats">
      <button
        v-for="s in statCards"
        :key="s.key"
        type="button"
        class="stat"
        :class="[`tone-${s.tone}`, { active: activePreset === s.key }]"
        :title="s.key === 'noise' ? '查看近 30 天的全部记录（含冗余记录）' : `只看近 30 天的${s.label}记录`"
        @click="applyPreset(s.key)"
      >
        <span class="stat-icon"><n-icon :size="16"><component :is="s.icon" /></n-icon></span>
        <span class="stat-body">
          <span class="stat-label">{{ s.label }}</span>
          <span class="stat-value num">
            <template v-if="stats[s.key] !== null">{{ formatNumber(stats[s.key]) }}</template>
            <span v-else class="stat-dash" :class="{ loading: statsLoading }">—</span>
          </span>
          <span class="stat-hint">{{ s.hint }}</span>
        </span>
      </button>
    </div>

    <n-card :bordered="false" class="list-card" content-style="padding: 16px">
      <n-alert v-if="cycleBackend === false" type="info" :show-icon="true" class="legacy-alert">
        当前面板还没有流量周期功能（后端未升级）：原因按触发来源推断，清零 0 B 的冗余记录只能淡化显示、无法隐藏，按原因筛选与统计不可用。
      </n-alert>

      <div class="toolbar">
        <n-input v-model:value="keyword" placeholder="用户邮箱，或 #用户ID" clearable class="search" @keyup.enter="flushKeyword">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-select
          v-model:value="reason"
          :options="REASON_OPTIONS"
          placeholder="全部原因"
          clearable
          :disabled="cycleBackend === false"
          class="sel"
        />
        <n-select v-model:value="source" :options="SOURCE_FILTER_OPTIONS" placeholder="全部来源" clearable class="sel" />
        <n-date-picker
          v-model:value="dateRange"
          type="daterange"
          clearable
          close-on-select
          update-value-on-close
          :is-date-disabled="isFutureDay"
          :shortcuts="dateShortcuts"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="range"
        />
        <n-button v-if="hasFilters" quaternary class="reset" aria-label="重置筛选" @click="resetFilters">
          <template v-if="!appState.isMobile" #icon><n-icon><close-outline /></n-icon></template>
          {{ appState.isMobile ? '重置' : '重置筛选' }}
        </n-button>
        <div class="grow" />
        <n-tooltip :disabled="cycleBackend !== false">
          <template #trigger>
            <span class="noise-switch" :class="{ disabled: cycleBackend === false }">
              <n-switch
                v-model:value="showNoise"
                size="small"
                :disabled="cycleBackend === false"
                aria-label="显示冗余记录"
              />
              <span @click="toggleNoise">显示冗余记录</span>
            </span>
          </template>
          后端未升级，冗余记录无法隐藏
        </n-tooltip>
        <n-tooltip>
          <template #trigger>
            <n-button quaternary circle class="refresh" aria-label="刷新" :loading="table.loading.value" @click="refresh">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </div>

      <div v-if="userId" class="chips">
        <n-tag closable round size="small" type="primary" :bordered="false" @close="setUser(null, '')">
          只看用户：{{ userLabel || `#${userId}` }}<span v-if="userLabel" class="chip-id">#{{ userId }}</span>
        </n-tag>
      </div>

      <n-data-table
        v-if="!appState.isMobile"
        remote
        class="log-table"
        size="small"
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :pagination="table.pagination"
        :row-key="(r: ResetLogView) => r.id"
        :row-class-name="resetLogRowClass"
        :scroll-x="resetLogScrollX"
      >
        <template #empty>
          <div v-if="errorInfo" class="state-block">
            <span class="state-icon"><n-icon :size="26"><cloud-offline-outline /></n-icon></span>
            <div class="state-title">{{ errorInfo.title }}</div>
            <div class="state-desc">{{ errorInfo.desc }}</div>
            <n-button size="small" secondary @click="refresh">重试</n-button>
          </div>
          <n-empty v-else :description="emptyText" />
        </template>
      </n-data-table>

      <template v-else>
        <n-spin :show="table.loading.value">
          <div class="cards">
            <reset-log-card
              v-for="row in table.data.value"
              :key="row.id"
              :log="row"
              @open-user="(l: ResetLogView) => openUser(l)"
              @open-cycle="(l: ResetLogView) => openUser(l, l.cycleId)"
            />
            <template v-if="!table.loading.value && !table.data.value.length">
              <div v-if="errorInfo" class="state-block">
                <span class="state-icon"><n-icon :size="26"><cloud-offline-outline /></n-icon></span>
                <div class="state-title">{{ errorInfo.title }}</div>
                <div class="state-desc">{{ errorInfo.desc }}</div>
                <n-button size="small" secondary @click="refresh">重试</n-button>
              </div>
              <n-empty v-else :description="emptyText" class="cards-empty" />
            </template>
          </div>
        </n-spin>
        <div class="mobile-pager">
          <span class="muted">共 {{ formatNumber(table.pagination.itemCount ?? 0) }} 条</span>
          <n-pagination :page="table.pagination.page" :page-count="pageCount" simple @update:page="goPage" />
        </div>
      </template>
    </n-card>

    <traffic-cycle-drawer
      v-model:show="cycleShow"
      :user-id="cycleUserId"
      :email="cycleEmail"
      :highlight-cycle-id="cycleHighlight"
    />
  </page-container>
</template>

<style scoped>
.num {
  font-variant-numeric: tabular-nums;
}

/* ---- overview tiles (compact version of the login log tiles) ---- */
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.stat {
  --tone: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--card-color);
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.stat:hover {
  border-color: color-mix(in srgb, var(--tone) 35%, transparent);
}
.stat:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--tone) 60%, transparent);
  outline-offset: 2px;
}
.stat.active {
  border-color: color-mix(in srgb, var(--tone) 60%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone) 14%, transparent);
}
.tone-primary {
  --tone: var(--primary-color);
}
.tone-info {
  --tone: var(--info-color);
}
.tone-warning {
  --tone: var(--warning-color);
}
.tone-neutral {
  --tone: var(--text-muted);
}
.stat-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 13%, transparent);
}
.stat-body {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'label label'
    'value hint';
  align-items: baseline;
  column-gap: 8px;
  min-width: 0;
}
.stat-label {
  grid-area: label;
  font-size: 12px;
  color: var(--text-muted);
}
.stat-value {
  grid-area: value;
  font-size: 19px;
  font-weight: 650;
  line-height: 1.25;
  color: var(--text-strong);
}
.stat-hint {
  grid-area: hint;
  min-width: 0;
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat-dash {
  color: var(--text-muted);
}
.stat-dash.loading {
  animation: rl-blink 1.2s ease-in-out infinite;
}
@keyframes rl-blink {
  50% {
    opacity: 0.35;
  }
}

/* ---- list ---- */
.list-card {
  border-radius: 12px;
}
.legacy-alert {
  margin-bottom: 12px;
}
.toolbar {
  margin-bottom: 12px;
}
.search {
  width: 220px;
}
.sel {
  width: 136px;
}
.range {
  width: 250px;
}
.noise-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-color);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.noise-switch.disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: -4px 0 12px;
}
.chip-id {
  margin-left: 6px;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}
.log-table :deep(.n-data-table-td) {
  vertical-align: middle;
}
.log-table :deep(.rl-noise > td) {
  opacity: 0.55;
}
.log-table :deep(.rl-cleared) {
  font-weight: 600;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.log-table :deep(.rl-cleared.zero) {
  font-weight: 400;
  color: var(--text-muted);
}
.log-table :deep(.rl-gap) {
  padding-left: 22px;
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 12px;
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
  max-width: 420px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}
.cards-empty {
  padding: 32px 0;
}
.mobile-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

@media (max-width: 1100px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .stats {
    gap: 8px;
  }
  .stat {
    padding: 10px 12px;
  }
  .stat-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
  }
  .stat-value {
    font-size: 17px;
  }
  .stat-hint {
    display: none;
  }
  .search {
    width: 100%;
  }
  /* Rows at 390px: search / [原因][来源] / [日期][重置][刷新] / [冗余开关] */
  .sel {
    flex: 1;
    min-width: 120px;
  }
  .range {
    flex: 1 1 200px;
    width: auto;
    min-width: 0;
    order: 2;
  }
  .toolbar .reset {
    order: 3;
  }
  .toolbar .refresh {
    order: 3;
  }
  .noise-switch {
    order: 4;
  }
  .toolbar .grow {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stat {
    transition: none;
  }
  .stat-dash.loading {
    animation: none;
  }
}
</style>
