<script setup lang="ts">
// 节点管理 (/server/manage): list with front-end filters, batch actions, drag sorting and the node form.
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDropdown,
  NEmpty,
  NIcon,
  NInput,
  NPagination,
  NSelect,
  NSkeleton,
  NSwitch,
  NTag,
  NTooltip,
  type DataTableColumns,
  type DropdownOption,
  type SelectOption,
} from 'naive-ui'
import {
  AddOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  ChevronDownOutline,
  ChevronUpOutline,
  CloseOutline,
  CopyOutline,
  CreateOutline,
  EllipsisHorizontal,
  EyeOffOutline,
  EyeOutline,
  PauseCircleOutline,
  PeopleOutline,
  PlayCircleOutline,
  RefreshOutline,
  ReorderFourOutline,
  SearchOutline,
  ServerOutline,
  SwapVerticalOutline,
  TimeOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import CopyText from '@/components/CopyText.vue'
import {
  batchDeleteNodes,
  batchResetNodeTraffic,
  batchUpdateNodes,
  copyNode,
  dropNode,
  fetchMachines,
  fetchNodes,
  resetNodeTraffic,
  sortNodes,
  updateNode,
  type MachineBrief,
  type ServerNode,
} from '@/api/node'
import { fetchServerGroups, type ServerGroupBrief } from '@/api/common'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { formatBytes } from '@/utils/format'
import NodeFormModal from './node/NodeFormModal.vue'
import NodeStatusDot from './node/NodeStatusDot.vue'
import NodeIdBadge from './node/cells/NodeIdBadge.vue'
import DeployCell from './node/cells/DeployCell.vue'
import TrafficCell from './node/cells/TrafficCell.vue'
import { NODE_STATUS, NODE_TYPES, STANDALONE, isShown, portsDiffer, typeColor, typeLabel } from './node/meta'

const route = useRoute()
const router = useRouter()

// ---- data ----

const nodes = ref<ServerNode[]>([])
const machines = ref<MachineBrief[]>([])
const groups = ref<ServerGroupBrief[]>([])
const loading = ref(false)
const loaded = ref(false)

async function loadNodes(silent = false) {
  if (!silent) loading.value = true
  try {
    const list = await fetchNodes(silent)
    if (!sortMode.value) nodes.value = list ?? []
    loaded.value = true
  } catch {
    /* toast by http client (silent refresh stays quiet) */
  } finally {
    loading.value = false
  }
}

async function loadMachines(silent = true) {
  try {
    machines.value = (await fetchMachines(silent)) ?? []
  } catch {
    /* ignore */
  }
}

async function loadGroups() {
  try {
    groups.value = (await fetchServerGroups()) ?? []
  } catch {
    /* ignore */
  }
}

function refreshAll() {
  void loadNodes()
  void loadMachines(false)
  void loadGroups()
}

const machineMap = computed(() => new Map(machines.value.map((m) => [m.id, m])))
const childCount = (id: number) => nodes.value.filter((n) => Number(n.parent_id) === id).length

// ---- polling (30s nodes, 60s machines; paused in sort mode / hidden tab) ----

let nodeTimer: number | undefined
let machineTimer: number | undefined
onMounted(() => {
  nodeTimer = window.setInterval(() => {
    if (!sortMode.value && document.visibilityState === 'visible') void loadNodes(true)
  }, 30_000)
  machineTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void loadMachines(true)
  }, 60_000)
})
onBeforeUnmount(() => {
  window.clearInterval(nodeTimer)
  window.clearInterval(machineTimer)
})

// ---- filters ----

const keyword = ref('')
const typeFilter = ref<string[]>([])
const machineFilter = ref<string[]>([])
const groupFilter = ref<string[]>([])

const hasFilter = computed(
  () => !!keyword.value.trim() || !!typeFilter.value.length || !!machineFilter.value.length || !!groupFilter.value.length,
)

function resetFilters() {
  keyword.value = ''
  typeFilter.value = []
  machineFilter.value = []
  groupFilter.value = []
}

const machineKey = (n: ServerNode) => (n.machine_id ? String(n.machine_id) : STANDALONE)

const filteredNodes = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const types = typeFilter.value
  const ms = machineFilter.value
  const gs = groupFilter.value
  return nodes.value.filter((n) => {
    if (kw) {
      const hay = `${n.name} ${n.host} ${n.id} ${n.code ?? ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    if (types.length && !types.includes(n.type)) return false
    if (ms.length && !ms.includes(machineKey(n))) return false
    if (gs.length && !(n.group_ids ?? []).some((g) => gs.includes(String(g)))) return false
    return true
  })
})

function countBy(fn: (n: ServerNode) => boolean) {
  return nodes.value.reduce((acc, n) => acc + (fn(n) ? 1 : 0), 0)
}

const typeFilterOptions = computed<SelectOption[]>(() =>
  NODE_TYPES.map((t) => ({ label: typeLabel(t), value: t, count: countBy((n) => n.type === t) })),
)
const machineFilterOptions = computed<SelectOption[]>(() => [
  { label: '独立部署', value: STANDALONE, count: countBy((n) => !n.machine_id) },
  ...machines.value.map((m) => ({
    label: `${m.name} · SID:${m.id}`,
    value: String(m.id),
    count: countBy((n) => n.machine_id === m.id),
  })),
])
const groupFilterOptions = computed<SelectOption[]>(() =>
  groups.value.map((g) => ({
    label: g.name,
    value: String(g.id),
    count: countBy((n) => (n.group_ids ?? []).map(String).includes(String(g.id))),
  })),
)
const typeDot = (o: SelectOption) =>
  (NODE_TYPES as string[]).includes(String(o.value))
    ? h('i', { class: 'nv-dot', style: { background: typeColor(String(o.value), appState.isDark) } })
    : null
// Menu options show the hit count; selected tags (render-tag) show only dot + name.
const renderCountLabel = (o: SelectOption) =>
  h('span', { class: 'nv-filter-opt' }, [
    typeDot(o),
    h('span', { class: 'nv-filter-label' }, o.label as string),
    h('span', { class: 'nv-filter-count' }, String(o.count ?? 0)),
  ])
const renderFilterTag = ({ option, handleClose }: { option: SelectOption; handleClose: () => void }) =>
  h(
    NTag,
    {
      closable: true,
      onMousedown: (e: MouseEvent) => e.preventDefault(),
      onClose: (e: MouseEvent) => {
        e.stopPropagation()
        handleClose()
      },
    },
    { default: () => h('span', { class: 'nv-filter-tag' }, [typeDot(option), option.label as string]) },
  )

// ---- machine query (?machine_id=&open_create=1) ----

const queryMachineId = computed(() => {
  const v = Number(route.query.machine_id)
  return Number.isInteger(v) && v > 0 ? v : null
})
const bannerMachine = computed(() => (queryMachineId.value ? machineMap.value.get(queryMachineId.value) ?? null : null))

watch(
  queryMachineId,
  (id, prev) => {
    if (id) machineFilter.value = [String(id)]
    // Query removed (sidebar link / back): drop the filter it applied, keep any manual choice.
    else if (prev && machineFilter.value.length === 1 && machineFilter.value[0] === String(prev)) machineFilter.value = []
  },
  { immediate: true },
)

function clearMachineFilter() {
  const q = { ...route.query }
  delete q.machine_id
  delete q.open_create
  machineFilter.value = []
  void router.replace({ query: q })
}

// ---- selection & pagination ----

const checkedKeys = ref<number[]>([])
const selectedIds = computed(() => {
  const visible = new Set(filteredNodes.value.map((n) => n.id))
  return checkedKeys.value.filter((id) => visible.has(id))
})

const pagination = reactive({
  page: 1,
  pageSize: 500,
  pageSizes: [10, 20, 30, 40, 50, 100, 500],
  showSizePicker: true,
  showQuickJumper: true,
  prefix: ({ itemCount }: { itemCount: number | undefined }) => `已选择 ${selectedIds.value.length} 项，共 ${itemCount ?? 0} 项`,
  onChange: (p: number) => (pagination.page = p),
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
  },
})
// Narrow screens use cards with a smaller page.
const MOBILE_PAGE_SIZE = 20
const mobilePage = ref(1)
watch([keyword, typeFilter, machineFilter, groupFilter], () => {
  pagination.page = 1
  mobilePage.value = 1
})

const mobilePageNodes = computed(() => {
  const start = (mobilePage.value - 1) * MOBILE_PAGE_SIZE
  return filteredNodes.value.slice(start, start + MOBILE_PAGE_SIZE)
})

// ---- row actions ----

const togglingShow = reactive(new Set<number>())

/** "显隐" switch uses the node type color when on (official behaviour). */
const railStyleFor =
  (type: string) =>
  ({ checked }: { checked: boolean }) =>
    checked ? { background: typeColor(type, appState.isDark) } : {}

async function toggleShow(row: ServerNode, v: boolean) {
  const prev = row.show
  row.show = v
  togglingShow.add(row.id)
  try {
    await updateNode({ id: row.id, show: v ? 1 : 0 })
  } catch {
    row.show = prev
    void loadNodes(true)
  } finally {
    togglingShow.delete(row.id)
  }
}

async function onCopy(row: ServerNode) {
  try {
    await copyNode(row.id)
    message.success('复制成功')
    void loadNodes(true)
  } catch {
    /* toast by http client */
  }
}

async function onResetTraffic(row: ServerNode) {
  const ok = await confirm({
    title: '确认重置流量',
    content: `将清零节点「${row.name}」的上传和下载流量（当前已用 ${formatBytes(Number(row.u) + Number(row.d))}），并解除因超出流量上限导致的停止下发。确定要继续吗？`,
    positiveText: '重置流量',
  })
  if (!ok) return
  try {
    await resetNodeTraffic(row.id)
    message.success('流量重置成功')
    void loadNodes(true)
  } catch {
    /* toast */
  }
}

async function onDelete(row: ServerNode) {
  const children = childCount(row.id)
  const ok = await confirm({
    title: '确认删除',
    content:
      `此操作将永久删除节点「${row.name}」，删除后无法恢复。` +
      (children ? `该节点有 ${children} 个子节点，删除后它们的父节点关联将失效。` : '') +
      '确定要继续吗？',
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await dropNode(row.id)
    message.success('删除成功')
    checkedKeys.value = checkedKeys.value.filter((id) => id !== row.id)
    void loadNodes(true)
  } catch {
    /* toast */
  }
}

function rowMenu(): DropdownOption[] {
  const icon = (c: Component) => () => h(NIcon, null, { default: () => h(c) })
  return [
    { key: 'edit', label: '编辑', icon: icon(CreateOutline) },
    { key: 'copy', label: '复制', icon: icon(CopyOutline) },
    { key: 'reset', label: '重置流量', icon: icon(RefreshOutline) },
    { type: 'divider', key: 'd1' },
    { key: 'delete', label: '删除', icon: icon(TrashOutline), props: { style: 'color: var(--error-color)' } },
  ]
}

function onRowAction(key: string, row: ServerNode) {
  if (key === 'edit') openEdit(row)
  else if (key === 'copy') void onCopy(row)
  else if (key === 'reset') void onResetTraffic(row)
  else if (key === 'delete') void onDelete(row)
}

// ---- batch actions ----

const batchOptions = computed<DropdownOption[]>(() => {
  const n = selectedIds.value.length
  const suffix = n ? ` (${n})` : ''
  const icon = (c: Component) => () => h(NIcon, null, { default: () => h(c) })
  return [
    { key: 'show', label: `显示节点${suffix}`, disabled: !n, icon: icon(EyeOutline) },
    { key: 'hide', label: `隐藏节点${suffix}`, disabled: !n, icon: icon(EyeOffOutline) },
    { type: 'divider', key: 'd1' },
    { key: 'enable', label: `启用节点${suffix}`, disabled: !n, icon: icon(PlayCircleOutline) },
    { key: 'disable', label: `禁用节点${suffix}`, disabled: !n, icon: icon(PauseCircleOutline) },
    { type: 'divider', key: 'd2' },
    { key: 'reset', label: `重置流量${suffix}`, disabled: !n, icon: icon(RefreshOutline) },
    { type: 'divider', key: 'd3' },
    {
      key: 'delete',
      label: `删除节点${suffix}`,
      disabled: !n,
      icon: icon(TrashOutline),
      props: { style: n ? 'color: var(--error-color)' : '' },
    },
  ]
})

const batching = ref(false)

async function runBatch(fn: () => Promise<unknown>, ok: string) {
  batching.value = true
  try {
    await fn()
    message.success(ok)
    checkedKeys.value = []
    void loadNodes(true)
  } catch {
    /* toast by http client */
  } finally {
    batching.value = false
  }
}

async function onBatch(key: string) {
  const ids = [...selectedIds.value]
  const count = ids.length
  if (!count) return
  switch (key) {
    case 'show':
      return runBatch(() => batchUpdateNodes({ ids, show: 1 }), `成功显示 ${count} 个节点`)
    case 'hide':
      return runBatch(() => batchUpdateNodes({ ids, show: 0 }), `成功隐藏 ${count} 个节点`)
    case 'enable':
      return runBatch(() => batchUpdateNodes({ ids, enabled: true }), `成功启用 ${count} 个节点`)
    case 'disable':
      return runBatch(() => batchUpdateNodes({ ids, enabled: false }), `成功禁用 ${count} 个节点`)
    case 'reset': {
      const ok = await confirm({
        title: '确认批量重置流量',
        content: `确定要重置选中的 ${count} 个节点的流量吗？此操作将清零流量并解除因超出流量上限导致的停止下发。`,
        positiveText: '确认重置',
      })
      if (ok) await runBatch(() => batchResetNodeTraffic(ids), `成功重置 ${count} 个节点的流量`)
      return
    }
    case 'delete': {
      const idSet = new Set(ids)
      const orphans = nodes.value.filter((n) => n.parent_id && idSet.has(Number(n.parent_id)) && !idSet.has(n.id)).length
      const ok = await confirm({
        title: '确认批量删除',
        content:
          `确定要删除选中的 ${count} 个节点吗？此操作不可恢复。` +
          (orphans ? `另有 ${orphans} 个未选中的子节点将失去父节点关联。` : ''),
        positiveText: '确认删除',
        type: 'error',
      })
      if (ok) await runBatch(() => batchDeleteNodes(ids), `成功删除 ${count} 个节点`)
      return
    }
  }
}

// ---- form modal ----

const formShow = ref(false)
const editing = ref<ServerNode | null>(null)
const presetMachineId = ref<number | null>(null)

function openCreate(machineId: number | null = null) {
  editing.value = null
  presetMachineId.value = machineId
  formShow.value = true
}

function openEdit(row: ServerNode) {
  editing.value = row
  presetMachineId.value = null
  formShow.value = true
}

function onSaved() {
  void loadNodes(true)
}

watch(
  () => route.query.open_create,
  (v) => {
    if (v !== '1' || !queryMachineId.value) return
    openCreate(queryMachineId.value)
    const q = { ...route.query }
    delete q.open_create
    void router.replace({ query: q })
  },
  { immediate: true },
)

// ---- sort mode ----

const sortMode = ref(false)
const sortList = ref<ServerNode[]>([])
const savingSort = ref(false)
const dragId = ref<number | null>(null)
const overId = ref<number | null>(null)

function enterSort() {
  sortList.value = [...nodes.value]
  sortMode.value = true
}

function cancelSort() {
  sortMode.value = false
  sortList.value = []
  void loadNodes(true)
}

function moveTo(fromIndex: number, toIndex: number) {
  const list = sortList.value
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length || fromIndex === toIndex) return
  const next = list.slice()
  const [it] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, it)
  sortList.value = next
}

function moveById(fromId: number, toId: number) {
  const list = sortList.value
  moveTo(
    list.findIndex((n) => n.id === fromId),
    list.findIndex((n) => n.id === toId),
  )
}

async function saveSort() {
  savingSort.value = true
  try {
    await sortNodes(sortList.value.map((n, i) => ({ id: n.id, order: i + 1 })))
    message.success('排序保存成功')
    sortMode.value = false
    sortList.value = []
    await loadNodes(true)
  } catch {
    /* stay in sort mode so the order is not lost; toast by http client */
  } finally {
    savingSort.value = false
  }
}

const sortRowProps = (row: ServerNode) => ({
  draggable: true,
  onDragstart: (e: DragEvent) => {
    dragId.value = row.id
    e.dataTransfer?.setData('text/plain', String(row.id))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  },
  onDragover: (e: DragEvent) => {
    e.preventDefault()
    overId.value = row.id
  },
  onDrop: (e: DragEvent) => {
    e.preventDefault()
    if (dragId.value !== null) moveById(dragId.value, row.id)
    dragId.value = null
    overId.value = null
  },
  onDragend: () => {
    dragId.value = null
    overId.value = null
  },
})
const sortRowClass = (row: ServerNode) =>
  row.id === dragId.value ? 'nv-dragging' : row.id === overId.value && dragId.value !== null ? 'nv-drag-over' : ''

// ---- columns ----

const iconBtn = (icon: Component, title: string, onClick: () => void, disabled = false) =>
  h(
    NButton,
    { quaternary: true, circle: true, size: 'tiny', title, disabled, onClick },
    { icon: () => h(NIcon, null, { default: () => h(icon) }) },
  )

const nameCell = (row: ServerNode) =>
  h('div', { class: 'nv-name' }, [
    h(NodeStatusDot, { node: row }),
    h('div', { class: 'nv-name-text' }, [
      h('span', { class: 'nv-name-main', title: row.name }, row.name),
      row.tags?.length
        ? h(
            'span',
            { class: 'nv-tags' },
            row.tags.slice(0, 3).map((t) => h(NTag, { size: 'tiny', bordered: false, round: true }, { default: () => t })),
          )
        : null,
    ]),
  ])

const statusLegend = () =>
  h('div', { class: 'nv-legend' }, [
    ...([0, 1, 2] as const).map((s) =>
      h('div', { class: 'nv-legend-row' }, [
        h('i', { class: 'nv-dot', style: { background: NODE_STATUS[s].color } }),
        NODE_STATUS[s].label,
      ]),
    ),
  ])

const headerTip = (title: string, tip: () => unknown) => () =>
  h(NTooltip, null, {
    trigger: () => h('span', { class: 'nv-th-tip' }, title),
    default: tip,
  })

const columns = computed<DataTableColumns<ServerNode>>(() => [
  { type: 'selection', fixed: 'left', width: 42 },
  {
    key: 'id',
    title: '节点ID',
    width: 130,
    sorter: (a, b) => a.id - b.id,
    render: (row) => h(NodeIdBadge, { node: row }),
  },
  {
    key: 'show',
    title: '显隐',
    width: 70,
    render: (row) =>
      h(NSwitch, {
        size: 'small',
        value: isShown(row),
        loading: togglingShow.has(row.id),
        railStyle: railStyleFor(row.type),
        'onUpdate:value': (v: boolean) => toggleShow(row, v),
      }),
  },
  {
    key: 'name',
    title: headerTip('节点', statusLegend),
    minWidth: 200,
    render: nameCell,
  },
  {
    key: 'machine',
    title: headerTip('部署方式', () => '独立部署：节点自行运行 xboard-node；绑定服务器：由服务器上的 xboard-node 统一托管'),
    width: 210,
    render: (row) => h(DeployCell, { node: row, machine: row.machine_id ? machineMap.value.get(row.machine_id) ?? null : null }),
  },
  {
    key: 'host',
    title: '地址',
    minWidth: 210,
    render: (row) =>
      h('div', { class: 'nv-addr' }, [
        h(CopyText, { text: `${row.host}:${row.port}`, mono: true, maxWidth: '230px' }),
        portsDiffer(row) ? h('span', { class: 'nv-inner-port' }, `(内部端口 ${row.server_port})`) : null,
      ]),
  },
  {
    key: 'online',
    title: headerTip('在线人数', () => '在线人数根据服务端上报频率而定'),
    width: 104,
    sorter: (a, b) => Number(a.online || 0) - Number(b.online || 0),
    render: (row) =>
      h('span', { class: 'nv-online' }, [
        h(NIcon, { size: 15 }, { default: () => h(PeopleOutline) }),
        h('span', { class: 'mono' }, String(row.online ?? 0)),
      ]),
  },
  {
    key: 'rate',
    title: headerTip('倍率', () => '流量扣费倍率'),
    width: 100,
    render: (row) =>
      h('span', { class: 'nv-rate' }, [
        h(NTag, { size: 'small', bordered: false }, { default: () => h('span', { class: 'mono' }, `${row.rate} x`) }),
        row.rate_time_enable && row.rate_time_ranges?.length
          ? h(
              NTooltip,
              null,
              {
                trigger: () => h(NIcon, { size: 15, class: 'nv-rate-time' }, { default: () => h(TimeOutline) }),
                default: () =>
                  h('div', { class: 'nv-rate-tip' }, [
                    h('div', { class: 'nv-rate-tip-title' }, '按时段倍率'),
                    ...(row.rate_time_ranges ?? []).map((r) =>
                      h('div', { class: 'mono' }, `${r.start} – ${r.end}  ×${r.rate}`),
                    ),
                  ]),
              },
            )
          : null,
      ]),
  },
  {
    key: 'group_ids',
    title: headerTip('权限组', () => '可订阅到该节点的权限组'),
    width: 190,
    render: (row) =>
      row.groups?.length
        ? h(
            'div',
            { class: 'nv-groups' },
            row.groups.map((g) => h(NTag, { size: 'small', bordered: false, type: 'info' }, { default: () => g.name })),
          )
        : h('span', { class: 'muted' }, '--'),
  },
  {
    key: 'traffic',
    title: headerTip('流量使用', () => '节点流量使用情况，显示已用流量和限制'),
    width: 160,
    render: (row) => h(TrafficCell, { node: row }),
  },
  {
    key: 'actions',
    title: '操作',
    width: 92,
    fixed: 'right',
    render: (row) =>
      h('div', { class: 'nv-actions' }, [
        iconBtn(CreateOutline, '编辑', () => openEdit(row)),
        h(
          NDropdown,
          {
            trigger: 'click',
            placement: 'bottom-end',
            options: rowMenu().filter((o) => o.key !== 'edit'),
            onSelect: (k: string) => onRowAction(k, row),
          },
          { default: () => iconBtn(EllipsisHorizontal, '更多操作', () => undefined) },
        ),
      ]),
  },
])

const sortColumns = computed<DataTableColumns<ServerNode>>(() => [
  {
    key: 'handle',
    title: '',
    width: 40,
    render: () => h(NIcon, { size: 18, class: 'nv-handle' }, { default: () => h(ReorderFourOutline) }),
  },
  {
    key: 'index',
    title: '#',
    width: 56,
    render: (_row, i) => h('span', { class: 'mono muted' }, String(i + 1)),
  },
  { key: 'id', title: '节点ID', width: 130, render: (row) => h(NodeIdBadge, { node: row }) },
  { key: 'name', title: '节点', minWidth: 260, render: nameCell },
  {
    key: 'type',
    title: '类型',
    width: 110,
    render: (row) => h('span', { class: 'nv-type', style: { color: typeColor(row.type, appState.isDark) } }, typeLabel(row.type)),
  },
  { key: 'traffic', title: '流量使用', width: 160, render: (row) => h(TrafficCell, { node: row }) },
  {
    key: 'move',
    title: '移动',
    width: 150,
    fixed: 'right',
    render: (_row, i) =>
      h('div', { class: 'nv-actions' }, [
        iconBtn(ArrowUpOutline, '置顶', () => moveTo(i, 0), i === 0),
        iconBtn(ChevronUpOutline, '上移', () => moveTo(i, i - 1), i === 0),
        iconBtn(ChevronDownOutline, '下移', () => moveTo(i, i + 1), i === sortList.value.length - 1),
        iconBtn(ArrowDownOutline, '置底', () => moveTo(i, sortList.value.length - 1), i === sortList.value.length - 1),
      ]),
  },
])

onMounted(() => {
  void loadNodes()
  void loadMachines(true)
  void loadGroups()
})
</script>

<template>
  <page-container title="节点管理" description="管理所有节点，包括添加、删除、编辑等操作。">
    <template #extra>
      <n-button :loading="loading" :disabled="sortMode" @click="refreshAll">
        <template #icon><n-icon><refresh-outline /></n-icon></template>
        刷新
      </n-button>
      <n-button type="primary" :disabled="sortMode" @click="openCreate()">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加节点
      </n-button>
    </template>

    <div v-if="bannerMachine && !sortMode" class="machine-banner">
      <div class="banner-icon"><n-icon :size="20"><server-outline /></n-icon></div>
      <div class="banner-text">
        <div class="banner-title">
          当前正在查看服务器 <strong>{{ bannerMachine.name }}</strong> (SID:{{ bannerMachine.id }}) 下的节点
        </div>
        <div class="muted banner-desc">在这里新增节点时，可以直接复用当前服务器作为部署目标。</div>
      </div>
      <div class="banner-actions">
        <n-tag size="small" class="mono" :bordered="true">SID:{{ bannerMachine.id }}</n-tag>
        <n-button size="small" type="primary" secondary @click="openCreate(bannerMachine.id)">
          <template #icon><n-icon><add-outline /></n-icon></template>
          新增节点到此服务器
        </n-button>
        <n-button size="small" quaternary @click="clearMachineFilter">
          <template #icon><n-icon><close-outline /></n-icon></template>
          清除服务器筛选
        </n-button>
      </div>
    </div>

    <n-card :bordered="true" size="small" class="list-card" :content-style="{ padding: appState.isMobile ? '12px' : '14px 16px' }">
      <!-- toolbar -->
      <div v-if="!sortMode" class="toolbar nv-toolbar">
        <n-input v-model:value="keyword" placeholder="搜索节点名称 / 地址 / ID..." clearable class="nv-search">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-select
          v-model:value="typeFilter"
          :options="typeFilterOptions"
          :render-label="renderCountLabel"
          :render-tag="renderFilterTag"
          multiple
          filterable
          clearable
          max-tag-count="responsive"
          placeholder="类型"
          class="nv-filter"
        />
        <n-select
          v-model:value="machineFilter"
          :options="machineFilterOptions"
          :render-label="renderCountLabel"
          :render-tag="renderFilterTag"
          multiple
          filterable
          clearable
          max-tag-count="responsive"
          placeholder="服务器"
          class="nv-filter"
        />
        <n-select
          v-model:value="groupFilter"
          :options="groupFilterOptions"
          :render-label="renderCountLabel"
          :render-tag="renderFilterTag"
          multiple
          filterable
          clearable
          max-tag-count="responsive"
          placeholder="权限组"
          class="nv-filter"
        />
        <n-button v-if="hasFilter" quaternary @click="resetFilters">
          <template #icon><n-icon><close-outline /></n-icon></template>
          重置
        </n-button>
        <n-dropdown trigger="click" :options="batchOptions" @select="onBatch">
          <n-button :loading="batching">
            操作{{ selectedIds.length ? ` (${selectedIds.length})` : '' }}
            <template #icon><n-icon><chevron-down-outline /></n-icon></template>
          </n-button>
        </n-dropdown>
        <span class="grow" />
        <n-button v-if="nodes.length > 1" secondary @click="enterSort">
          <template #icon><n-icon><swap-vertical-outline /></n-icon></template>
          编辑排序
        </n-button>
      </div>
      <div v-else class="toolbar nv-toolbar sort-bar">
        <n-icon :size="18" class="sort-icon"><swap-vertical-outline /></n-icon>
        <span class="sort-tip">拖拽节点进行排序（也可用右侧按钮移动），完成后点击保存</span>
        <span class="grow" />
        <n-button :disabled="savingSort" @click="cancelSort">取消</n-button>
        <n-button type="primary" :loading="savingSort" @click="saveSort">保存排序</n-button>
      </div>

      <!-- sort mode -->
      <n-data-table
        v-if="sortMode"
        class="nv-table"
        :columns="sortColumns"
        :data="sortList"
        :row-key="(r: ServerNode) => r.id"
        :row-props="sortRowProps"
        :row-class-name="sortRowClass"
        :scroll-x="900"
        size="small"
      />

      <!-- mobile cards -->
      <template v-else-if="appState.isMobile">
        <div v-if="loading && !loaded" class="m-list">
          <n-skeleton v-for="i in 4" :key="i" height="120px" :sharp="false" />
        </div>
        <n-empty v-else-if="!filteredNodes.length" description="暂无数据" class="m-empty" />
        <div v-else class="m-list">
          <div v-for="row in mobilePageNodes" :key="row.id" class="m-card">
            <div class="m-head">
              <n-checkbox
                :checked="checkedKeys.includes(row.id)"
                @update:checked="(v: boolean) => (checkedKeys = v ? [...checkedKeys, row.id] : checkedKeys.filter((x) => x !== row.id))"
              />
              <node-status-dot :node="row" />
              <span class="m-name">{{ row.name }}</span>
              <n-switch
                size="small"
                :value="isShown(row)"
                :loading="togglingShow.has(row.id)"
                :rail-style="railStyleFor(row.type)"
                @update:value="(v: boolean) => toggleShow(row, v)"
              />
            </div>
            <div class="m-sub">
              <node-id-badge :node="row" />
              <span class="m-type" :style="{ color: typeColor(row.type, appState.isDark) }">{{ typeLabel(row.type) }}</span>
              <copy-text :text="`${row.host}:${row.port}`" mono max-width="190px" />
            </div>
            <div class="m-grid">
              <div><span class="m-label">部署</span><deploy-cell :node="row" :machine="row.machine_id ? machineMap.get(row.machine_id) ?? null : null" /></div>
              <div><span class="m-label">在线</span><span class="mono">{{ row.online ?? 0 }}</span></div>
              <div><span class="m-label">倍率</span><span class="mono">{{ row.rate }} x</span></div>
              <div><span class="m-label">流量</span><traffic-cell :node="row" /></div>
              <div class="m-span">
                <span class="m-label">权限组</span>
                <span v-if="row.groups?.length" class="nv-groups">
                  <n-tag v-for="g in row.groups" :key="g.id" size="small" :bordered="false" type="info">{{ g.name }}</n-tag>
                </span>
                <span v-else class="muted">--</span>
              </div>
            </div>
            <div class="m-actions">
              <n-button size="small" secondary @click="openEdit(row)">
                <template #icon><n-icon><create-outline /></n-icon></template>
                编辑
              </n-button>
              <n-dropdown
                trigger="click"
                placement="bottom-end"
                :options="rowMenu().filter((o) => o.key !== 'edit')"
                @select="(k: string) => onRowAction(k, row)"
              >
                <n-button size="small" quaternary>
                  更多
                  <template #icon><n-icon><ellipsis-horizontal /></n-icon></template>
                </n-button>
              </n-dropdown>
            </div>
          </div>
          <div class="m-pager">
            <span class="muted m-count">已选择 {{ selectedIds.length }} 项，共 {{ filteredNodes.length }} 项</span>
            <n-pagination
              v-model:page="mobilePage"
              :page-size="MOBILE_PAGE_SIZE"
              :item-count="filteredNodes.length"
              :page-slot="5"
              size="small"
            />
          </div>
        </div>
      </template>

      <!-- desktop table -->
      <n-data-table
        v-else
        class="nv-table"
        :columns="columns"
        :data="filteredNodes"
        :loading="loading && !loaded"
        :row-key="(r: ServerNode) => r.id"
        :checked-row-keys="checkedKeys"
        :pagination="pagination"
        :scroll-x="1420"
        size="small"
        @update:checked-row-keys="(keys: Array<string | number>) => (checkedKeys = keys.map(Number))"
      >
        <template #empty>
          <n-empty :description="hasFilter ? '没有符合筛选条件的节点' : '暂无数据'">
            <template v-if="!hasFilter" #extra>
              <n-button size="small" type="primary" @click="openCreate()">添加节点</n-button>
            </template>
          </n-empty>
        </template>
      </n-data-table>
    </n-card>

    <node-form-modal
      v-model:show="formShow"
      :node="editing"
      :nodes="nodes"
      :preset-machine-id="presetMachineId"
      @saved="onSaved"
      @group-created="loadGroups"
    />
  </page-container>
</template>

<style scoped>
.machine-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 35%, var(--border-color));
  border-radius: 12px;
  background: color-mix(in srgb, var(--primary-color) 7%, var(--card-color));
}
.banner-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
  flex: none;
}
.banner-text {
  flex: 1;
  min-width: 220px;
}
.banner-title {
  font-size: 14px;
}
.banner-desc {
  font-size: 12.5px;
  margin-top: 2px;
}
.banner-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nv-toolbar {
  margin-bottom: 12px;
}
.nv-search {
  width: 240px;
}
.nv-filter {
  width: 170px;
}
.sort-bar {
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary-color) 8%, transparent);
}
.sort-icon {
  color: var(--primary-color);
}
.sort-tip {
  font-size: 13px;
}
.nv-table :deep(.nv-dragging td) {
  opacity: 0.45;
}
.nv-table :deep(.nv-drag-over td) {
  box-shadow: inset 0 2px 0 var(--primary-color);
}
.nv-table :deep(tr[draggable='true']) {
  cursor: grab;
}
:deep(.nv-name) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
:deep(.nv-name-text) {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
:deep(.nv-name-main) {
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.nv-tags) {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
:deep(.nv-th-tip) {
  cursor: help;
  border-bottom: 1px dashed var(--border-color);
}
:deep(.nv-addr) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
:deep(.nv-inner-port) {
  font-size: 12px;
  color: var(--text-muted);
}
:deep(.nv-online) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}
:deep(.nv-rate) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
:deep(.nv-rate-time) {
  color: var(--primary-color);
  cursor: help;
}
:deep(.nv-groups) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
:deep(.nv-actions) {
  display: flex;
  align-items: center;
  gap: 2px;
}
:deep(.nv-handle) {
  color: var(--text-muted);
  cursor: grab;
}
:deep(.nv-type) {
  font-size: 12.5px;
  font-weight: 600;
}
:global(.nv-dot) {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
:global(.nv-legend) {
  font-size: 12px;
  line-height: 1.9;
}
:global(.nv-legend-row) {
  display: flex;
  align-items: center;
  gap: 8px;
}
:global(.nv-rate-tip) {
  font-size: 12px;
  line-height: 1.8;
}
:global(.nv-rate-tip-title) {
  font-weight: 600;
}
:global(.nv-filter-opt) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
:global(.nv-filter-label) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.nv-filter-tag) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
:global(.nv-filter-count) {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}
/* mobile */
.m-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.m-empty {
  padding: 32px 0;
}
.m-card {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 12px;
}
.m-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.m-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.m-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.m-type {
  font-size: 12px;
  font-weight: 600;
}
.m-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin-top: 10px;
  font-size: 13px;
}
.m-grid > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.m-span {
  grid-column: 1 / -1;
}
.m-label {
  font-size: 11.5px;
  color: var(--text-muted);
}
.m-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--divider-color);
}
.m-pager {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.m-count {
  font-size: 12px;
}
@media (max-width: 767px) {
  .nv-search,
  .nv-filter {
    width: 100%;
  }
}
</style>
