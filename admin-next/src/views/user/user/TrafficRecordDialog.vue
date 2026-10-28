<script setup lang="ts">
// Reusable "流量使用记录" dialog (user list + ticket page).
// Contract: props { show, userId, email? }, emits update:show. Loads only while open.
import { computed, h, reactive, ref, shallowRef, watch } from 'vue'
import { NModal, NDataTable, NTag, NIcon, NTooltip, type DataTableColumns, type PaginationProps } from 'naive-ui'
import { ArrowUpOutline, ArrowDownOutline } from '@vicons/ionicons5'
import { fetchUserTrafficStats, type StatUserRecord } from '@/api/user'
import { formatBytes, formatDate } from '@/utils/format'

const props = withDefaults(defineProps<{ show: boolean; userId: number | null; email?: string }>(), { email: '' })
const emit = defineEmits<{ 'update:show': [boolean] }>()

const rows = shallowRef<StatUserRecord[]>([])
const loading = ref(false)
let seq = 0

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 40, 50],
  prefix: ({ itemCount }) => `共 ${itemCount ?? 0} 条`,
  onUpdatePage: (p: number) => {
    pagination.page = p
    void load()
  },
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
    void load()
  },
})

async function load() {
  if (!props.userId) return
  const my = ++seq
  loading.value = true
  try {
    const res = await fetchUserTrafficStats({
      user_id: props.userId,
      page: pagination.page ?? 1,
      pageSize: pagination.pageSize ?? 20,
    })
    if (my !== seq) return
    rows.value = res.data ?? []
    pagination.itemCount = Number(res.total ?? 0)
  } catch {
    if (my === seq) rows.value = []
  } finally {
    if (my === seq) loading.value = false
  }
}

watch(
  () => [props.show, props.userId] as const,
  ([show]) => {
    if (!show) return
    pagination.page = 1
    rows.value = []
    void load()
  },
  { immediate: true },
)

/** Billed bytes / rate = actual traffic; rate 0 has no meaningful value. */
function actual(bytes: number, rate: string | number): string | null {
  const r = parseFloat(String(rate))
  if (!Number.isFinite(r) || r <= 0) return null
  return formatBytes(Number(bytes) / r)
}

const columns = computed<DataTableColumns<StatUserRecord>>(() => [
  {
    title: '时间',
    key: 'record_at',
    width: 130,
    render: (r) =>
      h('div', { class: 'date-cell' }, [
        h('span', { class: 'num' }, formatDate(r.record_at)),
        r.record_type === 'm'
          ? h(NTag, { size: 'tiny', bordered: false, type: 'info' }, { default: () => '月' })
          : null,
      ]),
  },
  {
    title: '上行流量',
    key: 'u',
    minWidth: 120,
    render: (r) => {
      const v = actual(r.u, r.server_rate)
      return h('span', { class: 'traffic up' }, [
        h(NIcon, { size: 14 }, { default: () => h(ArrowUpOutline) }),
        h('span', { class: 'num' }, v ?? '—'),
      ])
    },
  },
  {
    title: '下行流量',
    key: 'd',
    minWidth: 120,
    render: (r) => {
      const v = actual(r.d, r.server_rate)
      return h('span', { class: 'traffic down' }, [
        h(NIcon, { size: 14 }, { default: () => h(ArrowDownOutline) }),
        h('span', { class: 'num' }, v ?? '—'),
      ])
    },
  },
  {
    title: '倍率',
    key: 'server_rate',
    width: 90,
    render: (r) => h(NTag, { size: 'small', round: true }, { default: () => `${parseFloat(String(r.server_rate))}x` }),
  },
  {
    title: () =>
      h(NTooltip, null, {
        trigger: () => h('span', { class: 'th-help' }, '总计'),
        default: () => '计费流量（已乘倍率）',
      }),
    key: 'total',
    align: 'right',
    minWidth: 110,
    render: (r) => h('span', { class: 'num strong' }, formatBytes(Number(r.u) + Number(r.d))),
  },
])
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :bordered="false"
    :style="{ width: 'min(760px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template #header>
      <div class="title">
        流量使用记录
        <span v-if="email" class="sub">{{ email }}</span>
      </div>
    </template>
    <p class="desc">上行/下行为按倍率还原后的实际流量，总计为计费流量。记录保留约 2 个月，标记“月”的为月汇总记录。</p>
    <n-data-table
      remote
      size="small"
      :columns="columns"
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      :row-key="(r: StatUserRecord) => r.id"
      :scroll-x="600"
      :max-height="420"
    >
      <template #empty>
        <span class="muted">暂无记录</span>
      </template>
    </n-data-table>
  </n-modal>
</template>

<style scoped>
.title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.sub {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.desc {
  margin: -6px 0 12px;
  font-size: 12px;
  color: var(--text-muted);
}
:deep(.num) {
  font-variant-numeric: tabular-nums;
}
:deep(.strong) {
  font-weight: 600;
}
:deep(.date-cell) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
:deep(.traffic) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
:deep(.traffic.up .n-icon) {
  color: var(--success-color);
}
:deep(.traffic.down .n-icon) {
  color: var(--info-color);
}
:deep(.th-help) {
  border-bottom: 1px dashed var(--text-muted);
  cursor: help;
}
</style>
