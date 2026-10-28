<script setup lang="ts">
// 流量重置日志 (spec users.md §12). Fixes the official page: total from pagination.total,
// readable time formats, working export (with BOM), complete type/source filters.
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import {
  NCard,
  NDataTable,
  NButton,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NDatePicker,
  NTag,
  NTooltip,
  NEmpty,
  NSpin,
  type DataTableColumns,
} from 'naive-ui'
import {
  SearchOutline,
  DownloadOutline,
  CloseOutline,
  RefreshOutline,
  PersonCircleOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import {
  fetchTrafficResetLogs,
  fetchTrafficResetStats,
  RESET_TYPE_OPTIONS,
  TRIGGER_SOURCE_OPTIONS,
  resetTypeLabel,
  triggerSourceLabel,
  type TrafficResetLog,
  type TrafficResetLogQuery,
  type TrafficResetStats,
} from '@/api/trafficReset'
import { saveFile } from '@/utils/clipboard'
import { message } from '@/utils/discrete'
import { GB, formatNumber, formatTime } from '@/utils/format'
import { sourceColor, sourceDesc, typeColor } from './traffic-reset/badges'

const route = useRoute()
const router = useRouter()

// ------------------------------------------------------------------ filters

const keyword = ref('')
const userEmail = ref('')
const userId = ref<number | null>(null)
const resetType = ref<string | null>(null)
const triggerSource = ref<string | null>(null)
const dateRange = ref<[number, number] | null>(null)

let kwTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, (v) => {
  clearTimeout(kwTimer)
  kwTimer = setTimeout(() => (userEmail.value = v.trim()), 300)
})
onBeforeUnmount(() => clearTimeout(kwTimer))

function ymd(ms: number) {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const filterQuery = computed<Omit<TrafficResetLogQuery, 'page' | 'per_page'>>(() => ({
  user_email: userEmail.value || null,
  user_id: userId.value,
  reset_type: resetType.value,
  trigger_source: triggerSource.value,
  start_date: dateRange.value ? ymd(dateRange.value[0]) : null,
  end_date: dateRange.value ? ymd(dateRange.value[1]) : null,
}))
const hasFilters = computed(() => Object.values(filterQuery.value).some((v) => v !== null && v !== ''))

const table = usePagedTable<TrafficResetLog>(
  async (q) => {
    const res = await fetchTrafficResetLogs({ ...filterQuery.value, page: q.current, per_page: q.pageSize })
    return { data: res.data ?? [], total: res.pagination?.total ?? 0 }
  },
  { pageSize: 20, pageSizes: [10, 20, 50, 100], immediate: false },
)
table.pagination.showQuickJumper = true
table.pagination.prefix = ({ itemCount }) => `共 ${formatNumber(itemCount ?? 0)} 条`

watch(
  () => JSON.stringify(filterQuery.value),
  () => void table.search(),
)

function resetFilters() {
  clearTimeout(kwTimer)
  keyword.value = ''
  userEmail.value = ''
  userId.value = null
  resetType.value = null
  triggerSource.value = null
  dateRange.value = null
  if (Object.keys(route.query).length) void router.replace({ query: {} })
}

function applyQuery(q: LocationQuery) {
  const id = typeof q.user_id === 'string' && /^\d+$/.test(q.user_id) ? Number(q.user_id) : null
  const email = typeof q.user_email === 'string' ? q.user_email.trim() : ''
  userId.value = id
  if (email) {
    clearTimeout(kwTimer)
    keyword.value = email
    userEmail.value = email
  }
}

watch(
  () => route.query,
  (q) => {
    if (route.path === '/user/traffic-reset-logs') applyQuery(q)
  },
)

// ------------------------------------------------------------------ stats (not in the official UI)

const STAT_RANGES = [
  { label: '最近一周', value: 7 },
  { label: '最近一月', value: 30 },
  { label: '最近三月', value: 90 },
  { label: '最近一年', value: 365 },
]
const statDays = ref(30)
const stats = ref<TrafficResetStats | null>(null)
const statsLoading = ref(false)

async function loadStats() {
  statsLoading.value = true
  try {
    stats.value = await fetchTrafficResetStats(statDays.value)
  } catch {
    stats.value = null
  } finally {
    statsLoading.value = false
  }
}
watch(statDays, () => void loadStats())

const statCards = computed(() => {
  const s = stats.value
  const other = s ? Math.max(0, s.total_resets - s.auto_resets - s.manual_resets - s.cron_resets) : 0
  const pct = (n: number) => (s && s.total_resets ? `${((n / s.total_resets) * 100).toFixed(1)}%` : '—')
  return [
    { key: 'total', label: '总重置次数', value: s?.total_resets ?? 0, sub: `最近 ${statDays.value} 天` },
    { key: 'cron', label: '定时重置', value: s?.cron_resets ?? 0, sub: `占比 ${pct(s?.cron_resets ?? 0)}` },
    { key: 'manual', label: '手动重置', value: s?.manual_resets ?? 0, sub: `占比 ${pct(s?.manual_resets ?? 0)}` },
    { key: 'auto', label: '自动重置', value: s?.auto_resets ?? 0, sub: `占比 ${pct(s?.auto_resets ?? 0)}` },
    { key: 'other', label: '其他来源', value: other, sub: '用户访问 / 订单 / 礼品卡等' },
  ]
})

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
    const rows = res.data ?? []
    if (!rows.length) {
      message.warning('没有可导出的日志')
      return
    }
    const head = ['ID', '用户邮箱', '用户ID', '重置类型', '触发源', '清零流量', '上传流量(GB)', '下载流量(GB)', '重置时间', '记录时间']
    const lines = [head.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.user_email,
          r.user_id,
          resetTypeLabel(r.reset_type, r.reset_type_name),
          triggerSourceLabel(r.trigger_source, r.trigger_source_name),
          r.old_traffic?.formatted,
          (Number(r.old_traffic?.upload ?? 0) / GB).toFixed(2),
          (Number(r.old_traffic?.download ?? 0) / GB).toFixed(2),
          formatTime(r.reset_time),
          formatTime(r.created_at),
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
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

// ------------------------------------------------------------------ columns

function openUser(email: string) {
  if (!email || email === 'N/A') return
  void router.push({ path: '/user/manage', query: { email } })
}

function metadataText(m: Record<string, unknown> | null): string {
  if (!m || typeof m !== 'object') return ''
  if (typeof m.reason === 'string' && m.reason) return m.reason
  const entries = Object.entries(m).filter(([, v]) => v !== null && v !== '')
  return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('；')
}

const columns = computed<DataTableColumns<TrafficResetLog>>(() => [
  {
    title: '日志ID',
    key: 'id',
    width: 90,
    render: (r) => h(NTag, { size: 'small' }, { default: () => h('span', { class: 'num' }, String(r.id)) }),
  },
  {
    title: '用户',
    key: 'user_email',
    minWidth: 220,
    render: (r) =>
      h('div', { class: 'user-cell' }, [
        h(NIcon, { size: 22, class: 'user-icon' }, { default: () => h(PersonCircleOutline) }),
        h('div', { class: 'user-text' }, [
          r.user_email && r.user_email !== 'N/A'
            ? h('button', { type: 'button', class: 'user-link', onClick: () => openUser(r.user_email) }, r.user_email)
            : h('span', { class: 'muted' }, '用户已删除'),
          h('div', { class: 'user-id num' }, `ID: ${r.user_id}`),
        ]),
      ]),
  },
  {
    title: '触发源',
    key: 'trigger_source',
    width: 130,
    render: (r) =>
      h(NTooltip, null, {
        trigger: () =>
          h(
            NTag,
            { size: 'small', round: true, color: sourceColor(r.trigger_source) },
            { default: () => triggerSourceLabel(r.trigger_source, r.trigger_source_name) },
          ),
        default: () => [
          h('div', { style: 'font-weight:600' }, triggerSourceLabel(r.trigger_source, r.trigger_source_name)),
          h('div', null, sourceDesc(r.trigger_source)),
        ],
      }),
  },
  {
    title: '重置类型',
    key: 'reset_type',
    width: 140,
    render: (r) =>
      h(
        NTag,
        { size: 'small', round: true, color: typeColor(r.reset_type) },
        { default: () => resetTypeLabel(r.reset_type, r.reset_type_name) },
      ),
  },
  {
    title: '清除流量',
    key: 'old_traffic',
    width: 130,
    align: 'center',
    render: (r) =>
      h(NTooltip, null, {
        trigger: () =>
          h('div', { class: 'cleared' }, [
            h('div', { class: 'cleared-num num' }, r.old_traffic?.formatted ?? '0 B'),
            h('div', { class: 'cleared-sub' }, '已清除'),
          ]),
        default: () => [
          h('div', null, `上传: ${(Number(r.old_traffic?.upload ?? 0) / GB).toFixed(2)} GB`),
          h('div', null, `下载: ${(Number(r.old_traffic?.download ?? 0) / GB).toFixed(2)} GB`),
        ],
      }),
  },
  {
    title: '重置时间',
    key: 'reset_time',
    width: 170,
    render: (r) => h('span', { class: 'num' }, formatTime(r.reset_time)),
  },
  {
    title: '记录时间',
    key: 'created_at',
    width: 170,
    render: (r) => h('span', { class: 'num muted' }, formatTime(r.created_at)),
  },
  {
    title: '附加信息',
    key: 'metadata',
    minWidth: 140,
    ellipsis: { tooltip: true },
    render: (r) => metadataText(r.metadata) || h('span', { class: 'muted' }, '-'),
  },
])

onMounted(() => {
  // A changed filter triggers the filterQuery watcher; only search explicitly when nothing changed.
  const before = JSON.stringify(filterQuery.value)
  applyQuery(route.query)
  if (JSON.stringify(filterQuery.value) === before) void table.search()
  void loadStats()
})
</script>

<template>
  <page-container title="流量重置日志" description="查看系统中所有流量重置操作的详细记录">
    <template #extra>
      <n-button :loading="exporting" @click="exportLogs">
        <template #icon><n-icon><download-outline /></n-icon></template>
        {{ exporting ? '导出中...' : '导出日志' }}
      </n-button>
    </template>

    <n-card :bordered="false" class="stats-card" content-style="padding: 14px 16px">
      <div class="stats-head">
        <span class="stats-title">流量重置统计</span>
        <n-select v-model:value="statDays" :options="STAT_RANGES" size="small" class="range" />
      </div>
      <n-spin :show="statsLoading">
        <div class="stats">
          <div v-for="c in statCards" :key="c.key" class="stat">
            <div class="stat-label">{{ c.label }}</div>
            <div class="stat-value num">{{ formatNumber(c.value) }}</div>
            <div class="stat-sub">{{ c.sub }}</div>
          </div>
        </div>
      </n-spin>
    </n-card>

    <n-card :bordered="false" class="list-card" content-style="padding: 16px">
      <div class="toolbar">
        <n-input v-model:value="keyword" placeholder="搜索用户邮箱..." clearable class="search">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-input-number v-model:value="userId" placeholder="用户ID" :min="1" :precision="0" :show-button="false" clearable class="uid" />
        <n-select v-model:value="resetType" :options="RESET_TYPE_OPTIONS" placeholder="全部类型" clearable class="sel" />
        <n-select v-model:value="triggerSource" :options="TRIGGER_SOURCE_OPTIONS" placeholder="全部来源" clearable class="sel" />
        <n-date-picker
          v-model:value="dateRange"
          type="daterange"
          clearable
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="range-picker"
        />
        <n-button v-if="hasFilters" quaternary @click="resetFilters">
          <template #icon><n-icon><close-outline /></n-icon></template>
          重置筛选
        </n-button>
        <div class="grow" />
        <n-button quaternary circle aria-label="刷新" :loading="table.loading.value" @click="table.reload()">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
        </n-button>
      </div>

      <n-data-table
        remote
        class="log-table"
        size="small"
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :pagination="table.pagination"
        :row-key="(r: TrafficResetLog) => r.id"
        :scroll-x="1180"
      >
        <template #empty>
          <n-empty :description="hasFilters ? '没有符合条件的重置记录' : '暂无重置记录'" />
        </template>
      </n-data-table>
      <div class="foot-hint muted">日期筛选按服务器时区比较；“订单开通”“礼品卡兑换”来源的记录只在列表中显示，后端不支持按这两种来源筛选。</div>
    </n-card>
  </page-container>
</template>

<style scoped>
.stats-card,
.list-card {
  border-radius: 12px;
}
.stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.stats-title {
  font-size: 14px;
  font-weight: 600;
}
.range {
  width: 120px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.stat {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--hover-color);
}
.stat-label {
  font-size: 12px;
  color: var(--text-muted);
}
.stat-value {
  margin-top: 2px;
  font-size: 22px;
  font-weight: 650;
  color: var(--text-strong);
}
.stat-sub {
  font-size: 12px;
  color: var(--text-muted);
}
.toolbar {
  margin-bottom: 12px;
}
.search {
  width: 220px;
}
.uid {
  width: 110px;
}
.sel {
  width: 150px;
}
.range-picker {
  width: 260px;
}
.num,
.log-table :deep(.num) {
  font-variant-numeric: tabular-nums;
}
.log-table :deep(.muted) {
  color: var(--text-muted);
}
.log-table :deep(.user-cell) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.log-table :deep(.user-icon) {
  color: var(--text-muted);
  flex: none;
}
.log-table :deep(.user-text) {
  min-width: 0;
}
.log-table :deep(.user-link) {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--text-strong);
  cursor: pointer;
  text-align: left;
  word-break: break-all;
}
.log-table :deep(.user-link:hover) {
  color: var(--primary-color);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.log-table :deep(.user-id) {
  font-size: 12px;
  color: var(--text-muted);
}
.log-table :deep(.cleared-num) {
  font-weight: 600;
  color: var(--error-color);
}
.log-table :deep(.cleared-sub) {
  font-size: 11px;
  color: var(--text-muted);
}
.foot-hint {
  margin-top: 10px;
  font-size: 12px;
}
@media (max-width: 767px) {
  .search,
  .range-picker {
    width: 100%;
  }
  .uid,
  .sel {
    flex: 1;
    min-width: 120px;
  }
  .toolbar .grow {
    display: none;
  }
}
</style>
