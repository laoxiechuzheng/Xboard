<script setup lang="ts">
// 历史周期: closed cycles, newest first, with why each one ended and how much of it was used.
import { NButton, NTooltip } from 'naive-ui'
import type { TrafficCycle } from '@/api/trafficCycle'
import { formatBytes, formatTime } from '@/utils/format'
import { shortTime } from '../login-log/meta'
import CyclePill from './CyclePill.vue'
import { cycleUsed, endReasonDesc, endReasonLabel, kindMeta, startReasonDesc, startReasonLabel } from './meta'

withDefaults(
  defineProps<{ items: TrafficCycle[]; total: number; loading?: boolean; highlightId?: number | null }>(),
  { loading: false, highlightId: null },
)
const emit = defineEmits<{ more: [] }>()

const END_TONES: Record<string, string> = { rollover: 'info', advanced: 'primary', replaced: 'warning', expired: 'neutral' }
const endTone = (c: TrafficCycle) => END_TONES[c.end_reason ?? ''] ?? 'neutral'
const usedText = (c: TrafficCycle) => {
  const used = cycleUsed(c)
  const q = Number(c.quota) || 0
  return q > 0 ? `用了 ${formatBytes(used)} / ${formatBytes(q)}（${((used / q) * 100).toFixed(0)}%）` : `用了 ${formatBytes(used)}`
}
</script>

<template>
  <ol class="history">
    <li v-for="c in items" :key="c.id ?? `${c.seq}-${c.started_at}`" class="item" :class="[`end-${endTone(c)}`, { highlight: highlightId !== null && c.id === highlightId }]">
      <span class="dot" />
      <div class="body">
        <div class="head">
          <span class="title">第 {{ c.seq ?? '?' }} 个周期</span>
          <cycle-pill :label="kindMeta(c.kind).label" :tone="kindMeta(c.kind).tone" :title="kindMeta(c.kind).hint" />
          <span class="quota num">{{ formatBytes(c.quota) }}</span>
          <span class="grow" />
          <n-tooltip :delay="250" placement="top-end">
            <template #trigger>
              <span class="range num">{{ shortTime(c.started_at) }} → {{ c.ended_at ? shortTime(c.ended_at) : '—' }}</span>
            </template>
            {{ formatTime(c.started_at) }} → {{ c.ended_at ? formatTime(c.ended_at) : '—' }}
            <template v-if="c.ends_at && c.ended_at && c.ends_at !== c.ended_at"><br />原计划 {{ formatTime(c.ends_at) }} 结束</template>
          </n-tooltip>
        </div>
        <div class="line">
          <span :title="startReasonDesc(c.start_reason)">{{ startReasonLabel(c.start_reason) }}开始</span>
          <span class="sep">→</span>
          <span class="end" :title="endReasonDesc(c.end_reason)">{{ endReasonLabel(c.end_reason) }}</span>
          <span class="sep">·</span>
          <span class="num">{{ usedText(c) }}</span>
          <span v-if="c.id" class="id">#{{ c.id }}</span>
        </div>
        <div v-if="c.end_reason" class="desc">{{ endReasonDesc(c.end_reason) }}<template v-if="c.plan_name"> · {{ c.plan_name }}</template></div>
        <div v-if="c.note" class="note">备注：{{ c.note }}</div>
      </div>
    </li>
  </ol>
  <div v-if="items.length < total" class="more">
    <n-button size="small" secondary :loading="loading" @click="emit('more')">加载更早的周期（还有 {{ total - items.length }} 个）</n-button>
  </div>
</template>

<style scoped>
.history {
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  --tone: var(--text-muted);
  position: relative;
  display: flex;
  gap: 12px;
  padding: 0 0 14px;
}
.item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 16px;
  bottom: 0;
  width: 2px;
  background: var(--divider-color);
}
.end-info {
  --tone: var(--info-color);
}
.end-primary {
  --tone: var(--primary-color);
}
.end-warning {
  --tone: var(--warning-color);
}
.dot {
  flex: none;
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 50%;
  border: 2px solid var(--tone);
  background: var(--card-color);
}
.body {
  flex: 1;
  min-width: 0;
}
.item.highlight .body {
  margin: -6px -8px 0;
  padding: 6px 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary-color) 9%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 35%, transparent);
}
.head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.quota {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.grow {
  flex: 1;
}
.range {
  font-size: 12px;
  color: var(--text-color);
  cursor: default;
  white-space: nowrap;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--text-color);
}
.sep {
  color: var(--text-muted);
}
.end {
  font-weight: 500;
  color: var(--tone);
}
.id {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-muted);
}
.desc,
.note {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-word;
}
.note {
  color: var(--text-color);
}
.num {
  font-variant-numeric: tabular-nums;
}
.more {
  display: flex;
  justify-content: center;
}
</style>
