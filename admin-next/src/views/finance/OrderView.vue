<script setup lang="ts">
// Order list with server-side paging / filtering / sorting and commission handling.
// Spec: docs/admin-next/spec/commerce.md §3 (bugs fixed: period filter sends DB format,
// deep-link numbers become exact matches, order_id maps to id, surplus_credit shown).
import { computed, h, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import {
  NCard,
  NDataTable,
  NButton,
  NIcon,
  NInput,
  NSelect,
  NTag,
  NTooltip,
  NDropdown,
  NEllipsis,
  type DataTableColumns,
  type DataTableSortState,
  type DropdownOption,
} from 'naive-ui'
import {
  AddOutline,
  SearchOutline,
  EllipsisHorizontal,
  HelpCircleOutline,
  RefreshOutline,
  CloseOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import {
  fetchOrders,
  findEnum,
  ORDER_STATUS,
  ORDER_TYPE,
  COMMISSION_STATUS,
  type Order,
  type OrderFilter,
  type OrderSort,
  type EnumOption,
} from '@/api/order'
import { PLAN_PERIODS, PERIOD_BY_KEY, PERIOD_BY_LEGACY, type LegacyPeriod, type PlanPeriod } from '@/api/plan'
import { formatMoney, formatTime } from '@/utils/format'
import AssignOrderDialog from './order/AssignOrderDialog.vue'
import OrderDetailModal from './order/OrderDetailModal.vue'
import { shortTradeNo, useOrderActions } from './order/useOrderActions'

const route = useRoute()
const router = useRouter()

// ---------- filters ----------
const filters = reactive({
  keyword: '',
  type: [] as number[],
  period: [] as PlanPeriod[],
  status: [] as number[],
  commission_status: [] as number[],
})

/** Column filters that come only from deep links (shown as removable chips). */
interface ExtraFilter {
  id: 'user_id' | 'id' | 'commission_balance' | 'invite_user_id' | 'plan_id'
  value: string
  /** query key it came from, removed from the URL when the chip is closed */
  queryKey: string
}
const extraFilters = ref<ExtraFilter[]>([])

const OPS: Record<string, string> = { eq: '=', gt: '>', gte: '≥', lt: '<', lte: '≤', like: '包含', notlike: '不包含' }
const OP_RE = /^(eq|gt|gte|lt|lte|like|notlike):(.+)$/i

/** Plain number -> exact match; "op:value" kept as-is; anything else rejected. */
function toOpValue(raw: string): string | null {
  const s = raw.trim()
  if (/^-?\d+(\.\d+)?$/.test(s)) return `eq:${s}`
  const m = s.match(OP_RE)
  return m ? `${m[1].toLowerCase()}:${m[2]}` : null
}

/** "3" / "eq:3" / "0,3" -> [3] / [3] / [0, 3] */
function toNumberList(raw: string, allowed: EnumOption[]): number[] {
  const s = raw.trim().replace(/^eq:/i, '')
  return s
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x))
    .map(Number)
    .filter((n, i, arr) => arr.indexOf(n) === i && allowed.some((o) => o.value === n))
}

function firstQuery(q: LocationQuery, key: string): string | null {
  const v = q[key]
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && s.trim() !== '' ? s : null
}

function applyQuery(q: LocationQuery) {
  filters.keyword = firstQuery(q, 'trade_no') ?? ''
  filters.type = toNumberList(firstQuery(q, 'type') ?? '', ORDER_TYPE)
  filters.status = toNumberList(firstQuery(q, 'status') ?? '', ORDER_STATUS)
  filters.commission_status = toNumberList(firstQuery(q, 'commission_status') ?? '', COMMISSION_STATUS)
  const period = firstQuery(q, 'period')
  filters.period = period
    ? period
        .split(',')
        .map((p) => PERIOD_BY_KEY[p as PlanPeriod]?.key ?? PERIOD_BY_LEGACY[p as LegacyPeriod]?.key)
        .filter((p): p is PlanPeriod => !!p)
    : []

  const extras: ExtraFilter[] = []
  const pick = (queryKey: string, id: ExtraFilter['id']) => {
    const raw = firstQuery(q, queryKey)
    const value = raw ? toOpValue(raw) : null
    if (value) extras.push({ id, value, queryKey })
  }
  pick('user_id', 'user_id')
  pick('order_id', 'id')
  pick('id', 'id')
  pick('invite_user_id', 'invite_user_id')
  pick('plan_id', 'plan_id')
  pick('commission_balance', 'commission_balance')
  extraFilters.value = extras.filter((f, i) => extras.findIndex((x) => x.id === f.id) === i)
}

function buildFilter(): OrderFilter[] {
  const out: OrderFilter[] = []
  const kw = filters.keyword.trim()
  // Plain keywords go as-is (backend: like %kw%). Only a keyword containing ":" gets a "like:" prefix,
  // since the backend casts numeric-looking "op:value" values (e.g. "6e4", "0522") to numbers.
  if (kw) out.push({ id: 'trade_no', value: kw.includes(':') ? `like:${kw}` : kw })
  if (filters.type.length) out.push({ id: 'type', value: [...filters.type] })
  if (filters.period.length) {
    // v2_order.period stores the new format; legacy keys are added for any unconverted rows.
    out.push({ id: 'period', value: filters.period.flatMap((p) => [p, PERIOD_BY_KEY[p].legacy]) })
  }
  if (filters.status.length) out.push({ id: 'status', value: [...filters.status] })
  if (filters.commission_status.length) out.push({ id: 'commission_status', value: [...filters.commission_status] })
  for (const f of extraFilters.value) out.push({ id: f.id, value: f.value })
  return out
}

// ---------- sorting ----------
const sortState = ref<{ key: OrderSort['id']; order: 'ascend' | 'descend' } | null>(null)

function buildSort(): OrderSort[] | undefined {
  return sortState.value ? [{ id: sortState.value.key, desc: sortState.value.order === 'descend' }] : undefined
}

function onSorter(s: DataTableSortState | DataTableSortState[] | null) {
  const one = Array.isArray(s) ? s[0] : s
  sortState.value =
    one && one.order ? { key: one.columnKey as OrderSort['id'], order: one.order as 'ascend' | 'descend' } : null
  void table.search()
}

// ---------- table ----------
const table = usePagedTable<Order>(
  async (q) => {
    const res = await fetchOrders({ current: q.current, pageSize: q.pageSize, filter: buildFilter(), sort: buildSort() })
    return { data: res.data ?? [], total: res.total ?? 0 }
  },
  { pageSize: 20, pageSizes: [10, 20, 30, 40, 50, 100, 500], immediate: false },
)
table.pagination.showQuickJumper = true

// Deep links: /finance/order?user_id=5&status=3&commission_status=0&commission_balance=gt:0 ...
// Later query changes (same page, new link) re-apply; the filter watchers below then reload.
let appliedQuery = ''
let loadedOnce = false
watch(
  () => route.query,
  (q) => {
    if (route.path !== '/finance/order') return
    const key = JSON.stringify(q)
    if (key === appliedQuery) return
    appliedQuery = key
    applyQuery(q)
    if (!loadedOnce) {
      loadedOnce = true
      void table.search()
    }
  },
  { immediate: true },
)

let keywordTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => filters.keyword,
  () => {
    clearTimeout(keywordTimer)
    keywordTimer = setTimeout(() => void table.search(), 350)
  },
)
onBeforeUnmount(() => clearTimeout(keywordTimer))

const filterKey = computed(() =>
  JSON.stringify([
    filters.type,
    filters.period,
    filters.status,
    filters.commission_status,
    extraFilters.value.map((f) => `${f.id}=${f.value}`),
  ]),
)
watch(filterKey, () => void table.search())

const hasFilter = computed(
  () =>
    !!filters.keyword.trim() ||
    filters.type.length > 0 ||
    filters.period.length > 0 ||
    filters.status.length > 0 ||
    filters.commission_status.length > 0 ||
    extraFilters.value.length > 0,
)

function syncQueryWithout(keys: string[]) {
  const q = { ...route.query }
  let changed = false
  for (const k of keys) {
    if (k in q) {
      delete q[k]
      changed = true
    }
  }
  if (!changed) return
  appliedQuery = JSON.stringify(q)
  void router.replace({ path: route.path, query: q })
}

// Filter watchers reload the table; these only change state and keep the URL in sync.
function resetFilters() {
  filters.keyword = ''
  filters.type = []
  filters.period = []
  filters.status = []
  filters.commission_status = []
  extraFilters.value = []
  syncQueryWithout(Object.keys(route.query))
}

function removeExtra(f: ExtraFilter) {
  extraFilters.value = extraFilters.value.filter((x) => x !== f)
  syncQueryWithout(f.queryKey === 'id' || f.queryKey === 'order_id' ? ['id', 'order_id'] : [f.queryKey])
}

function extraLabel(f: ExtraFilter): string {
  const [op, val] = f.value.split(/:(.*)/s)
  const sym = OPS[op] ?? op
  switch (f.id) {
    case 'user_id': {
      const email = op === 'eq' ? table.data.value.find((o) => String(o.user_id) === val)?.user?.email : undefined
      return email ? `用户 ${email}` : `用户 ID ${sym} ${val}`
    }
    case 'id':
      return `订单 ID ${sym} ${val}`
    case 'invite_user_id':
      return `邀请人 ID ${sym} ${val}`
    case 'plan_id':
      return `套餐 ID ${sym} ${val}`
    case 'commission_balance':
      return `佣金金额 ${sym} ${Number.isFinite(Number(val)) ? formatMoney(Number(val)) : val}`
    default:
      return `${f.id} ${sym} ${val}`
  }
}

const typeOptions = ORDER_TYPE.map((o) => ({ label: o.label, value: o.value }))
const statusOptions = ORDER_STATUS.map((o) => ({ label: o.label, value: o.value }))
const commissionOptions = COMMISSION_STATUS.map((o) => ({ label: o.label, value: o.value }))
const periodOptions = PLAN_PERIODS.map((p) => ({ label: p.orderLabel, value: p.key }))

// ---------- dialogs & actions ----------
const assignOpen = ref(false)
const detailOpen = ref(false)
const detailId = ref<number | null>(null)
const { busy, markPaid, cancel, setCommission } = useOrderActions()

function openDetail(o: Order) {
  detailId.value = o.id
  detailOpen.value = true
}

function goUser(email: string) {
  void router.push({ path: '/user/manage', query: { email } })
}

async function onStatusAction(key: string, o: Order) {
  const done = key === 'paid' ? await markPaid(o) : key === 'cancel' ? await cancel(o) : false
  if (done) void table.reload()
}

async function onCommissionAction(key: string, o: Order) {
  const done = key === 'valid' ? await setCommission(o, 1) : key === 'invalid' ? await setCommission(o, 3) : false
  if (done) void table.reload()
}

const statusMenu: DropdownOption[] = [
  { key: 'paid', label: '标记为已支付' },
  { key: 'cancel', label: '取消订单', props: { style: 'color: var(--error-color)' } },
]
const commissionMenu: DropdownOption[] = [
  { key: 'valid', label: '发放中' },
  { key: 'invalid', label: '无效', props: { style: 'color: var(--error-color)' } },
]

function legacyPeriodLabel(p: string | null | undefined): string {
  if (!p) return '-'
  return PERIOD_BY_LEGACY[p as LegacyPeriod]?.orderLabel ?? PERIOD_BY_KEY[p as PlanPeriod]?.orderLabel ?? p
}

function tag(opt: EnumOption | undefined, fallback: string | number) {
  return h(
    NTag,
    { type: opt?.type ?? 'default', size: 'small', round: true, bordered: false },
    { default: () => opt?.label ?? String(fallback) },
  )
}

function menuButton(options: DropdownOption[], o: Order, onSelect: (key: string, o: Order) => void, label: string) {
  return h(
    NDropdown,
    { options, trigger: 'click', placement: 'bottom-start', onSelect: (k: string | number) => onSelect(String(k), o) },
    {
      default: () =>
        h(
          NButton,
          { quaternary: true, circle: true, size: 'tiny', loading: busy.value === o.trade_no, 'aria-label': label, title: label },
          { icon: () => h(NIcon, null, { default: () => h(EllipsisHorizontal) }) },
        ),
    },
  )
}

function helpTitle(title: string, tip: string) {
  return () =>
    h('span', { class: 'th-help' }, [
      title,
      h(NTooltip, null, {
        trigger: () => h(NIcon, { size: 14, class: 'th-help-icon' }, { default: () => h(HelpCircleOutline) }),
        default: () => tip,
      }),
    ])
}

function sortOrderOf(key: OrderSort['id']) {
  return sortState.value?.key === key ? sortState.value.order : false
}

const columns = computed<DataTableColumns<Order>>(() => [
  {
    key: 'trade_no',
    title: '订单号',
    width: 150,
    fixed: 'left',
    render: (o) =>
      h(
        NButton,
        { text: true, type: 'primary', class: 'mono trade-btn', title: `${o.trade_no}（点击查看详情）`, onClick: () => openDetail(o) },
        { default: () => shortTradeNo(o.trade_no) },
      ),
  },
  {
    key: 'user',
    title: '用户',
    width: 200,
    render: (o) =>
      o.user?.email
        ? h(
            'a',
            { class: 'user-link', title: '查看用户', onClick: () => goUser(o.user!.email) },
            h(NEllipsis, { style: 'max-width: 180px' }, { default: () => o.user!.email }),
          )
        : h('span', { class: 'muted' }, `#${o.user_id}`),
  },
  {
    key: 'type',
    title: '类型',
    width: 92,
    render: (o) => tag(findEnum(ORDER_TYPE, o.type), o.type),
  },
  {
    key: 'plan',
    title: '订阅计划',
    width: 170,
    render: (o) =>
      o.plan?.name ? h(NEllipsis, { style: 'max-width: 160px' }, { default: () => o.plan!.name }) : h('span', { class: 'muted' }, '-'),
  },
  {
    key: 'period',
    title: '周期',
    width: 104,
    render: (o) =>
      o.period ? h(NTag, { size: 'small', bordered: false }, { default: () => legacyPeriodLabel(o.period) }) : '-',
  },
  {
    key: 'total_amount',
    title: '支付金额',
    width: 120,
    align: 'right',
    sorter: true,
    sortOrder: sortOrderOf('total_amount'),
    render: (o) => h('span', { class: 'num' }, Number.isFinite(Number(o.total_amount)) ? formatMoney(o.total_amount) : '¥N/A'),
  },
  {
    key: 'status',
    title: helpTitle('订单状态', '标记为「已支付」后，系统会立即开通并将订单置为已完成'),
    width: 140,
    sorter: true,
    sortOrder: sortOrderOf('status'),
    render: (o) =>
      h('div', { class: 'cell-with-menu' }, [
        tag(findEnum(ORDER_STATUS, o.status), o.status),
        o.status === 0 ? menuButton(statusMenu, o, onStatusAction, '处理订单') : null,
      ]),
  },
  {
    key: 'commission_balance',
    title: '佣金金额',
    width: 116,
    align: 'right',
    sorter: true,
    sortOrder: sortOrderOf('commission_balance'),
    render: (o) =>
      Number(o.commission_balance)
        ? h('span', { class: 'num' }, formatMoney(o.commission_balance))
        : h('span', { class: 'muted' }, '-'),
  },
  {
    key: 'commission_status',
    title: '佣金状态',
    width: 130,
    sorter: true,
    sortOrder: sortOrderOf('commission_status'),
    render: (o) =>
      Number(o.commission_balance)
        ? h('div', { class: 'cell-with-menu' }, [
            tag(findEnum(COMMISSION_STATUS, o.commission_status), o.commission_status ?? '-'),
            o.commission_status === 0 && o.status === 3 ? menuButton(commissionMenu, o, onCommissionAction, '处理佣金') : null,
          ])
        : h('span', { class: 'muted' }, '-'),
  },
  {
    key: 'created_at',
    title: '创建时间',
    width: 172,
    sorter: true,
    sortOrder: sortOrderOf('created_at'),
    render: (o) => h('span', { class: 'num' }, formatTime(o.created_at)),
  },
])
</script>

<template>
  <page-container title="订单管理" description="查看用户订单，手动分配订单、标记支付、取消订单，并处理邀请佣金。">
    <template #extra>
      <n-button type="primary" @click="assignOpen = true">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加订单
      </n-button>
    </template>

    <n-card :bordered="true" size="small" class="order-card">
      <div class="toolbar order-toolbar">
        <n-input v-model:value="filters.keyword" placeholder="搜索订单号..." clearable class="kw-input">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-select
          v-model:value="filters.type"
          :options="typeOptions"
          multiple
          clearable
          max-tag-count="responsive"
          placeholder="类型"
          class="filter-select"
        />
        <n-select
          v-model:value="filters.period"
          :options="periodOptions"
          multiple
          clearable
          max-tag-count="responsive"
          placeholder="周期"
          class="filter-select"
        />
        <n-select
          v-model:value="filters.status"
          :options="statusOptions"
          multiple
          clearable
          max-tag-count="responsive"
          placeholder="订单状态"
          class="filter-select"
        />
        <n-select
          v-model:value="filters.commission_status"
          :options="commissionOptions"
          multiple
          clearable
          max-tag-count="responsive"
          placeholder="佣金状态"
          class="filter-select"
        />
        <n-button v-if="hasFilter" quaternary @click="resetFilters">
          <template #icon><n-icon><close-outline /></n-icon></template>
          重置
        </n-button>
        <span class="grow" />
        <n-button quaternary circle title="刷新" aria-label="刷新" :loading="table.loading.value" @click="table.reload()">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
        </n-button>
      </div>
      <div v-if="extraFilters.length" class="toolbar extra-chips">
        <span class="muted chips-label">链接筛选：</span>
        <n-tag v-for="f in extraFilters" :key="f.id" closable size="small" type="info" :bordered="false" @close="removeExtra(f)">
          {{ extraLabel(f) }}
        </n-tag>
      </div>

      <n-data-table
        remote
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :pagination="table.pagination"
        :row-key="(o: Order) => o.id"
        :scroll-x="1400"
        :bordered="false"
        size="small"
        class="order-table"
        @update:sorter="onSorter"
      >
        <template #empty>
          <div class="empty">
            <div>{{ hasFilter ? '没有符合筛选条件的订单' : '暂无订单' }}</div>
            <n-button v-if="hasFilter" size="small" quaternary type="primary" @click="resetFilters">清除筛选</n-button>
          </div>
        </template>
      </n-data-table>
    </n-card>

    <assign-order-dialog v-model:show="assignOpen" @success="table.search()" />
    <order-detail-modal v-model:show="detailOpen" :order-id="detailId" @changed="table.reload()" />
  </page-container>
</template>

<style scoped>
.order-toolbar {
  margin-bottom: 12px;
}
.kw-input {
  width: 220px;
}
.filter-select {
  width: 150px;
}
@media (max-width: 767px) {
  .kw-input {
    width: 100%;
  }
  .filter-select {
    width: calc(50% - 4px);
  }
}
.extra-chips {
  margin: -4px 0 12px;
}
.chips-label {
  font-size: 12px;
}
.order-table :deep(.num) {
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  font-size: 12.5px;
}
.order-table :deep(.trade-btn) {
  font-family: var(--font-mono);
  font-size: 12.5px;
}
.order-table :deep(.user-link) {
  color: var(--text-color);
  cursor: pointer;
  display: inline-flex;
  max-width: 100%;
}
.order-table :deep(.user-link:hover) {
  color: var(--primary-color);
}
.order-table :deep(.cell-with-menu) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.order-table :deep(.th-help) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.order-table :deep(.th-help-icon) {
  color: var(--text-muted);
  cursor: help;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--text-muted);
}
</style>
