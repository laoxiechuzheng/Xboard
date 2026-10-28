<script setup lang="ts">
// Current load as threshold-colored bars. `detailed` adds used/total, swap and network rates (detail drawer).
import { computed } from 'vue'
import { NProgress } from 'naive-ui'
import type { MachineLoadStatus } from '@/api/machine'
import { formatBytes } from '@/utils/format'
import { formatSpeed, levelStatus, loadLevel, loadPercents, usagePercent } from './machine-utils'

const props = withDefaults(defineProps<{ load: MachineLoadStatus | null | undefined; detailed?: boolean }>(), {
  detailed: false,
})

const pct = computed(() => loadPercents(props.load))

interface Row {
  key: string
  label: string
  percent: number
  status: 'default' | 'warning' | 'error'
  text: string
  sub?: string
}

const rows = computed<Row[]>(() => {
  const ls = props.load
  if (!ls) return []
  const p = pct.value
  const out: Row[] = [
    {
      key: 'cpu',
      label: 'CPU',
      percent: p.cpu,
      status: levelStatus(loadLevel('cpu', p.cpu)),
      text: props.detailed ? `${p.cpu.toFixed(1)}%` : `${Math.round(p.cpu)}%`,
    },
    {
      key: 'mem',
      label: props.detailed ? '内存' : 'MEM',
      percent: p.mem,
      status: levelStatus(loadLevel('mem', p.mem)),
      text: `${Math.round(p.mem)}%`,
      sub: ls.mem ? `${formatBytes(ls.mem.used)} / ${formatBytes(ls.mem.total)}` : undefined,
    },
  ]
  if (props.detailed) {
    out.push({
      key: 'disk',
      label: '磁盘',
      percent: p.disk,
      status: levelStatus(loadLevel('disk', p.disk)),
      text: `${Math.round(p.disk)}%`,
      sub: ls.disk ? `${formatBytes(ls.disk.used)} / ${formatBytes(ls.disk.total)}` : undefined,
    })
    if (ls.swap && ls.swap.total > 0) {
      const sp = usagePercent(ls.swap)
      out.push({
        key: 'swap',
        label: '交换',
        percent: sp,
        status: levelStatus(loadLevel('mem', sp)),
        text: `${Math.round(sp)}%`,
        sub: `${formatBytes(ls.swap.used)} / ${formatBytes(ls.swap.total)}`,
      })
    }
  }
  return out
})

const diskText = computed(() =>
  props.load?.disk && props.load.disk.total > 0
    ? `${formatBytes(props.load.disk.used)} / ${formatBytes(props.load.disk.total)}`
    : '-',
)
</script>

<template>
  <div v-if="!load" class="no-load muted">暂无负载数据</div>
  <div v-else class="load-bars" :class="{ detailed }">
    <div v-for="r in rows" :key="r.key" class="load-row">
      <div class="load-head">
        <span class="load-label">{{ r.label }}</span>
        <span v-if="detailed && r.sub" class="load-sub">{{ r.sub }}</span>
        <span class="load-pct">{{ r.text }}</span>
      </div>
      <n-progress
        type="line"
        :percentage="r.percent"
        :status="r.status"
        :show-indicator="false"
        :height="detailed ? 8 : 5"
        :border-radius="4"
      />
    </div>
    <div v-if="!detailed" class="disk-line">
      <span class="load-label">DISK</span>
      <span class="load-sub">{{ diskText }}</span>
    </div>
    <div v-if="detailed && load.net" class="net-line">
      <span class="load-label">网络速率</span>
      <span class="net-val in">↓ {{ formatSpeed(load.net.in_speed) }}</span>
      <span class="net-val out">↑ {{ formatSpeed(load.net.out_speed) }}</span>
    </div>
  </div>
</template>

<style scoped>
.no-load {
  font-size: 12px;
}
.load-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 150px;
}
.load-bars.detailed {
  gap: 14px;
}
.load-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 3px;
  font-size: 12px;
}
.detailed .load-head {
  font-size: 13px;
  margin-bottom: 6px;
}
.load-label {
  color: var(--text-muted);
  font-weight: 500;
}
.detailed .load-label {
  color: var(--text-color);
}
.load-sub {
  color: var(--text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.load-pct {
  margin-left: auto;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.disk-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}
.net-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
  font-size: 13px;
}
.net-val {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.net-val.in {
  color: var(--success-color);
}
.net-val.out {
  color: var(--info-color);
}
</style>
