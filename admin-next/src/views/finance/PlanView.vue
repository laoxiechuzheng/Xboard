<script setup lang="ts">
// Plan list (all plans loaded at once; client-side search / paging / sorting).
// Spec: docs/admin-next/spec/commerce.md §2.
import { computed, h, reactive, ref, watch } from 'vue'
import {
  NCard,
  NDataTable,
  NButton,
  NIcon,
  NInput,
  NTag,
  NTooltip,
  NPopover,
  NCheckbox,
  NCheckboxGroup,
  NEllipsis,
  type DataTableColumns,
  type PaginationProps,
} from 'naive-ui'
import {
  AddOutline,
  SearchOutline,
  CreateOutline,
  TrashOutline,
  SwapVerticalOutline,
  PeopleOutline,
  PulseOutline,
  HelpCircleOutline,
  OptionsOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import SwitchCell from '@/components/SwitchCell.vue'
import { fetchPlans, updatePlan, dropPlan, planPrices, PLAN_PERIODS, resetMethodLabel, type Plan } from '@/api/plan'
import { confirm, message, notification } from '@/utils/discrete'
import { appState } from '@/stores/app'
import PlanFormDrawer from './plan/PlanFormDrawer.vue'
import PlanSortModal from './plan/PlanSortModal.vue'

const plans = ref<Plan[]>([])
const loading = ref(false)
const loaded = ref(false)
const keyword = ref('')

async function load() {
  loading.value = true
  try {
    plans.value = await fetchPlans()
    loaded.value = true
  } catch {
    /* toasted; keep previous rows */
  } finally {
    loading.value = false
  }
}
void load()

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return kw ? plans.value.filter((p) => p.name.toLowerCase().includes(kw)) : plans.value
})

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  showQuickJumper: true,
  pageSizes: [10, 20, 30, 40, 50, 100, 500],
  prefix: ({ itemCount }) => `共 ${itemCount ?? 0} 个套餐`,
  onUpdatePage: (p: number) => (pagination.page = p),
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
  },
})
watch(keyword, () => (pagination.page = 1))

// ---------- column visibility ----------
const OPTIONAL_COLUMNS = [
  { key: 'stats', label: '统计' },
  { key: 'limits', label: '流量 / 限制' },
  { key: 'prices', label: '价格' },
]
const visibleOptional = ref<string[]>(OPTIONAL_COLUMNS.map((c) => c.key))

// ---------- dialogs ----------
const formOpen = ref(false)
const editing = ref<Plan | null>(null)
const sortOpen = ref(false)

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(p: Plan) {
  editing.value = p
  formOpen.value = true
}

function onSaved(created: boolean) {
  void load()
  if (created) {
    notification.info({
      title: '套餐已创建',
      content: '新套餐默认不显示、不可新购。请在列表中打开「显示」和「新购」开关后，用户才能看到并购买。',
      duration: 8000,
    })
  }
}

/** Throwing makes SwitchCell revert the switch. */
async function toggle(p: Plan, field: 'show' | 'sell' | 'renew', v: boolean) {
  const payload: Parameters<typeof updatePlan>[0] = { id: p.id }
  payload[field] = v
  const ok = await updatePlan(payload)
  if (!ok) {
    void load()
    throw new Error('update failed')
  }
  p[field] = v
  const label = field === 'show' ? '显示' : field === 'sell' ? '新购' : '续费'
  message.success(`已${v ? '开启' : '关闭'}「${p.name}」的${label}`)
}

async function remove(p: Plan) {
  const ok = await confirm({
    title: '确认删除',
    content: `此操作将永久删除套餐「${p.name}」，删除后无法恢复。存在该套餐的订单或用户时后端会拒绝删除。`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await dropPlan(p.id)
    message.success('删除成功')
    void load()
  } catch {
    /* toasted */
  }
}

// ---------- rendering helpers ----------
function headerWithTip(title: string, tip: string) {
  return () =>
    h('span', { class: 'th-help' }, [
      title,
      h(NTooltip, null, {
        trigger: () => h(NIcon, { size: 14, class: 'th-help-icon' }, { default: () => h(HelpCircleOutline) }),
        default: () => tip,
      }),
    ])
}

function statBlock(icon: typeof PeopleOutline, value: number, cls: string, tipTitle: string, tipLines: string[]) {
  return h(NTooltip, null, {
    trigger: () =>
      h('span', { class: ['stat-pill', cls] }, [h(NIcon, { size: 14 }, { default: () => h(icon) }), h('span', { class: 'num' }, String(value))]),
    default: () => h('div', { class: 'stat-tip' }, [h('div', { class: 'stat-tip-title' }, tipTitle), ...tipLines.map((l) => h('div', l))]),
  })
}

function renderPrices(p: Plan) {
  const prices = planPrices(p)
  const tags = PLAN_PERIODS.filter((m) => prices[m.key] !== undefined).map((m) => {
    const v = prices[m.key] as number
    const text = `${m.label} ¥${v.toFixed(2)}`
    const title = `${m.label}：${v.toFixed(2)} ${m.unit || '元'}`
    return v > 0
      ? h(NTag, { size: 'small', bordered: false, class: 'price-tag', title }, { default: () => text })
      : h(NTooltip, null, {
          trigger: () => h(NTag, { size: 'small', type: 'warning', bordered: false, class: 'price-tag' }, { default: () => text }),
          default: () => '价格为 0：该周期可免费购买。重新保存套餐会移除此周期',
        })
  })
  if (!tags.length) return h(NTag, { size: 'small', bordered: true, class: 'price-tag dashed' }, { default: () => '无价格' })
  return h('div', { class: 'price-tags' }, tags)
}

function renderLimits(p: Plan) {
  const parts = [
    p.speed_limit ? `${p.speed_limit} Mbps` : '不限速',
    p.device_limit ? `${p.device_limit} 台` : '设备不限',
    p.capacity_limit === null || p.capacity_limit === undefined ? '容量不限' : p.capacity_limit === 0 ? '容量 0（停售）' : `容量 ${p.capacity_limit}`,
  ]
  return h('div', { class: 'limits' }, [
    h('div', { class: 'num strong' }, `${p.transfer_enable} GB`),
    h('div', { class: ['muted', 'small', p.capacity_limit === 0 ? 'warn' : ''] }, parts.join(' · ')),
    h('div', { class: 'muted small' }, `重置：${resetMethodLabel(p.reset_traffic_method)}`),
  ])
}

/** Column widths (sum is the scroll-x threshold, so ~1100px desktops need no horizontal scroll). */
const COL_W = { id: 64, switch: 62, renew: 76, name: 150, stats: 124, group: 110, limits: 170, prices: 200, actions: 88 }

const columns = computed<DataTableColumns<Plan>>(() => {
  const cols: DataTableColumns<Plan> = [
    {
      key: 'id',
      title: 'ID',
      width: COL_W.id,
      sorter: (a, b) => a.id - b.id,
      render: (p) => h(NTag, { size: 'small', bordered: true, class: 'num' }, { default: () => p.id }),
    },
    {
      key: 'show',
      title: '显示',
      width: COL_W.switch,
      render: (p) => h(SwitchCell, { value: p.show, onChange: (v: boolean) => toggle(p, 'show', v) }),
    },
    {
      key: 'sell',
      title: '新购',
      width: COL_W.switch,
      render: (p) => h(SwitchCell, { value: p.sell, onChange: (v: boolean) => toggle(p, 'sell', v) }),
    },
    {
      key: 'renew',
      title: headerWithTip('续费', '在订阅停止销售时，已购用户是否可以续费'),
      width: COL_W.renew,
      render: (p) => h(SwitchCell, { value: p.renew, onChange: (v: boolean) => toggle(p, 'renew', v) }),
    },
    {
      key: 'name',
      title: '名称',
      minWidth: COL_W.name,
      render: (p) =>
        h('div', { class: 'name-cell' }, [
          h(NEllipsis, { class: 'plan-name', style: 'max-width: 100%' }, { default: () => p.name }),
          p.tags?.length
            ? h(
                'div',
                { class: 'name-tags' },
                p.tags.map((t) => h(NTag, { size: 'tiny', round: true, bordered: false, type: 'info' }, { default: () => t })),
              )
            : null,
        ]),
    },
  ]
  if (visibleOptional.value.includes('stats')) {
    cols.push({
      key: 'users_count',
      title: '统计',
      width: COL_W.stats,
      sorter: (a, b) => (a.users_count ?? 0) - (b.users_count ?? 0),
      render: (p) => {
        const total = p.users_count ?? 0
        const active = p.active_users_count ?? 0
        const rate = total > 0 ? [`活跃率：${Math.round((active / total) * 100)}%`] : []
        return h('div', { class: 'stats' }, [
          statBlock(PeopleOutline, total, 'stat-total', '总用户数', ['所有使用该套餐的用户（包括已过期）']),
          statBlock(PulseOutline, active, 'stat-active', '有效期内用户', ['当前仍在有效期内的活跃用户', ...rate]),
        ])
      },
    })
  }
  cols.push({
    key: 'group',
    title: '权限组',
    width: COL_W.group,
    render: (p) =>
      p.group?.name
        ? h(NTag, { size: 'small', bordered: false }, { default: () => p.group!.name })
        : h('span', { class: 'muted' }, p.group_id ? `#${p.group_id}` : '未设置'),
  })
  if (visibleOptional.value.includes('limits')) {
    cols.push({ key: 'limits', title: '流量 / 限制', width: COL_W.limits, render: renderLimits })
  }
  if (visibleOptional.value.includes('prices')) {
    cols.push({ key: 'prices', title: '价格', minWidth: COL_W.prices, render: renderPrices })
  }
  cols.push({
    key: 'actions',
    title: '操作',
    width: COL_W.actions,
    fixed: 'right',
    align: 'right',
    render: (p) =>
      h('div', { class: 'row-actions' }, [
        h(NTooltip, null, {
          trigger: () =>
            h(
              NButton,
              { quaternary: true, circle: true, size: 'small', 'aria-label': '编辑', onClick: () => openEdit(p) },
              { icon: () => h(NIcon, null, { default: () => h(CreateOutline) }) },
            ),
          default: () => '编辑',
        }),
        h(NTooltip, null, {
          trigger: () =>
            h(
              NButton,
              { quaternary: true, circle: true, size: 'small', type: 'error', 'aria-label': '删除', onClick: () => remove(p) },
              { icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) },
            ),
          default: () => '删除',
        }),
      ]),
  })
  // Narrow screens: pin the name first so rows stay identifiable while scrolling sideways.
  if (appState.isMobile) {
    const i = cols.findIndex((c) => 'key' in c && c.key === 'name')
    const [name] = cols.splice(i, 1)
    cols.unshift({ ...name, fixed: 'left', width: 132, minWidth: undefined } as (typeof cols)[number])
  }
  return cols
})

const scrollX = computed(
  () =>
    COL_W.id +
    COL_W.switch * 2 +
    COL_W.renew +
    COL_W.name +
    COL_W.group +
    COL_W.actions +
    (visibleOptional.value.includes('stats') ? COL_W.stats : 0) +
    (visibleOptional.value.includes('limits') ? COL_W.limits : 0) +
    (visibleOptional.value.includes('prices') ? COL_W.prices : 0),
)

const summary = computed(() => {
  const list = plans.value
  return {
    total: list.length,
    visible: list.filter((p) => p.show).length,
    selling: list.filter((p) => Number(p.sell) === 1 || p.sell === true).length,
    users: list.reduce((s, p) => s + (p.users_count ?? 0), 0),
  }
})
</script>

<template>
  <page-container title="套餐管理" description="配置订阅套餐，包括价格、流量、限速与上架状态。">
    <template #extra>
      <n-button :disabled="!plans.length" @click="sortOpen = true">
        <template #icon><n-icon><swap-vertical-outline /></n-icon></template>
        编辑排序
      </n-button>
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加套餐
      </n-button>
    </template>

    <n-card size="small">
      <div class="toolbar plan-toolbar">
        <n-input v-model:value="keyword" placeholder="搜索套餐..." clearable class="kw-input">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <span v-if="loaded" class="muted summary">
          共 <b class="num">{{ summary.total }}</b> 个套餐 · 显示中 <b class="num">{{ summary.visible }}</b> · 可新购
          <b class="num">{{ summary.selling }}</b> · 用户 <b class="num">{{ summary.users }}</b>
        </span>
        <span class="grow" />
        <n-popover trigger="click" placement="bottom-end">
          <template #trigger>
            <n-button quaternary size="small">
              <template #icon><n-icon><options-outline /></n-icon></template>
              显示列
            </n-button>
          </template>
          <div class="col-picker">
            <div class="muted col-picker-title">切换显示列</div>
            <n-checkbox-group v-model:value="visibleOptional">
              <div v-for="c in OPTIONAL_COLUMNS" :key="c.key" class="col-picker-item">
                <n-checkbox :value="c.key" :label="c.label" />
              </div>
            </n-checkbox-group>
          </div>
        </n-popover>
        <n-button quaternary circle size="small" title="刷新" aria-label="刷新" :loading="loading" @click="load">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
        </n-button>
      </div>

      <n-data-table
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :pagination="pagination"
        :row-key="(p: Plan) => p.id"
        :scroll-x="scrollX"
        :bordered="false"
        size="small"
        class="plan-table"
      >
        <template #empty>
          <div class="empty">
            <template v-if="keyword.trim()">没有名称包含「{{ keyword.trim() }}」的套餐</template>
            <template v-else>
              <div>还没有套餐</div>
              <n-button size="small" type="primary" @click="openCreate">添加第一个套餐</n-button>
            </template>
          </div>
        </template>
      </n-data-table>
    </n-card>

    <plan-form-drawer v-model:show="formOpen" :plan="editing" @saved="onSaved" />
    <plan-sort-modal v-model:show="sortOpen" :plans="plans" @saved="load" />
  </page-container>
</template>

<style scoped>
.plan-toolbar {
  margin-bottom: 12px;
}
.kw-input {
  width: 240px;
}
@media (max-width: 767px) {
  .kw-input {
    width: 100%;
  }
  .summary {
    display: none;
  }
}
.summary {
  font-size: 12.5px;
}
.summary b {
  color: var(--text-strong);
  font-weight: 600;
}
.num {
  font-variant-numeric: tabular-nums;
}
.col-picker {
  min-width: 140px;
}
.col-picker-title {
  font-size: 12px;
  margin-bottom: 6px;
}
.col-picker-item {
  padding: 3px 0;
}
.plan-table :deep(.th-help) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.plan-table :deep(.th-help-icon) {
  color: var(--text-muted);
  cursor: help;
}
.plan-table :deep(.name-cell) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.plan-table :deep(.plan-name) {
  font-weight: 600;
  color: var(--text-strong);
}
.plan-table :deep(.name-tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.plan-table :deep(.stats) {
  display: flex;
  gap: 6px;
}
.plan-table :deep(.stat-pill) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  cursor: default;
}
.plan-table :deep(.stat-total) {
  background: var(--hover-color);
  color: var(--text-color);
}
.plan-table :deep(.stat-active) {
  background: color-mix(in srgb, var(--success-color) 14%, transparent);
  color: var(--success-color);
}
.plan-table :deep(.num) {
  font-variant-numeric: tabular-nums;
}
.plan-table :deep(.strong) {
  font-weight: 600;
  color: var(--text-strong);
}
.plan-table :deep(.small) {
  font-size: 12px;
  line-height: 1.5;
}
.plan-table :deep(.warn) {
  color: var(--warning-color);
}
.plan-table :deep(.price-tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.plan-table :deep(.price-tag) {
  font-variant-numeric: tabular-nums;
}
.plan-table :deep(.price-tag.dashed) {
  border-style: dashed;
  color: var(--text-muted);
}
.plan-table :deep(.row-actions) {
  display: inline-flex;
  gap: 2px;
}
:global(.stat-tip-title) {
  font-weight: 600;
  margin-bottom: 2px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 0;
  color: var(--text-muted);
}
</style>
