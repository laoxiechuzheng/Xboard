<script setup lang="ts">
// Traffic ranking card (spec core §7.4): stat/getTrafficRank top 10, refreshed every 30s.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NSelect, NDatePicker, NEmpty, NSkeleton, NSpin, NScrollbar, NTooltip, NIcon, NTag, useThemeVars } from 'naive-ui'
import { GitNetworkOutline, PeopleOutline, PulseOutline, ArrowUp, ArrowDown, RemoveOutline } from '@vicons/ionicons5'
import { getTrafficRank, type TrafficRankItem, type TrafficRankType } from '@/api/stat'
import { GB, nowSeconds } from '@/utils/format'
import {
  addDays,
  cnDate,
  cnMidnight,
  defaultPickerRange,
  isFutureDate,
  jsonEqual,
  pickerToDate,
  useAsyncState,
  usePolling,
} from '../composables'

type RangeKey = 'today' | 'last7days' | 'last30days' | 'custom'

const props = defineProps<{ type: TrafficRankType }>()
const router = useRouter()
// Text color Naive itself uses on primary fills: white in light mode, black in dark mode.
const themeVars = useThemeVars()

const title = computed(() => (props.type === 'node' ? '节点流量排行' : '用户流量排行'))
const rangeOptions: { label: string; value: RangeKey }[] = [
  { label: '今天', value: 'today' },
  { label: '最近7天', value: 'last7days' },
  { label: '最近30天', value: 'last30days' },
  { label: '自定义范围', value: 'custom' },
]
const range = ref<RangeKey>('today')
const custom = ref<[number, number] | null>(defaultPickerRange())

/** Query window in unix seconds (UTC+8 day boundaries); null while a custom range is incomplete. */
function interval(): { start_time: number; end_time: number } | null {
  const now = nowSeconds()
  switch (range.value) {
    case 'today': {
      const start = cnMidnight(cnDate(0))
      return { start_time: start, end_time: start + 86400 }
    }
    case 'last7days':
      return { start_time: now - 7 * 86400, end_time: now }
    case 'last30days':
      return { start_time: now - 30 * 86400, end_time: now }
    case 'custom': {
      if (!custom.value) return null
      return {
        start_time: cnMidnight(pickerToDate(custom.value[0])),
        end_time: cnMidnight(addDays(pickerToDate(custom.value[1]), 1)),
      }
    }
  }
  return null
}

const state = useAsyncState<TrafficRankItem[]>(
  async () => {
    const iv = interval()
    if (!iv) throw new Error('请选择日期范围')
    return getTrafficRank({ type: props.type, ...iv }, { silent: true })
  },
  { same: jsonEqual },
)
const refresh = usePolling(state.run, 30_000)
const hasError = computed(() => !!state.error.value)
defineExpose({ refresh, loading: state.loading, lastSuccess: state.lastSuccess, hasError })

const switching = ref(false)
watch([range, custom], () => {
  if (!interval()) return
  switching.value = true
  void refresh().finally(() => (switching.value = false))
})

const items = computed(() => (state.data.value ?? []).slice(0, 10))
const top = computed(() => Math.max(items.value[0]?.value ?? 0, 1))

const gb = (bytes: number) => `${(bytes / GB).toFixed(2)} GB`
const pct = (it: TrafficRankItem) => `${Math.max(2, Math.min(100, (it.value / top.value) * 100))}%`

/** Backend returns change = 0 when the previous period is empty; show that as "no data". */
function changeKind(it: TrafficRankItem): 'up' | 'down' | 'flat' | 'none' {
  if (!it.previousValue) return 'none'
  return it.change > 0 ? 'up' : it.change < 0 ? 'down' : 'flat'
}
function changeText(it: TrafficRankItem) {
  const k = changeKind(it)
  if (k === 'none') return '—'
  return `${Math.abs(it.change)}%`
}
function changeFull(it: TrafficRankItem) {
  const k = changeKind(it)
  if (k === 'none') return '上期无数据'
  return `${it.change > 0 ? '+' : ''}${it.change}%`
}

const isFallbackName = (it: TrafficRankItem) => /^(Node|User) \d+$/.test(it.name)
const canOpen = (it: TrafficRankItem) => props.type === 'user' && !isFallbackName(it)
function openItem(it: TrafficRankItem) {
  if (canOpen(it)) router.push({ path: '/user/manage', query: { email: it.name } })
}
</script>

<template>
  <n-card
    class="rank-card"
    :style="{ '--rank-on-primary': themeVars.baseColor }"
    content-style="padding-top: 4px; padding-right: 8px"
  >
    <template #header>
      <div class="card-title">
        <n-icon :size="18" class="title-icon">
          <git-network-outline v-if="type === 'node'" />
          <people-outline v-else />
        </n-icon>
        {{ title }}
      </div>
    </template>
    <template #header-extra>
      <div class="controls">
        <n-icon :size="16" class="muted"><pulse-outline /></n-icon>
        <n-select v-model:value="range" :options="rangeOptions" placeholder="选择时间范围" size="small" style="width: 120px" />
        <n-date-picker
          v-if="range === 'custom'"
          v-model:value="custom"
          type="daterange"
          size="small"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :is-date-disabled="isFutureDate"
          :clearable="false"
          style="width: 240px"
        />
      </div>
    </template>

    <n-spin :show="switching" :delay="150">
      <div class="rank-body">
        <div v-if="state.error.value && !state.data.value" class="rank-state error">
          <span>{{ state.error.value }}</span>
          <a v-if="interval()" class="retry" @click="refresh">点击重试</a>
        </div>
        <div v-else-if="!state.data.value" class="rank-list">
          <div v-for="i in 5" :key="i" class="rank-item skeleton">
            <n-skeleton text width="55%" />
            <n-skeleton text :height="8" />
          </div>
        </div>
        <div v-else-if="!items.length" class="rank-state">
          <n-empty description="暂无数据" />
        </div>
        <n-scrollbar v-else style="max-height: 400px">
          <div class="rank-list">
            <n-tooltip v-for="(it, i) in items" :key="it.id" placement="left" :delay="200">
              <template #trigger>
                <div
                  class="rank-item"
                  :class="{ clickable: canOpen(it) }"
                  :role="canOpen(it) ? 'link' : undefined"
                  :tabindex="canOpen(it) ? 0 : undefined"
                  @click="openItem(it)"
                  @keydown.enter="openItem(it)"
                >
                  <div class="row">
                    <span class="rank-no" :class="`top${i + 1}`">{{ i + 1 }}</span>
                    <span class="rank-name">{{ it.name }}</span>
                    <span class="change" :class="changeKind(it)">
                      <n-icon v-if="changeKind(it) === 'up'" :size="12"><arrow-up /></n-icon>
                      <n-icon v-else-if="changeKind(it) === 'down'" :size="12"><arrow-down /></n-icon>
                      <n-icon v-else-if="changeKind(it) === 'flat'" :size="12"><remove-outline /></n-icon>
                      {{ changeText(it) }}
                    </span>
                  </div>
                  <div class="row">
                    <div class="bar"><div class="bar-fill" :style="{ width: pct(it) }" /></div>
                    <span class="rank-value">{{ gb(it.value) }}</span>
                  </div>
                </div>
              </template>
              <div class="tip">
                <div class="tip-name">{{ it.name }}</div>
                <div class="tip-grid">
                  <span>当前流量</span><b>{{ gb(it.value) }}</b>
                  <span>上期流量</span><b>{{ gb(it.previousValue) }}</b>
                  <span>变化率</span><b :class="['change', changeKind(it)]">{{ changeFull(it) }}</b>
                </div>
                <div v-if="canOpen(it)" class="tip-hint">点击查看该用户</div>
              </div>
            </n-tooltip>
          </div>
        </n-scrollbar>
      </div>
    </n-spin>
    <n-tag v-if="state.error.value && state.data.value" size="small" type="warning" :bordered="false" class="warn">
      刷新失败：{{ state.error.value }}
    </n-tag>
  </n-card>
</template>

<style scoped>
.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.title-icon {
  color: var(--primary-color);
}
.controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.rank-card :deep(.n-card-header) {
  flex-wrap: wrap;
  gap: 10px;
}
.rank-card :deep(.n-card-header__main) {
  flex: 1 0 auto;
}
.rank-body {
  min-height: 200px;
  padding-right: 8px;
}
.rank-state {
  height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}
.rank-state.error {
  color: var(--error-color);
}
.retry {
  color: var(--primary-color);
  cursor: pointer;
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 8px;
}
.rank-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--hover-color);
  transition: background-color 0.2s;
}
.rank-item:hover {
  background: linear-gradient(var(--hover-color), var(--hover-color)), var(--hover-color);
}
.rank-item.clickable {
  cursor: pointer;
}
.rank-item.skeleton {
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.rank-no {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--card-color);
  font-variant-numeric: tabular-nums;
}
/* #1 solid primary with the theme's on-primary text; #2/#3 tinted fills with strong text, so contrast holds in both themes. */
.rank-no.top1 {
  color: var(--rank-on-primary);
  background: var(--primary-color);
}
.rank-no.top2,
.rank-no.top3 {
  color: var(--text-strong);
}
.rank-no.top2 {
  background: color-mix(in srgb, var(--primary-color) 32%, transparent);
}
.rank-no.top3 {
  background: color-mix(in srgb, var(--primary-color) 18%, transparent);
}
.rank-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
}
.change {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.change.up {
  color: var(--success-color);
}
.change.down {
  color: var(--error-color);
}
.change.flat,
.change.none {
  color: var(--text-muted);
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--primary-color);
  transition: width 0.4s ease;
}
.rank-value {
  flex: none;
  min-width: 78px;
  text-align: right;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-color);
}
.tip {
  min-width: 180px;
  font-size: 12px;
}
.tip-name {
  font-weight: 600;
  margin-bottom: 6px;
  word-break: break-all;
}
.tip-grid {
  display: grid;
  grid-template-columns: auto auto;
  gap: 4px 16px;
}
.tip-grid b {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.tip-hint {
  margin-top: 6px;
  opacity: 0.7;
}
.warn {
  margin-top: 8px;
}
</style>
