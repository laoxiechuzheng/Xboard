<script setup lang="ts">
// Load trend chart for one machine (spec nodes §5.7): CPU / MEM / DISK % on the left axis,
// network rates on an optional right axis, 1h/6h/12h/24h ranges with auto refresh.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { NButton, NEmpty, NIcon, NRadioButton, NRadioGroup, NSkeleton, NTooltip, useThemeVars } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import type { EChartsCoreOption } from 'echarts/core'
import EChart from '@/components/EChart.vue'
import { fetchMachineHistory, type MachineHistoryPoint } from '@/api/machine'
import { formatSpeed } from './machine-utils'

const props = defineProps<{ machineId: number }>()

const RANGES = [
  { hours: 1, limit: 60, label: '1h' },
  { hours: 6, limit: 360, label: '6h' },
  { hours: 12, limit: 720, label: '12h' },
  { hours: 24, limit: 1440, label: '24h' },
] as const

type SeriesKey = 'cpu' | 'mem' | 'disk' | 'netIn' | 'netOut'

interface Point {
  t: number
  cpu: number
  mem: number
  disk: number
  netIn: number | null
  netOut: number | null
}

const themeVars = useThemeVars()
const rangeHours = ref<number>(6)
const raw = ref<MachineHistoryPoint[]>([])
const loading = ref(false)
const loaded = ref(false)
/** The latest foreground request failed (background failures keep the current data silently). */
const error = ref(false)
const lastUpdated = ref<number | null>(null)
const hidden = reactive<Record<SeriesKey, boolean>>({ cpu: false, mem: false, disk: false, netIn: false, netOut: false })

let seq = 0
let timer: ReturnType<typeof setInterval> | undefined

const round1 = (n: number) => Math.round(n * 10) / 10
const pct = (used: number, total: number) => (total > 0 ? round1((used / total) * 100) : 0)

const points = computed<Point[]>(() =>
  raw.value.map((p) => ({
    t: Number(p.recorded_at) * 1000,
    cpu: round1(Number(p.cpu) || 0),
    mem: pct(Number(p.mem_used), Number(p.mem_total)),
    disk: pct(Number(p.disk_used), Number(p.disk_total)),
    netIn: p.net_in_speed === null || p.net_in_speed === undefined ? null : Number(p.net_in_speed),
    netOut: p.net_out_speed === null || p.net_out_speed === undefined ? null : Number(p.net_out_speed),
  })),
)
const hasNet = computed(() => points.value.some((p) => p.netIn !== null || p.netOut !== null))

const seriesDefs = computed(() => {
  const defs: { key: SeriesKey; label: string; color: string; net: boolean }[] = [
    { key: 'cpu', label: 'CPU', color: themeVars.value.primaryColor, net: false },
    { key: 'mem', label: 'MEM', color: '#f59e0b', net: false },
    { key: 'disk', label: 'DISK', color: '#ef4444', net: false },
  ]
  if (hasNet.value) {
    defs.push({ key: 'netIn', label: '↓ IN', color: '#10b981', net: true })
    defs.push({ key: 'netOut', label: '↑ OUT', color: '#3b82f6', net: true })
  }
  return defs
})

async function load(background = false) {
  const range = RANGES.find((r) => r.hours === rangeHours.value) ?? RANGES[1]
  const mySeq = ++seq
  if (!background) loading.value = true
  try {
    const data = await fetchMachineHistory(props.machineId, range.limit, range.hours, { silent: background })
    if (mySeq !== seq) return
    raw.value = data ?? []
    lastUpdated.value = Date.now()
    error.value = false
  } catch {
    if (mySeq === seq && !background) {
      raw.value = []
      error.value = true
    }
  } finally {
    if (mySeq === seq) {
      loading.value = false
      loaded.value = true
    }
  }
}

function schedule() {
  clearInterval(timer)
  const every = rangeHours.value >= 12 ? 120_000 : 30_000
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void load(true)
  }, every)
}

watch(rangeHours, () => {
  void load()
  schedule()
})
watch(
  () => props.machineId,
  () => {
    raw.value = []
    loaded.value = false
    error.value = false
    void load()
  },
)

onMounted(() => {
  void load()
  schedule()
})
onBeforeUnmount(() => clearInterval(timer))

const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
function fmtAxis(ms: number) {
  const d = new Date(ms)
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return rangeHours.value <= 6 ? hm : `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hm}`
}
function fmtFull(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function hexToRgba(color: string, alpha: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return color
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

interface TooltipParam {
  seriesName: string
  marker: string
  value: [number, number | null]
}

const option = computed<EChartsCoreOption>(() => {
  const v = themeVars.value
  const pts = points.value
  const showNetAxis = hasNet.value && (!hidden.netIn || !hidden.netOut)
  const defs = seriesDefs.value
  const netLabels = new Set(defs.filter((d) => d.net).map((d) => d.label))

  const series = defs
    .filter((d) => !hidden[d.key] && (!d.net || showNetAxis))
    .map((d) => ({
      name: d.label,
      type: 'line',
      smooth: 0.3,
      showSymbol: false,
      symbolSize: 5,
      connectNulls: false,
      yAxisIndex: d.net ? 1 : 0,
      data: pts.map((p) => [p.t, p[d.key]]),
      lineStyle: { width: d.key === 'cpu' ? 2 : 1.5, color: d.color, opacity: d.key === 'disk' ? 0.75 : 1 },
      itemStyle: { color: d.color },
      areaStyle: d.net
        ? undefined
        : {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexToRgba(d.color, d.key === 'cpu' ? 0.28 : 0.14) },
                { offset: 1, color: hexToRgba(d.color, 0) },
              ],
            },
          },
    }))

  const axisLabelColor = v.textColor3
  return {
    animationDuration: 300,
    grid: { left: 8, right: 12, top: 18, bottom: 6, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: v.popoverColor,
      borderColor: v.borderColor,
      textStyle: { color: v.textColor2, fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: v.borderColor } },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as TooltipParam[]
        if (!list.length) return ''
        const rows = list
          .map((p) => {
            const val = p.value?.[1]
            const text =
              val === null || val === undefined
                ? '-'
                : netLabels.has(p.seriesName)
                  ? formatSpeed(val)
                  : `${Number(val).toFixed(1)}%`
            return `<div style="display:flex;justify-content:space-between;gap:18px;line-height:1.7"><span>${p.marker}${p.seriesName}</span><span style="font-family:${v.fontFamilyMono};font-weight:600">${text}</span></div>`
          })
          .join('')
        return `<div style="opacity:.7;margin-bottom:2px">${fmtFull(list[0].value[0])}</div>${rows}`
      },
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLabel: { color: axisLabelColor, hideOverlap: true, formatter: (val: number) => fmtAxis(val) },
      axisLine: { lineStyle: { color: v.dividerColor } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: 100,
        interval: 25,
        axisLabel: { color: axisLabelColor, formatter: '{value}%' },
        splitLine: { lineStyle: { color: v.dividerColor, type: 'dashed' } },
      },
      ...(showNetAxis
        ? [
            {
              type: 'value',
              min: 0,
              axisLabel: { color: axisLabelColor, formatter: (val: number) => formatSpeed(val) },
              splitLine: { show: false },
            },
          ]
        : []),
    ],
    series,
  }
})

const updatedText = computed(() => {
  if (!lastUpdated.value) return ''
  const d = new Date(lastUpdated.value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})
</script>

<template>
  <div class="trend">
    <div class="trend-head">
      <div class="legend">
        <button
          v-for="d in seriesDefs"
          :key="d.key"
          type="button"
          class="legend-item"
          :class="{ off: hidden[d.key] }"
          :title="hidden[d.key] ? '点击显示' : '点击隐藏'"
          @click="hidden[d.key] = !hidden[d.key]"
        >
          <span class="legend-dot" :style="{ background: d.color }" />
          {{ d.label }}
        </button>
      </div>
      <div class="trend-actions">
        <n-radio-group v-model:value="rangeHours" size="small">
          <n-radio-button v-for="r in RANGES" :key="r.hours" :value="r.hours" :label="r.label" />
        </n-radio-group>
        <n-tooltip>
          <template #trigger>
            <n-button size="small" quaternary circle :loading="loading" aria-label="刷新" @click="load()">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新（{{ rangeHours >= 12 ? '每 2 分钟' : '每 30 秒' }}自动刷新）
        </n-tooltip>
      </div>
    </div>

    <n-skeleton v-if="!loaded" height="240px" :sharp="false" />
    <div v-else-if="error && !points.length" class="trend-empty is-error">
      <n-empty description="负载数据加载失败" size="small">
        <template #extra>
          <n-button size="small" :loading="loading" @click="load()">
            <template #icon><n-icon><refresh-outline /></n-icon></template>
            重试
          </n-button>
        </template>
      </n-empty>
    </div>
    <div v-else-if="!points.length" class="trend-empty">
      <n-empty description="暂无历史负载数据" size="small" />
    </div>
    <e-chart v-else :option="option" height="240px" />

    <div v-if="loaded && points.length" class="trend-foot muted">
      共 {{ points.length }} 个数据点<span v-if="updatedText"> · 更新于 {{ updatedText }}</span>
    </div>
  </div>
</template>

<style scoped>
.trend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: transparent;
  color: var(--text-color);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.legend-item:hover {
  background: var(--hover-color);
}
.legend-item.off {
  opacity: 0.45;
  text-decoration: line-through;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.trend-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.trend-empty {
  height: 240px;
  display: grid;
  place-items: center;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
}
.trend-empty.is-error {
  border-color: color-mix(in srgb, var(--error-color) 45%, var(--border-color));
}
.trend-foot {
  font-size: 12px;
  text-align: right;
}
</style>
