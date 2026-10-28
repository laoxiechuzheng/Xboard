<script setup lang="ts">
// 服务器管理 /server/machine (spec nodes §5). `?machine_id=` opens the detail drawer.
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NDataTable,
  NEllipsis,
  NEmpty,
  NIcon,
  NInput,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
  type PaginationProps,
  type SelectOption,
} from 'naive-ui'
import {
  AddOutline,
  AlertCircleOutline,
  CheckmarkCircleOutline,
  CloudOfflineOutline,
  CreateOutline,
  InformationCircleOutline,
  LayersOutline,
  RefreshOutline,
  SearchOutline,
  ServerOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { dropMachine, fetchMachines, type Machine, type MachineCreated } from '@/api/machine'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { formatTime, nowSeconds } from '@/utils/format'
import LoadBars from './machine/LoadBars.vue'
import MachineCredentialDialog from './machine/MachineCredentialDialog.vue'
import MachineDetailDrawer from './machine/MachineDetailDrawer.vue'
import MachineFormDialog from './machine/MachineFormDialog.vue'
import { STATUS_META, isHighLoad, machineStatus, relativeAgo, type MachineStatus } from './machine/machine-utils'

type NodeFilter = 'with_nodes' | 'idle_nodes' | 'high_load'

const route = useRoute()
const router = useRouter()

const machines = ref<Machine[]>([])
const loading = ref(false)
const loaded = ref(false)
/** True while the latest list request is outstanding (background ones included). */
const pending = ref(false)
/** The latest list request failed. */
const listError = ref(false)
/** At least one list response has been applied. */
const hasData = ref(false)
const now = ref(nowSeconds())
let lastFetch = 0
let seq = 0

const keyword = ref('')
const statusFilter = ref<MachineStatus[]>([])
const nodeFilter = ref<NodeFilter[]>([])

/** Latest request wins: a superseded response is dropped and does not touch the loading flags. */
async function load(background = false) {
  const mySeq = ++seq
  if (!background) loading.value = true
  pending.value = true
  try {
    const list = (await fetchMachines({ silent: background })) ?? []
    if (mySeq !== seq) return
    machines.value = list
    lastFetch = Date.now()
    now.value = nowSeconds()
    listError.value = false
    hasData.value = true
  } catch {
    // toast handled by http client (foreground only); keep the last good list
    if (mySeq === seq) listError.value = true
  } finally {
    if (mySeq === seq) {
      loading.value = false
      pending.value = false
      loaded.value = true
    }
  }
}

// ---- polling: list every 60s while visible, refetch on focus when older than 30s ----
// Timer / focus refreshes are skipped while a request is in flight; refreshes after a
// mutation always call load() so they supersede it.
let pollTimer: ReturnType<typeof setInterval> | undefined
let tickTimer: ReturnType<typeof setInterval> | undefined
function refreshIfStale() {
  if (pending.value || document.visibilityState !== 'visible') return
  if (Date.now() - lastFetch > 30_000) void load(true)
}
onMounted(() => {
  void load()
  pollTimer = setInterval(() => {
    if (!pending.value && document.visibilityState === 'visible') void load(true)
  }, 60_000)
  tickTimer = setInterval(() => (now.value = nowSeconds()), 5_000)
  window.addEventListener('focus', refreshIfStale)
  document.addEventListener('visibilitychange', refreshIfStale)
})
onBeforeUnmount(() => {
  clearInterval(pollTimer)
  clearInterval(tickTimer)
  window.removeEventListener('focus', refreshIfStale)
  document.removeEventListener('visibilitychange', refreshIfStale)
})

// ---- derived ----
const statusOf = (m: Machine) => machineStatus(m, now.value)

const stats = computed(() => {
  let online = 0
  let lost = 0
  let high = 0
  let nodes = 0
  for (const m of machines.value) {
    const s = statusOf(m)
    if (s === 'online') online++
    if (s === 'offline' || s === 'never') lost++
    if (isHighLoad(m.load_status)) high++
    nodes += Number(m.servers_count) || 0
  }
  return { total: machines.value.length, online, lost, high, nodes }
})

const statusOptions = computed<SelectOption[]>(() => {
  const count = (s: MachineStatus) => machines.value.filter((m) => statusOf(m) === s).length
  return (['online', 'offline', 'inactive', 'never'] as MachineStatus[]).map((s) => ({
    label: `${STATUS_META[s].label} (${count(s)})`,
    value: s,
  }))
})

const nodeOptions = computed<SelectOption[]>(() => {
  const list = machines.value
  return [
    { label: `已承载节点 (${list.filter((m) => m.servers_count > 0).length})`, value: 'with_nodes' },
    { label: `空闲服务器 (${list.filter((m) => !m.servers_count).length})`, value: 'idle_nodes' },
    { label: `高负载 (${list.filter((m) => isHighLoad(m.load_status)).length})`, value: 'high_load' },
  ]
})

function matchNodeFilter(m: Machine, f: NodeFilter) {
  if (f === 'with_nodes') return m.servers_count > 0
  if (f === 'idle_nodes') return !m.servers_count
  return isHighLoad(m.load_status)
}

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return machines.value.filter((m) => {
    if (k) {
      const hay = `${m.name} ${m.notes ?? ''} sid:${m.id} ${m.id}`.toLowerCase()
      if (!hay.includes(k)) return false
    }
    if (statusFilter.value.length && !statusFilter.value.includes(statusOf(m))) return false
    if (nodeFilter.value.length && !nodeFilter.value.some((f) => matchNodeFilter(m, f))) return false
    return true
  })
})

const hasFilter = computed(() => !!keyword.value.trim() || statusFilter.value.length > 0 || nodeFilter.value.length > 0)
function resetFilters() {
  keyword.value = ''
  statusFilter.value = []
  nodeFilter.value = []
}

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 40, 50, 100, 500],
  prefix: ({ itemCount }) => `共 ${itemCount ?? 0} 台`,
  onUpdatePage: (p: number) => (pagination.page = p),
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
  },
})
watch([keyword, statusFilter, nodeFilter], () => (pagination.page = 1))

// ---- stat cards double as quick filters ----
interface StatCard {
  key: string
  label: string
  value: number
  icon: Component
  tone: 'primary' | 'success' | 'error' | 'warning' | 'muted'
  apply: () => void
}
const statCards = computed<StatCard[]>(() => [
  { key: 'total', label: '服务器总数', value: stats.value.total, icon: ServerOutline, tone: 'primary', apply: resetFilters },
  {
    key: 'online',
    label: '在线服务器',
    value: stats.value.online,
    icon: CheckmarkCircleOutline,
    tone: 'success',
    apply: () => {
      resetFilters()
      statusFilter.value = ['online']
    },
  },
  {
    key: 'lost',
    label: '离线/失联',
    value: stats.value.lost,
    icon: CloudOfflineOutline,
    tone: stats.value.lost > 0 ? 'error' : 'muted',
    apply: () => {
      resetFilters()
      statusFilter.value = ['offline', 'never']
    },
  },
  {
    key: 'high',
    label: '高负载',
    value: stats.value.high,
    icon: AlertCircleOutline,
    tone: stats.value.high > 0 ? 'warning' : 'muted',
    apply: () => {
      resetFilters()
      nodeFilter.value = ['high_load']
    },
  },
  {
    key: 'nodes',
    label: '节点数',
    value: stats.value.nodes,
    icon: LayersOutline,
    tone: 'primary',
    apply: () => {
      resetFilters()
      nodeFilter.value = ['with_nodes']
    },
  },
])

// ---- detail drawer (state lives in the URL) ----
const detailId = computed(() => {
  // useRoute() follows navigation away before this view unmounts; only read our own query.
  if (route.path !== '/server/machine') return null
  const raw = route.query.machine_id
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) && n > 0 ? n : null
})
const detailMachine = computed(() => machines.value.find((m) => m.id === detailId.value) ?? null)

function openDetail(m: Machine | number) {
  const id = typeof m === 'number' ? m : m.id
  void router.replace({ query: { ...route.query, machine_id: String(id) } })
}
function closeDetail() {
  const rest = { ...route.query }
  delete rest.machine_id
  void router.replace({ query: rest })
}
// Unknown id in the URL (deleted / typo): drop it once the latest list request has settled
// successfully, so an in-flight refresh (e.g. right after creating) is never judged on stale data.
watch([machines, detailId, pending, listError], () => {
  if (!hasData.value || pending.value || listError.value || !detailId.value || detailMachine.value) return
  message.warning(`服务器 SID:${detailId.value} 不存在或已被删除`)
  closeDetail()
})

// ---- create / edit / delete ----
const formShow = ref(false)
const editing = ref<Machine | null>(null)
const credShow = ref(false)
const cred = reactive({ id: 0, name: '', token: '', command: '' })

function openCreate() {
  editing.value = null
  formShow.value = true
}
function openEdit(m: Machine) {
  editing.value = m
  formShow.value = true
}
function onCreated(res: MachineCreated & { name: string }) {
  cred.id = res.id
  cred.name = res.name
  cred.token = res.token
  cred.command = res.install_command
  credShow.value = true
  void load(true)
}
async function credOpenDetail() {
  credShow.value = false
  if (!machines.value.some((m) => m.id === cred.id)) await load(true)
  openDetail(cred.id)
}

async function remove(m: Machine) {
  const bound = m.servers_count > 0 ? `该服务器当前承载 ${m.servers_count} 个节点，删除后这些节点将自动解绑（不会被删除）。` : ''
  const ok = await confirm({
    title: '确认删除服务器？',
    content: `将删除服务器「${m.name}」(SID:${m.id}) 及其负载历史。${bound || '关联节点将自动解绑（不会被删除）。'}此操作不可撤销。`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await dropMachine(m.id)
    message.success('服务器删除成功')
    if (detailId.value === m.id) closeDetail()
    await load(true)
  } catch {
    /* toast handled by http client */
  }
}

// ---- table ----
function statusTag(m: Machine) {
  const meta = STATUS_META[statusOf(m)]
  return h(
    NTag,
    { size: 'small', type: meta.tagType, bordered: false, round: true },
    { default: () => [h('span', { class: 'dot', style: { background: meta.dot } }), meta.label] },
  )
}

function nameBlock(m: Machine) {
  const meta = STATUS_META[statusOf(m)]
  return h('div', { class: 'name-cell' }, [
    h('div', { class: 'name-icon' }, [h(NIcon, { size: 18 }, { default: () => h(ServerOutline) })]),
    h('div', { class: 'name-body' }, [
      h('div', { class: 'name-line' }, [
        h('button', { type: 'button', class: 'name-link', onClick: () => openDetail(m), title: '查看服务器详情' }, m.name),
        h('span', { class: 'dot', style: { background: meta.dot }, title: meta.label }),
        h(NTag, { size: 'tiny', bordered: true, class: 'sid-tag' }, { default: () => `SID:${m.id}` }),
        isHighLoad(m.load_status) ? h(NTag, { size: 'tiny', type: 'warning', bordered: false }, { default: () => '高负载' }) : null,
      ]),
      h('div', { class: 'name-meta' }, [
        `最后心跳: ${relativeAgo(m.last_seen_at, now.value)}`,
        h('span', { class: 'sep' }, '•'),
        `节点数: ${m.servers_count}`,
      ]),
      m.notes ? h(NEllipsis, { class: 'name-notes' }, { default: () => m.notes }) : null,
    ]),
  ])
}

function relationCell(m: Machine) {
  return h('div', { class: 'relation-cell' }, [
    h('div', { class: 'relation-top' }, [
      h('span', { class: 'relation-num' }, String(m.servers_count)),
      h('span', { class: 'muted relation-label' }, m.servers_count > 0 ? '已承载节点' : '暂无承载'),
    ]),
    h(NButton, { size: 'tiny', secondary: true, onClick: () => openDetail(m) }, { default: () => '服务器详情' }),
  ])
}

function heartbeatCell(m: Machine) {
  return h('div', { class: 'beat-cell' }, [
    h(
      NTooltip,
      { disabled: !m.last_seen_at },
      { trigger: () => h('span', { class: 'beat-main' }, relativeAgo(m.last_seen_at, now.value)), default: () => formatTime(m.last_seen_at) },
    ),
    h(
      'div',
      { class: 'muted beat-sub' },
      m.load_status?.updated_at ? `负载上报: ${relativeAgo(m.load_status.updated_at, now.value)}` : '暂无负载数据',
    ),
  ])
}

function iconBtn(label: string, icon: Component, onClick: () => void, type: 'default' | 'error' = 'default') {
  return h(NTooltip, null, {
    trigger: () =>
      h(
        NButton,
        { size: 'small', quaternary: true, circle: true, type, onClick, 'aria-label': label },
        { icon: () => h(NIcon, null, { default: () => h(icon) }) },
      ),
    default: () => label,
  })
}

function actionsCell(m: Machine) {
  return h('div', { class: 'row-actions' }, [
    iconBtn('服务器详情', InformationCircleOutline, () => openDetail(m)),
    iconBtn('编辑服务器', CreateOutline, () => openEdit(m)),
    iconBtn('删除', TrashOutline, () => remove(m), 'error'),
  ])
}

const desktopColumns = computed<DataTableColumns<Machine>>(() => [
  { title: '服务器名称', key: 'name', minWidth: 280, render: nameBlock },
  { title: '状态', key: 'status', width: 110, render: statusTag },
  { title: '负载', key: 'load', width: 220, render: (m) => h(LoadBars, { load: m.load_status }) },
  {
    title: '节点数',
    key: 'servers_count',
    width: 140,
    sorter: (a, b) => a.servers_count - b.servers_count,
    render: relationCell,
  },
  {
    title: '最后心跳',
    key: 'last_seen_at',
    width: 160,
    sorter: (a, b) => (a.last_seen_at ?? 0) - (b.last_seen_at ?? 0),
    render: heartbeatCell,
  },
  { title: '操作', key: 'actions', width: 128, align: 'center', fixed: 'right', render: actionsCell },
])

const mobileColumns = computed<DataTableColumns<Machine>>(() => [
  {
    title: '服务器',
    key: 'card',
    render: (m) =>
      h('div', { class: 'm-card' }, [
        nameBlock(m),
        h('div', { class: 'm-grid' }, [
          h('div', null, [h('div', { class: 'm-label' }, '负载'), h(LoadBars, { load: m.load_status })]),
          h('div', null, [h('div', { class: 'm-label' }, '节点数'), relationCell(m)]),
          h('div', null, [h('div', { class: 'm-label' }, '状态'), statusTag(m)]),
          h('div', null, [h('div', { class: 'm-label' }, '最后心跳'), heartbeatCell(m)]),
        ]),
        actionsCell(m),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : desktopColumns.value))
</script>

<template>
  <page-container title="服务器管理" description="用于查看服务器健康、负载与承载节点，并从运维视角快捷发起节点操作。">
    <template #extra>
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加服务器
      </n-button>
    </template>

    <div class="stat-row">
      <button
        v-for="c in statCards"
        :key="c.key"
        type="button"
        class="stat-card"
        :class="`tone-${c.tone}`"
        :title="`筛选：${c.label}`"
        @click="c.apply"
      >
        <span class="stat-icon"><n-icon :size="18"><component :is="c.icon" /></n-icon></span>
        <span class="stat-text">
          <span class="stat-label">{{ c.label }}</span>
          <span class="stat-value">{{ hasData ? c.value : '-' }}</span>
        </span>
      </button>
    </div>

    <n-card size="small">
      <div class="toolbar table-toolbar">
        <n-input v-model:value="keyword" placeholder="搜索服务器名称、备注或 SID..." clearable class="search-input">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-select
          v-model:value="statusFilter"
          :options="statusOptions"
          multiple
          clearable
          max-tag-count="responsive"
          placeholder="状态"
          class="filter-select"
        />
        <n-select
          v-model:value="nodeFilter"
          :options="nodeOptions"
          multiple
          clearable
          max-tag-count="responsive"
          placeholder="节点"
          class="filter-select"
        />
        <n-button v-if="hasFilter" quaternary @click="resetFilters">重置</n-button>
        <span class="grow" />
        <div class="summary">
          <n-tag size="small" :bordered="false" round type="success">
            在线: {{ hasData ? `${stats.online}/${stats.total}` : '-' }}
          </n-tag>
          <n-tag size="small" :bordered="false" round :type="stats.high ? 'warning' : 'default'">
            高负载: {{ hasData ? stats.high : '-' }}
          </n-tag>
          <n-tooltip>
            <template #trigger>
              <n-button quaternary circle size="small" :loading="loading" aria-label="刷新" @click="load()">
                <template #icon><n-icon><refresh-outline /></n-icon></template>
              </n-button>
            </template>
            刷新（每 60 秒自动刷新）
          </n-tooltip>
        </div>
      </div>
      <div class="toolbar-hint muted">适合集中查看服务器在线情况、承载节点数量与资源压力。心跳超过 5 分钟未更新视为离线。</div>
      <n-data-table
        :columns="columns"
        :data="filtered"
        :loading="loading && !loaded"
        :pagination="pagination"
        :row-key="(r: Machine) => r.id"
        :scroll-x="appState.isMobile ? undefined : 1040"
        :bordered="false"
        size="small"
        class="data-table"
      >
        <template #empty>
          <n-empty v-if="listError && !machines.length" description="服务器列表加载失败">
            <template #icon><n-icon><cloud-offline-outline /></n-icon></template>
            <template #extra>
              <n-button size="small" :loading="loading" @click="load()">
                <template #icon><n-icon><refresh-outline /></n-icon></template>
                重试
              </n-button>
            </template>
          </n-empty>
          <n-empty v-else :description="hasFilter ? '没有符合条件的服务器' : '暂无服务器'">
            <template #extra>
              <n-button v-if="hasFilter" size="small" @click="resetFilters">清除筛选</n-button>
              <n-button v-else size="small" type="primary" @click="openCreate">添加服务器</n-button>
            </template>
          </n-empty>
        </template>
      </n-data-table>
    </n-card>

    <machine-form-dialog
      v-model:show="formShow"
      :machine="editing"
      @created="onCreated"
      @updated="load(true)"
    />
    <machine-credential-dialog
      v-model:show="credShow"
      :name="cred.name"
      :token="cred.token"
      :command="cred.command"
      @open-detail="credOpenDetail"
    />
    <machine-detail-drawer
      :show="!!detailMachine"
      :machine="detailMachine"
      :now="now"
      @update:show="(v: boolean) => !v && closeDetail()"
      @edit="openEdit"
      @changed="load(true)"
    />
  </page-container>
</template>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}
.stat-card {
  --tone: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-color);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.stat-card:hover {
  border-color: color-mix(in srgb, var(--tone) 55%, var(--border-color));
  box-shadow: 0 4px 14px -8px color-mix(in srgb, var(--tone) 60%, transparent);
}
.stat-card.tone-success {
  --tone: var(--success-color);
}
.stat-card.tone-error {
  --tone: var(--error-color);
  border-color: color-mix(in srgb, var(--error-color) 40%, var(--border-color));
}
.stat-card.tone-warning {
  --tone: var(--warning-color);
  border-color: color-mix(in srgb, var(--warning-color) 45%, var(--border-color));
}
.stat-card.tone-muted {
  --tone: var(--text-muted);
}
.stat-icon {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 14%, transparent);
}
.stat-text {
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
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
}
.tone-error .stat-value {
  color: var(--error-color);
}
.tone-warning .stat-value {
  color: var(--warning-color);
}
.table-toolbar {
  margin-bottom: 6px;
}
.search-input {
  width: 260px;
  max-width: 100%;
}
.filter-select {
  width: 170px;
}
.summary {
  display: flex;
  align-items: center;
  gap: 6px;
}
.summary :deep(.n-tag) {
  font-variant-numeric: tabular-nums;
}
.toolbar-hint {
  font-size: 12px;
  margin-bottom: 10px;
}
@media (max-width: 767px) {
  .search-input,
  .filter-select {
    width: 100%;
  }
  .stat-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stat-card {
    padding: 12px;
  }
}
.data-table :deep(.dot) {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
  flex: none;
}
.data-table :deep(.name-cell) {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.data-table :deep(.name-icon) {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}
.data-table :deep(.name-body) {
  min-width: 0;
  flex: 1;
}
.data-table :deep(.name-line) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.data-table :deep(.name-link) {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--text-strong);
  cursor: pointer;
  text-align: left;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-table :deep(.name-link:hover) {
  color: var(--primary-color);
}
.data-table :deep(.name-line .dot) {
  margin-right: 0;
}
.data-table :deep(.sid-tag) {
  font-family: var(--font-mono);
}
.data-table :deep(.name-meta) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.name-meta .sep) {
  opacity: 0.5;
}
.data-table :deep(.name-notes) {
  margin-top: 2px;
  max-width: 100%;
  font-size: 12px;
  color: var(--text-color);
}
.data-table :deep(.relation-cell) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.data-table :deep(.relation-top) {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.data-table :deep(.relation-num) {
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.relation-label) {
  font-size: 12px;
}
.data-table :deep(.beat-main) {
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.beat-sub) {
  margin-top: 2px;
  font-size: 12px;
}
.data-table :deep(.row-actions) {
  display: inline-flex;
  gap: 2px;
}
.data-table :deep(.m-card) {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}
.data-table :deep(.m-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}
.data-table :deep(.m-label) {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
</style>
