<script setup lang="ts">
// Used traffic with percentage bar (red above 90%); tooltip shows the total quota.
import { computed } from 'vue'
import { NTooltip } from 'naive-ui'
import { formatBytes } from '@/utils/format'
import { usedPercent } from './helpers'

const props = defineProps<{ used: number; total: number }>()

const pct = computed(() => usedPercent({ total_used: props.used, transfer_enable: props.total }))
const pctText = computed(() => (pct.value === null ? '—' : `${pct.value.toFixed(1)}%`))
const width = computed(() => (pct.value === null ? 100 : Math.min(pct.value, 100)))
const danger = computed(() => pct.value === null || pct.value > 90)
</script>

<template>
  <n-tooltip :delay="200">
    <template #trigger>
      <div class="usage">
        <div class="usage-row">
          <span class="num">{{ formatBytes(used) }}</span>
          <span class="pct num" :class="{ danger }">{{ pctText }}</span>
        </div>
        <div class="bar">
          <div class="bar-fill" :class="{ danger }" :style="{ width: width + '%' }" />
        </div>
      </div>
    </template>
    总流量: {{ formatBytes(total) }}
    <template v-if="pct === null"><br />总流量为 0，无法计算使用比例</template>
  </n-tooltip>
</template>

<style scoped>
.usage {
  min-width: 120px;
}
.usage-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.num {
  font-variant-numeric: tabular-nums;
}
.pct {
  color: var(--text-muted);
  font-size: 12px;
}
.pct.danger {
  color: var(--error-color);
}
.bar {
  margin-top: 4px;
  height: 4px;
  border-radius: 2px;
  background: var(--hover-color);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--primary-color);
  transition: width 0.3s;
}
.bar-fill.danger {
  background: var(--error-color);
}
</style>
