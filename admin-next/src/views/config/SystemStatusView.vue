<script setup lang="ts">
// System status (spec platform §6.3): scheduler / Horizon status, queue stats, workload, masters, failed jobs.
// Read-only; refreshed every 30s; each block loads and fails independently.
import { computed, h, ref } from 'vue'
import {
  NCard,
  NButton,
  NIcon,
  NTag,
  NDataTable,
  NCollapse,
  NCollapseItem,
  NAlert,
  NEmpty,
  NSpace,
  type DataTableColumns,
} from 'naive-ui'
import { RefreshOutline, AlarmOutline, LayersOutline, CheckmarkCircle, AlertCircle } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import {
  getSystemStatus,
  getQueueStats,
  getQueueWorkload,
  getQueueMasters,
  formatMinutes,
  longestWait,
  type HorizonSupervisor,
} from '@/api/system'
import { formatNumber, formatTime } from '@/utils/format'
import { clockTime, sinceText, useAsyncState, usePolling } from '@/views/dashboard/composables'
import SectionState from './system-status/SectionState.vue'
import FailedJobsTable from './system-status/FailedJobsTable.vue'
import { formatSeconds } from './system-status/helpers'

const sys = useAsyncState(() => getSystemStatus({ silent: true }))
const stats = useAsyncState(() => getQueueStats({ silent: true }))
const workload = useAsyncState(() => getQueueWorkload({ silent: true }))
const masters = useAsyncState(() => getQueueMasters({ silent: true }))
const failedRef = ref<InstanceType<typeof FailedJobsTable> | null>(null)

// The masters endpoint is Horizon's own controller guarded by viewHorizon; production answers 403.
const mastersForbidden = computed(() => masters.errorStatus.value === 403)

const refreshing = ref(false)
let firstRun = true

async function loadAll(manual: boolean) {
  const tasks: Promise<unknown>[] = [sys.run(), stats.run(), workload.run()]
  // Do not keep polling an endpoint that is known to be forbidden; manual refresh still retries.
  if (manual || !mastersForbidden.value) tasks.push(masters.run())
  // Silent like the other blocks: a failure shows inline in the block instead of a toast per poll.
  if (!firstRun && failedRef.value) tasks.push(failedRef.value.reload({ silent: true }))
  firstRun = false
  await Promise.all(tasks)
}

// Header time = newest successful load of any block (polls, manual refresh and per-block retries),
// never advanced by a failed request; failures are flagged next to it.
const updatedAt = computed(() => {
  const last = Math.max(
    sys.lastSuccess.value,
    stats.lastSuccess.value,
    workload.lastSuccess.value,
    masters.lastSuccess.value,
    failedRef.value?.lastSuccess ?? 0,
  )
  return last ? clockTime(new Date(last)) : ''
})
const failedBlocks = computed(() => {
  const errs = [sys.error.value, stats.error.value, workload.error.value, failedRef.value?.error ?? '']
  // A 403 on masters is an expected deployment limit with its own notice, not a refresh failure.
  if (!mastersForbidden.value) errs.push(masters.error.value)
  return { failed: errs.filter(Boolean).length, total: errs.length }
})
const refreshHint = computed(() => {
  const { failed, total } = failedBlocks.value
  if (!failed) return ''
  return failed === total ? '刷新失败' : '部分区块刷新失败'
})

let manual = false
const poll = usePolling(() => loadAll(manual), 30_000)
async function refreshAll() {
  refreshing.value = true
  manual = true
  try {
    await poll()
  } finally {
    manual = false
    refreshing.value = false
  }
}

// ---------------------------------------------------------------- overview

interface OverviewCell {
  key: string
  label: string
  value: string
  sub?: string
  tone?: 'danger' | 'warning'
  mono?: boolean
  onClick?: () => void
}

function scrollToFailed() {
  document.getElementById('failed-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const overview = computed<OverviewCell[]>(() => {
  const s = stats.data.value
  if (!s) return []
  const w = longestWait(s.wait)
  return [
    { key: 'recent', label: '近期任务数', value: formatNumber(s.recentJobs), sub: `最近 ${formatMinutes(s.periods.recentJobs)}` },
    { key: 'perMinute', label: '每分钟处理量', value: formatNumber(s.jobsPerMinute), sub: '基于 Horizon 指标快照' },
    {
      key: 'failed',
      label: '失败任务数',
      value: formatNumber(s.failedJobs),
      sub: `最近 ${formatMinutes(s.periods.failedJobs)} · 点击查看`,
      tone: 'danger',
      onClick: scrollToFailed,
    },
    {
      key: 'processes',
      label: '活跃进程',
      value: formatNumber(s.processes),
      sub: s.pausedMasters > 0 ? `${s.pausedMasters} 个主进程已暂停` : '无暂停的主进程',
      tone: s.pausedMasters > 0 ? 'warning' : undefined,
    },
    { key: 'wait', label: '当前最长等待', value: formatSeconds(w.seconds), sub: w.queue ? `队列 ${w.queue}` : '无队列数据' },
    { key: 'throughput', label: '吞吐量最高队列', value: s.queueWithMaxThroughput || '—', mono: true },
    { key: 'runtime', label: '运行最久队列', value: s.queueWithMaxRuntime || '—', mono: true },
  ]
})

// ---------------------------------------------------------------- workload

interface WorkloadRow {
  key: string
  name: string
  length: number
  wait: number
  processes: number | null
  children?: WorkloadRow[]
}

const workloadRows = computed<WorkloadRow[]>(() =>
  (workload.data.value ?? []).map((q) => ({
    key: q.name,
    name: q.name,
    length: q.length,
    wait: q.wait,
    processes: q.processes,
    children: q.split_queues?.length
      ? q.split_queues.map((c) => ({ key: `${q.name}/${c.name}`, name: c.name, length: c.length, wait: c.wait, processes: null }))
      : undefined,
  })),
)
const pendingTotal = computed(() => (workload.data.value ?? []).reduce((sum, q) => sum + q.length, 0))

const workloadColumns: DataTableColumns<WorkloadRow> = [
  { title: '队列', key: 'name', minWidth: 160, render: (r) => h('span', { class: 'mono' }, r.name) },
  { title: '待处理', key: 'length', width: 110, align: 'right', render: (r) => h('span', { class: 'tnum' }, formatNumber(r.length)) },
  {
    title: '预计等待',
    key: 'wait',
    width: 140,
    align: 'right',
    render: (r) =>
      r.wait > 60
        ? h(NTag, { size: 'small', bordered: false, type: r.wait > 300 ? 'error' : 'warning' }, { default: () => formatSeconds(r.wait) })
        : h('span', { class: 'tnum' }, formatSeconds(r.wait)),
  },
  {
    title: '进程数',
    key: 'processes',
    width: 100,
    align: 'right',
    render: (r) => h('span', { class: 'tnum' }, r.processes === null ? '—' : formatNumber(r.processes)),
  },
]

// ---------------------------------------------------------------- masters

const STATUS_TAG: Record<string, { type: 'success' | 'warning' | 'default'; label: string }> = {
  running: { type: 'success', label: '运行中' },
  paused: { type: 'warning', label: '已暂停' },
}
const statusTag = (status?: string) => STATUS_TAG[status ?? ''] ?? { type: 'default' as const, label: status || '—' }

const BALANCE_LABEL: Record<string, string> = { auto: '自动', simple: '简单', false: '关闭' }
const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

const masterList = computed(() => masters.data.value ?? [])
const expandedMasters = ref<string[] | null>(null)
const expandedNames = computed(() => expandedMasters.value ?? masterList.value.map((m) => m.name))

const supervisorColumns = (master: string): DataTableColumns<HorizonSupervisor> => [
  {
    title: '名称',
    key: 'name',
    minWidth: 150,
    render: (r) => h('span', { class: 'mono' }, r.name.startsWith(`${master}:`) ? r.name.slice(master.length + 1) : r.name),
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render: (r) => {
      const t = statusTag(r.status)
      return h(NTag, { size: 'small', bordered: false, type: t.type }, { default: () => t.label })
    },
  },
  { title: 'PID', key: 'pid', width: 80, render: (r) => h('span', { class: 'mono' }, dash(r.pid)) },
  {
    title: '进程数',
    key: 'processes',
    width: 80,
    align: 'right',
    render: (r) =>
      h('span', { class: 'tnum' }, r.processes ? formatNumber(Object.values(r.processes).reduce((a, b) => a + Number(b || 0), 0)) : '—'),
  },
  {
    title: '队列',
    key: 'queue',
    minWidth: 220,
    render: (r) => {
      const qs = String(r.options?.queue ?? '')
        .split(',')
        .map((q) => q.trim())
        .filter(Boolean)
      if (!qs.length) return '—'
      return h(NSpace, { size: 4 }, { default: () => qs.map((q) => h(NTag, { size: 'small', bordered: false }, { default: () => q })) })
    },
  },
  {
    title: '均衡策略',
    key: 'balance',
    width: 90,
    render: (r) => {
      const b = r.options?.balance
      return b === undefined || b === null ? '—' : BALANCE_LABEL[String(b)] ?? String(b)
    },
  },
  {
    title: '进程范围',
    key: 'range',
    width: 90,
    render: (r) => h('span', { class: 'tnum' }, `${dash(r.options?.minProcesses)} ~ ${dash(r.options?.maxProcesses)}`),
  },
  {
    title: '超时',
    key: 'timeout',
    width: 80,
    render: (r) => h('span', { class: 'tnum' }, r.options?.timeout !== undefined ? `${r.options.timeout} 秒` : '—'),
  },
  { title: '最大尝试', key: 'tries', width: 90, render: (r) => h('span', { class: 'tnum' }, dash(r.options?.maxTries)) },
]
</script>

<template>
  <page-container title="系统状态" description="计划任务、队列服务（Horizon）的运行情况与失败任务，每 30 秒自动刷新。">
    <template #extra>
      <span v-if="updatedAt || refreshHint" class="updated">
        <template v-if="updatedAt">更新于 {{ updatedAt }}</template>
        <span v-if="refreshHint" class="warn">{{ updatedAt ? ' · ' : '' }}{{ refreshHint }}</span>
      </span>
      <n-button size="small" :loading="refreshing" @click="refreshAll">
        <template #icon>
          <n-icon><refresh-outline /></n-icon>
        </template>
        刷新
      </n-button>
    </template>

    <!-- 1. Runtime status -->
    <n-card title="运行状态">
      <section-state :loading="sys.loading.value" :error="sys.error.value" :has-data="!!sys.data.value" @retry="sys.run">
        <div v-if="sys.data.value" class="tiles">
          <div class="tile" :class="sys.data.value.schedule ? 'ok' : 'bad'">
            <div class="tile-head">
              <span class="tile-title">
                <n-icon :size="18"><alarm-outline /></n-icon>
                计划任务
              </span>
              <n-tag :type="sys.data.value.schedule ? 'success' : 'error'" round :bordered="false">
                <template #icon>
                  <n-icon><checkmark-circle v-if="sys.data.value.schedule" /><alert-circle v-else /></n-icon>
                </template>
                {{ sys.data.value.schedule ? '运行中' : '未运行' }}
              </n-tag>
            </div>
            <div class="tile-meta">
              最近一次运行：
              <template v-if="sys.data.value.schedule_last_runtime">
                <span class="tnum">{{ formatTime(sys.data.value.schedule_last_runtime) }}</span>
                <span class="muted">（{{ sinceText(sys.data.value.schedule_last_runtime) }}）</span>
              </template>
              <span v-else class="muted">从未运行</span>
            </div>
            <div v-if="!sys.data.value.schedule" class="tile-tip">
              超过 2 分钟没有调度心跳。请检查 <code>php artisan schedule:run</code> 是否每分钟执行（cron / supervisor）。
            </div>
          </div>

          <div class="tile" :class="sys.data.value.horizon ? 'ok' : 'bad'">
            <div class="tile-head">
              <span class="tile-title">
                <n-icon :size="18"><layers-outline /></n-icon>
                队列服务（Horizon）
              </span>
              <n-tag :type="sys.data.value.horizon ? 'success' : 'error'" round :bordered="false">
                <template #icon>
                  <n-icon><checkmark-circle v-if="sys.data.value.horizon" /><alert-circle v-else /></n-icon>
                </template>
                {{ sys.data.value.horizon ? '运行中' : '未运行或已暂停' }}
              </n-tag>
            </div>
            <div class="tile-meta">
              <template v-if="stats.data.value">
                活跃进程 <b class="tnum">{{ formatNumber(stats.data.value.processes) }}</b>
                <span v-if="stats.data.value.pausedMasters" class="warn">
                  · {{ stats.data.value.pausedMasters }} 个主进程已暂停
                </span>
              </template>
              <span v-else class="muted">进程信息加载中</span>
            </div>
            <div v-if="!sys.data.value.horizon" class="tile-tip">
              请检查 <code>php artisan horizon</code> 进程是否在运行，或是否被 <code>horizon:pause</code> 暂停。
            </div>
          </div>
        </div>
      </section-state>
    </n-card>

    <!-- 2. Queue overview -->
    <n-card title="队列概览">
      <template #header-extra>
        <n-tag v-if="stats.data.value" :type="stats.data.value.status ? 'success' : 'error'" size="small" :bordered="false">
          {{ stats.data.value.status ? '队列正常' : '队列异常' }}
        </n-tag>
      </template>
      <section-state :loading="stats.loading.value" :error="stats.error.value" :has-data="!!stats.data.value" @retry="stats.run">
        <div class="cells">
          <component
            :is="c.onClick ? 'button' : 'div'"
            v-for="c in overview"
            :key="c.key"
            class="cell"
            :class="[c.tone, { clickable: !!c.onClick }]"
            :type="c.onClick ? 'button' : undefined"
            @click="c.onClick?.()"
          >
            <div class="cell-label">{{ c.label }}</div>
            <div class="cell-value" :class="{ mono: c.mono }" :title="c.value">{{ c.value }}</div>
            <div v-if="c.sub" class="cell-sub">{{ c.sub }}</div>
          </component>
        </div>
      </section-state>
    </n-card>

    <!-- 3. Workload -->
    <n-card title="队列负载">
      <template #header-extra>
        <span v-if="workload.data.value" class="muted small">
          {{ workload.data.value.length }} 个队列 · 待处理 <b class="tnum">{{ formatNumber(pendingTotal) }}</b>
        </span>
      </template>
      <section-state
        :loading="workload.loading.value"
        :error="workload.error.value"
        :has-data="!!workload.data.value"
        @retry="workload.run"
      >
        <n-data-table
          size="small"
          :columns="workloadColumns"
          :data="workloadRows"
          :row-key="(r: WorkloadRow) => r.key"
          :scroll-x="520"
        >
          <template #empty>
            <n-empty description="暂无队列" />
          </template>
        </n-data-table>
      </section-state>
    </n-card>

    <!-- 4. Horizon masters -->
    <n-card title="Horizon 进程">
      <template #header-extra>
        <span v-if="masterList.length" class="muted small">{{ masterList.length }} 个主进程</span>
      </template>
      <n-alert v-if="mastersForbidden && !masters.data.value" type="info" title="无法读取 Horizon 进程详情" :bordered="false">
        后端返回 403：该接口直接复用 Horizon 自带的控制器，受 Horizon 访问授权（viewHorizon）限制，生产环境默认拒绝访问。
        队列服务整体状态与进程总数仍可在上方“运行状态”“队列概览”中查看；如需在此显示进程明细，需要在后端放开 Horizon 授权。
      </n-alert>
      <section-state
        v-else
        :loading="masters.loading.value"
        :error="masters.error.value"
        :has-data="!!masters.data.value"
        @retry="masters.run"
      >
        <n-empty v-if="!masterList.length" description="未检测到 Horizon 主进程" />
        <n-collapse
          v-else
          :expanded-names="expandedNames"
          @update:expanded-names="(v: unknown) => (expandedMasters = (v as string[]) ?? [])"
        >
          <n-collapse-item v-for="m in masterList" :key="m.name" :name="m.name">
            <template #header>
              <span class="master-name mono">{{ m.name }}</span>
            </template>
            <template #header-extra>
              <n-space :size="6" align="center" :wrap="false">
                <n-tag v-if="m.environment" size="small" :bordered="false">{{ m.environment }}</n-tag>
                <span class="muted small mono">PID {{ dash(m.pid) }}</span>
                <n-tag size="small" :bordered="false" :type="statusTag(m.status).type">{{ statusTag(m.status).label }}</n-tag>
              </n-space>
            </template>
            <n-data-table
              size="small"
              :columns="supervisorColumns(m.name)"
              :data="m.supervisors"
              :row-key="(r: HorizonSupervisor) => r.name"
              :scroll-x="980"
            >
              <template #empty>
                <n-empty description="该主进程下没有 supervisor" />
              </template>
            </n-data-table>
          </n-collapse-item>
        </n-collapse>
      </section-state>
    </n-card>

    <!-- 5. Failed jobs -->
    <n-card id="failed-jobs" title="失败任务">
      <template #header-extra>
        <n-button size="small" quaternary :loading="failedRef?.loading" @click="failedRef?.reload()">
          <template #icon>
            <n-icon><refresh-outline /></n-icon>
          </template>
          刷新
        </n-button>
      </template>
      <failed-jobs-table ref="failedRef" :page-sizes="[10, 20, 50]" />
    </n-card>
  </page-container>
</template>

<style scoped>
.updated {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.small {
  font-size: 12px;
}
.tnum,
:deep(.tnum) {
  font-variant-numeric: tabular-nums;
}
.tiles {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
@media (min-width: 900px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.tile {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  border-left-width: 3px;
}
.tile.ok {
  border-left-color: var(--success-color);
}
.tile.bad {
  border-left-color: var(--error-color);
  background: color-mix(in srgb, var(--error-color) 6%, transparent);
}
.tile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.tile-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
}
.tile-meta {
  margin-top: 8px;
  font-size: 13px;
}
.tile-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--error-color);
  line-height: 1.6;
}
.tile-tip code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--code-bg);
  font-family: var(--font-mono);
  color: var(--text-color);
}
.warn {
  color: var(--warning-color);
}
.cells {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  padding: 12px 14px;
  border: 0;
  border-radius: 10px;
  background: var(--hover-color);
  color: inherit;
  font: inherit;
  text-align: left;
}
.cell.clickable {
  cursor: pointer;
}
.cell.clickable:hover {
  outline: 1px solid color-mix(in srgb, var(--error-color) 40%, transparent);
}
.cell-label {
  font-size: 13px;
  color: var(--text-muted);
}
.cell-value {
  max-width: 100%;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-value.mono {
  font-size: 17px;
}
.cell.danger .cell-value {
  color: var(--error-color);
}
.cell.warning .cell-sub {
  color: var(--warning-color);
}
.cell-sub {
  font-size: 12px;
  color: var(--text-muted);
}
.master-name {
  font-weight: 600;
  word-break: break-all;
}
@media (max-width: 559px) {
  .cells {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .cell {
    padding: 10px 12px;
  }
  .cell-value {
    font-size: 19px;
  }
  .cell-value.mono {
    font-size: 15px;
  }
}
</style>
