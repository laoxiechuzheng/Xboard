<script setup lang="ts">
// 用户管理 (spec users.md §2–§10).
import { computed, h, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import {
  NCard,
  NDataTable,
  NButton,
  NIcon,
  NInput,
  NDropdown,
  NTag,
  NBadge,
  NPopover,
  NCheckbox,
  NCheckboxGroup,
  NEmpty,
  NSpin,
  NPagination,
  NSelect,
  NTooltip,
  type DataTableColumns,
  type DataTableSortState,
  type DropdownOption,
} from 'naive-ui'
import {
  AddOutline,
  SearchOutline,
  FunnelOutline,
  CloseOutline,
  ChevronDownOutline,
  RefreshOutline,
  EllipsisHorizontal,
  CreateOutline,
  CartOutline,
  LinkOutline,
  KeyOutline,
  ReceiptOutline,
  PeopleOutline,
  StatsChartOutline,
  ReloadCircleOutline,
  TimeOutline,
  InformationCircleOutline,
  TrashOutline,
  MailOutline,
  DownloadOutline,
  BanOutline,
  OptionsOutline,
  FingerPrintOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import AssignOrderDialog from '@/views/finance/order/AssignOrderDialog.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import { fetchPlanOptions, type PlanBrief } from '@/api/common'
import {
  destroyUser,
  dumpUsersCsv,
  fetchUsers,
  resetUserSecret,
  type UserFilter,
  type UserRow,
  type UserSort,
} from '@/api/user'
import { appState } from '@/stores/app'
import { authState } from '@/stores/auth'
import { loadPlugins, pluginState } from '@/stores/plugins'
import { copyText, saveFile } from '@/utils/clipboard'
import { confirm, dialog, message } from '@/utils/discrete'
import { formatBytes, formatNumber, formatTime } from '@/utils/format'
import { storage } from '@/utils/storage'
import EmailCell from './user/EmailCell.vue'
import ExpireTag from './user/ExpireTag.vue'
import TrafficUsage from './user/TrafficUsage.vue'
import OnlineCount from './user/OnlineCount.vue'
import UserEditDrawer from './user/UserEditDrawer.vue'
import UserDetailDialog from './user/UserDetailDialog.vue'
import CreateUserDialog from './user/CreateUserDialog.vue'
import AdvancedFilterDrawer from './user/AdvancedFilterDrawer.vue'
import SendMailDialog from './user/SendMailDialog.vue'
import BanUsersDialog from './user/BanUsersDialog.vue'
import TrafficRecordDialog from './user/TrafficRecordDialog.vue'
import TrafficResetDialog from './user/TrafficResetDialog.vue'
import LoginLogDialog from './user/LoginLogDialog.vue'
import {
  buildFilterFields,
  conditionLabel,
  conditionToFilter,
  containsValue,
  money,
  truthy,
  type FilterCondition,
} from './user/helpers'
import { autoScope, scopePayload, scopeSuffix, type SelectedUserBrief } from './user/scope'

const route = useRoute()
const router = useRouter()

// ------------------------------------------------------------------ lookups

const plans = ref<PlanBrief[]>([])
const planOptions = computed(() => plans.value.map((p) => ({ label: p.name, value: p.id })))
const phoneAuthEnabled = computed(() =>
  pluginState.list.some((p) => p.code === 'phone_auth' && p.is_installed && p.is_enabled),
)
const filterFields = computed(() => buildFilterFields(planOptions.value, phoneAuthEnabled.value))
const fieldDef = (key: string) => filterFields.value.find((f) => f.key === key)

// ------------------------------------------------------------------ filters & sorting

const keyword = ref('')
const appliedKeyword = ref('')
const conditions = ref<FilterCondition[]>([])
const sort = ref<UserSort | null>(null)

const filters = computed<UserFilter[]>(() => {
  const out: UserFilter[] = []
  const kw = appliedKeyword.value.trim()
  if (kw) out.push({ id: 'email', value: containsValue(kw) })
  for (const c of conditions.value) out.push(conditionToFilter(c, fieldDef(c.field)))
  return out
})
const hasFilters = computed(() => filters.value.length > 0)

const table = usePagedTable<UserRow>(
  async (q) => {
    const res = await fetchUsers({ ...q, filter: filters.value, sort: sort.value ? [sort.value] : undefined })
    return { data: res.data ?? [], total: res.total ?? 0 }
  },
  { pageSize: 20, pageSizes: [10, 20, 30, 40, 50, 100, 500], immediate: false },
)
table.pagination.showQuickJumper = true
table.pagination.prefix = ({ itemCount }) => `共 ${formatNumber(itemCount ?? 0)} 个用户`

let kwTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, (v) => {
  clearTimeout(kwTimer)
  kwTimer = setTimeout(() => (appliedKeyword.value = v), 300)
})
onBeforeUnmount(() => clearTimeout(kwTimer))

// Any filter change: back to page 1 and drop the selection (rows may no longer match).
watch(
  () => JSON.stringify(filters.value),
  () => {
    clearSelection()
    void table.search()
  },
)

function setKeywordNow(v: string) {
  clearTimeout(kwTimer)
  keyword.value = v
  appliedKeyword.value = v
}

function removeCondition(i: number) {
  conditions.value = conditions.value.filter((_, idx) => idx !== i)
}

function resetFilters() {
  setKeywordNow('')
  conditions.value = []
  if (Object.keys(route.query).length) void router.replace({ query: {} })
}

const filterChips = computed(() => {
  const chips: { key: string; label: string; onClose: () => void }[] = []
  if (appliedKeyword.value.trim()) {
    chips.push({ key: 'kw', label: `邮箱 包含 ${appliedKeyword.value.trim()}`, onClose: () => setKeywordNow('') })
  }
  conditions.value.forEach((c, i) =>
    chips.push({ key: `c${i}`, label: conditionLabel(c, fieldDef(c.field)), onClose: () => removeCondition(i) }),
  )
  return chips
})

function sortOrderOf(key: string): 'ascend' | 'descend' | false {
  if (sort.value?.id !== key) return false
  return sort.value.desc ? 'descend' : 'ascend'
}

// Header clicks cycle asc -> desc -> none (official: first click is asc). Naive's own cycle is
// descend-first and `customNextSortOrder` is skipped for an unsorted column, so the next state is
// derived from our controlled `sort` and only the clicked column key is taken from the event.
function onSorterChange(s: DataTableSortState | DataTableSortState[] | null) {
  const st = Array.isArray(s) ? s[0] : s
  const key = st ? String(st.columnKey) : ''
  if (!key) sort.value = null
  else if (sort.value?.id !== key) sort.value = { id: key, desc: false }
  else if (!sort.value.desc) sort.value = { id: key, desc: true }
  else sort.value = null
  void table.search()
}

const MOBILE_SORTS = [
  { label: '默认排序（ID 倒序）', value: '' },
  { label: 'ID 从小到大', value: 'id:asc' },
  { label: '已用流量 从多到少', value: 'total_used:desc' },
  { label: '总流量 从多到少', value: 'transfer_enable:desc' },
  { label: '到期时间 从早到晚', value: 'expired_at:asc' },
  { label: '到期时间 从晚到早', value: 'expired_at:desc' },
  { label: '在线设备 从多到少', value: 'online_count:desc' },
  { label: '余额 从高到低', value: 'balance:desc' },
  { label: '注册时间 从新到旧', value: 'created_at:desc' },
]
const mobileSort = computed({
  get: () => (sort.value ? `${sort.value.id}:${sort.value.desc ? 'desc' : 'asc'}` : ''),
  set: (v: string) => {
    if (!v) sort.value = null
    else {
      const [id, dir] = v.split(':')
      sort.value = { id, desc: dir === 'desc' }
    }
    void table.search()
  },
})

// ------------------------------------------------------------------ deep links (?email= / ?id= / ?invite_user_id=)

function applyQuery(q: LocationQuery): boolean {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? String(v[0] ?? '').trim() : '')
  const email = str(q.email)
  const id = str(q.id)
  const inviter = str(q.invite_user_id)
  if (!email && !id && !inviter) return false
  setKeywordNow(email)
  const next: FilterCondition[] = []
  if (/^\d+$/.test(id)) next.push({ field: 'id', operator: 'eq', value: Number(id) })
  if (/^\d+$/.test(inviter)) next.push({ field: 'invite_user_id', operator: 'eq', value: Number(inviter) })
  conditions.value = next
  return true
}

watch(
  () => route.query,
  (q) => {
    if (route.path === '/user/manage') applyQuery(q)
  },
)

// ------------------------------------------------------------------ selection (kept across pages)

const checkedKeys = ref<number[]>([])
const selectedBriefs = ref<Record<number, SelectedUserBrief>>({})
const selectedList = computed(() => checkedKeys.value.map((k) => selectedBriefs.value[k]).filter(Boolean))

function onCheckedChange(keys: (string | number)[]) {
  const ids = keys.map(Number)
  const set = new Set(ids)
  const next: Record<number, SelectedUserBrief> = {}
  for (const id of ids) if (selectedBriefs.value[id]) next[id] = selectedBriefs.value[id]
  for (const r of table.data.value) {
    if (set.has(r.id)) next[r.id] = { id: r.id, email: r.email, is_admin: truthy(r.is_admin) }
  }
  selectedBriefs.value = next
  checkedKeys.value = ids
}

function toggleRow(row: UserRow, checked: boolean) {
  const keys = checked ? [...checkedKeys.value, row.id] : checkedKeys.value.filter((k) => k !== row.id)
  onCheckedChange(keys)
}

function clearSelection() {
  checkedKeys.value = []
  selectedBriefs.value = {}
}

const bulkScope = computed(() => autoScope(checkedKeys.value.length, filters.value.length))

// ------------------------------------------------------------------ dialogs

const createShow = ref(false)
const filterShow = ref(false)
const mailShow = ref(false)
const banShow = ref(false)
const editShow = ref(false)
const editRow = ref<UserRow | null>(null)
const detailShow = ref(false)
const detailRow = ref<UserRow | null>(null)
const assignShow = ref(false)
const assignEmail = ref('')
const trafficShow = ref(false)
const trafficRow = ref<UserRow | null>(null)
const resetShow = ref(false)
const resetRow = ref<UserRow | null>(null)
const loginLogShow = ref(false)
const loginLogRow = ref<UserRow | null>(null)

function openDetail(row: UserRow) {
  detailRow.value = row
  detailShow.value = true
}

function filterByEmail(email: string) {
  conditions.value = []
  setKeywordNow(email)
  void router.replace({ query: { email } })
}

function onFilterApply(next: FilterCondition[]) {
  conditions.value = next
}

// ------------------------------------------------------------------ row actions

const isSelf = (row: UserRow) => !!authState.user?.email && row.email.toLowerCase() === authState.user.email.toLowerCase()
const renderIcon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })

const rowActions: DropdownOption[] = [
  { label: '编辑', key: 'edit', icon: renderIcon(CreateOutline) },
  { label: '分配订单', key: 'assign', icon: renderIcon(CartOutline) },
  { label: '复制订阅URL', key: 'copy-sub', icon: renderIcon(LinkOutline) },
  { label: '重置UUID及订阅URL', key: 'reset-secret', icon: renderIcon(KeyOutline) },
  { type: 'divider', key: 'd1' },
  { label: 'TA的订单', key: 'orders', icon: renderIcon(ReceiptOutline) },
  { label: 'TA的邀请', key: 'invites', icon: renderIcon(PeopleOutline) },
  { label: 'TA的流量记录', key: 'traffic', icon: renderIcon(StatsChartOutline) },
  { label: '登录记录', key: 'login-log', icon: renderIcon(FingerPrintOutline) },
  { label: '重置流量', key: 'reset-traffic', icon: renderIcon(ReloadCircleOutline) },
  { label: '查看重置日志', key: 'reset-logs', icon: renderIcon(TimeOutline) },
  { label: '查看详情', key: 'detail', icon: renderIcon(InformationCircleOutline) },
  { type: 'divider', key: 'd2' },
  {
    label: () => h('span', { style: 'color: var(--error-color)' }, '删除'),
    key: 'delete',
    icon: () => h(NIcon, { color: 'var(--error-color)' }, { default: () => h(TrashOutline) }),
  },
]

async function onRowAction(key: string, row: UserRow) {
  switch (key) {
    case 'edit':
      editRow.value = row
      editShow.value = true
      break
    case 'assign':
      assignEmail.value = row.email
      assignShow.value = true
      break
    case 'copy-sub':
      if (row.subscribe_url) void copyText(row.subscribe_url, '复制成功')
      else message.warning('该用户没有订阅地址')
      break
    case 'reset-secret':
      await doResetSecret(row)
      break
    case 'orders':
      void router.push({ path: '/finance/order', query: { user_id: String(row.id) } })
      break
    case 'invites':
      setKeywordNow('')
      conditions.value = [{ field: 'invite_user_id', operator: 'eq', value: row.id }]
      break
    case 'traffic':
      trafficRow.value = row
      trafficShow.value = true
      break
    case 'login-log':
      loginLogRow.value = row
      loginLogShow.value = true
      break
    case 'reset-traffic':
      resetRow.value = row
      resetShow.value = true
      break
    case 'reset-logs':
      void router.push({ path: '/user/traffic-reset-logs', query: { user_id: String(row.id) } })
      break
    case 'detail':
      openDetail(row)
      break
    case 'delete':
      await doDelete(row)
      break
  }
}

async function doResetSecret(row: UserRow) {
  const ok = await confirm({
    title: '重置UUID及订阅URL',
    content: `将为 ${row.email} 生成新的 UUID 和订阅 Token。原订阅链接会立即失效，该用户所有客户端都需要重新导入订阅。确定继续吗？`,
    positiveText: '确认重置',
    type: 'warning',
  })
  if (!ok) return
  try {
    const res = await resetUserSecret(row.id)
    if (res) {
      message.success('重置成功')
      void table.reload()
    } else {
      message.error('重置失败')
    }
  } catch {
    /* toast handled by http client */
  }
}

// Delete confirm with a separate, highlighted warning paragraph when deleting the signed-in admin.
function confirmDelete(row: UserRow): Promise<boolean> {
  const self = isSelf(row)
  const body = `此操作将永久删除用户 ${row.email} 及其所有相关数据，包括订单、邀请码、流量记录、工单记录等信息。删除后无法恢复，是否继续？`
  return new Promise((resolve) => {
    dialog.error({
      title: self ? '确认删除当前登录的管理员账号' : '确认删除用户',
      content: () =>
        h('div', [
          self
            ? h(
                'p',
                { style: 'margin: 0 0 10px; color: var(--error-color); font-weight: 600' },
                '警告：这是你当前登录的管理员账号，删除后将立即无法再登录后台！',
              )
            : null,
          h('p', { style: 'margin: 0' }, body),
        ]),
      positiveText: '确认删除',
      negativeText: '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
      onMaskClick: () => resolve(false),
    })
  })
}

async function doDelete(row: UserRow) {
  const ok = await confirmDelete(row)
  if (!ok) return
  try {
    const res = await destroyUser(row.id)
    if (res) {
      message.success('删除成功')
      if (checkedKeys.value.includes(row.id)) onCheckedChange(checkedKeys.value.filter((k) => k !== row.id))
      void table.reload()
    } else {
      message.error('删除失败')
    }
  } catch {
    /* toast handled by http client */
  }
}

// ------------------------------------------------------------------ bulk actions

const exporting = ref(false)

const bulkOptions = computed<DropdownOption[]>(() => {
  const suffix = scopeSuffix(bulkScope.value, checkedKeys.value.length)
  return [
    { label: `发送邮件${suffix}`, key: 'mail', icon: renderIcon(MailOutline) },
    { label: `导出 CSV${suffix}`, key: 'export', icon: renderIcon(DownloadOutline), disabled: exporting.value },
    { type: 'divider', key: 'd' },
    {
      label: () => h('span', { style: 'color: var(--error-color)' }, `批量封禁${suffix}`),
      key: 'ban',
      icon: () => h(NIcon, { color: 'var(--error-color)' }, { default: () => h(BanOutline) }),
    },
  ]
})

function onBulk(key: string) {
  if (key === 'mail') mailShow.value = true
  else if (key === 'ban') banShow.value = true
  else if (key === 'export') void exportCsv()
}

function fileStamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function exportCsv() {
  const payload = scopePayload(bulkScope.value, [...checkedKeys.value], filters.value)
  if (!payload || exporting.value) return
  exporting.value = true
  const loading = message.loading('正在导出 CSV，数据量大时可能需要较长时间…', { duration: 0 })
  try {
    const blob = await dumpUsersCsv(payload)
    if (!(blob instanceof Blob)) throw new Error('unexpected response')
    saveFile(blob, `users_${fileStamp()}.csv`)
    message.success('导出成功')
  } catch (e) {
    if (!(e instanceof Error && e.name === 'ApiError')) message.error('导出失败')
  } finally {
    loading.destroy()
    exporting.value = false
  }
}

function onBanned() {
  clearSelection()
  void table.reload()
}

// ------------------------------------------------------------------ columns

interface ToggleColumn {
  key: string
  title: string
}
const TOGGLE_COLUMNS: ToggleColumn[] = [
  { key: 'is_admin', title: '管理员' },
  { key: 'is_staff', title: '员工' },
  { key: 'email', title: '邮箱' },
  { key: 'online_count', title: '在线设备' },
  { key: 'banned', title: '状态' },
  { key: 'plan_id', title: '订阅' },
  { key: 'group_id', title: '权限组' },
  { key: 'total_used', title: '已用流量' },
  { key: 'transfer_enable', title: '总流量' },
  { key: 'expired_at', title: '到期时间' },
  { key: 'balance', title: '余额' },
  { key: 'commission_balance', title: '佣金' },
  { key: 'created_at', title: '注册时间' },
]
const DEFAULT_HIDDEN = ['is_admin', 'is_staff', 'plan_id', 'commission_balance', 'created_at']
const COLUMNS_STORAGE_KEY = 'user_table_hidden_columns'

function loadHidden(): string[] {
  try {
    const raw = storage.get(COLUMNS_STORAGE_KEY)
    const v = raw ? JSON.parse(raw) : null
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [...DEFAULT_HIDDEN]
  } catch {
    return [...DEFAULT_HIDDEN]
  }
}
const hiddenColumns = ref<string[]>(loadHidden())
const visibleColumnKeys = computed({
  get: () => TOGGLE_COLUMNS.map((c) => c.key).filter((k) => !hiddenColumns.value.includes(k)),
  set: (keys: string[]) => {
    hiddenColumns.value = TOGGLE_COLUMNS.map((c) => c.key).filter((k) => !keys.includes(k))
  },
})
watch(hiddenColumns, (v) => storage.set(COLUMNS_STORAGE_KEY, JSON.stringify(v)))

const yesNo = (v: unknown, type: 'error' | 'info') =>
  truthy(v)
    ? h(NTag, { size: 'small', type, bordered: false, round: true }, { default: () => '是' })
    : h('span', { class: 'muted' }, '否')

const allColumns = computed<(DataTableColumns<UserRow>[number] & { key?: string; width?: number })[]>(() => [
  { type: 'selection', fixed: 'left', width: 44 },
  { title: '管理员', key: 'is_admin', width: 80, align: 'center', render: (r) => yesNo(r.is_admin, 'error') },
  { title: '员工', key: 'is_staff', width: 72, align: 'center', render: (r) => yesNo(r.is_staff, 'info') },
  {
    title: 'ID',
    key: 'id',
    width: 84,
    sorter: true,
    sortOrder: sortOrderOf('id'),
    render: (r) => h(NTag, { size: 'small', bordered: true }, { default: () => h('span', { class: 'num' }, String(r.id)) }),
  },
  { title: '邮箱', key: 'email', width: 260, render: (r) => h(EmailCell, { row: r, onOpen: openDetail }) },
  {
    title: '在线设备',
    key: 'online_count',
    width: 108,
    sorter: true,
    sortOrder: sortOrderOf('online_count'),
    render: (r) => h(OnlineCount, { online: r.online_count, limit: r.device_limit }),
  },
  {
    title: '状态',
    key: 'banned',
    width: 84,
    align: 'center',
    sorter: true,
    sortOrder: sortOrderOf('banned'),
    render: (r) =>
      truthy(r.banned)
        ? h(NTag, { size: 'small', type: 'error', bordered: false, round: true }, { default: () => '封禁' })
        : h(NTag, { size: 'small', type: 'success', bordered: false, round: true }, { default: () => '正常' }),
  },
  { title: '订阅', key: 'plan_id', width: 140, ellipsis: { tooltip: true }, render: (r) => r.plan?.name || '-' },
  {
    title: '权限组',
    key: 'group_id',
    width: 120,
    render: (r) =>
      r.group?.name ? h(NTag, { size: 'small', bordered: true }, { default: () => r.group!.name }) : h('span', { class: 'muted' }, '-'),
  },
  {
    title: '已用流量',
    key: 'total_used',
    width: 180,
    sorter: true,
    sortOrder: sortOrderOf('total_used'),
    render: (r) => h(TrafficUsage, { used: r.total_used, total: r.transfer_enable }),
  },
  {
    title: '总流量',
    key: 'transfer_enable',
    width: 110,
    sorter: true,
    sortOrder: sortOrderOf('transfer_enable'),
    render: (r) => h('span', { class: 'num muted' }, formatBytes(r.transfer_enable)),
  },
  {
    title: '到期时间',
    key: 'expired_at',
    width: 128,
    sorter: true,
    sortOrder: sortOrderOf('expired_at'),
    render: (r) => h(ExpireTag, { expiredAt: r.expired_at, nextResetAt: r.next_reset_at, block: true }),
  },
  {
    title: '余额',
    key: 'balance',
    width: 104,
    sorter: true,
    sortOrder: sortOrderOf('balance'),
    render: (r) => h('span', { class: 'num' }, money(r.balance)),
  },
  {
    title: '佣金',
    key: 'commission_balance',
    width: 104,
    sorter: true,
    sortOrder: sortOrderOf('commission_balance'),
    render: (r) => h('span', { class: 'num' }, money(r.commission_balance)),
  },
  {
    title: '注册时间',
    key: 'created_at',
    width: 170,
    sorter: true,
    sortOrder: sortOrderOf('created_at'),
    render: (r) => h('span', { class: 'num' }, formatTime(r.created_at)),
  },
  {
    title: '操作',
    key: 'actions',
    width: 64,
    fixed: 'right',
    align: 'center',
    render: (r) =>
      h(
        NDropdown,
        { options: rowActions, trigger: 'click', placement: 'bottom-end', onSelect: (k: string) => onRowAction(k, r) },
        {
          default: () =>
            h(
              NButton,
              { quaternary: true, circle: true, size: 'small', 'aria-label': '更多操作' },
              { icon: () => h(NIcon, null, { default: () => h(EllipsisHorizontal) }) },
            ),
        },
      ),
  },
])

const columns = computed(() =>
  allColumns.value.filter((c) => !('key' in c) || !c.key || !hiddenColumns.value.includes(String(c.key))),
)
const scrollX = computed(() => columns.value.reduce((sum, c) => sum + (Number(c.width) || 120), 0))

// ------------------------------------------------------------------ mobile pagination

const pageCount = computed(() =>
  Math.max(1, Math.ceil((table.pagination.itemCount ?? 0) / (table.pagination.pageSize ?? 20))),
)
function goPage(p: number) {
  table.pagination.page = p
  void table.reload()
}
function setPageSize(s: number) {
  table.pagination.pageSize = s
  table.pagination.page = 1
  void table.reload()
}

// ------------------------------------------------------------------ init

onMounted(async () => {
  // A changed filter triggers the filters watcher; only search explicitly when nothing changed.
  const before = JSON.stringify(filters.value)
  applyQuery(route.query)
  if (JSON.stringify(filters.value) === before) void table.search()
  void loadPlugins().catch(() => undefined)
  try {
    plans.value = await fetchPlanOptions()
  } catch {
    plans.value = []
  }
})
</script>

<template>
  <page-container title="用户管理" description="在这里可以管理用户，包括增加、删除、编辑、查询等操作。">
    <template #extra>
      <n-button secondary @click="router.push('/user/login-log')">
        <template #icon><n-icon><finger-print-outline /></n-icon></template>
        登录记录
      </n-button>
      <n-button secondary @click="router.push('/user/traffic-reset-logs')">
        <template #icon><n-icon><time-outline /></n-icon></template>
        流量重置日志
      </n-button>
    </template>

    <n-card :bordered="false" class="list-card" content-style="padding: 16px">
      <div class="toolbar">
        <n-button type="primary" @click="createShow = true">
          <template #icon><n-icon><add-outline /></n-icon></template>
          创建用户
        </n-button>
        <n-input v-model:value="keyword" placeholder="搜索用户邮箱..." clearable class="search">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <div class="grow" />
        <n-badge :value="conditions.length" :show="conditions.length > 0" type="info">
          <n-button dashed @click="filterShow = true">
            <template #icon><n-icon><funnel-outline /></n-icon></template>
            高级筛选
          </n-button>
        </n-badge>
        <n-button v-if="hasFilters" quaternary @click="resetFilters">
          <template #icon><n-icon><close-outline /></n-icon></template>
          重置
        </n-button>
        <n-dropdown trigger="click" :options="bulkOptions" placement="bottom-end" @select="onBulk">
          <n-button dashed :loading="exporting" icon-placement="right">
            <template #icon><n-icon><chevron-down-outline /></n-icon></template>
            操作
            <span v-if="bulkScope === 'selected'" class="scope-dot" />
          </n-button>
        </n-dropdown>
        <n-popover v-if="!appState.isMobile" trigger="click" placement="bottom-end">
          <template #trigger>
            <n-button quaternary>
              <template #icon><n-icon><options-outline /></n-icon></template>
              显示列
            </n-button>
          </template>
          <div class="col-panel">
            <div class="col-panel-title">切换显示列</div>
            <n-checkbox-group v-model:value="visibleColumnKeys">
              <div class="col-list">
                <n-checkbox v-for="c in TOGGLE_COLUMNS" :key="c.key" :value="c.key" :label="c.title" />
              </div>
            </n-checkbox-group>
            <n-button text size="small" type="primary" class="col-reset" @click="hiddenColumns = [...DEFAULT_HIDDEN]">恢复默认</n-button>
          </div>
        </n-popover>
        <n-select
          v-else
          v-model:value="mobileSort"
          :options="MOBILE_SORTS"
          size="medium"
          class="mobile-sort"
          :consistent-menu-width="false"
        />
        <n-tooltip>
          <template #trigger>
            <n-button quaternary circle aria-label="刷新" :loading="table.loading.value" @click="table.reload()">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </div>

      <div v-if="filterChips.length || checkedKeys.length" class="chips">
        <n-tag v-for="c in filterChips" :key="c.key" closable size="small" round @close="c.onClose">{{ c.label }}</n-tag>
        <span v-if="checkedKeys.length" class="selection-info">
          已选择 <strong class="num">{{ checkedKeys.length }}</strong> 项（翻页保留）
          <n-button text size="tiny" type="primary" @click="clearSelection">清除选择</n-button>
        </span>
      </div>

      <n-data-table
        v-if="!appState.isMobile"
        remote
        class="user-table"
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :pagination="table.pagination"
        :row-key="(r: UserRow) => r.id"
        :checked-row-keys="checkedKeys"
        :scroll-x="scrollX"
        size="small"
        @update:checked-row-keys="onCheckedChange"
        @update:sorter="onSorterChange"
      >
        <template #empty>
          <n-empty :description="hasFilters ? '没有符合条件的用户' : '暂无数据'" />
        </template>
      </n-data-table>

      <template v-else>
        <n-spin :show="table.loading.value">
          <div class="cards">
            <div v-for="row in table.data.value" :key="row.id" class="ucard">
              <div class="ucard-head">
                <n-checkbox
                  :checked="checkedKeys.includes(row.id)"
                  aria-label="选择用户"
                  @update:checked="(v: boolean) => toggleRow(row, v)"
                />
                <div class="ucard-email"><email-cell :row="row" @open="openDetail" /></div>
                <n-dropdown trigger="click" placement="bottom-end" :options="rowActions" @select="(k: string) => onRowAction(k, row)">
                  <n-button quaternary circle size="small" aria-label="更多操作">
                    <template #icon><n-icon><ellipsis-horizontal /></n-icon></template>
                  </n-button>
                </n-dropdown>
              </div>
              <div class="ucard-grid">
                <div class="cell">
                  <span class="k">ID</span><span class="num">{{ row.id }}</span>
                </div>
                <div class="cell">
                  <span class="k">状态</span>
                  <n-tag size="small" round :bordered="false" :type="truthy(row.banned) ? 'error' : 'success'">
                    {{ truthy(row.banned) ? '封禁' : '正常' }}
                  </n-tag>
                </div>
                <div class="cell">
                  <span class="k">在线设备</span><online-count :online="row.online_count" :limit="row.device_limit" />
                </div>
                <div class="cell">
                  <span class="k">到期时间</span><expire-tag :expired-at="row.expired_at" :next-reset-at="row.next_reset_at" />
                </div>
                <div class="cell">
                  <span class="k">总流量</span><span class="num">{{ formatBytes(row.transfer_enable) }}</span>
                </div>
                <div class="cell stretch">
                  <span class="k">已用流量</span>
                  <traffic-usage :used="row.total_used" :total="row.transfer_enable" />
                </div>
              </div>
            </div>
            <n-empty
              v-if="!table.loading.value && !table.data.value.length"
              :description="hasFilters ? '没有符合条件的用户' : '暂无数据'"
              class="cards-empty"
            />
          </div>
        </n-spin>
        <div class="mobile-pager">
          <span class="muted">共 {{ formatNumber(table.pagination.itemCount ?? 0) }} 个</span>
          <n-pagination
            :page="table.pagination.page"
            :page-size="table.pagination.pageSize"
            :page-count="pageCount"
            :page-sizes="[10, 20, 30, 40, 50, 100, 500]"
            show-size-picker
            simple
            @update:page="goPage"
            @update:page-size="setPageSize"
          />
        </div>
      </template>
    </n-card>

    <create-user-dialog v-model:show="createShow" @success="table.search()" />
    <advanced-filter-drawer v-model:show="filterShow" :conditions="conditions" :fields="filterFields" @apply="onFilterApply" />
    <send-mail-dialog
      v-model:show="mailShow"
      :default-scope="bulkScope"
      :selected-ids="checkedKeys"
      :filter="filters"
      :filtered-total="table.pagination.itemCount ?? 0"
    />
    <ban-users-dialog v-model:show="banShow" :default-scope="bulkScope" :selected="selectedList" :filter="filters" @success="onBanned" />
    <user-edit-drawer v-model:show="editShow" :user-id="editRow?.id ?? null" :user="editRow" @saved="table.reload()" />
    <user-detail-dialog v-model:show="detailShow" :user="detailRow" @filter-email="filterByEmail" />
    <assign-order-dialog v-model:show="assignShow" :email="assignEmail" @success="table.reload()" />
    <traffic-record-dialog v-model:show="trafficShow" :user-id="trafficRow?.id ?? null" :email="trafficRow?.email" />
    <traffic-reset-dialog v-model:show="resetShow" :user="resetRow" @success="table.reload()" />
    <login-log-dialog v-model:show="loginLogShow" :user-id="loginLogRow?.id ?? null" :email="loginLogRow?.email" />
  </page-container>
</template>

<style scoped>
.list-card {
  border-radius: 12px;
}
.toolbar {
  margin-bottom: 12px;
}
.search {
  width: 260px;
  max-width: 100%;
}
.scope-dot {
  width: 6px;
  height: 6px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--primary-color);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: -4px 0 12px;
}
.selection-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.num,
.user-table :deep(.num) {
  font-variant-numeric: tabular-nums;
}
.user-table :deep(.muted) {
  color: var(--text-muted);
}
.col-panel {
  min-width: 180px;
  padding: 4px 2px;
}
.col-panel-title {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.col-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}
.col-reset {
  margin-top: 10px;
}
.mobile-sort {
  width: 180px;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}
.ucard {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.ucard-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ucard-email {
  flex: 1;
  min-width: 0;
}
.ucard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin-top: 10px;
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  font-size: 13px;
}
.cell.stretch {
  align-items: stretch;
}
.k {
  font-size: 12px;
  color: var(--text-muted);
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
@media (max-width: 767px) {
  .search {
    width: 100%;
    order: 10;
  }
  .toolbar .grow {
    display: none;
  }
}
</style>
