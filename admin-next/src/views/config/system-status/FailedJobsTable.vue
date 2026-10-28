<script setup lang="ts">
// Horizon failed jobs table (server pagination) + detail modal. Used by the dashboard dialog and the system status page.
import { h, ref } from 'vue'
import { NDataTable, NButton, NIcon, NEllipsis, NAlert, type DataTableColumns } from 'naive-ui'
import { EyeOutline } from '@vicons/ionicons5'
import { getHorizonFailedJobs, FAILED_JOBS_VISIBLE_LIMIT, type FailedJob } from '@/api/system'
import { usePagedTable } from '@/composables/usePagedTable'
import { formatNumber } from '@/utils/format'
import FailedJobDetailModal from './FailedJobDetailModal.vue'
import SectionState from './SectionState.vue'
import { firstLine, formatFailedAt } from './helpers'

const props = withDefaults(defineProps<{ pageSizes?: number[]; pageSize?: number; maxHeight?: number | string }>(), {
  pageSizes: () => [10],
  pageSize: 10,
  maxHeight: undefined,
})

/** Real backend total; the pager is capped at the 50 records Horizon actually returns. */
const realTotal = ref(0)
/** Last load error; cleared on the next success. The rows of the last success stay visible. */
const error = ref('')
/** Date.now() of the last successful load; 0 until the first one. */
const lastSuccess = ref(0)

// Errors are handled here (usePagedTable would blank the rows but keep the old total).
let silentNext = false
let seq = 0
let shown: { rows: FailedJob[]; total: number; page: number; pageSize: number } | null = null

const table = usePagedTable<FailedJob>(
  async ({ current, pageSize }) => {
    const mine = ++seq
    const silent = silentNext
    silentNext = false
    try {
      const res = await getHorizonFailedJobs({ current, page_size: pageSize }, { silent })
      const total = Math.min(res.total, FAILED_JOBS_VISIBLE_LIMIT)
      if (mine === seq) {
        realTotal.value = res.total
        error.value = ''
        lastSuccess.value = Date.now()
        shown = { rows: res.data, total, page: current, pageSize }
      }
      return { data: res.data, total }
    } catch (e) {
      if (mine === seq) {
        error.value = e instanceof Error && e.message ? e.message : '加载失败'
        // Keep showing the last successful page and point the pager back at it.
        if (shown) {
          table.pagination.page = shown.page
          table.pagination.pageSize = shown.pageSize
        }
      }
      return { data: shown?.rows ?? [], total: shown?.total ?? 0 }
    }
  },
  { pageSize: props.pageSize, pageSizes: props.pageSizes },
)
table.pagination.showSizePicker = props.pageSizes.length > 1

/** Reload the current page; `silent` suppresses the error toast (background polling). */
function reload(opts: { silent?: boolean } = {}) {
  silentNext = !!opts.silent
  return table.reload()
}

const detail = ref<FailedJob | null>(null)
const detailOpen = ref(false)
function view(job: FailedJob) {
  detail.value = job
  detailOpen.value = true
}

const columns: DataTableColumns<FailedJob> = [
  {
    title: '时间',
    key: 'failed_at',
    width: 170,
    render: (r) => h('span', { class: 'nowrap tnum' }, formatFailedAt(r.failed_at)),
  },
  { title: '队列', key: 'queue', width: 130, render: (r) => h('span', { class: 'mono small' }, r.queue || '—') },
  {
    title: '任务名称',
    key: 'name',
    width: 220,
    render: (r) => h(NEllipsis, { style: 'max-width: 200px' }, { default: () => r.name || '—' }),
  },
  {
    title: '异常信息',
    key: 'exception',
    minWidth: 240,
    render: (r) =>
      h(
        NEllipsis,
        { style: 'max-width: 360px', tooltip: { scrollable: true, contentStyle: { maxHeight: '300px' } } },
        {
          default: () => firstLine(r.exception),
          tooltip: () => h('div', { class: 'exception-tip' }, r.exception || ''),
        },
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 72,
    align: 'center',
    fixed: 'right',
    render: (r) =>
      h(
        NButton,
        { size: 'small', quaternary: true, circle: true, title: '查看详情', 'aria-label': '查看详情', onClick: () => view(r) },
        { icon: () => h(NIcon, null, { default: () => h(EyeOutline) }) },
      ),
  },
]

defineExpose({ reload, loading: table.loading, realTotal, error, lastSuccess })
</script>

<template>
  <div class="failed-jobs">
    <section-state
      :loading="table.loading.value"
      :error="error"
      :has-data="lastSuccess > 0"
      min-height="160px"
      @retry="reload()"
    >
      <n-alert v-if="realTotal > FAILED_JOBS_VISIBLE_LIMIT" type="info" :bordered="false" class="limit-tip">
        共 {{ formatNumber(realTotal) }} 条失败任务，Horizon 接口只返回最近 {{ FAILED_JOBS_VISIBLE_LIMIT }} 条，这里仅显示这部分。
      </n-alert>
      <n-data-table
        remote
        size="small"
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :pagination="table.pagination"
        :row-key="(r: FailedJob) => r.id"
        :scroll-x="840"
        :max-height="maxHeight"
      >
        <template #empty>
          <div class="empty">暂无失败任务</div>
        </template>
      </n-data-table>
    </section-state>
    <failed-job-detail-modal v-model:show="detailOpen" :job="detail" />
  </div>
</template>

<style scoped>
.limit-tip {
  margin-bottom: 10px;
}
.empty {
  padding: 24px 0;
  color: var(--text-muted);
  font-size: 13px;
}
.failed-jobs :deep(.tnum) {
  font-variant-numeric: tabular-nums;
}
.failed-jobs :deep(.small) {
  font-size: 12px;
}
:global(.exception-tip) {
  max-width: min(420px, calc(100vw - 48px));
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
}
</style>
