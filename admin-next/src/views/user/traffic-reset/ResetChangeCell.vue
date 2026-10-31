<script setup lang="ts">
// Before → after for the quota (bytes) or the subscription expiry (unix seconds, with the 换时 shift).
import { computed } from 'vue'
import { NTooltip } from 'naive-ui'
import { formatBytes, formatTime } from '@/utils/format'
import { durationText } from '../traffic-cycle/meta'
import { shortTime } from '../login-log/meta'

const props = withDefaults(
  defineProps<{ kind: 'quota' | 'expiry'; before: number | null; after: number | null; shift?: number | null }>(),
  { shift: null },
)

const fmt = (v: number | null) => {
  if (v === null) return '—'
  return props.kind === 'quota' ? formatBytes(v) : shortTime(v)
}
const full = (v: number | null) => (v === null ? '未记录' : props.kind === 'quota' ? formatBytes(v) : formatTime(v))

const empty = computed(() => props.before === null && props.after === null)
const changed = computed(() => props.before !== null && props.after !== null && props.before !== props.after)
const single = computed(() => (props.after ?? props.before) as number | null)

/** Expiry only: 换时 reports shift_seconds; otherwise derive it from before / after. */
const shiftText = computed(() => {
  if (props.kind !== 'expiry') return ''
  if (props.shift) return `提前 ${durationText(props.shift)}`
  if (!changed.value) return ''
  const diff = (props.after as number) - (props.before as number)
  return diff > 0 ? `延后 ${durationText(diff)}` : `提前 ${durationText(diff)}`
})
</script>

<template>
  <span v-if="empty" class="muted">—</span>
  <n-tooltip v-else :delay="250" placement="top-start">
    <template #trigger>
      <div class="change">
        <div v-if="changed" class="row">
          <span class="before">{{ fmt(before) }}</span>
          <span class="arrow">→</span>
          <span class="after">{{ fmt(after) }}</span>
        </div>
        <div v-else class="row"><span class="after">{{ fmt(single) }}</span></div>
        <div v-if="shiftText" class="shift">{{ shiftText }}</div>
      </div>
    </template>
    <div>改前：{{ full(before) }}</div>
    <div>改后：{{ full(after) }}</div>
    <div v-if="shiftText">{{ kind === 'expiry' && shift ? `到期时间${shiftText}（本周期未用完的时长作废）` : shiftText }}</div>
  </n-tooltip>
</template>

<style scoped>
.change {
  display: inline-block;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  cursor: default;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 4px;
  white-space: nowrap;
}
.before {
  color: var(--text-muted);
}
.arrow {
  color: var(--text-muted);
  font-size: 12px;
}
.after {
  color: var(--text-strong);
  font-weight: 500;
}
.shift {
  font-size: 12px;
  color: var(--warning-color);
}
.muted {
  color: var(--text-muted);
}
</style>
