<script setup lang="ts">
// 工单管理 /user/ticket (spec content.md §2).
// Default filter is 处理中 (status=0). Deep links: ?status=0|1|all &email= &reply_status=0|1 &level=0,2 &id=<open detail>.
import { computed, h, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NIcon,
  NInput,
  NInputGroup,
  NResult,
  NSelect,
  NTab,
  NTabs,
  NTag,
  NTooltip,
  type DataTableColumns,
  type DataTableSortState,
  type SelectOption,
} from 'naive-ui'
import {
  CloseCircleOutline,
  EyeOutline,
  MailOutline,
  OpenOutline,
  RefreshOutline,
  SearchOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { usePagedTable, type PageQuery, type PageResult } from '@/composables/usePagedTable'
import { ApiError } from '@/api/http'
import { fetchTickets, type TicketFilter, type TicketListItem, type TicketSort } from '@/api/ticket'
import { appState } from '@/stores/app'
import { formatTime } from '@/utils/format'
import TicketDetailModal from './ticket/TicketDetailModal.vue'
import { renderLevelTag, renderStatusTag } from './ticket/TicketTags'
import { LEVELS, confirmCloseTicket, isClosed, levelMeta } from './ticket/meta'

type StatusTab = '0' | '1' | 'all'
type SearchField = 'subject' | 'email' | 'id' | 'user_id'
type SortKey = 'id' | 'level' | 'status' | 'updated_at' | 'created_at'

const route = useRoute()
const router = useRouter()

// ---------- filters ----------
const statusTab = ref<StatusTab>('0')
const levels = ref<number[]>([])
const replyStatus = ref<number | null>(null)
const searchField = ref<SearchField>('subject')
const keyword = ref('')

const SEARCH_FIELDS: { label: string; value: SearchField; placeholder: string }[] = [
  { label: '主题', value: 'subject', placeholder: '搜索工单主题...' },
  { label: '用户邮箱', value: 'email', placeholder: '输入完整邮箱（精确匹配）' },
  { label: '工单号', value: 'id', placeholder: '输入工单号' },
  { label: '用户 ID', value: 'user_id', placeholder: '输入用户 ID' },
]
const searchPlaceholder = computed(() => SEARCH_FIELDS.find((f) => f.value === searchField.value)?.placeholder)
const numericField = computed(() => searchField.value === 'id' || searchField.value === 'user_id')
const allowInput = (v: string) => !numericField.value || /^\d*$/.test(v)
// A non-numeric keyword would be ignored by 工单号 / 用户 ID (and block typing digits): drop it.
watch(numericField, (numeric) => {
  if (numeric && !/^\d*$/.test(keyword.value.trim())) keyword.value = ''
})

const LEVEL_OPTIONS = LEVELS.map((l) => ({ label: l.label, value: l.value }))
const LEVEL_COLOR: Record<string, string> = {
  success: 'var(--success-color)',
  warning: 'var(--warning-color)',
  error: 'var(--error-color)',
}
function renderLevelOption(option: SelectOption) {
  const m = levelMeta(option.value)
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px' }, [
    m ? h(NIcon, { size: 14, color: LEVEL_COLOR[m.type] }, { default: () => h(m.icon) }) : null,
    String(option.label),
  ])
}
const REPLY_OPTIONS = [
  { label: '待回复', value: 0 },
  { label: '已回复', value: 1 },
]

function buildFilter(): TicketFilter[] {
  const out: TicketFilter[] = []
  // Arrays use whereIn; the official string "0" relied on LIKE (spec R-T3).
  if (statusTab.value !== 'all') out.push({ id: 'status', value: [Number(statusTab.value)] })
  if (levels.value.length) out.push({ id: 'level', value: [...levels.value] })
  if (replyStatus.value !== null) out.push({ id: 'reply_status', value: [replyStatus.value] })
  const kw = keyword.value.trim()
  if (kw && searchField.value === 'subject') out.push({ id: 'subject', value: kw })
  if (kw && numericField.value && /^\d+$/.test(kw)) {
    out.push({ id: searchField.value as 'id' | 'user_id', value: [Number(kw)] })
  }
  return out
}

function emailParam(): string | undefined {
  const kw = keyword.value.trim()
  return searchField.value === 'email' && kw ? kw : undefined
}

// ---------- sorting (single column, server side) ----------
const sortState = ref<{ key: SortKey; order: 'ascend' | 'descend' } | null>(null)

function buildSort(): TicketSort[] | undefined {
  const s = sortState.value
  if (!s) return undefined
  const desc = s.order === 'descend'
  // The badge combines status + reply_status: ascending = 待回复 → 已回复 → 已关闭.
  if (s.key === 'status') return [{ id: 'status', desc }, { id: 'reply_status', desc }]
  return [{ id: s.key, desc }]
}

function onSorter(s: DataTableSortState | DataTableSortState[] | null) {
  const one = Array.isArray(s) ? s[0] : s
  sortState.value = one && one.order ? { key: one.columnKey as SortKey, order: one.order } : null
  void table.search()
}

const sortOrderOf = (key: SortKey) => (sortState.value?.key === key ? sortState.value.order : false)

// ---------- table ----------
/** Last list failure (shown instead of the empty text). One orphaned ticket makes the whole list 500 (spec R-T8). */
const loadError = ref<{ status: number; message: string } | null>(null)
let fetchSeq = 0

async function fetchPage(q: PageQuery): Promise<PageResult<TicketListItem>> {
  const my = ++fetchSeq
  try {
    const res = await fetchTickets({
      current: q.current,
      pageSize: q.pageSize,
      filter: buildFilter(),
      sort: buildSort(),
      email: emailParam(),
    })
    if (my === fetchSeq) loadError.value = null
    return res
  } catch (e) {
    if (my === fetchSeq) {
      loadError.value = e instanceof ApiError ? { status: e.status, message: e.message } : { status: 0, message: '加载失败' }
      // Do not keep showing the previous total / page count next to the error.
      table.pagination.itemCount = 0
    }
    throw e
  }
}

const table = usePagedTable<TicketListItem>(fetchPage, {
  pageSize: 20,
  pageSizes: [10, 20, 30, 40, 50, 100, 500],
  immediate: false,
})
table.pagination.showQuickJumper = true

const loadErrorHint = computed(() => {
  const err = loadError.value
  if (!err) return ''
  if (err.status >= 500) {
    return `服务器返回：${err.message}。常见原因是存在所属用户已被删除的残留工单（后端无法处理，需在数据库中清理该工单），也可能是服务暂时不可用。`
  }
  return err.message
})

const hasFilter = computed(
  () =>
    statusTab.value !== '0' ||
    levels.value.length > 0 ||
    replyStatus.value !== null ||
    !!keyword.value.trim() ||
    sortState.value !== null,
)

function resetFilters() {
  statusTab.value = '0'
  levels.value = []
  replyStatus.value = null
  keyword.value = ''
  if (sortState.value) {
    sortState.value = null
    runSearch()
  }
}

// Filter changes reload from page 1 (spec R-T3). The request key de-duplicates: a deep link that
// already searched, or a field switch with an empty keyword, does not fire a second request.
const filterKey = computed(() => JSON.stringify([buildFilter(), emailParam() ?? null]))
let lastKey = ''
function runSearch() {
  lastKey = filterKey.value
  void table.search()
}
let searchTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSearch(delay: number) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (filterKey.value !== lastKey) runSearch()
  }, delay)
}
watch([statusTab, levels, replyStatus, searchField], () => scheduleSearch(0))
// Typing is debounced; clearing (× button, field switch) searches right away.
watch(keyword, (v) => scheduleSearch(v.trim() ? 350 : 0))
onBeforeUnmount(() => clearTimeout(searchTimer))

// ---------- detail (declared before the deep-link watcher, which may open it immediately) ----------
const detailShow = ref(false)
const detailId = ref<number | null>(null)
const detailStatus = ref<0 | 1>(0)

function openDetail(row: Pick<TicketListItem, 'id' | 'status'>) {
  detailId.value = row.id
  detailStatus.value = isClosed(row) ? 1 : 0
  detailShow.value = true
}

// ---------- deep links ----------
function first(q: LocationQuery, key: string): string | null {
  const v = q[key]
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && s.trim() !== '' ? s.trim() : null
}

function applyQuery(q: LocationQuery) {
  const st = first(q, 'status')
  statusTab.value = st === '1' || st === 'all' ? st : '0'
  const lv = first(q, 'level')
  levels.value = lv
    ? lv
        .split(',')
        .map(Number)
        .filter((n) => n === 0 || n === 1 || n === 2)
    : []
  const rs = first(q, 'reply_status')
  replyStatus.value = rs === '0' || rs === '1' ? Number(rs) : null
  const email = first(q, 'email')
  const uid = first(q, 'user_id')
  if (email) {
    searchField.value = 'email'
    keyword.value = email
  } else if (uid && /^\d+$/.test(uid)) {
    searchField.value = 'user_id'
    keyword.value = uid
  } else {
    searchField.value = 'subject'
    keyword.value = ''
  }
  const id = first(q, 'id')
  if (id && /^\d+$/.test(id)) openDetail({ id: Number(id), status: st === '1' ? 1 : 0 })
}

let appliedQuery = ''
watch(
  () => route.query,
  (q) => {
    if (route.path !== '/user/ticket') return
    const key = JSON.stringify(q)
    if (key === appliedQuery) return
    appliedQuery = key
    applyQuery(q)
    runSearch()
  },
  { immediate: true },
)

async function closeRow(row: TicketListItem) {
  if (await confirmCloseTicket(row)) void table.reload()
}

function goUser(email: string) {
  void router.push({ path: '/user/manage', query: { email } })
}

// ---------- columns ----------
function iconBtn(label: string, icon: typeof EyeOutline, onClick: () => void, type: 'default' | 'error' = 'default') {
  return h(NTooltip, null, {
    trigger: () =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          circle: true,
          type,
          'aria-label': label,
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            onClick()
          },
        },
        { icon: () => h(NIcon, null, { default: () => h(icon) }) },
      ),
    default: () => label,
  })
}

function rowActions(row: TicketListItem) {
  return h('div', { class: 'row-actions' }, [
    iconBtn('查看详情', EyeOutline, () => openDetail(row)),
    isClosed(row) ? null : iconBtn('关闭工单', CloseCircleOutline, () => void closeRow(row), 'error'),
  ])
}

function userCell(row: TicketListItem) {
  const email = row.user?.email
  if (!email) return h('span', { class: 'muted' }, `#${row.user_id}`)
  return h('div', { class: 'user-cell' }, [
    h('span', { class: 'user-email', title: email }, email),
    h(NTooltip, null, {
      trigger: () =>
        h(
          NButton,
          {
            text: true,
            size: 'tiny',
            class: 'user-link',
            'aria-label': '查看用户',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              goUser(email)
            },
          },
          { icon: () => h(NIcon, null, { default: () => h(OpenOutline) }) },
        ),
      default: () => '在用户管理中查看',
    }),
  ])
}

const timeCell = (ts: number, icon = false) =>
  h('span', { class: 'time-cell' }, [icon ? h(NIcon, { size: 13 }, { default: () => h(TimeOutline) }) : null, formatTime(ts)])

const COL = { id: 84, subject: 220, level: 96, status: 88, user: 200, updated: 166, created: 156, actions: 88 }

const desktopColumns = computed<DataTableColumns<TicketListItem>>(() => [
  {
    title: '工单号',
    key: 'id',
    width: COL.id,
    sorter: true,
    sortOrder: sortOrderOf('id'),
    render: (r) => h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => r.id }),
  },
  {
    title: '主题',
    key: 'subject',
    minWidth: COL.subject,
    render: (r) =>
      h('div', { class: 'subject-cell' }, [
        h(NIcon, { size: 15, class: 'subject-icon' }, { default: () => h(MailOutline) }),
        h('span', { class: 'subject-text', title: r.subject }, r.subject),
      ]),
  },
  {
    title: '优先级',
    key: 'level',
    width: COL.level,
    sorter: true,
    sortOrder: sortOrderOf('level'),
    render: (r) => renderLevelTag(r.level),
  },
  {
    title: '状态',
    key: 'status',
    width: COL.status,
    sorter: true,
    sortOrder: sortOrderOf('status'),
    render: (r) => renderStatusTag(r),
  },
  // Extra column (not in the official list): who opened the ticket, with a link to the user page.
  { title: '用户', key: 'user', width: COL.user, render: userCell },
  {
    title: '最后更新',
    key: 'updated_at',
    width: COL.updated,
    sorter: true,
    sortOrder: sortOrderOf('updated_at'),
    render: (r) => timeCell(r.updated_at, true),
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: COL.created,
    sorter: true,
    sortOrder: sortOrderOf('created_at'),
    render: (r) => timeCell(r.created_at),
  },
  { title: '操作', key: 'actions', width: COL.actions, align: 'right', fixed: 'right', render: rowActions },
])
const scrollX = Object.values(COL).reduce((s, w) => s + w, 0)

const mobileColumns = computed<DataTableColumns<TicketListItem>>(() => [
  {
    title: '工单',
    key: 'card',
    render: (r) =>
      h('div', { class: 'm-card' }, [
        h('div', { class: 'm-head' }, [
          h('span', { class: 'm-title' }, r.subject),
          isClosed(r) ? null : iconBtn('关闭工单', CloseCircleOutline, () => void closeRow(r), 'error'),
        ]),
        h('div', { class: 'm-sub' }, [
          h('span', { class: 'mono' }, `#${r.id}`),
          renderStatusTag(r, 'tiny'),
          renderLevelTag(r.level, 'tiny'),
        ]),
        h('div', { class: 'm-meta' }, [
          h('span', { class: 'm-email' }, r.user?.email ?? `#${r.user_id}`),
          h('span', { class: 'm-time' }, formatTime(r.updated_at)),
        ]),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : desktopColumns.value))
const rowProps = (row: TicketListItem) => ({ class: 'ticket-row', onClick: () => openDetail(row) })

const emptyText = computed(() => {
  if (keyword.value.trim() || levels.value.length || replyStatus.value !== null) return '没有符合条件的工单'
  if (statusTab.value === '0') return '暂无处理中工单'
  if (statusTab.value === '1') return '暂无已关闭工单'
  return '暂无工单'
})
</script>

<template>
  <page-container
    title="工单管理"
    description="查看、回复和关闭用户工单。管理员回复后，用户 24 小时内未回应的工单会被系统自动关闭。"
  >
    <n-card size="small">
      <div class="toolbar table-toolbar">
        <n-tabs v-model:value="statusTab" type="segment" size="small" class="status-tabs" animated>
          <n-tab name="0">处理中</n-tab>
          <n-tab name="1">已关闭</n-tab>
          <n-tab name="all">全部</n-tab>
        </n-tabs>
        <n-select
          v-model:value="levels"
          :options="LEVEL_OPTIONS"
          :render-label="renderLevelOption"
          multiple
          clearable
          max-tag-count="responsive"
          placeholder="优先级"
          class="level-select"
        />
        <n-select
          v-model:value="replyStatus"
          :options="REPLY_OPTIONS"
          clearable
          placeholder="回复状态"
          class="reply-select"
        />
        <n-input-group class="search-group">
          <n-select
            v-model:value="searchField"
            :options="SEARCH_FIELDS"
            :consistent-menu-width="false"
            class="field-select"
          />
          <n-input
            v-model:value="keyword"
            clearable
            :allow-input="allowInput"
            :placeholder="searchPlaceholder"
            class="search-input"
          >
            <template #prefix><n-icon><search-outline /></n-icon></template>
          </n-input>
        </n-input-group>
        <n-button v-if="hasFilter" quaternary @click="resetFilters">重置</n-button>
        <span class="grow" />
        <n-tooltip>
          <template #trigger>
            <n-button
              quaternary
              circle
              size="small"
              :loading="table.loading.value"
              aria-label="刷新"
              @click="table.reload()"
            >
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </div>

      <n-data-table
        remote
        size="small"
        :bordered="false"
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :pagination="table.pagination"
        :row-key="(r: TicketListItem) => r.id"
        :row-props="rowProps"
        :scroll-x="appState.isMobile ? undefined : scrollX"
        class="data-table"
        @update:sorter="onSorter"
      >
        <template #empty>
          <n-result
            v-if="loadError"
            status="error"
            size="small"
            title="工单列表加载失败"
            :description="loadErrorHint"
            class="load-error"
          >
            <template #footer>
              <n-button size="small" @click="table.reload()">
                <template #icon><n-icon><refresh-outline /></n-icon></template>
                重试
              </n-button>
            </template>
          </n-result>
          <n-empty v-else :description="emptyText" />
        </template>
      </n-data-table>
    </n-card>

    <ticket-detail-modal
      v-model:show="detailShow"
      :ticket-id="detailId"
      :status="detailStatus"
      @changed="table.reload()"
    />
  </page-container>
</template>

<style scoped>
.table-toolbar {
  margin-bottom: 12px;
}
.status-tabs {
  width: 240px;
}
.level-select {
  width: 200px;
}
.reply-select {
  width: 130px;
}
.search-group {
  width: 360px;
  max-width: 100%;
}
.field-select {
  width: 112px;
  flex: none;
}
.search-input {
  flex: 1;
}
@media (max-width: 767px) {
  .status-tabs,
  .search-group {
    width: 100%;
  }
  .level-select,
  .reply-select {
    flex: 1;
    width: auto;
    min-width: 0;
  }
}
.load-error {
  max-width: 560px;
  margin: 0 auto;
  padding: 12px 0;
}
.data-table :deep(.ticket-row) {
  cursor: pointer;
}
.data-table :deep(.id-tag) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.subject-cell) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.data-table :deep(.subject-icon) {
  flex: none;
  color: var(--text-muted);
}
.data-table :deep(.subject-text) {
  font-weight: 600;
  max-width: 500px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-table :deep(.user-cell) {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.data-table :deep(.user-email) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-table :deep(.user-link) {
  flex: none;
  opacity: 0.55;
}
.data-table :deep(.user-link:hover) {
  opacity: 1;
}
.data-table :deep(.time-cell) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.data-table :deep(.row-actions) {
  display: inline-flex;
  gap: 2px;
}
.data-table :deep(.m-card) {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
.data-table :deep(.m-sub) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.data-table :deep(.m-meta) {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.data-table :deep(.m-email) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-table :deep(.m-time) {
  flex: none;
  font-variant-numeric: tabular-nums;
}
</style>
