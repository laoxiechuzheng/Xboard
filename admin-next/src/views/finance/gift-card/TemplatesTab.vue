<script setup lang="ts">
// 模板管理 tab (spec commerce §6.2). Loads all templates (backend filters type/status) and
// searches / sorts / pages on the client, since the backend ignores name search and sorting.
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import {
  NButton,
  NDataTable,
  NEmpty,
  NEllipsis,
  NIcon,
  NInput,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
  type PaginationProps,
} from 'naive-ui'
import {
  AddOutline,
  CreateOutline,
  KeyOutline,
  ListOutline,
  ReceiptOutline,
  RefreshOutline,
  SearchOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import SwitchCell from '@/components/SwitchCell.vue'
import { fetchPlanOptions, type PlanBrief } from '@/api/common'
import {
  GIFT_CARD_TYPES,
  asObject,
  deleteTemplate,
  fetchTemplates,
  giftCardTypeLabel,
  updateTemplate,
  type GiftCardConditions,
  type GiftCardLimits,
  type GiftCardRewards,
  type GiftCardSpecialConfig,
  type GiftCardTemplate,
} from '@/api/giftCard'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { formatDate, formatTime } from '@/utils/format'
import ColumnToggle from './ColumnToggle.vue'
import TemplateFormDrawer from './TemplateFormDrawer.vue'
import { formatMultiplier, invalidateTemplateOptions, rewardItems, useHiddenColumns, type ColumnOption } from './helpers'

const emit = defineEmits<{
  (e: 'generate', templateId: number): void
  (e: 'view-codes', templateId: number): void
  (e: 'view-usages', templateId: number): void
  /** A template was created, edited, toggled or deleted. */
  (e: 'changed'): void
}>()

const PER_PAGE = 1000
const list = ref<GiftCardTemplate[]>([])
const total = ref(0)
const loading = ref(false)

const filters = reactive({
  keyword: '',
  type: null as number | null,
  status: null as 0 | 1 | null,
})
const hasFilter = computed(() => !!filters.keyword || filters.type !== null || filters.status !== null)

const plans = ref<PlanBrief[]>([])
const plansLoading = ref(false)
const plansLoaded = ref(false)
const planName = (id: number) => plans.value.find((p) => p.id === id)?.name ?? `#${id}`

/** Plan options; refetched every time the form opens so newly created plans show up. */
let plansPending: Promise<void> | null = null
function loadPlans(): Promise<void> {
  if (plansPending) return plansPending
  plansLoading.value = true
  plansPending = fetchPlanOptions()
    .then((list) => {
      plans.value = list
      plansLoaded.value = true
    })
    .catch(() => {
      /* toast handled by http client */
    })
    .finally(() => {
      plansLoading.value = false
      plansPending = null
    })
  return plansPending
}

let seq = 0
async function load() {
  const my = ++seq
  loading.value = true
  try {
    const res = await fetchTemplates({ page: 1, per_page: PER_PAGE, type: filters.type, status: filters.status })
    if (my !== seq) return
    list.value = res.data ?? []
    total.value = Number(res.total ?? 0)
  } catch {
    if (my === seq) list.value = []
  } finally {
    if (my === seq) loading.value = false
  }
}

watch(
  () => [filters.type, filters.status],
  () => {
    pagination.page = 1
    void load()
  },
)

const filtered = computed(() => {
  const k = filters.keyword.trim().toLowerCase()
  if (!k) return list.value
  return list.value.filter(
    (t) => t.name.toLowerCase().includes(k) || (t.description ?? '').toLowerCase().includes(k) || String(t.id) === k,
  )
})

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 20,
  showSizePicker: true,
  showQuickJumper: true,
  pageSizes: [10, 20, 30, 40, 50, 100, 500],
  prefix: ({ itemCount }) => `共 ${itemCount ?? 0} 个模板`,
  onUpdatePage: (p: number) => (pagination.page = p),
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
  },
})
watch(() => filters.keyword, () => (pagination.page = 1))

function resetFilters() {
  filters.keyword = ''
  filters.type = null
  filters.status = null
}

const typeOptions = GIFT_CARD_TYPES.map((t) => ({ label: t.label, value: t.value }))
const statusOptions = [
  { label: '已启用', value: 1 },
  { label: '已禁用', value: 0 },
]

// ---------- actions ----------
const formShow = ref(false)
const editing = ref<GiftCardTemplate | null>(null)

function openCreate() {
  editing.value = null
  formShow.value = true
  void loadPlans()
}
function openEdit(row: GiftCardTemplate) {
  editing.value = row
  formShow.value = true
  void loadPlans()
}
function onSaved() {
  invalidateTemplateOptions()
  emit('changed')
  void load()
}

async function toggleStatus(row: GiftCardTemplate, v: boolean) {
  await updateTemplate({ id: row.id, status: v })
  row.status = v
  message.success(v ? '模板已启用' : '模板已禁用')
  invalidateTemplateOptions()
  emit('changed')
}

async function remove(row: GiftCardTemplate) {
  const ok = await confirm({
    title: '确认删除',
    content: `此操作将永久删除模板「${row.name}」，删除后无法恢复。模板下存在兑换码时无法删除。确定要继续吗？`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await deleteTemplate(row.id)
    message.success('模板删除成功')
    invalidateTemplateOptions()
    emit('changed')
    await load()
  } catch {
    /* backend reason (has codes) is toasted by the http client */
  }
}

// ---------- cells ----------
interface ConditionItem {
  text: string
  /** danger: blocks (almost) everyone; warn: restriction caused by an empty legacy value. */
  level?: 'danger' | 'warn'
}

/** PHP isset(): the key exists and is not null (0, false and [] count as set). */
const isSet = (obj: Record<string, unknown>, key: string) => obj[key] !== undefined && obj[key] !== null

/**
 * Effective redemption rules, evaluated like GiftCardTemplate::checkUserConditions/checkUsageLimit:
 * keys count when present (isset), so legacy 0 / false / [] values are shown with what they really do.
 */
function conditionItems(row: GiftCardTemplate): ConditionItem[] {
  const r = asObject<GiftCardRewards>(row.rewards)
  const c = asObject<GiftCardConditions>(row.conditions)
  const l = asObject<GiftCardLimits>(row.limits)
  const s = asObject<GiftCardSpecialConfig>(row.special_config)
  const out: ConditionItem[] = []

  if (Number(row.type) === 1) {
    const keys = ['transfer_enable', 'expire_days', 'reset_package'].filter((k) => isSet(r, k))
    if (keys.length) {
      const effective = keys.some((k) => (k === 'reset_package' ? !!r[k] : Number(r[k]) > 0))
      out.push(
        effective
          ? { text: '仅限已订阅套餐的用户' }
          : { text: '仅限已订阅套餐的用户（由值为 0 / 关闭的流量、有效期或重置奖励项触发）', level: 'warn' },
      )
    }
  } else if (Number(row.type) === 2) {
    out.push({ text: '仅限没有有效订阅的用户' })
  }
  if (c.new_user_only) {
    const days = isSet(c, 'new_user_max_days') ? Number(c.new_user_max_days) : 7
    out.push(
      days > 0
        ? { text: `仅限注册 ${days} 天内新用户` }
        : { text: `仅限新用户，注册天数限制为 ${String(c.new_user_max_days)}（几乎无人可兑换）`, level: 'danger' },
    )
  }
  if (c.paid_user_only) out.push({ text: '仅限付费用户' })
  if (c.require_invite) out.push({ text: '需要邀请关系' })
  if (isSet(c, 'allowed_plans')) {
    const ids = Array.isArray(c.allowed_plans) ? c.allowed_plans : []
    out.push(
      ids.length
        ? { text: `允许套餐：${ids.map((id) => planName(Number(id))).join('、')}` }
        : { text: '允许套餐为空：有套餐的用户均不可兑换', level: 'danger' },
    )
  }
  if (isSet(l, 'max_use_per_user')) {
    const n = Number(l.max_use_per_user)
    out.push(
      n > 0
        ? { text: `每人限 ${n} 次` }
        : { text: `每人限 ${String(l.max_use_per_user)} 次（无人可兑换）`, level: 'danger' },
    )
  }
  if (Number(l.cooldown_hours) > 0) out.push({ text: `冷却 ${l.cooldown_hours} 小时` })
  if (Number(s.festival_bonus) > 1 && s.start_time && s.end_time) {
    out.push({ text: `节日 ${formatMultiplier(Number(s.festival_bonus))}（${formatDate(s.start_time)} ~ ${formatDate(s.end_time)}）` })
  }
  return out
}

function rewardCell(row: GiftCardTemplate) {
  const items = rewardItems(asObject<GiftCardRewards>(row.rewards), planName)
  if (!items.length) return h(NTag, { size: 'small', bordered: false }, { default: () => '无奖励' })
  return h(
    'div',
    { class: 'tag-stack' },
    items.map((t) => h(NTag, { size: 'small', bordered: true, class: 'reward-tag' }, { default: () => t })),
  )
}

function conditionCell(row: GiftCardTemplate) {
  const items = conditionItems(row)
  if (!items.length) return h('span', { class: 'muted small' }, '不限制')
  return h(
    'ul',
    { class: 'cond-list' },
    items.map((t) => h('li', { class: t.level ? `cond-${t.level}` : undefined }, t.text)),
  )
}

function nameCell(row: GiftCardTemplate) {
  return h('div', { class: 'name-cell' }, [
    h('span', { class: 'color-dot', style: { background: row.theme_color || 'var(--primary-color)' } }),
    h('div', { class: 'name-text' }, [
      h(NEllipsis, { class: 'name-main' }, { default: () => row.name }),
      row.description
        ? h(NEllipsis, { class: 'name-desc', lineClamp: 1, tooltip: { width: 320 } }, { default: () => row.description })
        : null,
    ]),
  ])
}

function actionButtons(row: GiftCardTemplate) {
  const btn = (label: string, icon: typeof CreateOutline, onClick: () => void, opts: { danger?: boolean; disabled?: boolean; tip?: string } = {}) =>
    h(NTooltip, null, {
      trigger: () =>
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            circle: true,
            type: opts.danger ? 'error' : 'default',
            disabled: opts.disabled,
            onClick,
            'aria-label': label,
          },
          { icon: () => h(NIcon, null, { default: () => h(icon) }) },
        ),
      default: () => opts.tip ?? label,
    })
  return h('div', { class: 'row-actions' }, [
    btn('编辑', CreateOutline, () => openEdit(row)),
    btn('生成兑换码', KeyOutline, () => emit('generate', row.id), {
      disabled: !row.status,
      tip: row.status ? '生成兑换码' : '模板已禁用，无法生成兑换码',
    }),
    btn('查看兑换码', ListOutline, () => emit('view-codes', row.id)),
    btn('查看使用记录', ReceiptOutline, () => emit('view-usages', row.id)),
    btn('删除', TrashOutline, () => remove(row), { danger: true }),
  ])
}

const idTag = (row: GiftCardTemplate) => h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id })
const typeTag = (row: GiftCardTemplate) =>
  h(NTag, { size: 'small', type: row.type === 2 ? 'success' : row.type === 3 ? 'warning' : 'info', bordered: false }, { default: () => giftCardTypeLabel(row.type) })
const statusSwitch = (row: GiftCardTemplate) => h(SwitchCell, { value: row.status, onChange: (v: boolean) => toggleStatus(row, v) })

const desktopColumns = computed<DataTableColumns<GiftCardTemplate>>(() => [
  { title: 'ID', key: 'id', width: 80, sorter: (a, b) => a.id - b.id, render: idTag },
  { title: '状态', key: 'status', width: 76, render: statusSwitch },
  { title: '名称', key: 'name', minWidth: 180, render: nameCell },
  { title: '类型', key: 'type', width: 110, sorter: (a, b) => a.type - b.type, render: typeTag },
  { title: '奖励内容', key: 'rewards', minWidth: 170, render: rewardCell },
  { title: '条件与限制', key: 'conditions', minWidth: 180, render: conditionCell },
  {
    title: '排序',
    key: 'sort',
    width: 76,
    sorter: (a, b) => a.sort - b.sort,
    render: (row) => h('span', { class: 'num' }, String(row.sort ?? 0)),
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 170,
    sorter: (a, b) => a.created_at - b.created_at,
    render: (row) => h('span', { class: 'muted mono small' }, formatTime(row.created_at)),
  },
  { title: '操作', key: 'actions', width: 190, align: 'center', fixed: 'right', render: actionButtons },
])

const columnOptions: ColumnOption[] = [
  { key: 'id', label: 'ID' },
  { key: 'status', label: '状态' },
  { key: 'name', label: '名称', fixed: true },
  { key: 'type', label: '类型' },
  { key: 'rewards', label: '奖励内容' },
  { key: 'conditions', label: '条件与限制' },
  { key: 'sort', label: '排序' },
  { key: 'created_at', label: '创建时间' },
  { key: 'actions', label: '操作', fixed: true },
]
const hiddenColumns = useHiddenColumns('templates')
const visibleColumns = computed(() =>
  desktopColumns.value.filter((c) => !('key' in c) || !hiddenColumns.value.includes(String(c.key))),
)

const mobileColumns = computed<DataTableColumns<GiftCardTemplate>>(() => [
  {
    title: '模板',
    key: 'card',
    render: (row) =>
      h('div', { class: 'm-card' }, [
        h('div', { class: 'm-head' }, [idTag(row), h('span', { class: 'm-title' }, row.name), statusSwitch(row)]),
        h('div', { class: 'm-line' }, [typeTag(row), h('span', { class: 'muted small' }, `排序 ${row.sort ?? 0}`)]),
        rewardCell(row),
        conditionItems(row).length ? conditionCell(row) : null,
        h('div', { class: 'm-foot' }, [h('span', { class: 'muted mono small' }, formatTime(row.created_at)), actionButtons(row)]),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : visibleColumns.value))

onMounted(() => {
  void load()
  void loadPlans()
})

defineExpose({ reload: load })
</script>

<template>
  <div class="tab-pane">
    <div class="toolbar tab-toolbar">
      <n-input v-model:value="filters.keyword" placeholder="搜索模板名称..." clearable class="search-input">
        <template #prefix><n-icon><search-outline /></n-icon></template>
      </n-input>
      <n-select v-model:value="filters.type" :options="typeOptions" placeholder="类型" clearable class="filter-select" />
      <n-select v-model:value="filters.status" :options="statusOptions" placeholder="状态" clearable class="filter-select" />
      <n-button v-if="hasFilter" quaternary @click="resetFilters">重置</n-button>
      <span class="grow" />
      <n-tooltip>
        <template #trigger>
          <n-button quaternary circle :loading="loading" aria-label="刷新" @click="load">
            <template #icon><n-icon><refresh-outline /></n-icon></template>
          </n-button>
        </template>
        刷新
      </n-tooltip>
      <column-toggle v-if="!appState.isMobile" v-model:hidden="hiddenColumns" :options="columnOptions" />
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加模板
      </n-button>
    </div>
    <p v-if="total > PER_PAGE" class="muted small over-hint">模板数量超过 {{ PER_PAGE }} 个，仅显示排序靠前的 {{ PER_PAGE }} 个。</p>

    <n-data-table
      :columns="columns"
      :data="filtered"
      :loading="loading"
      :pagination="pagination"
      :row-key="(r: GiftCardTemplate) => r.id"
      :scroll-x="appState.isMobile ? undefined : 1210"
      :bordered="false"
      size="small"
      class="data-table"
    >
      <template #empty>
        <n-empty :description="hasFilter ? '没有符合条件的模板' : '暂无礼品卡模板'">
          <template v-if="!hasFilter" #extra>
            <n-button size="small" @click="openCreate">添加模板</n-button>
          </template>
        </n-empty>
      </template>
    </n-data-table>

    <template-form-drawer
      v-model:show="formShow"
      :template="editing"
      :plans="plans"
      :plans-loading="plansLoading"
      :plans-loaded="plansLoaded"
      @success="onSaved"
    />
  </div>
</template>

<style scoped>
.tab-toolbar {
  margin-bottom: 12px;
}
.search-input {
  width: 220px;
  max-width: 100%;
}
.filter-select {
  width: 130px;
}
.over-hint {
  margin: -4px 0 8px;
}
.small {
  font-size: 12px;
}
@media (max-width: 767px) {
  .search-input {
    width: 100%;
  }
  .filter-select {
    flex: 1;
    width: auto;
    min-width: 120px;
  }
}
.data-table :deep(.id-tag),
.data-table :deep(.num) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.small) {
  font-size: 12px;
}
.data-table :deep(.name-cell) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}
.data-table :deep(.color-dot) {
  flex: none;
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 8%, transparent);
}
.data-table :deep(.name-text) {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.data-table :deep(.name-main) {
  font-weight: 500;
}
.data-table :deep(.name-desc) {
  font-size: 12px;
  color: var(--text-muted);
}
.data-table :deep(.tag-stack) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.data-table :deep(.reward-tag) {
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.cond-list) {
  margin: 0;
  padding-left: 14px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-color);
}
.data-table :deep(.cond-danger) {
  color: var(--error-color);
  font-weight: 500;
}
.data-table :deep(.cond-warn) {
  color: var(--warning-color);
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
.data-table :deep(.m-head),
.data-table :deep(.m-line),
.data-table :deep(.m-foot) {
  display: flex;
  align-items: center;
  gap: 8px;
}
.data-table :deep(.m-foot) {
  justify-content: space-between;
}
.data-table :deep(.m-title) {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
