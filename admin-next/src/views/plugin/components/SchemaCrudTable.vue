<script setup lang="ts">
// Generic list + create / edit / delete page driven by an admin_crud schema (spec platform §4.4).
// Paging, search and sorting go through `source` (server endpoints or the demo's in-memory store).
import { computed, h, onBeforeUnmount, ref } from 'vue'
import {
  NAlert,
  NButton,
  NDataTable,
  NIcon,
  NInput,
  NModal,
  NScrollbar,
  NTag,
  NText,
  NTooltip,
  type DataTableColumns,
  type DataTableSortState,
} from 'naive-ui'
import { AddOutline, CreateOutline, RefreshOutline, SearchOutline, TrashOutline } from '@vicons/ionicons5'
import DynamicForm from '@/components/DynamicForm.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import type { CrudListQuery, PluginCrudColumn, PluginCrudSchema, CrudTagVariant } from '@/api/plugin'
import { formatTime } from '@/utils/format'
import { confirm, message } from '@/utils/discrete'
import type { CrudSource } from '@/views/plugin/crud'
import { collectValues, rowToValues, schemaToFields, schemaToValues, validateValues } from '@/views/plugin/schema'

type Row = Record<string, unknown>

const props = defineProps<{
  schema: PluginCrudSchema
  source: CrudSource
}>()

const columnsDef = computed<PluginCrudColumn[]>(() => (Array.isArray(props.schema.columns) ? props.schema.columns : []))
const formSchema = computed(() => (props.schema.form && typeof props.schema.form === 'object' ? props.schema.form : {}))
const idField = computed(() => props.schema.id_field || 'id')
const actions = computed(() => props.schema.actions || {})
const searchable = computed(() => columnsDef.value.some((c) => c.searchable))
const hasRowActions = computed(() => !!(actions.value.edit || actions.value.delete))

// ---------------------------------------------------------------- list

const search = ref('')
const sort = ref<{ field: string; order: 'asc' | 'desc' } | null>(null)
const listError = ref('')
// usePagedTable drops stale results; only the latest request may touch listError as well.
let listSeq = 0

const table = usePagedTable<Row>(async ({ current, pageSize }) => {
  const mine = ++listSeq
  const q: CrudListQuery = { current, pageSize }
  const kw = search.value.trim()
  if (kw) q.search = kw
  if (sort.value) {
    q.sort_field = sort.value.field
    q.sort_order = sort.value.order
  }
  try {
    const res = await props.source.list(q)
    if (mine === listSeq) listError.value = ''
    return res
  } catch (e) {
    if (mine === listSeq) listError.value = (e as Error).message || '加载失败'
    throw e
  }
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearch(v: string) {
  search.value = v
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void table.search(), 300)
}
onBeforeUnmount(() => clearTimeout(searchTimer))

function onSorter(s: DataTableSortState | DataTableSortState[] | null) {
  const first = Array.isArray(s) ? s[0] : s
  sort.value =
    first && first.order && typeof first.columnKey === 'string'
      ? { field: first.columnKey, order: first.order === 'ascend' ? 'asc' : 'desc' }
      : null
  void table.search()
}

// ---------------------------------------------------------------- cells

const TAG_TYPES: Record<CrudTagVariant, { type: 'primary' | 'default' | 'error'; bordered: boolean }> = {
  default: { type: 'primary', bordered: false },
  secondary: { type: 'default', bordered: false },
  destructive: { type: 'error', bordered: false },
  outline: { type: 'default', bordered: true },
}

function truthy(v: unknown) {
  return v === true || v === 1 || v === '1' || v === 'true'
}

function plain(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function renderCell(col: PluginCrudColumn, row: Row) {
  const v = row[col.key]
  switch (col.type) {
    case 'datetime':
      return h('span', { class: 'mono nowrap' }, formatTime(v as number | string | null | undefined))
    case 'boolean':
      return truthy(v)
        ? h(NTag, { size: 'small', type: 'primary', bordered: false }, { default: () => '是' })
        : h(NTag, { size: 'small', bordered: true }, { default: () => '否' })
    case 'tag': {
      if (v === null || v === undefined || v === '') return '-'
      const opt = (col.options || []).find((o) => String(o.value) === String(v))
      const style = TAG_TYPES[(opt?.variant as CrudTagVariant) || 'outline'] || TAG_TYPES.outline
      return h(NTag, { size: 'small', type: style.type, bordered: style.bordered }, { default: () => opt?.label || String(v) })
    }
    case 'number':
      return h('span', { class: 'mono' }, plain(v))
    default:
      return plain(v)
  }
}

const sortOrderOf = (key: string): 'ascend' | 'descend' | false =>
  sort.value && sort.value.field === key ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false

const columns = computed<DataTableColumns<Row>>(() => {
  const cols: DataTableColumns<Row> = columnsDef.value.map((c) => ({
    key: c.key,
    title: c.title || c.key,
    width: c.width,
    minWidth: c.width ? undefined : 120,
    sorter: c.sortable ? true : undefined,
    sortOrder: c.sortable ? sortOrderOf(c.key) : undefined,
    ellipsis: !c.type || c.type === 'string' ? { tooltip: true } : undefined,
    render: (row: Row) => renderCell(c, row),
  }))
  if (hasRowActions.value) {
    cols.push({
      key: '__actions',
      title: '操作',
      width: 100,
      fixed: 'right',
      align: 'center',
      render: (row: Row) =>
        h('div', { class: 'row-actions' }, [
          actions.value.edit
            ? h(
                NTooltip,
                null,
                {
                  trigger: () =>
                    h(
                      NButton,
                      { size: 'small', quaternary: true, circle: true, 'aria-label': '编辑', onClick: () => openEdit(row) },
                      { icon: () => h(NIcon, null, { default: () => h(CreateOutline) }) },
                    ),
                  default: () => '编辑',
                },
              )
            : null,
          actions.value.delete
            ? h(
                NTooltip,
                null,
                {
                  trigger: () =>
                    h(
                      NButton,
                      {
                        size: 'small',
                        quaternary: true,
                        circle: true,
                        type: 'error',
                        'aria-label': '删除',
                        onClick: () => removeRow(row),
                      },
                      { icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) },
                    ),
                  default: () => '删除',
                },
              )
            : null,
        ]),
    })
  }
  return cols
})

const scrollX = computed(
  () => columnsDef.value.reduce((sum, c) => sum + (c.width || 140), 0) + (hasRowActions.value ? 100 : 0),
)
const rowKey = (row: Row) => String(row[idField.value] ?? JSON.stringify(row))

// ---------------------------------------------------------------- form

const formShow = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingRow = ref<Row | null>(null)
const formValues = ref<Record<string, unknown>>({})
const saving = ref(false)
const formFields = computed(() => schemaToFields(formSchema.value, { withRequired: true }))

function openCreate() {
  formMode.value = 'create'
  editingRow.value = null
  formValues.value = schemaToValues(formSchema.value)
  formShow.value = true
}

function openEdit(row: Row) {
  formMode.value = 'edit'
  editingRow.value = row
  formValues.value = rowToValues(formSchema.value, row)
  formShow.value = true
}

/** Every close path (mask, X, Esc, 取消) goes through here; a running save keeps the dialog open. */
function closeForm() {
  if (!saving.value) formShow.value = false
}

async function submitForm() {
  if (saving.value) return
  const errors = validateValues(formSchema.value, formValues.value, { withRequired: true })
  if (errors.length) {
    message.error(errors.join('；'))
    return
  }
  const values = collectValues(formSchema.value, formValues.value)
  const body = formMode.value === 'edit' && editingRow.value ? { [idField.value]: editingRow.value[idField.value], ...values } : values
  saving.value = true
  try {
    await props.source.save(body, formMode.value)
    message.success(formMode.value === 'create' ? '创建成功' : '更新成功')
    formShow.value = false
    void table.reload()
  } catch {
    /* toasted by the http client / source */
  } finally {
    saving.value = false
  }
}

async function removeRow(row: Row) {
  const ok = await confirm({
    title: '删除记录',
    content: '确定删除该记录吗？此操作无法撤销。',
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await props.source.remove({ [idField.value]: row[idField.value] })
    message.success('删除成功')
    const page = table.pagination.page ?? 1
    if (table.data.value.length === 1 && page > 1) table.pagination.page = page - 1
    void table.reload()
  } catch {
    /* toasted */
  }
}

defineExpose({ reload: table.reload })
</script>

<template>
  <div class="crud">
    <div class="toolbar">
      <n-input
        v-if="searchable"
        :value="search"
        clearable
        placeholder="搜索..."
        class="crud-search"
        @update:value="onSearch"
      >
        <template #prefix><n-icon><search-outline /></n-icon></template>
      </n-input>
      <div class="grow" />
      <n-button :loading="table.loading.value" @click="table.reload()">
        <template #icon><n-icon><refresh-outline /></n-icon></template>
        刷新
      </n-button>
      <n-button v-if="actions.create" type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        新建
      </n-button>
    </div>

    <n-alert v-if="listError" type="error" title="列表加载失败" class="crud-alert">
      {{ listError }}
      <template v-if="schema.api?.list">
        <br /><n-text depth="3" class="mono">GET {{ schema.api.list }}</n-text>
      </template>
    </n-alert>
    <n-alert v-if="!columnsDef.length" type="warning" class="crud-alert">该 Schema 没有声明任何列（columns）。</n-alert>

    <n-data-table
      remote
      :columns="columns"
      :data="table.data.value"
      :loading="table.loading.value"
      :pagination="table.pagination"
      :row-key="rowKey"
      :scroll-x="scrollX"
      :single-line="false"
      @update:sorter="onSorter"
    />

    <n-modal
      :show="formShow"
      preset="card"
      :title="formMode === 'create' ? '新建' : '编辑'"
      :style="{ width: 'min(560px, 94vw)' }"
      :mask-closable="!saving"
      :closable="!saving"
      :close-on-esc="!saving"
      :segmented="{ content: true, footer: 'soft' }"
      @update:show="(v: boolean) => (v ? (formShow = true) : closeForm())"
    >
      <p class="form-desc">{{ formMode === 'create' ? '填写以下字段以创建新记录。' : '修改以下字段后保存。' }}</p>
      <n-scrollbar style="max-height: 60vh" trigger="none">
        <div class="form-inner">
          <dynamic-form v-model:value="formValues" :fields="formFields" :disabled="saving" />
        </div>
      </n-scrollbar>
      <template #footer>
        <div class="form-footer">
          <n-button :disabled="saving" @click="closeForm">取消</n-button>
          <n-button type="primary" :loading="saving" @click="submitForm">{{ saving ? '保存中...' : '保存' }}</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.crud {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.crud-search {
  width: 280px;
  max-width: 100%;
}
.crud-alert {
  word-break: break-word;
}
.crud :deep(.row-actions) {
  display: inline-flex;
  gap: 2px;
}
.form-desc {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.form-inner {
  padding-right: 12px;
}
/* DynamicForm drops the feedback row for fields without a description; keep the rhythm even. */
.form-inner :deep(.n-form-item:not(:has(.n-form-item-feedback-wrapper)):not(:last-child)) {
  margin-bottom: 20px;
}
.form-inner :deep(.n-form-item:has(.n-form-item-feedback-wrapper):not(:last-child)) {
  margin-bottom: 8px;
}
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
