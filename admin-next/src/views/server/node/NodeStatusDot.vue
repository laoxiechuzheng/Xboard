<script setup lang="ts">
// Availability dot with a tooltip showing the node's reported load and runtime metrics.
import { computed } from 'vue'
import { NProgress, NTooltip } from 'naive-ui'
import type { ServerNode } from '@/api/node'
import { formatBytes } from '@/utils/format'
import { NODE_STATUS, formatUptime, levelColor, percent } from './meta'

const props = defineProps<{ node: ServerNode }>()

const status = computed(() => NODE_STATUS[props.node.available_status] ?? NODE_STATUS[0])
const load = computed(() => props.node.load_status)
const m = computed(() => props.node.metrics)

const bars = computed(() => {
  const l = load.value
  if (!l) return []
  const cpu = Math.round(Number(l.cpu ?? 0))
  const mem = percent(l.mem?.used, l.mem?.total)
  const disk = percent(l.disk?.used, l.disk?.total)
  return [
    { label: 'CPU 使用率', pct: cpu, text: `${cpu}%` },
    { label: '内存使用', pct: mem, text: `${formatBytes(l.mem?.used)} / ${formatBytes(l.mem?.total)}` },
    { label: '磁盘使用', pct: disk, text: `${formatBytes(l.disk?.used)} / ${formatBytes(l.disk?.total)}` },
  ]
})

const metricItems = computed(() => {
  const x = m.value
  if (!x) return []
  const items: { label: string; value: string; danger?: boolean }[] = [
    { label: '运行时长', value: formatUptime(x.uptime) },
    {
      label: '实时/总连接',
      value: `${x.active_connections ?? 0}${x.total_connections !== undefined ? ` / ${x.total_connections}` : ''}`,
    },
    { label: '出站速率', value: `${formatBytes(x.outbound_speed)}/s` },
    { label: '入站速率', value: `${formatBytes(x.inbound_speed)}/s` },
    { label: '在线用户', value: `${x.active_users ?? 0} / ${x.total_users ?? 0}` },
    { label: '并发协程', value: String(x.goroutines ?? 0) },
  ]
  if (x.load?.load5 !== undefined) items.push({ label: '系统负载 (5m)', value: Number(x.load.load5).toFixed(2) })
  if (x.api) {
    items.push({
      label: '面板 API 成功/失败',
      value: `${x.api.success ?? 0} / ${x.api.failure ?? 0}`,
      danger: Number(x.api.failure ?? 0) > 0,
    })
  }
  if (x.ws?.enabled) items.push({ label: 'WebSocket', value: x.ws.connected ? 'WS-OK' : 'WS-ERR', danger: !x.ws.connected })
  if (x.kernel_status !== undefined || x.gc) {
    const gc = x.gc?.last_pause_ms !== undefined ? ` (${x.gc.last_pause_ms}ms)` : ''
    items.push({ label: '内核 / GC', value: `${x.kernel_status ? 'ON' : 'OFF'}${gc}`, danger: x.kernel_status === false })
  }
  return items
})

const limitText = computed(() => {
  const x = m.value
  if (!x) return ''
  const events = Number(x.limits?.device_limit_events ?? 0)
  if (!x.speed_limiter?.has_limits && events <= 0) return ''
  return `${x.speed_limiter?.limited_users ?? 0} Limit${events > 0 ? ` | ${events} Events` : ''}`
})
</script>

<template>
  <n-tooltip placement="right" :style="{ maxWidth: '360px' }">
    <template #trigger>
      <span class="dot" :style="{ background: status.color }" :aria-label="status.label" />
    </template>
    <div class="tip">
      <div class="tip-status">
        <span class="dot" :style="{ background: status.color }" />
        {{ status.label }}
      </div>
      <div v-for="b in bars" :key="b.label" class="bar">
        <div class="bar-head">
          <span>{{ b.label }}</span>
          <span class="mono">{{ b.text }}<template v-if="b.label !== 'CPU 使用率'"> · {{ b.pct }}%</template></span>
        </div>
        <n-progress
          type="line"
          :percentage="Math.min(b.pct, 100)"
          :show-indicator="false"
          :height="5"
          :color="levelColor(b.pct)"
        />
      </div>
      <div v-if="metricItems.length" class="grid">
        <div v-for="it in metricItems" :key="it.label" class="cell">
          <div class="cell-label">{{ it.label }}</div>
          <div class="cell-value mono" :class="{ danger: it.danger }">{{ it.value }}</div>
        </div>
      </div>
      <div v-if="limitText" class="limit mono">{{ limitText }}</div>
      <div v-if="!bars.length && !metricItems.length" class="empty">暂无节点上报数据</div>
    </div>
  </n-tooltip>
</template>

<style scoped>
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.tip {
  min-width: 220px;
  font-size: 12px;
}
.tip-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
}
.bar {
  margin-top: 6px;
}
.bar-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 2px;
  opacity: 0.85;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(128, 128, 128, 0.25);
}
.cell-label {
  opacity: 0.7;
  font-size: 11px;
}
.cell-value {
  font-variant-numeric: tabular-nums;
}
.cell-value.danger {
  color: var(--error-color);
  animation: blink 1.2s ease-in-out infinite;
}
.limit {
  margin-top: 8px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--error-color);
  color: #fff;
  display: inline-block;
}
.empty {
  opacity: 0.7;
  margin-top: 2px;
}
@keyframes blink {
  50% {
    opacity: 0.45;
  }
}
</style>
