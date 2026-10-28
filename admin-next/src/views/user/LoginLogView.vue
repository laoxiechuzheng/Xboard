<script setup lang="ts">
// 登录记录 (extra page, backend: GET user/loginLog/fetch). Deep links: ?user_id= / ?email= / ?ip=.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import {
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
  NTag,
  NTooltip,
} from 'naive-ui'
import {
  AlertCircleOutline,
  CloseOutline,
  CloudOfflineOutline,
  FingerPrintOutline,
  GlobeOutline,
  PersonAddOutline,
  RefreshOutline,
  SearchOutline,
  ShieldCheckmarkOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import { ApiError } from '@/api/http'
import { fetchLoginLogs, type LoginLog, type LoginLogQuery, type LoginLogType } from '@/api/user'
import { appState } from '@/stores/app'
import { formatNumber } from '@/utils/format'
import LoginLogCard from './login-log/LoginLogCard.vue'
import { buildLoginLogColumns, loginLogRowClass, loginLogScrollX } from './login-log/columns'
import { LOGIN_RESULT_OPTIONS, LOGIN_TYPE_OPTIONS, isFutureDay } from './login-log/meta'

const ROUTE_PATH = '/user/login-log'
const route = useRoute()
const router = useRouter()

// ------------------------------------------------------------------ filters

const emailInput = ref('')
const ipInput = ref('')
const email = ref('')
const ip = ref('')
const userId = ref<number | null>(null)
/** Email shown in the user chip (from the clicked row or the loaded data). */
const userLabel = ref('')
const type = ref<LoginLogType | null>(null)
const result = ref<0 | 1 | null>(null)
const dateRange = ref<[number, number] | null>(null)

let inputTimer: ReturnType<typeof setTimeout> | undefined
watch([emailInput, ipInput], () => {
  clearTimeout(inputTimer)
  inputTimer = setTimeout(() => {
    email.value = emailInput.value.trim()
    ip.value = ipInput.value.trim()
  }, 400)
})
function flushInputs() {
  clearTimeout(inputTimer)
  email.value = emailInput.value.trim()
  ip.value = ipInput.value.trim()
}
onBeforeUnmount(() => clearTimeout(inputTimer))

const DAY_MS = 86400000
function todayStartMs() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const dateShortcuts = {
  今天: () => [todayStartMs(), todayStartMs()] as [number, number],
  最近7天: () => [todayStartMs() - 6 * DAY_MS, todayStartMs()] as [number, number],
  最近30天: () => [todayStartMs() - 29 * DAY_MS, todayStartMs()] as [number, number],
}

const filterQuery = computed<Omit<LoginLogQuery, 'current' | 'pageSize'>>(() => ({
  user_id: userId.value,
  email: email.value || null,
  ip: ip.value || null,
  type: type.value,
  success: result.value,
  // Day boundaries in the browser's time zone; the end day is inclusive.
  start_at: dateRange.value ? Math.floor(dateRange.value[0] / 1000) : null,
  end_at: dateRange.value ? Math.floor(dateRange.value[1] / 1000) + 86399 : null,
}))
const hasFilters = computed(() => Object.values(filterQuery.value).some((v) => v !== null && v !== ''))

const table = usePagedTable<LoginLog>(
  async (q) => {
    const res = await fetchLoginLogs({ ...q, ...filterQuery.value }, { silent: true })
    return { data: res.data ?? [], total: res.total ?? 0 }
  },
  { pageSize: 20, pageSizes: [10, 20, 50, 100], immediate: false },
)
table.pagination.showQuickJumper = true
table.pagination.prefix = ({ itemCount }) => `共 ${formatNumber(itemCount ?? 0)} 条记录`

watch(
  () => JSON.stringify(filterQuery.value),
  () => void table.search(),
)

// Fill the user chip label from loaded rows (deep links only carry the id).
watch(
  () => table.data.value,
  (rows) => {
    if (!userId.value || userLabel.value) return
    const hit = rows.find((r) => r.user_id === userId.value && r.email)
    if (hit?.email) userLabel.value = hit.email
  },
)

// ------------------------------------------------------------------ URL

/** Query this page wrote itself (user filter / chip close / reset / preset); see applyQuery. */
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

function filterByUser(row: LoginLog) {
  clearTimeout(inputTimer)
  emailInput.value = ''
  email.value = ''
  userId.value = row.user_id
  userLabel.value = row.email ?? ''
  replaceQuery({ user_id: String(row.user_id) })
}

function filterByIp(value: string) {
  ipInput.value = value
  flushInputs()
}

function clearUser() {
  userId.value = null
  userLabel.value = ''
  if (route.query.user_id !== undefined) {
    const rest = { ...route.query }
    delete rest.user_id
    replaceQuery(rest)
  }
}

function resetFilters() {
  clearTimeout(inputTimer)
  emailInput.value = ''
  ipInput.value = ''
  email.value = ''
  ip.value = ''
  userId.value = null
  userLabel.value = ''
  type.value = null
  result.value = null
  dateRange.value = null
  replaceQuery({})
}

/**
 * On mount and on any navigation from outside the page (sidebar, back/forward, edited URL) the URL is the whole
 * filter state: ?user_id= / ?email= / ?ip= are applied and every other filter is cleared, so a stale input never
 * narrows a deep link unnoticed. The page's own query writes (own = true) only sync user_id.
 */
function applyQuery(q: LocationQuery, own = false) {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? String(v[0] ?? '').trim() : '')
  const id = str(q.user_id)
  const nextId = /^\d+$/.test(id) && Number(id) > 0 ? Number(id) : null
  if (nextId !== userId.value) userLabel.value = ''
  userId.value = nextId
  if (own) return
  emailInput.value = str(q.email)
  ipInput.value = str(q.ip)
  flushInputs()
  type.value = null
  result.value = null
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

// ------------------------------------------------------------------ today overview (counts via pageSize=1)

type PresetKey = 'ok' | 'fail' | 'register' | 'all'
const stats = shallowRef<Record<PresetKey, number | null>>({ ok: null, fail: null, register: null, all: null })
const statsLoading = ref(false)

async function loadStats() {
  statsLoading.value = true
  const since = Math.floor(todayStartMs() / 1000)
  const count = (extra: Partial<LoginLogQuery>) =>
    fetchLoginLogs({ current: 1, pageSize: 1, ...extra }, { silent: true }).then((r) => Number(r.total ?? 0))
  const settled = await Promise.allSettled([
    count({ success: 1, start_at: since }),
    count({ success: 0, start_at: since }),
    count({ type: 'register', start_at: since }),
    count({}),
  ])
  const val = (i: number) => (settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<number>).value : null)
  stats.value = { ok: val(0), fail: val(1), register: val(2), all: val(3) }
  statsLoading.value = false
}

function isToday(range: [number, number] | null) {
  const t = todayStartMs()
  return !!range && range[0] === t && range[1] === t
}
const noOtherFilters = computed(() => !userId.value && !email.value && !ip.value)
const activePreset = computed<PresetKey | null>(() => {
  if (!noOtherFilters.value) return null
  if (!dateRange.value && type.value === null && result.value === null) return 'all'
  if (!isToday(dateRange.value)) return null
  if (type.value === null && result.value === 1) return 'ok'
  if (type.value === null && result.value === 0) return 'fail'
  if (type.value === 'register' && result.value === null) return 'register'
  return null
})

const statCards = computed<{ key: PresetKey; label: string; hint: string; icon: Component; tone: string }[]>(() => [
  { key: 'ok', label: '今日成功', hint: '今天成功的登录与注册', icon: ShieldCheckmarkOutline, tone: 'success' },
  { key: 'fail', label: '今日失败', hint: '今天密码错误的登录尝试', icon: AlertCircleOutline, tone: 'error' },
  { key: 'register', label: '今日注册', hint: '今天新注册的账号', icon: PersonAddOutline, tone: 'info' },
  { key: 'all', label: '全部记录', hint: '保留最近 6 个月', icon: FingerPrintOutline, tone: 'primary' },
])

function applyPreset(key: PresetKey) {
  if (key === 'all') {
    resetFilters()
    return
  }
  clearTimeout(inputTimer)
  emailInput.value = ''
  ipInput.value = ''
  email.value = ''
  ip.value = ''
  userId.value = null
  userLabel.value = ''
  type.value = key === 'register' ? 'register' : null
  result.value = key === 'ok' ? 1 : key === 'fail' ? 0 : null
  const t = todayStartMs()
  dateRange.value = [t, t]
  replaceQuery({})
}

function refresh() {
  void table.reload()
  void loadStats()
}

// ------------------------------------------------------------------ table / cards

const columns = computed(() =>
  buildLoginLogColumns({
    showUser: true,
    activeUserId: userId.value,
    onFilterUser: filterByUser,
    onFilterIp: filterByIp,
  }),
)
const scrollX = loginLogScrollX(true)

const errorInfo = computed(() => {
  const e = table.error.value
  if (!e) return null
  if (e instanceof ApiError && e.status === 404) {
    return { title: '当前面板还没有登录记录接口', desc: '升级面板（含 v2_user_login_log 数据表迁移）后即可查看登录记录。' }
  }
  return { title: '登录记录加载失败', desc: e instanceof Error && e.message ? e.message : '请稍后重试' }
})
const emptyText = computed(() => (hasFilters.value ? '没有符合条件的登录记录' : '暂无登录记录'))

const pageCount = computed(() =>
  Math.max(1, Math.ceil((table.pagination.itemCount ?? 0) / (table.pagination.pageSize ?? 20))),
)
function goPage(p: number) {
  table.pagination.page = p
  void table.reload()
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
    title="登录记录"
    description="用户每次登录、注册与链接登录的 IP、归属地和设备，密码错误的尝试同样会记录，保留 6 个月。"
  >
    <div class="stats">
      <button
        v-for="s in statCards"
        :key="s.key"
        type="button"
        class="stat"
        :class="[`tone-${s.tone}`, { active: activePreset === s.key }]"
        :title="s.key === 'all' ? '清除筛选，查看全部记录' : `只看${s.label}`"
        @click="applyPreset(s.key)"
      >
        <span class="stat-icon"><n-icon :size="18"><component :is="s.icon" /></n-icon></span>
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
      <div class="toolbar">
        <n-input v-model:value="emailInput" placeholder="用户邮箱" clearable class="search" @keyup.enter="flushInputs">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-input v-model:value="ipInput" placeholder="IP 前缀，如 223.5." clearable class="ip" @keyup.enter="flushInputs">
          <template #prefix><n-icon><globe-outline /></n-icon></template>
        </n-input>
        <n-select v-model:value="type" :options="LOGIN_TYPE_OPTIONS" placeholder="全部类型" clearable class="sel" />
        <n-select v-model:value="result" :options="LOGIN_RESULT_OPTIONS" placeholder="全部结果" clearable class="sel-sm" />
        <!-- close-on-select: the second date applies the range (no 确认 click needed, also on phones where
             global.css shows a single calendar); update-value-on-close keeps a half-picked range on outside click. -->
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
        <!-- Phones: short label; CSS order moves it beside the two selects so the date row keeps its width. -->
        <n-button v-if="hasFilters" quaternary class="reset" aria-label="重置筛选" @click="resetFilters">
          <template v-if="!appState.isMobile" #icon><n-icon><close-outline /></n-icon></template>
          {{ appState.isMobile ? '重置' : '重置筛选' }}
        </n-button>
        <div class="grow" />
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
        <n-tag closable round size="small" type="primary" :bordered="false" @close="clearUser">
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
        :row-key="(r: LoginLog) => r.id"
        :row-class-name="loginLogRowClass"
        :scroll-x="scrollX"
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
            <login-log-card
              v-for="row in table.data.value"
              :key="row.id"
              :log="row"
              show-user
              filterable-ip
              @filter-user="filterByUser"
              @filter-ip="filterByIp"
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
          <n-pagination
            :page="table.pagination.page"
            :page-count="pageCount"
            simple
            @update:page="goPage"
          />
        </div>
      </template>
    </n-card>
  </page-container>
</template>

<style scoped>
.num {
  font-variant-numeric: tabular-nums;
}

/* ---- overview tiles ---- */
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.stat {
  --tone: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--card-color);
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}
.stat::after {
  content: '';
  position: absolute;
  inset: auto -30% -60% auto;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--tone) 16%, transparent), transparent 70%);
  pointer-events: none;
}
.stat:hover {
  border-color: color-mix(in srgb, var(--tone) 35%, transparent);
  transform: translateY(-1px);
}
.stat:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--tone) 60%, transparent);
  outline-offset: 2px;
}
.stat.active {
  border-color: color-mix(in srgb, var(--tone) 60%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone) 14%, transparent);
}
.tone-success {
  --tone: var(--success-color);
}
.tone-error {
  --tone: var(--error-color);
}
.tone-info {
  --tone: var(--info-color);
}
.tone-primary {
  --tone: var(--primary-color);
}
.stat-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 13%, transparent);
}
.stat-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.stat-label {
  font-size: 12px;
  color: var(--text-muted);
}
.stat-value {
  font-size: 22px;
  font-weight: 650;
  line-height: 1.25;
  color: var(--text-strong);
}
.stat-hint {
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
  animation: ll-blink 1.2s ease-in-out infinite;
}
@keyframes ll-blink {
  50% {
    opacity: 0.35;
  }
}

/* ---- list ---- */
.list-card {
  border-radius: 12px;
}
.toolbar {
  margin-bottom: 12px;
}
.search {
  width: 220px;
}
.ip {
  width: 200px;
}
.sel {
  width: 128px;
}
.sel-sm {
  width: 116px;
}
.range {
  width: 250px;
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
.log-table :deep(.ll-fail > td) {
  --n-merged-td-color: color-mix(in srgb, var(--error-color) 5%, var(--card-color));
}
.log-table :deep(.ll-fail > td:first-child) {
  box-shadow: inset 3px 0 0 var(--error-color);
}
.log-table :deep(.ll-origin) {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-color);
}
.log-table :deep(.n-data-table-td) {
  vertical-align: middle;
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
    padding: 12px;
    gap: 10px;
  }
  .stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
  }
  .stat-value {
    font-size: 19px;
  }
  .stat-hint {
    display: none;
  }
  .search,
  .ip {
    width: 100%;
  }
  /*
   * Rows at 390px: email / IP / [类型][结果][重置] / [日期范围][刷新]. 重置 joins the selects (order), so the date
   * range keeps a full-width row and the end date is never clipped when a filter becomes active.
   */
  .range {
    flex: 1 1 200px;
    width: auto;
    min-width: 0;
    order: 2;
  }
  .toolbar .refresh {
    order: 3;
  }
  .sel,
  .sel-sm {
    flex: 1;
    min-width: 110px;
  }
  .toolbar .grow {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stat {
    transition: none;
  }
  .stat:hover {
    transform: none;
  }
  .stat-dash.loading {
    animation: none;
  }
}
</style>
