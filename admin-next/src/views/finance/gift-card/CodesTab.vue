<script setup lang="ts">
// 兑换码管理 tab (spec commerce §6.3). Filters use the parameters the backend really supports:
// template_id / batch_id / status. Adds batch export, edit and delete (backend-only in the official UI).
import { computed, h, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NDataTable,
  NEmpty,
  NIcon,
  NInput,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
} from 'naive-ui'
import {
  CopyOutline,
  CreateOutline,
  DownloadOutline,
  KeyOutline,
  RefreshOutline,
  SearchOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import SwitchCell from '@/components/SwitchCell.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import {
  deleteCode,
  fetchCodes,
  giftCardTypeLabel,
  toggleCode,
  type GiftCardCode,
} from '@/api/giftCard'
import { appState } from '@/stores/app'
import { copyText } from '@/utils/clipboard'
import { confirm, message } from '@/utils/discrete'
import { formatTime, nowSeconds } from '@/utils/format'
import CodeEditDialog from './CodeEditDialog.vue'
import ColumnToggle from './ColumnToggle.vue'
import ExportBatchDialog from './ExportBatchDialog.vue'
import {
  codeStatusView,
  downloadBatch,
  isFieldError,
  loadTemplateOptions,
  templateOptions,
  templateSelectOptions,
  toastApiError,
  useHiddenColumns,
  type ColumnOption,
  type TabIntent,
} from './helpers'

const props = defineProps<{ intent: TabIntent | null }>()
const emit = defineEmits<{ (e: 'generate', templateId: number | null): void }>()

const router = useRouter()

const filters = reactive({
  template_id: (props.intent?.template_id ?? null) as number | null,
  batch_id: props.intent?.batch_id ?? '',
  status: null as number | null,
})
/** Batch input text; applied on enter / blur. */
const batchInput = ref(filters.batch_id)
const hasFilter = computed(() => filters.template_id !== null || !!filters.batch_id || filters.status !== null)

const currentFilters = computed(() => ({
  template_id: filters.template_id,
  batch_id: filters.batch_id || null,
  status: filters.status,
}))

const table = usePagedTable<GiftCardCode>(
  async (q) => {
    try {
      const res = await fetchCodes({ ...currentFilters.value, page: q.current, per_page: q.pageSize }, { silent: true })
      return { data: res.data ?? [], total: res.total ?? 0 }
    } catch (e) {
      // Deep link / intent to a template that does not exist (or was deleted elsewhere).
      if (isFieldError(e, 'template_id') && filters.template_id !== null) {
        message.warning(`模板 #${filters.template_id} 不存在（可能已被删除），已清除模板筛选`)
        filters.template_id = null // the filter watcher reloads
      } else toastApiError(e)
      throw e
    }
  },
  { pageSize: 20, pageSizes: [10, 20, 30, 40, 50, 100, 500] },
)
table.pagination.showQuickJumper = true
table.pagination.prefix = ({ itemCount }) => `共 ${itemCount ?? 0} 个兑换码`

/** Reload the current page; if it became empty (last row deleted / filtered out), go to the new last page. */
async function reloadClamped() {
  await table.reload()
  const page = table.pagination.page ?? 1
  const total = table.pagination.itemCount ?? 0
  if (!table.data.value.length && total > 0 && page > 1) {
    table.pagination.page = Math.max(1, Math.ceil(total / (table.pagination.pageSize ?? 20)))
    await table.reload()
  }
}

watch(
  () => [filters.template_id, filters.status, filters.batch_id],
  () => void table.search(),
)

watch(
  () => props.intent?.seq,
  () => {
    const it = props.intent
    if (!it) return
    filters.status = null
    filters.template_id = it.template_id ?? null
    filters.batch_id = it.batch_id ?? ''
    batchInput.value = filters.batch_id
  },
)

function applyBatch() {
  filters.batch_id = batchInput.value.trim()
}
function filterBatch(batchId: string) {
  batchInput.value = batchId
  filters.batch_id = batchId
}
function resetFilters() {
  filters.template_id = null
  filters.status = null
  filters.batch_id = ''
  batchInput.value = ''
}

void loadTemplateOptions()
const templateFilterOptions = computed(() => templateSelectOptions())
// The filter matches the stored status. Status 2 is only set by hand (编辑兑换码); codes past their
// expiry time keep status 0 / 1 and are listed under those, displayed as “已过期”.
const statusOptions = [
  { label: '未使用', value: 0 },
  { label: '已使用', value: 1 },
  { label: '已过期（手动标记）', value: 2 },
  { label: '已禁用', value: 3 },
]
const statusHint = computed(() => {
  if (filters.status === 0) return '按数据库状态筛选：已到过期时间但未兑换的兑换码仍属于“未使用”，列表中显示为“已过期”。'
  if (filters.status === 2) return '只包含被手动标记为“已过期”的兑换码；到期后系统不会自动改状态，按时间过期的兑换码在“未使用”中。'
  return ''
})

const filterText = computed(() => {
  const parts: string[] = []
  if (filters.template_id !== null) {
    const t = templateOptions.list.find((x) => x.id === filters.template_id)
    parts.push(`模板「${t?.name ?? `#${filters.template_id}`}」`)
  }
  if (filters.status !== null) parts.push(`状态「${statusOptions.find((o) => o.value === filters.status)?.label ?? filters.status}」`)
  if (filters.batch_id) parts.push(`批次「${filters.batch_id}」`)
  return parts.join('、')
})

// ---------- actions ----------
const editShow = ref(false)
const editing = ref<GiftCardCode | null>(null)
const exportShow = ref(false)

function openEdit(row: GiftCardCode) {
  editing.value = row
  editShow.value = true
}

async function onToggle(row: GiftCardCode, enabled: boolean) {
  await toggleCode(row.id, enabled ? 'enable' : 'disable')
  message.success('兑换码状态更新成功')
  // With a status filter the row may leave the current page.
  void reloadClamped()
}

const deletable = (row: GiftCardCode) => row.status !== 1 && !(row.usage_count > 0)

async function remove(row: GiftCardCode) {
  const ok = await confirm({
    title: '确认删除',
    content: `确定要永久删除兑换码「${row.code}」吗？删除后无法恢复，已分发出去的该兑换码将无法兑换。`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  // Deleting the only row of a later page: step back instead of showing an empty page.
  const page = table.pagination.page ?? 1
  const lastOnPage = table.data.value.length === 1 && page > 1
  try {
    await deleteCode(row.id)
    message.success('兑换码删除成功')
  } catch {
    /* backend reason is toasted by the http client */
    return
  }
  if (lastOnPage) table.pagination.page = page - 1
  void reloadClamped()
}

function exportCodes() {
  exportShow.value = true
}

function openUser(email: string) {
  void router.push({ path: '/user/manage', query: { email } })
}

// ---------- cells ----------
function statusCell(row: GiftCardCode) {
  const v = codeStatusView(row)
  const tag = h(NTag, { size: 'small', type: v.tag, bordered: false }, { default: () => v.label })
  return h('div', { class: 'status-cell' }, [
    v.hint ? h(NTooltip, null, { trigger: () => tag, default: () => v.hint }) : tag,
    row.status === 0 || row.status === 3
      ? h(NTooltip, null, {
          trigger: () =>
            h('span', null, [h(SwitchCell, { value: row.status !== 3, onChange: (en: boolean) => onToggle(row, en) })]),
          default: () => (row.status === 3 ? '启用兑换码' : '禁用兑换码'),
        })
      : null,
  ])
}

function templateCell(row: GiftCardCode) {
  if (!row.template) return h('span', { class: 'muted' }, `#${row.template_id}`)
  return h('div', { class: 'two-line' }, [
    h('span', { class: 'strong' }, row.template.name),
    h('span', { class: 'muted small' }, giftCardTypeLabel(row.template.type)),
  ])
}

function batchCell(row: GiftCardCode) {
  if (!row.batch_id) return h('span', { class: 'muted' }, '-')
  return h(NTooltip, null, {
    trigger: () =>
      h(
        NButton,
        { text: true, size: 'small', class: 'mono small batch-link', onClick: () => filterBatch(row.batch_id!) },
        { default: () => row.batch_id },
      ),
    default: () => '只看此批次',
  })
}

function usageCell(row: GiftCardCode) {
  const full = row.usage_count >= row.max_usage
  return h('span', { class: ['num', full ? 'muted' : ''] }, `${row.usage_count ?? 0} / ${row.max_usage ?? 1}`)
}

function userCell(row: GiftCardCode) {
  if (!row.user) return h('span', { class: 'muted' }, row.user_id ? `#${row.user_id}` : '-')
  const email = row.user.email
  return h('div', { class: 'two-line' }, [
    h(NTooltip, null, {
      trigger: () => h(NButton, { text: true, type: 'primary', size: 'small', class: 'email-link', onClick: () => openUser(email) }, { default: () => email }),
      default: () => '查看用户',
    }),
    row.used_at ? h('span', { class: 'muted mono small' }, formatTime(row.used_at)) : null,
  ])
}

function expiresCell(row: GiftCardCode) {
  if (!row.expires_at) return h('span', { class: 'forever' }, '长期有效')
  const expired = row.expires_at < nowSeconds()
  return h('span', { class: ['mono', 'small', expired ? 'expired' : ''] }, formatTime(row.expires_at))
}

function actionButtons(row: GiftCardCode) {
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
  const canDelete = deletable(row)
  return h('div', { class: 'row-actions' }, [
    btn('编辑', CreateOutline, () => openEdit(row)),
    btn('导出本批次', DownloadOutline, () => row.batch_id && void downloadBatch(row.batch_id), {
      disabled: !row.batch_id,
      tip: row.batch_id ? '导出本批次（TXT）' : '没有批次号',
    }),
    btn('删除', TrashOutline, () => remove(row), {
      danger: true,
      disabled: !canDelete,
      tip: canDelete ? '删除' : '已使用的兑换码无法删除',
    }),
  ])
}

// Codes are short; show them in full (no ellipsis) with a copy button.
const codeCell = (row: GiftCardCode) =>
  h('span', { class: 'code-cell' }, [
    h('span', { class: 'code-text' }, row.code),
    h(
      NButton,
      { text: true, size: 'tiny', class: 'copy-btn', title: '复制', 'aria-label': '复制兑换码', onClick: () => copyText(row.code, '复制成功') },
      { icon: () => h(NIcon, null, { default: () => h(CopyOutline) }) },
    ),
  ])
const idTag = (row: GiftCardCode) => h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id })

const desktopColumns = computed<DataTableColumns<GiftCardCode>>(() => [
  { title: 'ID', key: 'id', width: 76, render: idTag },
  { title: '兑换码', key: 'code', width: 210, render: codeCell },
  { title: '模板', key: 'template', minWidth: 150, render: templateCell },
  { title: '批次号', key: 'batch_id', width: 170, render: batchCell },
  { title: '状态', key: 'status', width: 130, render: statusCell },
  { title: '已用/可用', key: 'usage', width: 90, render: usageCell },
  { title: '使用者', key: 'user', minWidth: 210, render: userCell },
  { title: '过期时间', key: 'expires_at', width: 160, render: expiresCell },
  {
    title: '创建时间',
    key: 'created_at',
    width: 160,
    render: (row) => h('span', { class: 'muted mono small' }, formatTime(row.created_at)),
  },
  { title: '操作', key: 'actions', width: 120, align: 'center', fixed: 'right', render: actionButtons },
])

const columnOptions: ColumnOption[] = [
  { key: 'id', label: 'ID' },
  { key: 'code', label: '兑换码', fixed: true },
  { key: 'template', label: '模板' },
  { key: 'batch_id', label: '批次号' },
  { key: 'status', label: '状态' },
  { key: 'usage', label: '已用/可用' },
  { key: 'user', label: '使用者' },
  { key: 'expires_at', label: '过期时间' },
  { key: 'created_at', label: '创建时间' },
  { key: 'actions', label: '操作', fixed: true },
]
const hiddenColumns = useHiddenColumns('codes')
const visibleColumns = computed(() =>
  desktopColumns.value.filter((c) => !('key' in c) || !hiddenColumns.value.includes(String(c.key))),
)

const mobileColumns = computed<DataTableColumns<GiftCardCode>>(() => [
  {
    title: '兑换码',
    key: 'card',
    render: (row) =>
      h('div', { class: 'm-card' }, [
        h('div', { class: 'm-head' }, [h('div', { class: 'm-code' }, [codeCell(row)]), statusCell(row)]),
        h('div', { class: 'm-grid' }, [
          h('div', null, [h('div', { class: 'm-label' }, '模板'), templateCell(row)]),
          h('div', null, [h('div', { class: 'm-label' }, '已用/可用'), usageCell(row)]),
          h('div', null, [h('div', { class: 'm-label' }, '过期时间'), expiresCell(row)]),
          h('div', null, [h('div', { class: 'm-label' }, '批次号'), batchCell(row)]),
        ]),
        row.user ? h('div', null, [h('div', { class: 'm-label' }, '使用者'), userCell(row)]) : null,
        h('div', { class: 'm-foot' }, [h('span', { class: 'muted mono small' }, formatTime(row.created_at)), actionButtons(row)]),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : visibleColumns.value))

defineExpose({ reload: reloadClamped })
</script>

<template>
  <div class="tab-pane">
    <div class="toolbar tab-toolbar">
      <n-select
        v-model:value="filters.template_id"
        :options="templateFilterOptions"
        :loading="templateOptions.loading"
        placeholder="全部模板"
        filterable
        clearable
        class="template-select"
      />
      <n-select
        v-model:value="filters.status"
        :options="statusOptions"
        :consistent-menu-width="false"
        placeholder="状态"
        clearable
        class="status-select"
      />
      <n-input
        v-model:value="batchInput"
        placeholder="按批次号筛选，回车确认"
        clearable
        class="batch-input"
        @keyup.enter="applyBatch"
        @blur="applyBatch"
        @clear="filterBatch('')"
      >
        <template #prefix><n-icon><search-outline /></n-icon></template>
      </n-input>
      <n-button v-if="hasFilter" quaternary @click="resetFilters">重置</n-button>
      <span class="grow" />
      <n-tooltip>
        <template #trigger>
          <n-button quaternary circle :loading="table.loading.value" aria-label="刷新" @click="reloadClamped">
            <template #icon><n-icon><refresh-outline /></n-icon></template>
          </n-button>
        </template>
        刷新
      </n-tooltip>
      <column-toggle v-if="!appState.isMobile" v-model:hidden="hiddenColumns" :options="columnOptions" />
      <n-button @click="exportCodes">
        <template #icon><n-icon><download-outline /></n-icon></template>
        导出
      </n-button>
      <n-button type="primary" @click="emit('generate', filters.template_id)">
        <template #icon><n-icon><key-outline /></n-icon></template>
        生成兑换码
      </n-button>
    </div>
    <p v-if="statusHint" class="muted status-hint">{{ statusHint }}</p>

    <n-data-table
      remote
      :columns="columns"
      :data="table.data.value"
      :loading="table.loading.value"
      :pagination="table.pagination"
      :row-key="(r: GiftCardCode) => r.id"
      :scroll-x="appState.isMobile ? undefined : 1480"
      :bordered="false"
      size="small"
      class="data-table"
    >
      <template #empty>
        <n-empty :description="hasFilter ? '没有符合条件的兑换码' : '暂无兑换码'">
          <template v-if="!hasFilter" #extra>
            <n-button size="small" @click="emit('generate', null)">生成兑换码</n-button>
          </template>
        </n-empty>
      </template>
    </n-data-table>

    <code-edit-dialog v-model:show="editShow" :code="editing" @success="reloadClamped" />
    <export-batch-dialog v-model:show="exportShow" :filters="currentFilters" :filter-text="filterText" />
  </div>
</template>

<style scoped>
.tab-toolbar {
  margin-bottom: 12px;
}
.status-hint {
  margin: -4px 0 10px;
  font-size: 12px;
}
.template-select {
  width: 200px;
}
.status-select {
  width: 150px;
}
.batch-input {
  width: 230px;
}
@media (max-width: 767px) {
  .template-select,
  .status-select {
    flex: 1;
    width: auto;
    min-width: 130px;
  }
  .batch-input {
    width: 100%;
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
.data-table :deep(.strong) {
  font-weight: 500;
}
.data-table :deep(.code-cell) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}
.data-table :deep(.code-text) {
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow-wrap: anywhere;
}
.data-table :deep(.copy-btn) {
  flex: none;
  opacity: 0.6;
}
.data-table :deep(.copy-btn:hover) {
  opacity: 1;
}
.data-table :deep(.two-line) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  line-height: 1.45;
}
.data-table :deep(.status-cell) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.data-table :deep(.batch-link) {
  font-family: var(--font-mono);
  font-size: 12px;
}
.data-table :deep(.email-link) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.data-table :deep(.forever) {
  font-size: 12px;
  color: var(--success-color);
}
.data-table :deep(.expired) {
  color: var(--error-color);
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
.data-table :deep(.m-foot) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.data-table :deep(.m-code) {
  flex: 1;
  min-width: 0;
}
.data-table :deep(.m-grid) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.data-table :deep(.m-label) {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
</style>
