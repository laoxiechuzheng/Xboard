<script setup lang="ts">
// Revenue overview (spec core §7.3): stat/getOrder over a UTC+8 date range, refreshed every 30s.
import { computed, ref, watch } from 'vue'
import {
  NCard,
  NSelect,
  NDatePicker,
  NRadioGroup,
  NRadioButton,
  NEmpty,
  NSkeleton,
  NSpin,
  NTag,
  NIcon,
  NTooltip,
  useThemeVars,
} from 'naive-ui'
import { InformationCircleOutline } from '@vicons/ionicons5'
import EChart from '@/components/EChart.vue'
import { getOrderStat, type OrderStatItem } from '@/api/stat'
import { formatMoney, formatNumber } from '@/utils/format'
import { appState } from '@/stores/app'
import {
  cnDate,
  defaultPickerRange,
  isFutureDate,
  jsonEqual,
  pickerToDate,
  useAsyncState,
  usePolling,
  withAlpha,
} from '../composables'

type RangeKey = '7d' | '30d' | '90d' | '180d' | '365d' | 'custom'
type Mode = 'amount' | 'count'

const rangeOptions: { label: string; value: RangeKey }[] = [
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '最近90天', value: '90d' },
  { label: '最近180天', value: '180d' },
  { label: '最近一年', value: '365d' },
  { label: '自定义范围', value: 'custom' },
]
const RANGE_DAYS: Record<Exclude<RangeKey, 'custom'>, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 }

const range = ref<RangeKey>('30d')
const custom = ref<[number, number] | null>(defaultPickerRange())
const mode = ref<Mode>('amount')
const themeVars = useThemeVars()

/** Request dates; null while a custom range is incomplete. */
function currentParams(): { start_date: string; end_date: string } | null {
  if (range.value === 'custom') {
    if (!custom.value) return null
    return { start_date: pickerToDate(custom.value[0]), end_date: pickerToDate(custom.value[1]) }
  }
  return { start_date: cnDate(-RANGE_DAYS[range.value]), end_date: cnDate(0) }
}

// Unchanged polls keep the same data object, so the chart is not redrawn (no replayed animation, tooltip kept).
const state = useAsyncState(
  async () => {
    const p = currentParams()
    if (!p) throw new Error('请选择日期范围')
    return getOrderStat(p, { silent: true })
  },
  { same: jsonEqual },
)
const refresh = usePolling(state.run, 30_000)
const hasError = computed(() => !!state.error.value)
defineExpose({ refresh, loading: state.loading, lastSuccess: state.lastSuccess, hasError })

// Spinner only for user-initiated range changes, not for background polling.
const switching = ref(false)
watch([range, custom], () => {
  if (!currentParams()) return
  switching.value = true
  void refresh().finally(() => (switching.value = false))
})

const list = computed<OrderStatItem[]>(() => state.data.value?.list ?? [])
const summary = computed(() => state.data.value?.summary ?? null)

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`
const compactYuan = (cents: number) => {
  const yuan = cents / 100
  if (Math.abs(yuan) >= 10000) return `¥${Number((yuan / 10000).toFixed(1))}万`
  return `¥${Number(yuan.toFixed(2))}`
}

const chartOption = computed(() => {
  const v = themeVars.value
  const primary = v.primaryColor
  const secondary = v.successColor
  const isAmount = mode.value === 'amount'
  const rows = list.value
  const axisText = { color: v.textColor3, fontSize: 11 }

  const series = isAmount
    ? [
        { name: '订单金额', key: 'paid_total' as const, color: primary },
        { name: '佣金金额', key: 'commission_total' as const, color: secondary },
      ].map((s) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        // Monotone interpolation like the official chart: no overshoot below zero.
        smoothMonotone: 'x',
        showSymbol: rows.length <= 1,
        symbolSize: 6,
        data: rows.map((r) => r[s.key]),
        itemStyle: { color: s.color },
        lineStyle: { width: 2, color: s.color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(s.color, 0.32) },
              { offset: 1, color: withAlpha(s.color, 0.02) },
            ],
          },
        },
      }))
    : [
        { name: '订单数量', key: 'paid_count' as const, color: primary },
        { name: '佣金数量', key: 'commission_count' as const, color: secondary },
      ].map((s) => ({
        name: s.name,
        type: 'bar',
        barMaxWidth: 40,
        data: rows.map((r) => r[s.key]),
        itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] },
      }))

  return {
    color: [primary, secondary],
    grid: { left: 8, right: 12, top: 36, bottom: 4, containLabel: true },
    legend: { top: 0, right: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: v.textColor2 } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: isAmount ? 'line' : 'shadow' },
      backgroundColor: v.popoverColor,
      borderColor: v.borderColor,
      textStyle: { color: v.textColor1, fontSize: 12 },
      formatter: (params: { dataIndex: number; marker: string; seriesName: string; value: number }[]) => {
        if (!params.length) return ''
        const date = rows[params[0].dataIndex]?.date ?? ''
        const lines = params.map((p) => {
          const val = p.seriesName.includes('金额') ? money(Number(p.value)) : `${formatNumber(p.value)} 笔交易`
          return `${p.marker}${p.seriesName}<span style="float:right;margin-left:16px;font-weight:600">${val}</span>`
        })
        return [`<div style="margin-bottom:4px;font-weight:600">${date}</div>`, ...lines].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: !isAmount,
      data: rows.map((r) => r.date.slice(5)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: v.dividerColor } },
      axisLabel: axisText,
    },
    yAxis: {
      type: 'value',
      minInterval: isAmount ? 0 : 1,
      axisLabel: { ...axisText, formatter: (val: number) => (isAmount ? compactYuan(val) : `${val} 笔`) },
      splitLine: { lineStyle: { type: 'dashed', color: withAlpha(v.textColor3, 0.3) } },
    },
    series,
  }
})

const chartHeight = computed(() => (appState.isMobile ? '300px' : '400px'))
</script>

<template>
  <n-card :bordered="true" class="revenue-card" content-style="padding-top: 4px">
    <template #header>
      <div class="card-title">收入概览</div>
      <div class="card-sub">
        <template v-if="summary">{{ summary.start_date }} 至 {{ summary.end_date }}</template>
        <template v-else>&nbsp;</template>
      </div>
    </template>
    <template #header-extra>
      <div class="controls">
        <n-select v-model:value="range" :options="rangeOptions" placeholder="选择范围" size="small" style="width: 124px" />
        <n-date-picker
          v-if="range === 'custom'"
          v-model:value="custom"
          type="daterange"
          size="small"
          placeholder="选择日期"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :is-date-disabled="isFutureDate"
          :clearable="false"
          style="width: 240px"
        />
        <n-radio-group v-model:value="mode" size="small">
          <n-radio-button value="amount">金额</n-radio-button>
          <n-radio-button value="count">数量</n-radio-button>
        </n-radio-group>
      </div>
    </template>

    <n-spin :show="switching" :delay="150">
      <div v-if="summary" class="summary">
        <div class="summary-item">
          <div class="summary-label">总收入</div>
          <div class="summary-value">{{ formatMoney(summary.paid_total) }}</div>
          <div class="summary-meta">共 {{ formatNumber(summary.paid_count) }} 笔交易</div>
          <div class="summary-meta">平均订单金额: {{ formatMoney(summary.avg_paid_amount) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">总佣金</div>
          <div class="summary-value">{{ formatMoney(summary.commission_total) }}</div>
          <div class="summary-meta">共 {{ formatNumber(summary.commission_count) }} 笔交易</div>
          <div class="summary-meta">佣金比例: {{ summary.commission_rate.toFixed(2) }}%</div>
        </div>
      </div>
      <div v-else-if="state.loading.value || !state.error.value" class="summary">
        <div v-for="i in 2" :key="i" class="summary-item">
          <n-skeleton text width="30%" />
          <n-skeleton text :height="26" width="50%" />
          <n-skeleton text width="40%" />
        </div>
      </div>

      <div class="chart-wrap" :style="{ height: chartHeight }">
        <div v-if="state.error.value && !state.data.value" class="chart-state error">
          <span>{{ state.error.value }}</span>
          <a v-if="currentParams()" class="retry" @click="refresh">点击重试</a>
        </div>
        <n-skeleton v-else-if="!state.data.value" :height="chartHeight" :sharp="false" />
        <div v-else-if="!list.length" class="chart-state">
          <n-empty description="所选范围内暂无统计数据" />
        </div>
        <e-chart v-else :option="chartOption" :height="chartHeight" />
      </div>
    </n-spin>

    <div class="foot">
      <n-tooltip>
        <template #trigger>
          <span class="foot-hint">
            <n-icon :size="14"><information-circle-outline /></n-icon>
            统计数据每日 00:10 生成，当天数据次日可见
          </span>
        </template>
        收入概览按订单支付时间统计（定时任务 xboard:statistics），与上方卡片按下单时间统计的收入可能不一致。
      </n-tooltip>
      <n-tag v-if="state.error.value && state.data.value" size="small" type="warning" :bordered="false">
        刷新失败：{{ state.error.value }}
      </n-tag>
    </div>
  </n-card>
</template>

<style scoped>
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}
/* Let the controls wrap below the title on narrow screens instead of squeezing it. */
.revenue-card :deep(.n-card-header) {
  flex-wrap: wrap;
  gap: 10px;
}
.revenue-card :deep(.n-card-header__main) {
  flex: 1 0 auto;
}
.summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--hover-color);
  min-width: 0;
}
.summary-label {
  font-size: 13px;
  color: var(--text-muted);
}
.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.summary-meta {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.chart-wrap {
  position: relative;
}
.chart-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}
.chart-state.error {
  color: var(--error-color);
}
.retry {
  color: var(--primary-color);
  cursor: pointer;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.foot-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: help;
}
@media (max-width: 520px) {
  .summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
