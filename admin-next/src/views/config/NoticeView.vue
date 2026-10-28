<script setup lang="ts">
// 公告管理 /config/notice (spec content.md §3). All notices are loaded at once; search, paging and
// column sorting are client side. Ordering is edited in a dialog over the full list (spec R-S2).
import { computed, h, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NEllipsis,
  NIcon,
  NInput,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
  type DataTableInst,
  type DataTableSortState,
  type PaginationProps,
} from 'naive-ui'
import {
  AddOutline,
  CreateOutline,
  ImageOutline,
  RefreshOutline,
  SearchOutline,
  SwapVerticalOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import SwitchCell from '@/components/SwitchCell.vue'
import { POPUP_TAG, dropNotice, fetchNotices, toggleNoticeShow, type Notice } from '@/api/notice'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { formatTime } from '@/utils/format'
import NoticeFormModal from './notice/NoticeFormModal.vue'
import NoticeSortModal from './notice/NoticeSortModal.vue'

const notices = ref<Notice[]>([])
const loading = ref(false)
const loaded = ref(false)

/** `quiet` reloads keep the table visible (used after toggles to resync). */
async function load(quiet = false): Promise<Notice[] | null> {
  if (!quiet) loading.value = true
  try {
    const list = await fetchNotices()
    notices.value = Array.isArray(list) ? list : []
    loaded.value = true
    return notices.value
  } catch {
    return null
  } finally {
    if (!quiet) loading.value = false
  }
}
void load()

// ---------- filters ----------
type ShowFilter = 'all' | 'shown' | 'hidden'
const keyword = ref('')
const showFilter = ref<ShowFilter>('all')
const sorted = ref(false)
const tableRef = ref<DataTableInst | null>(null)

const SHOW_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '显示中', value: 'shown' },
  { label: '已隐藏', value: 'hidden' },
]

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return notices.value.filter((n) => {
    if (showFilter.value === 'shown' && !n.show) return false
    if (showFilter.value === 'hidden' && n.show) return false
    return !kw || (n.title ?? '').toLowerCase().includes(kw)
  })
})

const hasFilter = computed(() => !!keyword.value.trim() || showFilter.value !== 'all' || sorted.value)

function resetFilters() {
  keyword.value = ''
  showFilter.value = 'all'
  tableRef.value?.clearSorter()
  sorted.value = false
}

function onSorter(s: DataTableSortState | DataTableSortState[] | null) {
  const one = Array.isArray(s) ? s[0] : s
  sorted.value = !!one?.order
}

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 50,
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
watch([keyword, showFilter], () => (pagination.page = 1))

const summary = computed(() => ({
  total: notices.value.length,
  shown: notices.value.filter((n) => n.show).length,
  popup: notices.value.filter((n) => n.show && (n.tags ?? []).includes(POPUP_TAG)).length,
}))

const tagSuggestions = computed(() => {
  const set = new Set<string>()
  notices.value.forEach((n) => (n.tags ?? []).forEach((t) => t && set.add(String(t))))
  return [...set].slice(0, 12)
})

// ---------- dialogs ----------
const formOpen = ref(false)
const editing = ref<Notice | null>(null)
const sortOpen = ref(false)

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(n: Notice) {
  editing.value = n
  formOpen.value = true
}

// ---------- row actions ----------
/** The backend toggles (no target value), so resync afterwards to catch concurrent edits. Throw = revert. */
async function toggleShow(n: Notice, v: boolean) {
  const ok = await toggleNoticeShow(n.id)
  if (!ok) {
    void load(true)
    throw new Error('toggle failed')
  }
  n.show = v
  const fresh = await load(true)
  const now = fresh?.find((x) => x.id === n.id)
  if (now && !!now.show !== v) {
    message.warning('该公告的显示状态已被其他操作修改，已同步为最新状态')
  } else {
    message.success(v ? `已在用户端显示「${n.title}」` : `已隐藏「${n.title}」`)
  }
}

async function remove(n: Notice) {
  const ok = await confirm({
    title: '删除确认',
    content: `确定要删除公告「${n.title}」吗？删除后用户端将不再显示，此操作无法撤销。`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await dropNotice(n.id)
    message.success('删除成功')
  } catch {
    /* toasted */
  }
  void load()
}

// ---------- rendering ----------
/** Plain-text excerpt for the list (rendered as text, never HTML). */
function excerpt(md: string | null | undefined): string {
  return (md ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

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

function renderTags(n: Notice) {
  const tags = n.tags ?? []
  if (!tags.length) return h('span', { class: 'muted' }, '—')
  return h(
    'div',
    { class: 'tags' },
    tags.map((t) =>
      h(
        NTag,
        { size: 'small', bordered: false, type: t === POPUP_TAG ? 'warning' : 'default', round: true },
        { default: () => t },
      ),
    ),
  )
}

function renderTitle(n: Notice) {
  const ex = excerpt(n.content)
  return h('div', { class: 'title-cell' }, [
    h('div', { class: 'title-line' }, [
      h(NEllipsis, { class: 'title-text', tooltip: { width: 360 } }, { default: () => n.title }),
      n.img_url
        ? h(NTooltip, null, {
            trigger: () => h(NIcon, { size: 14, class: 'img-flag' }, { default: () => h(ImageOutline) }),
            default: () => `背景图：${n.img_url}`,
          })
        : null,
    ]),
    ex ? h('div', { class: 'excerpt' }, ex) : null,
  ])
}

const COL_W = { id: 72, show: 76, title: 280, tags: 200, time: 170, actions: 92 }
const MOBILE_TITLE_W = 168

const columns = computed<DataTableColumns<Notice>>(() => {
  const cols: DataTableColumns<Notice> = [
    {
      key: 'id',
      title: 'ID',
      width: COL_W.id,
      sorter: (a, b) => a.id - b.id,
      render: (n) => h(NTag, { size: 'small', bordered: true, class: 'num' }, { default: () => n.id }),
    },
    {
      key: 'show',
      title: '显示',
      width: COL_W.show,
      render: (n) => h(SwitchCell, { value: n.show, onChange: (v: boolean) => toggleShow(n, v) }),
    },
    { key: 'title', title: '标题', minWidth: COL_W.title, render: renderTitle },
    { key: 'tags', title: '标签', width: COL_W.tags, render: renderTags },
    {
      key: 'updated_at',
      title: '更新时间',
      width: COL_W.time,
      sorter: (a, b) => a.updated_at - b.updated_at,
      render: (n) => h('span', { class: 'time' }, formatTime(n.updated_at)),
    },
    {
      key: 'actions',
      title: '操作',
      width: COL_W.actions,
      fixed: 'right',
      align: 'right',
      render: (n) =>
        h('div', { class: 'row-actions' }, [
          iconAction('编辑', CreateOutline, () => openEdit(n)),
          iconAction('删除', TrashOutline, () => void remove(n), 'error'),
        ]),
    },
  ]
  // Narrow screens: keep the title pinned so rows stay identifiable while scrolling sideways.
  if (appState.isMobile) {
    const i = cols.findIndex((c) => 'key' in c && c.key === 'title')
    const [title] = cols.splice(i, 1)
    cols.unshift({ ...title, fixed: 'left', width: MOBILE_TITLE_W, minWidth: undefined } as (typeof cols)[number])
  }
  return cols
})

// Must equal the column widths: extra width would widen the pinned title over the actions column.
const scrollX = computed(
  () => Object.values(COL_W).reduce((s, w) => s + w, 0) - (appState.isMobile ? COL_W.title - MOBILE_TITLE_W : 0),
)
</script>

<template>
  <page-container
    title="公告管理"
    description="在这里可以配置公告，包括添加、删除、编辑和排序。用户端按排序展示处于“显示”状态的公告。"
  >
    <template #extra>
      <n-button :disabled="notices.length < 2" @click="sortOpen = true">
        <template #icon><n-icon><swap-vertical-outline /></n-icon></template>
        编辑排序
      </n-button>
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加公告
      </n-button>
    </template>

    <n-card size="small">
      <div class="toolbar list-toolbar">
        <n-input v-model:value="keyword" placeholder="搜索公告标题..." clearable class="kw-input">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-select v-model:value="showFilter" :options="SHOW_OPTIONS" class="show-select" />
        <n-button v-if="hasFilter" quaternary @click="resetFilters">重置</n-button>
        <span v-if="loaded" class="muted summary">
          共 <b class="num">{{ summary.total }}</b> 条 · 显示中 <b class="num">{{ summary.shown }}</b>
          <template v-if="summary.popup"> · 弹窗 <b class="num">{{ summary.popup }}</b></template>
        </span>
        <span class="grow" />
        <n-tooltip>
          <template #trigger>
            <n-button quaternary circle size="small" aria-label="刷新" :loading="loading" @click="load()">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </div>

      <n-data-table
        ref="tableRef"
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :pagination="pagination"
        :row-key="(n: Notice) => n.id"
        :scroll-x="scrollX"
        :bordered="false"
        size="small"
        class="notice-table"
        @update:sorter="onSorter"
      >
        <template #empty>
          <div class="empty">
            <template v-if="notices.length">没有符合条件的公告</template>
            <template v-else-if="loaded">
              <div>还没有公告</div>
              <n-button size="small" type="primary" @click="openCreate">添加第一条公告</n-button>
            </template>
            <template v-else>暂无数据</template>
          </div>
        </template>
      </n-data-table>
    </n-card>

    <notice-form-modal
      v-model:show="formOpen"
      :notice="editing"
      :tag-suggestions="tagSuggestions"
      @saved="load()"
      @missing="load()"
    />
    <notice-sort-modal v-model:show="sortOpen" :notices="notices" @saved="load()" />
  </page-container>
</template>

<style scoped>
.list-toolbar {
  margin-bottom: 12px;
}
.kw-input {
  width: 240px;
}
.show-select {
  width: 124px;
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
  .show-select {
    flex: 1;
  }
  .summary {
    display: none;
  }
}
.notice-table :deep(.num) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.notice-table :deep(.title-cell) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.notice-table :deep(.title-line) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.notice-table :deep(.title-text) {
  font-weight: 600;
  color: var(--text-strong);
  max-width: 500px;
}
.notice-table :deep(.img-flag) {
  flex: none;
  color: var(--text-muted);
}
.notice-table :deep(.excerpt) {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 560px;
}
.notice-table :deep(.tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.notice-table :deep(.time) {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.notice-table :deep(.row-actions) {
  display: inline-flex;
  gap: 2px;
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
