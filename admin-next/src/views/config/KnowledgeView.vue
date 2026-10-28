<script setup lang="ts">
// 知识库管理 /config/knowledge (spec content.md §4). All rows load at once; search, category filter
// (exact set match, fixing spec R-K1), paging and sorting are client side. "按分类" shows the rows
// grouped the way the user frontend does (category groups in global sort order).
import { computed, h, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NIcon,
  NInput,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
  type DataTableInst,
  type DataTableRowKey,
  type DataTableSortState,
  type PaginationProps,
} from 'naive-ui'
import {
  AddOutline,
  CreateOutline,
  FolderOpenOutline,
  RefreshOutline,
  SearchOutline,
  SwapVerticalOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import SwitchCell from '@/components/SwitchCell.vue'
import {
  dropKnowledge,
  fetchKnowledgeCategories,
  fetchKnowledgeList,
  toggleKnowledgeShow,
  type KnowledgeListItem,
} from '@/api/knowledge'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { formatTime } from '@/utils/format'
import { storage } from '@/utils/storage'
import KnowledgeFormModal from './knowledge/KnowledgeFormModal.vue'
import KnowledgeSortModal from './knowledge/KnowledgeSortModal.vue'

interface ItemRow extends KnowledgeListItem {
  kind: 'item'
  rowKey: string
}
interface GroupRow {
  kind: 'group'
  rowKey: string
  category: string
  total: number
  shown: number
  children: ItemRow[]
}
type Row = ItemRow | GroupRow

const items = ref<KnowledgeListItem[]>([])
const extraCategories = ref<string[]>([])
const loading = ref(false)
const loaded = ref(false)

async function load(quiet = false): Promise<KnowledgeListItem[] | null> {
  if (!quiet) loading.value = true
  try {
    const list = await fetchKnowledgeList()
    items.value = Array.isArray(list) ? list : []
    loaded.value = true
    return items.value
  } catch {
    return null
  } finally {
    if (!quiet) loading.value = false
  }
}

async function loadCategories() {
  try {
    const cats = await fetchKnowledgeCategories({ silent: true })
    extraCategories.value = Array.isArray(cats) ? cats.map(String) : []
  } catch {
    /* suggestions only */
  }
}
void load()
void loadCategories()

// ---------- view + filters ----------
type ViewMode = 'list' | 'group'
type ShowFilter = 'all' | 'shown' | 'hidden'
const viewMode = ref<ViewMode>(storage.get('knowledge_view') === 'group' ? 'group' : 'list')
watch(viewMode, (v) => storage.set('knowledge_view', v))

const keyword = ref('')
const selectedCategories = ref<string[]>([])
const showFilter = ref<ShowFilter>('all')
const sorted = ref(false)
const tableRef = ref<DataTableInst | null>(null)

const SHOW_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '显示中', value: 'shown' },
  { label: '已隐藏', value: 'hidden' },
]

/** Categories in first-appearance order of the global sort (same as the user frontend groups). */
const categoryStats = computed(() => {
  const map = new Map<string, number>()
  for (const it of items.value) map.set(it.category ?? '', (map.get(it.category ?? '') ?? 0) + 1)
  return [...map.entries()].map(([name, count]) => ({ name, count }))
})

const categoryOptions = computed(() =>
  categoryStats.value.map((c) => ({ label: `${c.name || '（未分类）'}（${c.count}）`, value: c.name })),
)

const allCategories = computed(() => [
  ...new Set([...categoryStats.value.map((c) => c.name), ...extraCategories.value].filter((c) => !!c)),
])

// Drop selections whose category disappeared (e.g. last article deleted).
watch(categoryStats, (stats) => {
  const names = new Set(stats.map((c) => c.name))
  if (selectedCategories.value.some((c) => !names.has(c))) {
    selectedCategories.value = selectedCategories.value.filter((c) => names.has(c))
  }
})

const filtered = computed<ItemRow[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  const cats = new Set(selectedCategories.value)
  return items.value
    .filter((it) => {
      if (cats.size && !cats.has(it.category ?? '')) return false
      if (showFilter.value === 'shown' && !it.show) return false
      if (showFilter.value === 'hidden' && it.show) return false
      return !kw || (it.title ?? '').toLowerCase().includes(kw)
    })
    .map((it) => ({ ...it, kind: 'item' as const, rowKey: `k${it.id}` }))
})

const groups = computed<GroupRow[]>(() => {
  const map = new Map<string, GroupRow>()
  for (const it of filtered.value) {
    const c = it.category ?? ''
    let g = map.get(c)
    if (!g) {
      g = { kind: 'group', rowKey: `g:${c}`, category: c, total: 0, shown: 0, children: [] }
      map.set(c, g)
    }
    g.children.push(it)
    g.total++
    if (it.show) g.shown++
  }
  return [...map.values()]
})

const tableData = computed<Row[]>(() => (viewMode.value === 'group' ? groups.value : filtered.value))

const hasFilter = computed(
  () => !!keyword.value.trim() || selectedCategories.value.length > 0 || showFilter.value !== 'all' || sorted.value,
)

function resetFilters() {
  keyword.value = ''
  selectedCategories.value = []
  showFilter.value = 'all'
  tableRef.value?.clearSorter()
  sorted.value = false
}

function onSorter(s: DataTableSortState | DataTableSortState[] | null) {
  const one = Array.isArray(s) ? s[0] : s
  sorted.value = !!one?.order
}

watch(viewMode, () => {
  tableRef.value?.clearSorter()
  sorted.value = false
})

// Group view: everything expanded unless the admin collapsed it.
const collapsed = ref<Set<string>>(new Set())
const expandedKeys = computed(() => groups.value.map((g) => g.rowKey).filter((k) => !collapsed.value.has(k)))
function onExpand(keys: DataTableRowKey[]) {
  const open = new Set(keys.map(String))
  collapsed.value = new Set(groups.value.map((g) => g.rowKey).filter((k) => !open.has(k)))
}

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  showQuickJumper: true,
  pageSizes: [10, 20, 30, 40, 50, 100, 500],
  prefix: ({ itemCount }) => `共 ${itemCount ?? 0} 条`,
  onUpdatePage: (p: number) => (pagination.page = p),
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
  },
})
watch([keyword, selectedCategories, showFilter], () => (pagination.page = 1))

const summary = computed(() => ({
  total: items.value.length,
  shown: items.value.filter((i) => i.show).length,
  categories: categoryStats.value.length,
}))

// ---------- dialogs ----------
const formOpen = ref(false)
const editing = ref<KnowledgeListItem | null>(null)
const presetCategory = ref('')
const sortOpen = ref(false)

function openCreate(category = '') {
  editing.value = null
  presetCategory.value = category
  formOpen.value = true
}
function openEdit(row: KnowledgeListItem) {
  editing.value = row
  presetCategory.value = ''
  formOpen.value = true
}

function reloadAll() {
  void load()
  void loadCategories()
}

// ---------- row actions ----------
/** The backend toggles (no target value), so resync afterwards to catch concurrent edits. Throw = revert. */
async function toggleShow(row: KnowledgeListItem, v: boolean) {
  const ok = await toggleKnowledgeShow(row.id)
  if (!ok) {
    void load(true)
    throw new Error('toggle failed')
  }
  // Table rows are copies: update the source first so the switch's `value` prop changes and the
  // resync below can move it back if another admin had already flipped it (also covers a failed resync).
  const src = items.value.find((x) => x.id === row.id)
  if (src) src.show = v
  const fresh = await load(true)
  const now = fresh?.find((x) => x.id === row.id)
  if (now && !!now.show !== v) {
    message.warning('该知识的显示状态已被其他操作修改，已同步为最新状态')
  } else {
    message.success(v ? `已在用户端显示「${row.title}」` : `已隐藏「${row.title}」`)
  }
}

async function remove(row: KnowledgeListItem) {
  const ok = await confirm({
    title: '确认删除',
    content: `此操作将永久删除知识「${row.title}」，删除后无法恢复。确定要继续吗？`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    const done = await dropKnowledge(row.id)
    if (done) message.success('操作成功')
  } catch {
    /* toasted */
  }
  reloadAll()
}

// ---------- rendering ----------
function iconAction(label: string, icon: typeof CreateOutline, onClick: () => void, type: 'default' | 'error' = 'default') {
  return h(NTooltip, null, {
    trigger: () =>
      h(
        NButton,
        { quaternary: true, circle: true, size: 'small', type, 'aria-label': label, onClick },
        { icon: () => h(NIcon, null, { default: () => h(icon) }) },
      ),
    default: () => label,
  })
}

const idTag = (r: ItemRow) => h(NTag, { size: 'small', bordered: true, class: 'num' }, { default: () => r.id })
const switchCell = (r: ItemRow) => h(SwitchCell, { value: r.show, onChange: (v: boolean) => toggleShow(r, v) })
const timeCell = (r: ItemRow) => h('span', { class: 'time' }, formatTime(r.updated_at))
const titleCell = (r: ItemRow) => h('div', { class: 'title-text', title: r.title }, r.title)
const itemActions = (r: ItemRow) =>
  h('div', { class: 'row-actions' }, [
    iconAction('编辑知识', CreateOutline, () => openEdit(r)),
    iconAction('删除', TrashOutline, () => void remove(r), 'error'),
  ])
const categoryTag = (name: string) =>
  h(NTag, { size: 'small', bordered: false, class: 'cat-tag', title: name }, { default: () => name || '（未分类）' })

const COL = { id: 72, show: 76, title: 320, category: 180, time: 170, actions: 92 }
const MOBILE_TITLE_W = 168

const listColumns = computed<DataTableColumns<Row>>(() => {
  const asItem = (r: Row) => r as ItemRow
  const cols: DataTableColumns<Row> = [
    {
      key: 'id',
      title: 'ID',
      width: COL.id,
      sorter: (a, b) => asItem(a).id - asItem(b).id,
      render: (r) => idTag(asItem(r)),
    },
    { key: 'show', title: '状态', width: COL.show, render: (r) => switchCell(asItem(r)) },
    {
      key: 'title',
      title: '标题',
      minWidth: COL.title,
      sorter: (a, b) => asItem(a).title.localeCompare(asItem(b).title, 'zh-CN'),
      render: (r) => titleCell(asItem(r)),
    },
    {
      key: 'category',
      title: '分类',
      width: COL.category,
      sorter: (a, b) => (asItem(a).category ?? '').localeCompare(asItem(b).category ?? '', 'zh-CN'),
      render: (r) => categoryTag(asItem(r).category),
    },
    {
      key: 'updated_at',
      title: '更新时间',
      width: COL.time,
      sorter: (a, b) => asItem(a).updated_at - asItem(b).updated_at,
      render: (r) => timeCell(asItem(r)),
    },
    { key: 'actions', title: '操作', width: COL.actions, fixed: 'right', align: 'right', render: (r) => itemActions(asItem(r)) },
  ]
  if (appState.isMobile) {
    const i = cols.findIndex((c) => 'key' in c && c.key === 'title')
    const [title] = cols.splice(i, 1)
    cols.unshift({ ...title, fixed: 'left', width: MOBILE_TITLE_W, minWidth: undefined } as (typeof cols)[number])
  }
  return cols
})

const groupColumns = computed<DataTableColumns<Row>>(() => [
  {
    key: 'title',
    title: '分类 / 标题',
    tree: true,
    minWidth: appState.isMobile ? undefined : COL.title,
    width: appState.isMobile ? MOBILE_TITLE_W : undefined,
    fixed: appState.isMobile ? 'left' : undefined,
    render: (r) =>
      r.kind === 'group'
        ? h('span', { class: 'group-title' }, [
            h(NIcon, { size: 16, class: 'group-icon' }, { default: () => h(FolderOpenOutline) }),
            h('span', { class: 'group-name', title: r.category }, r.category || '（未分类）'),
            h('span', { class: 'group-count num' }, `${r.total} 篇`),
          ])
        : // Inline so it stays on the tree indent line.
          h('span', { class: 'title-inline', title: r.title }, r.title),
  },
  { key: 'id', title: 'ID', width: COL.id, render: (r) => (r.kind === 'group' ? null : idTag(r)) },
  {
    key: 'show',
    title: '状态',
    width: COL.show + 24,
    render: (r) =>
      r.kind === 'group' ? h('span', { class: 'group-meta num' }, `显示 ${r.shown}/${r.total}`) : switchCell(r),
  },
  { key: 'updated_at', title: '更新时间', width: COL.time, render: (r) => (r.kind === 'group' ? null : timeCell(r)) },
  {
    key: 'actions',
    title: '操作',
    width: COL.actions + 24,
    fixed: 'right',
    align: 'right',
    render: (r) =>
      r.kind === 'group'
        ? h('div', { class: 'row-actions' }, [iconAction('在此分类下添加知识', AddOutline, () => openCreate(r.category))])
        : itemActions(r),
  },
])

const columns = computed(() => (viewMode.value === 'group' ? groupColumns.value : listColumns.value))
// Must equal the column widths: extra width would widen the pinned title over the actions column.
const scrollX = computed(() => {
  const title = appState.isMobile ? MOBILE_TITLE_W : COL.title
  return viewMode.value === 'group'
    ? title + COL.id + COL.show + COL.time + COL.actions + 48
    : title + COL.id + COL.show + COL.category + COL.time + COL.actions
})
const rowClass = (r: Row) => (r.kind === 'group' ? 'group-row' : '')
</script>

<template>
  <page-container
    title="知识库管理"
    description="在这里可以配置知识库，包括添加、删除、编辑和排序。用户端按界面语言显示文章，并按分类分组。"
  >
    <template #extra>
      <n-button :disabled="items.length < 2" @click="sortOpen = true">
        <template #icon><n-icon><swap-vertical-outline /></n-icon></template>
        编辑排序
      </n-button>
      <n-button type="primary" @click="openCreate()">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加知识
      </n-button>
    </template>

    <n-card size="small">
      <div class="toolbar list-toolbar">
        <n-radio-group v-model:value="viewMode" size="small" class="view-switch">
          <n-radio-button value="list">列表</n-radio-button>
          <n-radio-button value="group">按分类</n-radio-button>
        </n-radio-group>
        <n-input v-model:value="keyword" placeholder="搜索知识..." clearable class="kw-input">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-select
          v-model:value="selectedCategories"
          :options="categoryOptions"
          multiple
          clearable
          filterable
          max-tag-count="responsive"
          placeholder="分类"
          class="cat-select"
        />
        <n-select v-model:value="showFilter" :options="SHOW_OPTIONS" class="show-select" />
        <n-button v-if="hasFilter" quaternary @click="resetFilters">重置</n-button>
        <span v-if="loaded" class="muted summary">
          共 <b class="num">{{ summary.total }}</b> 篇 · 显示中 <b class="num">{{ summary.shown }}</b> · 分类
          <b class="num">{{ summary.categories }}</b>
        </span>
        <span class="grow" />
        <n-tooltip>
          <template #trigger>
            <n-button quaternary circle size="small" aria-label="刷新" :loading="loading" @click="reloadAll">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </div>

      <n-data-table
        ref="tableRef"
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :pagination="viewMode === 'group' ? false : pagination"
        :row-key="(r: Row) => r.rowKey"
        :row-class-name="rowClass"
        :expanded-row-keys="expandedKeys"
        :indent="20"
        :scroll-x="scrollX"
        :bordered="false"
        size="small"
        class="kb-table"
        @update:sorter="onSorter"
        @update:expanded-row-keys="onExpand"
      >
        <template #empty>
          <div class="empty">
            <template v-if="items.length">没有符合条件的知识</template>
            <template v-else-if="loaded">
              <div>知识库还是空的</div>
              <n-button size="small" type="primary" @click="openCreate()">添加第一篇知识</n-button>
            </template>
            <template v-else>暂无数据</template>
          </div>
        </template>
      </n-data-table>
    </n-card>

    <knowledge-form-modal
      v-model:show="formOpen"
      :row="editing"
      :preset-category="presetCategory"
      :categories="allCategories"
      @saved="reloadAll"
      @missing="reloadAll"
    />
    <knowledge-sort-modal v-model:show="sortOpen" :items="items" @saved="load()" />
  </page-container>
</template>

<style scoped>
.list-toolbar {
  margin-bottom: 12px;
}
.view-switch {
  flex: none;
}
.kw-input {
  width: 200px;
}
.cat-select {
  width: 220px;
}
.show-select {
  width: 120px;
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
@media (max-width: 767px) {
  .kw-input {
    width: 100%;
  }
  .cat-select,
  .show-select {
    flex: 1;
    min-width: 0;
    width: auto;
  }
  .summary {
    display: none;
  }
}
.kb-table :deep(.num) {
  font-variant-numeric: tabular-nums;
}
.kb-table :deep(.n-tag.num) {
  font-family: var(--font-mono);
}
.kb-table :deep(.title-text) {
  font-weight: 600;
  color: var(--text-strong);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.kb-table :deep(.title-inline) {
  display: inline-block;
  max-width: calc(100% - 48px);
  vertical-align: middle;
  font-weight: 600;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-table :deep(.cat-tag) {
  max-width: 180px;
}
.kb-table :deep(.cat-tag .n-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.kb-table :deep(.time) {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.kb-table :deep(.row-actions) {
  display: inline-flex;
  gap: 2px;
}
.kb-table :deep(.group-row td) {
  background: color-mix(in srgb, var(--primary-color) 5%, var(--card-color));
}
.kb-table :deep(.group-title) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}
.kb-table :deep(.group-icon) {
  flex: none;
  color: var(--primary-color);
}
.kb-table :deep(.group-name) {
  font-weight: 650;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-table :deep(.group-count),
.kb-table :deep(.group-meta) {
  flex: none;
  font-size: 12px;
  color: var(--text-muted);
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
