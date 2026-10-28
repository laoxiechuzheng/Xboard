<script setup lang="ts">
// 统计数据 tab (spec commerce §6.5): the official 4 cards plus 使用记录数, a date-ranged daily
// usage chart and the per-type / per-template distribution (all time).
import { computed, onMounted, ref } from 'vue'
import { NButton, NDatePicker, NEmpty, NIcon, NSkeleton, NTooltip, useThemeVars } from 'naive-ui'
import {
  AlbumsOutline,
  CheckmarkDoneOutline,
  CloudOfflineOutline,
  GiftOutline,
  InformationCircleOutline,
  KeyOutline,
  ReceiptOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import EChart from '@/components/EChart.vue'
import { ApiError } from '@/api/http'
import { fetchStatistics, type GiftCardStatistics } from '@/api/giftCard'
import { appState } from '@/stores/app'
import { formatNumber } from '@/utils/format'
import { ymd } from './helpers'

const DAY = 86400_000

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const today = startOfDay(Date.now())
const range = ref<[number, number]>([today - 30 * DAY, today])
const stats = ref<GiftCardStatistics | null>(null)
const loading = ref(false)
const failed = ref(false)
const errorText = ref('')
/** ready: data shown; loading: first load (skeletons); failed: first load failed (placeholders + retry). */
const phase = computed<'ready' | 'loading' | 'failed'>(() =>
  stats.value ? 'ready' : failed.value && !loading.value ? 'failed' : 'loading',
)
/** Range that the loaded `daily_usages` belongs to. */
const loadedRange = ref<[number, number]>(range.value)

const shortcuts: Record<string, () => [number, number]> = {
  近7天: () => [today - 7 * DAY, today],
  近30天: () => [today - 30 * DAY, today],
  近90天: () => [today - 90 * DAY, today],
  近一年: () => [today - 365 * DAY, today],
}

let seq = 0
async function load() {
  const my = ++seq
  const r: [number, number] = [range.value[0], range.value[1]]
  loading.value = true
  try {
    const res = await fetchStatistics({ start_date: ymd(new Date(r[0])), end_date: ymd(new Date(r[1])) })
    if (my !== seq) return
    stats.value = res
    loadedRange.value = r
    failed.value = false
  } catch (e) {
    if (my === seq) {
      failed.value = true
      errorText.value = e instanceof ApiError && e.message ? e.message : '请求失败'
    }
  } finally {
    if (my === seq) loading.value = false
  }
}

function onRange(v: [number, number] | null) {
  if (!v) return
  range.value = [startOfDay(v[0]), startOfDay(v[1])]
  void load()
}

const isFuture = (ts: number) => ts > today + DAY - 1

// ---------- cards ----------
const total = computed(() => stats.value?.total_stats)
const pct = (a: number, b: number) => (b > 0 ? `${Number(((a / b) * 100).toFixed(1))}%` : '—')

const cards = computed(() => {
  const t = total.value
  const templates = Number(t?.templates_count ?? 0)
  const active = Number(t?.active_templates_count ?? 0)
  const codes = Number(t?.codes_count ?? 0)
  const used = Number(t?.used_codes_count ?? 0)
  const usages = Number(t?.usages_count ?? 0)
  return [
    { key: 'templates', label: '模板总数', value: templates, sub: `已停用 ${formatNumber(Math.max(0, templates - active))} 个`, icon: AlbumsOutline, tone: 'primary' },
    { key: 'active', label: '活跃模板数', value: active, sub: `启用率 ${pct(active, templates)}`, icon: GiftOutline, tone: 'success' },
    { key: 'codes', label: '兑换码总数', value: codes, sub: '包含所有状态', icon: KeyOutline, tone: 'info' },
    { key: 'used', label: '已使用兑换码', value: used, sub: `使用率 ${pct(used, codes)}`, icon: CheckmarkDoneOutline, tone: 'warning' },
    { key: 'usages', label: '使用记录数', value: usages, sub: '累计兑换次数', icon: ReceiptOutline, tone: 'error' },
  ] as const
})

// ---------- charts ----------
const themeVars = useThemeVars()

/** Every day of the loaded range, missing days filled with 0. */
const daily = computed(() => {
  const counts = new Map<string, number>()
  for (const d of stats.value?.daily_usages ?? []) counts.set(String(d.date), Number(d.count) || 0)
  const out: { date: string; count: number }[] = []
  const [from, to] = loadedRange.value
  const end = ymd(new Date(to))
  // Step by calendar day (not 24h) so DST changes cannot skip or repeat a date.
  for (let d = new Date(from), guard = 0; guard < 4000; d.setDate(d.getDate() + 1), guard++) {
    const key = ymd(d)
    out.push({ date: key, count: counts.get(key) ?? 0 })
    if (key >= end) break
  }
  // Server dates outside the client-side calendar (time zone differences) are appended as-is.
  for (const [k, v] of counts) if (!out.some((d) => d.date === k)) out.push({ date: k, count: v })
  return out.sort((a, b) => a.date.localeCompare(b.date))
})
const dailyTotal = computed(() => daily.value.reduce((s, d) => s + d.count, 0))

const axisStyle = computed(() => ({ color: themeVars.value.textColor3, fontSize: 11 }))
const tooltipBase = computed(() => ({
  backgroundColor: themeVars.value.popoverColor,
  borderColor: themeVars.value.borderColor,
  textStyle: { color: themeVars.value.textColor1, fontSize: 12 },
}))

const dailyOption = computed(() => {
  const v = themeVars.value
  const rows = daily.value
  return {
    color: [v.primaryColor],
    grid: { left: 8, right: 16, top: 16, bottom: rows.length > 45 ? 36 : 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      ...tooltipBase.value,
      formatter: (p: { dataIndex: number; marker: string; value: number }[]) => {
        const it = p[0]
        if (!it) return ''
        return `<div style="font-weight:600;margin-bottom:4px">${rows[it.dataIndex]?.date ?? ''}</div>${it.marker}使用次数<span style="float:right;margin-left:16px;font-weight:600">${formatNumber(it.value)}</span>`
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: rows.map((r) => r.date.slice(5)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: v.dividerColor } },
      axisLabel: axisStyle.value,
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: axisStyle.value,
      splitLine: { lineStyle: { type: 'dashed', color: v.dividerColor } },
    },
    dataZoom: rows.length > 45 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 6 }] : [],
    series: [
      {
        name: '使用次数',
        type: 'line',
        smooth: true,
        smoothMonotone: 'x',
        showSymbol: rows.length <= 31,
        symbolSize: 5,
        data: rows.map((r) => r.count),
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.14 },
      },
    ],
  }
})

/** type_stats is per template; aggregate by type for the pie. */
const typeAgg = computed(() => {
  const m = new Map<string, number>()
  for (const s of stats.value?.type_stats ?? []) {
    const name = s.type_name || '未知类型（模板已删除）'
    m.set(name, (m.get(name) ?? 0) + (Number(s.count) || 0))
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
})

const templateRank = computed(() =>
  [...(stats.value?.type_stats ?? [])]
    .map((s) => ({ name: s.template_name || '（模板已删除）', type: s.type_name || '-', count: Number(s.count) || 0 }))
    .sort((a, b) => b.count - a.count),
)
const rankMax = computed(() => Math.max(1, ...templateRank.value.map((r) => r.count)))

const pieOption = computed(() => {
  const v = themeVars.value
  return {
    color: [v.primaryColor, v.successColor, v.warningColor, v.infoColor, v.errorColor],
    tooltip: {
      trigger: 'item',
      ...tooltipBase.value,
      formatter: (p: { marker: string; name: string; value: number; percent: number }) =>
        `${p.marker}${p.name}<span style="float:right;margin-left:16px;font-weight:600">${formatNumber(p.value)} 次（${p.percent}%）</span>`,
    },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: v.textColor2 } },
    series: [
      {
        name: '类型分布',
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: v.cardColor, borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 600, color: v.textColor1 } },
        data: typeAgg.value,
      },
    ],
  }
})

const chartHeight = computed(() => (appState.isMobile ? '240px' : '300px'))

onMounted(() => void load())
defineExpose({ reload: load })
</script>

<template>
  <div class="tab-pane">
    <div class="toolbar tab-toolbar">
      <span class="range-label muted">日期范围</span>
      <n-date-picker
        :value="range"
        type="daterange"
        :clearable="false"
        :shortcuts="shortcuts"
        :is-date-disabled="isFuture"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        class="range-picker"
        @update:value="onRange"
      />
      <span class="grow" />
      <n-tooltip>
        <template #trigger>
          <n-button quaternary circle :loading="loading" aria-label="刷新" @click="load">
            <template #icon><n-icon><refresh-outline /></n-icon></template>
          </n-button>
        </template>
        刷新
      </n-tooltip>
    </div>

    <div class="cards">
      <div v-for="c in cards" :key="c.key" class="stat" :class="`tone-${c.tone}`">
        <div class="stat-top">
          <span class="stat-label">{{ c.label }}</span>
          <span class="stat-icon"><n-icon :size="16"><component :is="c.icon" /></n-icon></span>
        </div>
        <template v-if="phase === 'ready'">
          <div class="stat-value">{{ formatNumber(c.value) }}</div>
          <div class="stat-sub">{{ c.sub }}</div>
        </template>
        <template v-else-if="phase === 'failed'">
          <div class="stat-value muted">-</div>
          <div class="stat-sub">加载失败</div>
        </template>
        <template v-else>
          <n-skeleton text :height="28" width="45%" style="margin-top: 6px" />
          <n-skeleton text width="60%" />
        </template>
      </div>
    </div>

    <div class="charts">
      <section class="panel trend">
        <header class="panel-head">
          <div>
            <h4>每日使用量</h4>
            <p>使用量趋势图 · {{ ymd(new Date(loadedRange[0])) }} 至 {{ ymd(new Date(loadedRange[1])) }}，共 {{ formatNumber(dailyTotal) }} 次</p>
          </div>
          <n-tooltip>
            <template #trigger>
              <n-icon :size="16" class="help"><information-circle-outline /></n-icon>
            </template>
            按使用记录的创建日期统计，日期以服务器数据库时区为准。
          </n-tooltip>
        </header>
        <n-skeleton v-if="phase === 'loading'" :height="chartHeight" :sharp="false" />
        <div v-else-if="phase === 'failed'" class="empty" :style="{ height: chartHeight }">
          <n-empty :description="`统计数据加载失败：${errorText}`">
            <template #icon><n-icon><cloud-offline-outline /></n-icon></template>
            <template #extra>
              <n-button size="small" :loading="loading" @click="load">重试</n-button>
            </template>
          </n-empty>
        </div>
        <div v-else-if="!dailyTotal" class="empty" :style="{ height: chartHeight }">
          <n-empty description="所选日期范围内没有使用记录" />
        </div>
        <e-chart v-else :option="dailyOption" :height="chartHeight" :loading="loading" />
      </section>

      <section class="panel dist">
        <header class="panel-head">
          <div>
            <h4>类型统计</h4>
            <p>类型分布图 · 全部时间的兑换次数</p>
          </div>
        </header>
        <n-skeleton v-if="phase === 'loading'" :height="chartHeight" :sharp="false" />
        <div v-else-if="phase === 'failed'" class="empty" :style="{ height: chartHeight }">
          <n-empty description="统计数据加载失败">
            <template #icon><n-icon><cloud-offline-outline /></n-icon></template>
          </n-empty>
        </div>
        <div v-else-if="!typeAgg.length" class="empty" :style="{ height: chartHeight }">
          <n-empty description="暂无兑换数据" />
        </div>
        <e-chart v-else :option="pieOption" :height="chartHeight" />
      </section>
    </div>

    <section v-if="templateRank.length" class="panel rank">
      <header class="panel-head">
        <div>
          <h4>模板兑换排行</h4>
          <p>按模板统计的兑换次数（全部时间）</p>
        </div>
      </header>
      <ol class="rank-list">
        <li v-for="(r, i) in templateRank.slice(0, 10)" :key="`${r.name}-${i}`" class="rank-item">
          <span class="rank-no">{{ i + 1 }}</span>
          <div class="rank-main">
            <div class="rank-line">
              <span class="rank-name">{{ r.name }}</span>
              <span class="rank-type muted">{{ r.type }}</span>
              <span class="grow" />
              <span class="rank-count">{{ formatNumber(r.count) }} 次</span>
            </div>
            <div class="rank-bar"><span :style="{ width: `${(r.count / rankMax) * 100}%` }" /></div>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.tab-toolbar {
  margin-bottom: 14px;
}
.range-label {
  font-size: 13px;
}
.range-picker {
  width: 280px;
  max-width: 100%;
}
.cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.stat {
  --tone: var(--primary-color);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--card-color);
}
.tone-success {
  --tone: var(--success-color);
}
.tone-info {
  --tone: var(--info-color);
}
.tone-warning {
  --tone: var(--warning-color);
}
.tone-error {
  --tone: var(--error-color);
}
.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.stat-label {
  font-size: 13px;
  color: var(--text-muted);
}
.stat-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 12%, transparent);
}
.stat-value {
  margin-top: 4px;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.2;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}
.stat-sub {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.charts {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 12px;
  margin-top: 12px;
}
.panel {
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--card-color);
}
.rank {
  margin-top: 12px;
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.panel-head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}
.panel-head p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.help {
  color: var(--text-muted);
  cursor: help;
}
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.rank-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rank-no {
  flex: none;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--hover-color);
  font-variant-numeric: tabular-nums;
}
.rank-item:nth-child(-n + 3) .rank-no {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}
.rank-main {
  flex: 1;
  min-width: 0;
}
.rank-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}
.rank-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.rank-type {
  flex: none;
  font-size: 12px;
}
.rank-count {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.rank-bar {
  height: 6px;
  margin-top: 4px;
  border-radius: 3px;
  background: var(--hover-color);
  overflow: hidden;
}
.rank-bar span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--primary-color);
}
@media (max-width: 1200px) {
  .cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 900px) {
  .charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 560px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .range-picker {
    width: 100%;
  }
}
</style>
