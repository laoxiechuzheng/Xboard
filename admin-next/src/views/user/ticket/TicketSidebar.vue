<script setup lang="ts">
// Ticket list inside the detail view. Unlike the official 10-row sidebar (spec R-T2) it pages in
// 50 rows at a time, and search also asks the server (subject LIKE / exact email).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NButton, NEmpty, NIcon, NInput, NRadioButton, NRadioGroup, NSkeleton, NSpin } from 'naive-ui'
import { AlertCircleOutline, RefreshOutline, SearchOutline } from '@vicons/ionicons5'
import { ApiError } from '@/api/http'
import { fetchTickets, type TicketListItem } from '@/api/ticket'
import { formatTime } from '@/utils/format'
import { SYNTH_STATUS, levelMeta, synthStatus } from './meta'

const PAGE = 50

const props = defineProps<{
  activeId: number
  status: 0 | 1
  /** Bump to reload (after reply / close / detected changes). */
  refreshKey: number
}>()
const emit = defineEmits<{ select: [number]; 'update:status': [0 | 1] }>()

const items = ref<TicketListItem[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
/** Failed full load (e.g. HTTP 500 from an orphaned ticket, spec R-T8); quiet refreshes keep the old rows. */
const loadError = ref('')
const keyword = ref('')
const remoteHits = ref<TicketListItem[]>([])
const searching = ref(false)
let seq = 0
let searchSeq = 0

const statusFilter = () => [{ id: 'status' as const, value: [props.status] }]

async function load(keep = false) {
  const my = ++seq
  // Reloads keep what was already paged in (capped) so the active row does not disappear.
  const size = keep ? Math.min(Math.max(items.value.length, PAGE), 200) : PAGE
  if (!keep) loading.value = true
  try {
    const res = await fetchTickets({ current: 1, pageSize: size, filter: statusFilter() }, { silent: keep })
    if (my !== seq) return
    items.value = res.data ?? []
    total.value = Number(res.total ?? 0)
    loadError.value = ''
  } catch (e) {
    if (my === seq && !keep) {
      items.value = []
      total.value = 0
      loadError.value =
        e instanceof ApiError && e.status >= 500
          ? '列表加载失败：可能存在所属用户已被删除的残留工单，或服务暂时不可用。'
          : `列表加载失败：${e instanceof ApiError ? e.message : '网络错误'}`
    }
  } finally {
    if (my === seq) loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value) return
  const my = seq
  loadingMore.value = true
  try {
    const page = Math.floor(items.value.length / PAGE) + 1
    const res = await fetchTickets({ current: page, pageSize: PAGE, filter: statusFilter() })
    if (my !== seq) return
    const seen = new Set(items.value.map((t) => t.id))
    items.value = [...items.value, ...(res.data ?? []).filter((t) => !seen.has(t.id))]
    total.value = Number(res.total ?? 0)
  } catch {
    /* toasted */
  } finally {
    loadingMore.value = false
  }
}

watch(() => props.status, () => load(false), { immediate: true })
watch(
  () => props.refreshKey,
  () => {
    void load(true)
    if (keyword.value.trim()) void remoteSearch()
  },
)

// ---- search: local over loaded rows + server-side subject / exact email ----
async function remoteSearch() {
  const kw = keyword.value.trim()
  const my = ++searchSeq
  if (!kw) {
    remoteHits.value = []
    searching.value = false
    return
  }
  searching.value = true
  try {
    const reqs = [
      fetchTickets({ current: 1, pageSize: PAGE, filter: [...statusFilter(), { id: 'subject', value: kw }] }, { silent: true }),
    ]
    if (kw.includes('@')) {
      reqs.push(fetchTickets({ current: 1, pageSize: PAGE, filter: statusFilter(), email: kw }, { silent: true }))
    }
    const results = await Promise.allSettled(reqs)
    if (my !== searchSeq) return
    remoteHits.value = results.flatMap((r) => (r.status === 'fulfilled' ? (r.value.data ?? []) : []))
  } finally {
    if (my === searchSeq) searching.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(keyword, () => {
  clearTimeout(timer)
  timer = setTimeout(() => void remoteSearch(), 300)
})
watch(
  () => props.status,
  () => {
    if (keyword.value.trim()) void remoteSearch()
  },
)
onBeforeUnmount(() => clearTimeout(timer))

const visible = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return items.value
  const map = new Map<number, TicketListItem>()
  for (const t of items.value) {
    if (t.subject.toLowerCase().includes(kw) || (t.user?.email ?? '').toLowerCase().includes(kw)) map.set(t.id, t)
  }
  for (const t of remoteHits.value) if (Number(t.status) === props.status) map.set(t.id, t)
  return [...map.values()].sort((a, b) => b.updated_at - a.updated_at || b.id - a.id)
})

const emptyText = computed(() => {
  if (keyword.value.trim()) return searching.value ? '搜索中…' : '未找到匹配的工单'
  return props.status === 1 ? '暂无已关闭工单' : '暂无处理中工单'
})

const hasMore = computed(() => !keyword.value.trim() && items.value.length < total.value)

function levelClass(level: unknown) {
  const m = levelMeta(level)
  return m ? `lv-${m.value}` : 'lv-none'
}
</script>

<template>
  <div class="sidebar">
    <div class="side-head">
      <div class="side-title">
        <span>工单列表</span>
        <span v-if="!loading" class="side-count">{{ total }}</span>
      </div>
      <n-radio-group
        :value="status"
        size="small"
        class="side-status"
        @update:value="(v: 0 | 1) => emit('update:status', v)"
      >
        <n-radio-button :value="0">处理中</n-radio-button>
        <n-radio-button :value="1">已关闭</n-radio-button>
      </n-radio-group>
      <n-input v-model:value="keyword" size="small" clearable placeholder="搜索工单标题或用户邮箱">
        <template #prefix>
          <n-icon><search-outline /></n-icon>
        </template>
        <template #suffix>
          <n-spin v-if="searching" :size="12" />
        </template>
      </n-input>
    </div>

    <div class="side-list">
      <template v-if="loading">
        <div v-for="i in 4" :key="i" class="skeleton-item">
          <n-skeleton text style="width: 70%" />
          <n-skeleton text style="width: 50%" />
          <n-skeleton text style="width: 40%" />
        </div>
      </template>
      <div v-else-if="loadError && !visible.length" class="side-error" role="alert">
        <n-icon :size="28" class="side-error-icon"><alert-circle-outline /></n-icon>
        <div class="side-error-text">{{ loadError }}</div>
        <n-button size="small" @click="load(false)">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          重试
        </n-button>
      </div>
      <n-empty v-else-if="!visible.length" size="small" :description="emptyText" class="side-empty" />
      <template v-else>
        <button
          v-for="t in visible"
          :key="t.id"
          type="button"
          class="side-item"
          :class="{ active: t.id === activeId }"
          @click="emit('select', t.id)"
        >
          <div class="row1">
            <span class="subject">{{ t.subject }}</span>
            <span class="status-dot" :class="synthStatus(t)">{{ SYNTH_STATUS[synthStatus(t)].label }}</span>
          </div>
          <div class="row2">{{ t.user?.email ?? `用户 #${t.user_id}` }}</div>
          <div class="row3">
            <span class="num">#{{ t.id }} · {{ formatTime(t.updated_at) }}</span>
            <span class="level-pill" :class="levelClass(t.level)">{{ levelMeta(t.level)?.label ?? '-' }}</span>
          </div>
        </button>
        <div v-if="hasMore" class="more">
          <n-button size="small" quaternary block :loading="loadingMore" @click="loadMore">
            加载更多（已显示 {{ items.length }} / {{ total }}）
          </n-button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.side-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 14px 12px;
  border-bottom: 1px solid var(--divider-color);
}
.side-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.side-count {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--hover-color);
}
.side-status {
  display: flex;
}
.side-status :deep(.n-radio-button) {
  flex: 1;
  text-align: center;
}
.side-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}
.side-empty {
  margin-top: 40px;
}
.side-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 32px;
  padding: 0 12px;
  text-align: center;
}
.side-error-icon {
  color: var(--error-color);
}
.side-error-text {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}
.skeleton-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}
.side-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s;
}
.side-item:hover {
  background: var(--hover-color);
}
.side-item.active {
  background: var(--hover-color);
  border-color: var(--primary-color);
}
.side-item:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}
.row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.subject {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-dot {
  flex: none;
  font-size: 11px;
  line-height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  color: var(--text-muted);
  background: var(--hover-color);
}
.status-dot.pending {
  color: var(--error-color);
  background: color-mix(in srgb, var(--error-color) 14%, transparent);
}
.status-dot.replied {
  color: var(--success-color);
  background: color-mix(in srgb, var(--success-color) 14%, transparent);
}
.row2 {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}
.num {
  font-variant-numeric: tabular-nums;
}
.level-pill {
  flex: none;
  padding: 0 6px;
  line-height: 18px;
  border-radius: 9px;
  background: var(--hover-color);
}
.level-pill.lv-2 {
  color: var(--error-color);
  background: color-mix(in srgb, var(--error-color) 14%, transparent);
}
.level-pill.lv-1 {
  color: var(--warning-color);
  background: color-mix(in srgb, var(--warning-color) 16%, transparent);
}
.level-pill.lv-0 {
  color: var(--success-color);
  background: color-mix(in srgb, var(--success-color) 14%, transparent);
}
.more {
  padding: 4px 0 8px;
}
</style>
