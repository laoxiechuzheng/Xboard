<script setup lang="ts">
// Traffic usage (u + d) against the node's transfer limit.
import { computed } from 'vue'
import { NProgress, NTooltip } from 'naive-ui'
import type { ServerNode } from '@/api/node'
import { formatBytes } from '@/utils/format'
import { trafficOf } from '../meta'

const props = defineProps<{ node: ServerNode }>()

const t = computed(() => trafficOf(props.node))
const over = computed(() => t.value.total > 0 && t.value.used >= t.value.total)
</script>

<template>
  <n-tooltip>
    <template #trigger>
      <span class="traffic">
        <n-progress
          v-if="t.total > 0"
          type="line"
          class="bar"
          :percentage="t.pct"
          :show-indicator="false"
          :height="6"
          :status="t.pct > 90 ? 'error' : 'default'"
        />
        <span class="mono num" :class="{ danger: t.pct > 90 }">{{ formatBytes(t.used) }}</span>
      </span>
    </template>
    <div class="tip">
      <div>已用: <span class="mono">{{ formatBytes(t.used) }}</span></div>
      <div>总流量: <span class="mono">{{ t.total > 0 ? formatBytes(t.total) : '不限' }}</span></div>
      <div v-if="t.total > 0">使用率: <span class="mono">{{ t.pct.toFixed(1) }}%</span></div>
      <div v-if="over" class="over">已达上限，节点不再下发给用户</div>
    </div>
  </n-tooltip>
</template>

<style scoped>
.traffic {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bar {
  width: 48px;
  flex: none;
}
.num {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.num.danger {
  color: var(--error-color);
}
.tip {
  font-size: 12px;
  line-height: 1.7;
}
.over {
  color: var(--warning-color);
}
</style>
