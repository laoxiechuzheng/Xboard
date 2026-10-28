<script setup lang="ts">
// Relative time on top, compact exact time below; full timestamp in the tooltip.
import { computed } from 'vue'
import { NTooltip } from 'naive-ui'
import { formatTime, relativeTime } from '@/utils/format'
import { shortTime } from './meta'

const props = defineProps<{ ts: number }>()
const rel = computed(() => relativeTime(props.ts))
const exact = computed(() => formatTime(props.ts))
const short = computed(() => shortTime(props.ts))
</script>

<template>
  <n-tooltip placement="top-start" :delay="250">
    <template #trigger>
      <div class="time">
        <div class="rel">{{ rel }}</div>
        <div v-if="rel !== exact" class="abs">{{ short }}</div>
      </div>
    </template>
    {{ exact }}
  </n-tooltip>
</template>

<style scoped>
.time {
  display: inline-block;
  line-height: 1.4;
  cursor: default;
  font-variant-numeric: tabular-nums;
}
.rel {
  font-weight: 500;
  color: var(--text-strong);
  white-space: nowrap;
}
.abs {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
