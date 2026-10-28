<script setup lang="ts">
// 权限组管理 /server/group (spec nodes §6).
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NEllipsis,
  NIcon,
  NInput,
  NTag,
  NTooltip,
  NEmpty,
  type DataTableColumns,
  type PaginationProps,
} from 'naive-ui'
import {
  AddOutline,
  CreateOutline,
  PeopleOutline,
  RefreshOutline,
  SearchOutline,
  ServerOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import GroupFormDialog from './group/GroupFormDialog.vue'
import { dropGroup, fetchGroups, type ServerGroup } from '@/api/serverGroup'
import { appState } from '@/stores/app'
import { confirm, dialog, message } from '@/utils/discrete'
import { formatTime } from '@/utils/format'

const list = ref<ServerGroup[]>([])
const loading = ref(false)
const keyword = ref('')

const formShow = ref(false)
const editing = ref<ServerGroup | null>(null)

async function load() {
  loading.value = true
  try {
    list.value = await fetchGroups()
  } catch {
    /* toast handled by http client */
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return list.value
  return list.value.filter((g) => g.name.toLowerCase().includes(k) || String(g.id) === k)
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

function openEdit(row: ServerGroup) {
  editing.value = row
  formShow.value = true
}

async function remove(row: ServerGroup) {
  // The backend guard against node usage is unreliable on MySQL (see api/serverGroup.ts); block early as well.
  const usage: string[] = []
  if (row.server_count > 0) usage.push(`${row.server_count} 个节点`)
  if (row.users_count > 0) usage.push(`${row.users_count} 个用户`)
  if (usage.length) {
    dialog.warning({
      title: '无法删除',
      content: `权限组「${row.name}」仍被 ${usage.join('、')}使用。请先在节点或用户中移除该权限组后再删除。`,
      positiveText: '知道了',
    })
    return
  }
  const ok = await confirm({
    title: '确认删除',
    content: `此操作将永久删除权限组「${row.name}」，删除后无法恢复。若仍有套餐使用该权限组，删除会被拒绝。确定要继续吗？`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await dropGroup(row.id)
    message.success('删除成功')
    await load()
  } catch {
    /* backend reason (used by nodes / plans / users) is toasted by the http client */
  }
}

function countCell(icon: typeof PeopleOutline, value: number) {
  return h('span', { class: 'count-cell' }, [
    h(NIcon, { size: 15, class: 'count-icon' }, { default: () => h(icon) }),
    h('span', { class: 'count-num' }, String(value ?? 0)),
  ])
}

function actionButtons(row: ServerGroup) {
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

const desktopColumns = computed<DataTableColumns<ServerGroup>>(() => [
  {
    title: '组ID',
    key: 'id',
    width: 96,
    sorter: (a, b) => a.id - b.id,
    render: (row) => h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id }),
  },
  {
    title: '组名称',
    key: 'name',
    minWidth: 180,
    render: (row) => h(NEllipsis, { style: 'max-width: 320px; font-weight: 500' }, { default: () => row.name }),
  },
  {
    title: '用户数量',
    key: 'users_count',
    width: 130,
    sorter: (a, b) => a.users_count - b.users_count,
    render: (row) => countCell(PeopleOutline, row.users_count),
  },
  {
    title: '节点数量',
    key: 'server_count',
    width: 130,
    sorter: (a, b) => a.server_count - b.server_count,
    render: (row) => countCell(ServerOutline, row.server_count),
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 180,
    render: (row) => h('span', { class: 'muted mono time-cell' }, formatTime(row.created_at)),
  },
  { title: '操作', key: 'actions', width: 100, align: 'center', fixed: 'right', render: actionButtons },
])

const mobileColumns = computed<DataTableColumns<ServerGroup>>(() => [
  {
    title: '权限组',
    key: 'card',
    render: (row) =>
      h('div', { class: 'm-card' }, [
        h('div', { class: 'm-head' }, [
          h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id }),
          h('span', { class: 'm-title' }, row.name),
          actionButtons(row),
        ]),
        h('div', { class: 'm-grid' }, [
          h('div', null, [h('div', { class: 'm-label' }, '用户数量'), countCell(PeopleOutline, row.users_count)]),
          h('div', null, [h('div', { class: 'm-label' }, '节点数量'), countCell(ServerOutline, row.server_count)]),
        ]),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : desktopColumns.value))

onMounted(load)
</script>

<template>
  <page-container title="权限组管理" description="管理所有权限组，包括添加、删除、编辑等操作。">
    <template #extra>
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加权限组
      </n-button>
    </template>

    <n-card :bordered="true" size="small" class="table-card">
      <div class="toolbar table-toolbar">
        <n-input v-model:value="keyword" placeholder="搜索权限组..." clearable class="search-input">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-button v-if="keyword" quaternary @click="keyword = ''">重置</n-button>
        <span class="grow" />
        <span class="muted total-hint">共 {{ list.length }} 个权限组</span>
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
        :row-key="(r: ServerGroup) => r.id"
        :scroll-x="appState.isMobile ? undefined : 760"
        :bordered="false"
        size="small"
        class="data-table"
      >
        <template #empty>
          <n-empty :description="keyword ? '没有匹配的权限组' : '暂无权限组'">
            <template v-if="!keyword" #extra>
              <n-button size="small" @click="openCreate">添加权限组</n-button>
            </template>
          </n-empty>
        </template>
      </n-data-table>
    </n-card>

    <group-form-dialog v-model:show="formShow" :group="editing" @success="load" />
  </page-container>
</template>

<style scoped>
.table-toolbar {
  margin-bottom: 12px;
}
.search-input {
  width: 260px;
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
.data-table :deep(.count-cell) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.data-table :deep(.count-icon) {
  color: var(--text-muted);
}
.data-table :deep(.count-num) {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.data-table :deep(.time-cell) {
  font-size: 12px;
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
  gap: 8px;
}
.data-table :deep(.m-label) {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
</style>
