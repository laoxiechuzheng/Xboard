<script setup lang="ts">
// 优惠券管理 /finance/coupon (spec commerce §5).
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NButton,
  NCard,
  NDataTable,
  NEllipsis,
  NEmpty,
  NIcon,
  NInput,
  NInputGroup,
  NPopover,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
  type DataTableSortState,
  type DataTableBaseColumn,
} from 'naive-ui'
import {
  AddOutline,
  CreateOutline,
  HelpCircleOutline,
  RefreshOutline,
  SearchOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import CopyText from '@/components/CopyText.vue'
import SwitchCell from '@/components/SwitchCell.vue'
import CouponFormDialog from './coupon/CouponFormDialog.vue'
import CouponBatchResult from './coupon/CouponBatchResult.vue'
import { batchCsvFile, couponValidity, couponValueText, shortTime } from './coupon/coupon-utils'
import {
  COUPON_PERIOD_LABEL,
  COUPON_TYPES,
  CouponMissingError,
  dropCoupon,
  fetchCoupons,
  setCouponShow,
  type Coupon,
  type CouponFilter,
  type CouponType,
} from '@/api/coupon'
import { fetchPlanOptions } from '@/api/common'
import { usePagedTable } from '@/composables/usePagedTable'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { saveFile } from '@/utils/clipboard'
import { formatTime } from '@/utils/format'

const route = useRoute()

// ---- filters (all server-side: scalar -> LIKE, array -> whereIn) ----
const searchField = ref<'name' | 'code'>(route.query.code ? 'code' : 'name')
const keyword = ref(String(route.query.code ?? route.query.name ?? ''))
/** Keyword actually sent to the backend. */
const appliedKeyword = ref(keyword.value.trim())
const typeFilter = ref<CouponType[]>([])
const showFilter = ref<'all' | '1' | '0'>('all')
const sortState = ref<{ key: string; order: 'ascend' | 'descend' } | null>(null)

const searchFieldOptions = [
  { label: '名称', value: 'name' },
  { label: '券码', value: 'code' },
]
const typeOptions = COUPON_TYPES.map((t) => ({ label: t.label, value: t.value }))
const showOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已启用', value: '1' },
  { label: '已停用', value: '0' },
]

const hasFilter = computed(() => !!keyword.value.trim() || typeFilter.value.length > 0 || showFilter.value !== 'all')

const table = usePagedTable<Coupon>(
  async (q) => {
    const filter: CouponFilter[] = []
    const k = appliedKeyword.value
    if (k) filter.push({ id: searchField.value, value: k })
    if (typeFilter.value.length) filter.push({ id: 'type', value: typeFilter.value.slice() })
    if (showFilter.value !== 'all') filter.push({ id: 'show', value: [Number(showFilter.value)] })
    const sort = sortState.value ? [{ id: sortState.value.key, desc: sortState.value.order === 'descend' }] : undefined
    const res = await fetchCoupons({ ...q, ...(filter.length ? { filter } : {}), ...(sort ? { sort } : {}) })
    return { data: res.data ?? [], total: res.total ?? 0 }
  },
  { pageSize: 20, pageSizes: [10, 20, 30, 40, 50, 100, 500] },
)

// Typing is debounced; clearing applies immediately. One watcher so a reset reloads once.
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, (v) => {
  clearTimeout(searchTimer)
  if (!v.trim()) appliedKeyword.value = ''
  else searchTimer = setTimeout(() => (appliedKeyword.value = v.trim()), 350)
})
watch([appliedKeyword, searchField, typeFilter, showFilter], () => void table.search())
onBeforeUnmount(() => clearTimeout(searchTimer))

function resetFilters() {
  // Only touch refs that change, so the filter watcher fires at most once.
  const filtersChanged = !!appliedKeyword.value || typeFilter.value.length > 0 || showFilter.value !== 'all'
  keyword.value = ''
  if (typeFilter.value.length) typeFilter.value = []
  showFilter.value = 'all'
  sortState.value = null
  if (!filtersChanged) void table.search()
}

function onSorter(s: DataTableSortState | DataTableSortState[] | null) {
  const st = Array.isArray(s) ? s[0] : s
  sortState.value = st && st.order ? { key: String(st.columnKey), order: st.order } : null
  void table.search()
}

// ---- plan names for the "使用范围" column ----
const planNames = ref<Map<number, string>>(new Map())
async function loadPlans() {
  try {
    const plans = await fetchPlanOptions()
    planNames.value = new Map(plans.map((p) => [Number(p.id), p.name]))
  } catch {
    /* toasted */
  }
}

// ---- dialogs ----
const formShow = ref(false)
const editing = ref<Coupon | null>(null)
const batch = reactive({ show: false, csv: '', count: 0, name: '', stamp: 0 })

function openCreate() {
  editing.value = null
  formShow.value = true
}

function openEdit(row: Coupon) {
  editing.value = row
  formShow.value = true
}

function onGenerated(p: { csv: string; count: number; name: string }) {
  batch.csv = p.csv
  batch.count = p.count
  batch.name = p.name
  batch.stamp = Date.now()
  saveFile(batchCsvFile(p.csv), `coupons_${batch.stamp}.csv`, 'text/csv;charset=utf-8')
  batch.show = true
}

async function toggleShow(row: Coupon, v: boolean) {
  try {
    await setCouponShow(row.id, v)
  } catch (e) {
    // ApiErrors are already toasted by the http client.
    if (e instanceof CouponMissingError) {
      message.error(e.message)
      void table.reload()
    }
    throw e
  }
  row.show = v
  message.success(v ? `已启用「${row.name}」` : `已停用「${row.name}」`)
}

async function remove(row: Coupon) {
  const ok = await confirm({
    title: '确认删除',
    content: `此操作将永久删除优惠券「${row.name}」（券码 ${row.code}），删除后无法恢复，用户将无法再使用该券码。确定要继续吗？`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await dropCoupon(row.id)
    message.success('删除成功')
    // Step back a page when the last row of the last page was removed.
    if (table.data.value.length === 1 && (table.pagination.page ?? 1) > 1) table.pagination.page = (table.pagination.page ?? 1) - 1
    await table.reload()
  } catch {
    /* toast handled by http client */
  }
}

// ---- cells ----
function idTag(row: Coupon) {
  return h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id })
}

function typeTag(row: Coupon) {
  const percent = Number(row.type) === 2
  return h(
    NTag,
    { size: 'small', bordered: true, type: percent ? 'info' : 'default', class: 'nowrap' },
    { default: () => (percent ? '按比例优惠' : '按金额优惠') },
  )
}

function valueCell(row: Coupon) {
  return h('span', { class: 'value-text' }, couponValueText(row))
}

function limitUseCell(row: Coupon) {
  if (row.limit_use === null || row.limit_use === undefined) return h('span', { class: 'muted' }, '无限次')
  if (Number(row.limit_use) <= 0) return h(NTag, { size: 'small', type: 'error', bordered: false }, { default: () => '已用完' })
  return h('span', { class: 'num' }, `${row.limit_use} 次`)
}

function perUserCell(row: Coupon) {
  if (row.limit_use_with_user === null || row.limit_use_with_user === undefined) return h('span', { class: 'muted' }, '无限制')
  return h('span', { class: 'num' }, `${row.limit_use_with_user} 次`)
}

function scopeCell(row: Coupon) {
  const planIds = (row.limit_plan_ids ?? []).map(Number)
  const periods = row.limit_period ?? []
  if (!planIds.length && !periods.length) return h('span', { class: 'muted' }, '不限')
  const parts: string[] = []
  parts.push(planIds.length ? `${planIds.length} 个套餐` : '全部套餐')
  parts.push(periods.length ? `${periods.length} 个周期` : '全部周期')
  return h(
    NPopover,
    { trigger: 'hover', placement: 'bottom', style: 'max-width: 320px' },
    {
      trigger: () => h('span', { class: 'dashed' }, parts.join(' · ')),
      default: () =>
        h('div', { class: 'scope-pop' }, [
          h('div', { class: 'scope-title' }, '指定订阅'),
          h(
            'div',
            null,
            planIds.length
              ? planIds.map((id) => planNames.value.get(id) ?? `已删除的套餐 #${id}`).join('、')
              : '不限制',
          ),
          h('div', { class: 'scope-title' }, '指定周期'),
          h('div', null, periods.length ? periods.map((p) => COUPON_PERIOD_LABEL[p] ?? p).join('、') : '不限制'),
        ]),
    },
  )
}

function validityCell(row: Coupon) {
  const v = couponValidity(row)
  return h(
    NTooltip,
    { placement: 'bottom' },
    {
      trigger: () =>
        h('div', { class: 'validity' }, [
          h(NTag, { size: 'small', type: v.tagType, bordered: false, round: true }, { default: () => v.text }),
          h('span', { class: 'range num' }, `${shortTime(row.started_at)} → ${shortTime(row.ended_at)}`),
        ]),
      default: () =>
        h('div', { class: 'num' }, [
          h('div', null, `开始时间 ${formatTime(row.started_at)}`),
          h('div', null, `结束时间 ${formatTime(row.ended_at)}`),
        ]),
    },
  )
}

function switchCell(row: Coupon) {
  return h(SwitchCell, { value: row.show, onChange: (v: boolean) => toggleShow(row, v) })
}

function actionButtons(row: Coupon) {
  const btn = (label: string, icon: typeof CreateOutline, onClick: () => void, danger = false) =>
    h(NTooltip, null, {
      trigger: () =>
        h(
          NButton,
          { size: 'small', quaternary: true, circle: true, type: danger ? 'error' : 'default', onClick, 'aria-label': label },
          { icon: () => h(NIcon, null, { default: () => h(icon) }) },
        ),
      default: () => label,
    })
  return h('div', { class: 'row-actions' }, [
    btn('编辑', CreateOutline, () => openEdit(row)),
    btn('删除', TrashOutline, () => remove(row), true),
  ])
}

function sortable(key: string): Pick<DataTableBaseColumn<Coupon>, 'sorter' | 'sortOrder'> {
  return { sorter: true, sortOrder: sortState.value?.key === key ? sortState.value.order : false }
}

const limitUseTitle = () =>
  h('span', { class: 'th-help' }, [
    '剩余次数',
    h(NTooltip, null, {
      trigger: () => h(NIcon, { size: 14, class: 'help-icon' }, { default: () => h(HelpCircleOutline) }),
      default: () => '所有用户合计还可使用的次数，每使用一次自动减 1',
    }),
  ])

const desktopColumns = computed<DataTableColumns<Coupon>>(() => [
  { title: 'ID', key: 'id', width: 80, render: idTag, ...sortable('id') },
  { title: '启用', key: 'show', width: 70, render: switchCell },
  {
    title: '券名称',
    key: 'name',
    minWidth: 160,
    render: (row) => h(NEllipsis, { style: 'max-width: 240px; font-weight: 600' }, { default: () => row.name }),
  },
  { title: '类型', key: 'type', width: 120, render: typeTag, ...sortable('type') },
  { title: '优惠值', key: 'value', width: 110, render: valueCell, ...sortable('value') },
  {
    title: '券码',
    key: 'code',
    width: 170,
    render: (row) => h(CopyText, { text: row.code, mono: true, maxWidth: '150px' }),
    ...sortable('code'),
  },
  { title: limitUseTitle, key: 'limit_use', width: 110, render: limitUseCell, ...sortable('limit_use') },
  { title: '可用次数/用户', key: 'limit_use_with_user', width: 130, render: perUserCell, ...sortable('limit_use_with_user') },
  { title: '使用范围', key: 'scope', width: 170, render: scopeCell },
  { title: '有效期', key: 'ended_at', width: 270, render: validityCell, ...sortable('ended_at') },
  { title: '操作', key: 'actions', width: 96, align: 'center', fixed: 'right', render: actionButtons },
])

const mobileColumns = computed<DataTableColumns<Coupon>>(() => [
  {
    title: '优惠券',
    key: 'card',
    render: (row) =>
      h('div', { class: 'm-card' }, [
        h('div', { class: 'm-head' }, [
          idTag(row),
          h('span', { class: 'm-title' }, row.name),
          switchCell(row),
          actionButtons(row),
        ]),
        h('div', { class: 'm-grid' }, [
          h('div', null, [h('div', { class: 'm-label' }, '券码'), h(CopyText, { text: row.code, mono: true })]),
          h('div', null, [h('div', { class: 'm-label' }, '优惠'), h('div', { class: 'm-inline' }, [typeTag(row), valueCell(row)])]),
          h('div', null, [h('div', { class: 'm-label' }, '剩余次数'), limitUseCell(row)]),
          h('div', null, [h('div', { class: 'm-label' }, '可用次数/用户'), perUserCell(row)]),
        ]),
        h('div', null, [h('div', { class: 'm-label' }, '有效期'), validityCell(row)]),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : desktopColumns.value))

onMounted(loadPlans)
</script>

<template>
  <page-container title="优惠券管理" description="在这里可以查看优惠券，包括增加、查看、删除等操作。">
    <template #extra>
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加优惠券
      </n-button>
    </template>

    <n-card size="small">
      <div class="toolbar table-toolbar">
        <n-input-group class="search-group">
          <n-select v-model:value="searchField" :options="searchFieldOptions" class="field-select" />
          <n-input
            v-model:value="keyword"
            :placeholder="searchField === 'code' ? '搜索券码...' : '搜索优惠券...'"
            clearable
          >
            <template #prefix><n-icon><search-outline /></n-icon></template>
          </n-input>
        </n-input-group>
        <n-select
          v-model:value="typeFilter"
          :options="typeOptions"
          multiple
          clearable
          placeholder="类型"
          :max-tag-count="1"
          class="type-filter"
        />
        <n-select v-model:value="showFilter" :options="showOptions" class="show-filter" />
        <n-button v-if="hasFilter || sortState" quaternary @click="resetFilters">重置</n-button>
        <span class="grow" />
        <n-tooltip>
          <template #trigger>
            <n-button quaternary circle :loading="table.loading.value" aria-label="刷新" @click="table.reload()">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </div>
      <n-data-table
        remote
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :pagination="table.pagination"
        :row-key="(r: Coupon) => r.id"
        :scroll-x="appState.isMobile ? undefined : 1500"
        :bordered="false"
        size="small"
        class="data-table"
        @update:sorter="onSorter"
      >
        <template #empty>
          <n-empty :description="hasFilter ? '没有匹配的优惠券' : '暂无优惠券'">
            <template v-if="!hasFilter" #extra>
              <n-button size="small" @click="openCreate">添加优惠券</n-button>
            </template>
          </n-empty>
        </template>
      </n-data-table>
    </n-card>

    <coupon-form-dialog
      v-model:show="formShow"
      :coupon="editing"
      @success="table.reload()"
      @generated="onGenerated"
    />
    <coupon-batch-result
      v-model:show="batch.show"
      :csv="batch.csv"
      :count="batch.count"
      :name="batch.name"
      :stamp="batch.stamp"
    />
  </page-container>
</template>

<style scoped>
.table-toolbar {
  margin-bottom: 12px;
}
.search-group {
  width: 340px;
  max-width: 100%;
}
.field-select {
  width: 88px;
  flex: none;
}
.type-filter {
  width: 190px;
}
.show-filter {
  width: 120px;
}
@media (max-width: 767px) {
  .search-group {
    width: 100%;
  }
  .type-filter,
  .show-filter {
    flex: 1;
    min-width: 0;
  }
}
.data-table :deep(.id-tag) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.num) {
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.value-text) {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.dashed) {
  cursor: default;
  border-bottom: 1px dashed var(--border-color);
}
.data-table :deep(.validity) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.data-table :deep(.range) {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
.data-table :deep(.th-help) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.data-table :deep(.help-icon) {
  color: var(--text-muted);
  cursor: help;
}
.data-table :deep(.row-actions) {
  display: inline-flex;
  gap: 2px;
}
.data-table :deep(.m-card) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 0;
}
.data-table :deep(.m-head) {
  display: flex;
  align-items: center;
  gap: 8px;
}
.data-table :deep(.m-title) {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-table :deep(.m-grid) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.data-table :deep(.m-inline) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.data-table :deep(.m-label) {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
:global(.scope-pop) {
  font-size: 12px;
  line-height: 1.7;
}
:global(.scope-pop .scope-title) {
  font-weight: 600;
  margin-top: 4px;
}
:global(.scope-pop .scope-title:first-child) {
  margin-top: 0;
}
</style>
