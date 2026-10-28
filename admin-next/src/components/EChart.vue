<script setup lang="ts">
// Minimal ECharts wrapper: tree-shaken core, auto resize, dark-mode aware.
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  DataZoomComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { appState } from '@/stores/app'

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  DataZoomComponent,
  TitleComponent,
  CanvasRenderer,
])

const props = withDefaults(defineProps<{ option: EChartsCoreOption; height?: string; loading?: boolean }>(), {
  height: '300px',
  loading: false,
})

const el = ref<HTMLDivElement | null>(null)
const chart = shallowRef<echarts.ECharts | null>(null)
let ro: ResizeObserver | null = null

function init() {
  if (!el.value) return
  chart.value?.dispose()
  chart.value = echarts.init(el.value, appState.isDark ? 'dark' : undefined, { renderer: 'canvas' })
  chart.value.setOption({ backgroundColor: 'transparent', ...props.option }, true)
  if (props.loading) chart.value.showLoading()
}

onMounted(() => {
  init()
  ro = new ResizeObserver(() => chart.value?.resize())
  if (el.value) ro.observe(el.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  chart.value?.dispose()
})

watch(
  () => props.option,
  (opt) => chart.value?.setOption({ backgroundColor: 'transparent', ...opt }, true),
  { deep: true },
)
watch(
  () => props.loading,
  (v) => (v ? chart.value?.showLoading() : chart.value?.hideLoading()),
)
watch(() => appState.isDark, init)
</script>

<template>
  <div ref="el" class="echart" :style="{ height }" />
</template>

<style scoped>
.echart {
  width: 100%;
}
</style>
