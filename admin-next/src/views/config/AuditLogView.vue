<script setup lang="ts">
// Audit log (spec platform §6.4). Uses GET so browsing the log does not write audit records itself.
import { h, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NAlert,
  NButton,
  NDataTable,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NEllipsis,
  NEmpty,
  type DataTableColumns,
} from 'naive-ui'
import { RefreshOutline, SearchOutline, EyeOutline } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import { getAuditLog, stripAdminPrefix, type AuditLog } from '@/api/system'
import { formatTime } from '@/utils/format'
import { storage } from '@/utils/storage'
import AuditDetailModal from './audit-log/AuditDetailModal.vue'
import { AUDIT_ACTION_OPTIONS, auditActionLabel } from './audit-log/actions'

const route = useRoute()
const q = route.query
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

// Initial filters may come from the URL (?action=&admin_id=&keyword=).
const action = ref<string | null>(typeof first(q.action) === 'string' && first(q.action) ? String(first(q.action)) : null)
const adminId = ref<number | null>(Number(first(q.admin_id)) > 0 ? Number(first(q.admin_id)) : null)
const keyword = ref<string>(typeof first(q.keyword) === 'string' ? String(first(q.keyword)) : '')

const WARN_KEY = 'audit_log_warning_dismissed'
const showWarning = ref(storage.get(WARN_KEY) !== '1')
function dismissWarning() {
  storage.set(WARN_KEY, '1')
  showWarning.value = false
}

const table = usePagedTable<AuditLog>(
  ({ current, pageSize }) =>
    getAuditLog({ current, page_size: pageSize, action: action.value, admin_id: adminId.value, keyword: keyword.value }),
  { pageSize: 20, pageSizes: [10, 20, 50, 100] },
)

// The action select searches immediately; typing (admin ID / keyword) is debounced by 400ms.
let kwTimer: number | undefined
let immediateNext = false
watch([action, adminId, keyword], ([a], [pa]) => {
  window.clearTimeout(kwTimer)
  if (immediateNext || a !== pa) {
    immediateNext = false
    void table.search()
    return
  }
  kwTimer = window.setTimeout(() => void table.search(), 400)
})
/** Filter set by clicking a table cell: search without debounce. */
function filterBy(patch: { action?: string; adminId?: number }) {
  const nextAction = patch.action ?? action.value
  const nextAdmin = patch.adminId ?? adminId.value
  if (nextAction === action.value && nextAdmin === adminId.value) return
  immediateNext = true
  action.value = nextAction
  adminId.value = nextAdmin
}
function searchNow() {
  window.clearTimeout(kwTimer)
  void table.search()
}
onBeforeUnmount(() => window.clearTimeout(kwTimer))

function resetFilters() {
  const changed = action.value !== null || adminId.value !== null || keyword.value !== ''
  if (!changed) {
    void table.search()
    return
  }
  immediateNext = true
  action.value = null
  adminId.value = null
  keyword.value = ''
}

const detail = ref<AuditLog | null>(null)
const detailOpen = ref(false)
function openDetail(row: AuditLog) {
  detail.value = row
  detailOpen.value = true
}

function compact(s: string | null, max = 60) {
  const v = (s ?? '').trim()
  return v.length > max ? `${v.slice(0, max)}…` : v
}

const columns: DataTableColumns<AuditLog> = [
  { title: 'ID', key: 'id', width: 80, render: (r) => h('span', { class: 'mono' }, String(r.id)) },
  {
    title: '时间',
    key: 'created_at',
    width: 168,
    render: (r) => h('span', { class: 'nowrap tnum' }, formatTime(r.created_at)),
  },
  {
    title: '管理员',
    key: 'admin',
    width: 200,
    render: (r) =>
      h(
        NButton,
        {
          text: true,
          title: '按该管理员筛选',
          onClick: () => filterBy({ adminId: r.admin_id }),
        },
        {
          default: () =>
            r.admin
              ? h(NEllipsis, { style: 'max-width: 180px' }, { default: () => r.admin!.email })
              : h('span', { class: 'muted' }, `#${r.admin_id}（已删除）`),
        },
      ),
  },
  {
    title: '操作',
    key: 'action',
    width: 210,
    render: (r) =>
      h(
        'button',
        { type: 'button', class: 'action-cell', title: '按该操作筛选', onClick: () => filterBy({ action: r.action }) },
        [
          h('span', { class: 'action-label' }, auditActionLabel(r.action) || r.action),
          h('span', { class: 'action-raw mono' }, r.action),
        ],
      ),
  },
  {
    title: '请求路径',
    key: 'uri',
    width: 240,
    render: (r) => {
      const p = stripAdminPrefix(r.uri)
      return h(NEllipsis, { style: 'max-width: 220px', class: 'mono small' }, { default: () => p })
    },
  },
  { title: 'IP', key: 'ip', width: 140, render: (r) => h('span', { class: 'mono small' }, r.ip || '—') },
  {
    title: '请求数据',
    key: 'request_data',
    minWidth: 300,
    render: (r) =>
      h('div', { class: 'data-cell' }, [
        h('span', { class: 'data-text mono small' }, compact(r.request_data) || '—'),
        h(
          NButton,
          { size: 'tiny', quaternary: true, type: 'primary', onClick: () => openDetail(r) },
          { icon: () => h(NIcon, null, { default: () => h(EyeOutline) }), default: () => '查看' },
        ),
      ]),
  },
]
</script>

<template>
  <page-container title="审计日志" description="记录管理员在后台执行的所有写操作（POST 请求），保留 3 个月。">
    <n-alert v-if="showWarning" type="warning" closable :bordered="false" @close="dismissWarning">
      请求数据可能包含插件/支付配置中的密钥等敏感信息（只有顶层 password/token/secret/key/api_key 字段会被过滤），请勿外传截图。
    </n-alert>

    <div class="toolbar">
      <n-select
        v-model:value="action"
        :options="AUDIT_ACTION_OPTIONS"
        filterable
        clearable
        tag
        placeholder="操作（可输入任意 action）"
        style="width: 280px; max-width: 100%"
      />
      <n-input-number
        v-model:value="adminId"
        clearable
        :min="1"
        :precision="0"
        :show-button="false"
        placeholder="管理员 ID"
        style="width: 130px"
      />
      <n-input
        v-model:value="keyword"
        clearable
        placeholder="搜索请求路径或请求数据"
        style="width: 260px; max-width: 100%"
        @keyup.enter="searchNow"
      >
        <template #prefix>
          <n-icon><search-outline /></n-icon>
        </template>
      </n-input>
      <n-button @click="resetFilters">重置</n-button>
      <span class="grow" />
      <n-button :loading="table.loading.value" @click="table.reload()">
        <template #icon>
          <n-icon><refresh-outline /></n-icon>
        </template>
        刷新
      </n-button>
    </div>

    <n-data-table
      remote
      :columns="columns"
      :data="table.data.value"
      :loading="table.loading.value"
      :pagination="table.pagination"
      :row-key="(r: AuditLog) => r.id"
      :scroll-x="1300"
      class="audit-table"
    >
      <template #empty>
        <n-empty description="暂无审计记录" />
      </template>
    </n-data-table>

    <audit-detail-modal v-model:show="detailOpen" :log="detail" />
  </page-container>
</template>

<style scoped>
.audit-table :deep(.tnum) {
  font-variant-numeric: tabular-nums;
}
.audit-table :deep(.small) {
  font-size: 12px;
}
.audit-table :deep(.action-cell) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.audit-table :deep(.action-cell:hover .action-label) {
  color: var(--primary-color);
}
.audit-table :deep(.action-raw) {
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
}
.audit-table :deep(.data-cell) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.audit-table :deep(.data-text) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);
}
</style>
