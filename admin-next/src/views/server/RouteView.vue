<script setup lang="ts">
// 路由管理 /server/route (spec nodes §7).
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NEllipsis,
  NEmpty,
  NIcon,
  NInput,
  NPopover,
  NTag,
  NTooltip,
  type DataTableColumns,
  type PaginationProps,
} from 'naive-ui'
import { AddOutline, CreateOutline, RefreshOutline, SearchOutline, TrashOutline } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import RouteFormDialog from './route/RouteFormDialog.vue'
import { ROUTE_ACTIONS, routeActionMeta } from './route/route-actions'
import { dropRoute, fetchRouteUsage, fetchRoutes, type RouteNodeRef, type ServerRoute } from '@/api/serverRoute'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'

const list = ref<ServerRoute[]>([])
const usage = ref<Map<number, RouteNodeRef[]> | null>(null)
const loading = ref(false)
const keyword = ref('')

const formShow = ref(false)
const editing = ref<ServerRoute | null>(null)

/** Node references per route; null (column shows "-") when the node list could not be fetched. */
async function loadUsage(): Promise<boolean> {
  try {
    usage.value = await fetchRouteUsage()
    return true
  } catch {
    usage.value = null
    return false
  }
}

async function load() {
  loading.value = true
  try {
    const [routes] = await Promise.all([fetchRoutes(), loadUsage()])
    list.value = routes
  } catch {
    /* toast handled by http client */
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return list.value
  return list.value.filter(
    (r) =>
      r.remarks.toLowerCase().includes(k) ||
      String(r.id) === k ||
      r.match.some((m) => m.toLowerCase().includes(k)) ||
      (r.action_value ?? '').toLowerCase().includes(k),
  )
})

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 40, 50, 100, 500],
  prefix: ({ itemCount }) => `共 ${itemCount ?? 0} 项`,
  onUpdatePage: (p: number) => (pagination.page = p),
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
  },
})
watch(keyword, () => (pagination.page = 1))

function openCreate() {
  editing.value = null
  formShow.value = true
}

function openEdit(row: ServerRoute) {
  editing.value = row
  formShow.value = true
}

/** Route whose delete button is fetching fresh node references before the confirm dialog. */
const checkingId = ref<number | null>(null)

async function remove(row: ServerRoute) {
  if (checkingId.value !== null) return
  checkingId.value = row.id
  let fresh = false
  try {
    fresh = await loadUsage()
  } finally {
    checkingId.value = null
  }
  const refs = usage.value?.get(row.id) ?? []
  let refText = ''
  if (!fresh) {
    refText = '（无法获取引用节点信息，请确认没有节点仍在使用此路由。）'
  } else if (refs.length) {
    refText = `当前有 ${refs.length} 个节点引用此路由（${refs
      .slice(0, 5)
      .map((n) => n.name)
      .join('、')}${refs.length > 5 ? ' 等' : ''}），删除后这些节点将不再应用该规则。`
  }
  const ok = await confirm({
    title: '确认删除',
    content: `此操作将永久删除路由「${row.remarks}」，删除后无法恢复。${refText}确定要继续吗？`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await dropRoute(row.id)
    message.success('删除成功')
    await load()
  } catch {
    /* toast handled by http client */
  }
}

function actionTag(row: ServerRoute) {
  const meta = routeActionMeta(row.action)
  return h(
    NTag,
    { size: 'small', type: meta.tagType, bordered: false, round: true },
    {
      icon: () => h(NIcon, null, { default: () => h(meta.icon) }),
      default: () => meta.label,
    },
  )
}

function actionValueText(row: ServerRoute) {
  if (row.action === 'dns' && row.action_value) return h('span', { class: 'mono' }, `DNS: ${row.action_value}`)
  if (row.action === 'proxy' && row.action_value) return h('span', { class: 'mono' }, `转发 (${row.action_value})`)
  if (row.action === 'block') return h('span', { class: 'text-danger' }, '阻止访问')
  return h('span', null, '直连')
}

function matchSummary(row: ServerRoute) {
  const count = row.match.length
  const trigger = () => h('span', { class: 'match-count' }, `匹配 ${count} 条规则`)
  if (!count) return trigger()
  return h(
    NPopover,
    { trigger: 'hover', placement: 'bottom-start', style: 'max-width: 420px' },
    {
      trigger,
      default: () =>
        h('div', { class: 'route-match-pop' }, [
          h('div', { class: 'route-match-pop-title' }, `匹配规则（${count}）`),
          h(
            'ul',
            { class: 'route-match-list' },
            row.match.slice(0, 50).map((m) => h('li', { class: 'mono' }, m)),
          ),
          count > 50 ? h('div', { class: 'muted' }, `… 另有 ${count - 50} 条，编辑查看全部`) : null,
        ]),
    },
  )
}

function usageCell(row: ServerRoute) {
  if (!usage.value) return h('span', { class: 'muted' }, '-')
  const refs = usage.value.get(row.id) ?? []
  if (!refs.length) return h('span', { class: 'muted' }, '未使用')
  return h(
    NPopover,
    { trigger: 'hover', placement: 'bottom' },
    {
      trigger: () => h('span', { class: 'usage-num' }, `${refs.length} 个节点`),
      default: () =>
        h(
          'ul',
          { class: 'route-match-list' },
          refs.slice(0, 30).map((n) => h('li', null, `#${n.id} ${n.name}`)),
        ),
    },
  )
}

function actionButtons(row: ServerRoute) {
  const btn = (label: string, icon: typeof CreateOutline, onClick: () => void, danger = false, loading = false) =>
    h(NTooltip, null, {
      trigger: () =>
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            circle: true,
            type: danger ? 'error' : 'default',
            loading,
            onClick,
            'aria-label': label,
          },
          { icon: () => h(NIcon, null, { default: () => h(icon) }) },
        ),
      default: () => (loading ? '正在检查引用节点…' : label),
    })
  return h('div', { class: 'row-actions' }, [
    btn('编辑', CreateOutline, () => openEdit(row)),
    btn('删除', TrashOutline, () => remove(row), true, checkingId.value === row.id),
  ])
}

const desktopColumns = computed<DataTableColumns<ServerRoute>>(() => [
  {
    title: 'ID',
    key: 'id',
    width: 72,
    sorter: (a, b) => a.id - b.id,
    render: (row) => h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id }),
  },
  {
    title: '备注',
    key: 'remarks',
    minWidth: 160,
    render: (row) => h(NEllipsis, { style: 'max-width: 280px; font-weight: 500' }, { default: () => row.remarks }),
  },
  {
    title: '动作值',
    key: 'action_value',
    minWidth: 220,
    render: (row) =>
      h('div', { class: 'value-cell' }, [h('div', null, [actionValueText(row)]), h('div', null, [matchSummary(row)])]),
  },
  {
    title: '动作',
    key: 'action',
    width: 200,
    filterOptions: ROUTE_ACTIONS.map((a) => ({ label: a.label, value: a.value })),
    filter: (value, row) => row.action === value,
    render: actionTag,
  },
  { title: '引用节点', key: 'usage', width: 100, render: usageCell },
  { title: '操作', key: 'actions', width: 100, align: 'center', fixed: 'right', render: actionButtons },
])

const mobileColumns = computed<DataTableColumns<ServerRoute>>(() => [
  {
    title: '路由',
    key: 'card',
    render: (row) =>
      h('div', { class: 'm-card' }, [
        h('div', { class: 'm-head' }, [
          h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id }),
          h('span', { class: 'm-title' }, row.remarks),
          actionButtons(row),
        ]),
        h('div', { class: 'm-grid' }, [
          h('div', null, [h('div', { class: 'm-label' }, '动作'), actionTag(row)]),
          h('div', null, [h('div', { class: 'm-label' }, '动作值'), actionValueText(row), h('div', null, [matchSummary(row)])]),
        ]),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : desktopColumns.value))

onMounted(load)
</script>

<template>
  <page-container title="路由管理" description="管理所有路由组，包括添加、删除、编辑等操作。">
    <template #extra>
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加路由
      </n-button>
    </template>

    <n-card :bordered="true" size="small">
      <div class="toolbar table-toolbar">
        <n-input v-model:value="keyword" placeholder="搜索路由（备注、匹配规则、动作值）..." clearable class="search-input">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-button v-if="keyword" quaternary @click="keyword = ''">重置</n-button>
        <span class="grow" />
        <span class="muted total-hint">共 {{ list.length }} 条路由</span>
        <n-tooltip>
          <template #trigger>
            <n-button quaternary circle :loading="loading" aria-label="刷新" @click="load">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </div>
      <n-data-table
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :pagination="pagination"
        :row-key="(r: ServerRoute) => r.id"
        :scroll-x="appState.isMobile ? undefined : 860"
        :bordered="false"
        size="small"
        class="data-table"
      >
        <template #empty>
          <n-empty :description="keyword ? '没有匹配的路由' : '暂无路由规则'">
            <template v-if="!keyword" #extra>
              <n-button size="small" @click="openCreate">添加路由</n-button>
            </template>
          </n-empty>
        </template>
      </n-data-table>
    </n-card>

    <route-form-dialog v-model:show="formShow" :route="editing" @success="load" />
  </page-container>
</template>

<style scoped>
.table-toolbar {
  margin-bottom: 12px;
}
.search-input {
  width: 300px;
  max-width: 100%;
}
.total-hint {
  font-size: 12px;
}
@media (max-width: 767px) {
  .search-input {
    width: 100%;
  }
  .total-hint {
    display: none;
  }
}
.data-table :deep(.id-tag) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.value-cell) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.5;
}
.data-table :deep(.text-danger) {
  color: var(--error-color);
  font-weight: 500;
}
.data-table :deep(.match-count) {
  font-size: 12px;
  color: var(--text-muted);
  cursor: default;
  border-bottom: 1px dashed var(--border-color);
}
.data-table :deep(.usage-num) {
  font-variant-numeric: tabular-nums;
  cursor: default;
  border-bottom: 1px dashed var(--border-color);
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
  grid-template-columns: auto 1fr;
  gap: 12px;
}
.data-table :deep(.m-label) {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
:global(.route-match-pop-title) {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}
:global(.route-match-list) {
  margin: 0;
  padding-left: 16px;
  max-height: 260px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.7;
  word-break: break-all;
}
</style>
