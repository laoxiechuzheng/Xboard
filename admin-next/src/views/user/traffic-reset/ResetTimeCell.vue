<script setup lang="ts">
// Compact reset time with the log ID below (admins and the AI assistant refer to logs by ID).
import { computed } from 'vue'
import { NTooltip } from 'naive-ui'
import { formatTime, relativeTime } from '@/utils/format'
import { shortTime } from '../login-log/meta'

const props = defineProps<{ ts: number; id: number }>()
const rel = computed(() => relativeTime(props.ts))
</script>

<template>
  <n-tooltip placement="top-start" :delay="250">
    <template #trigger>
      <div class="time">
        <div class="abs">{{ shortTime(ts) }}</div>
        <div class="id">#{{ id }}</div>
      </div>
    </template>
    {{ formatTime(ts) }}<template v-if="rel !== formatTime(ts)">（{{ rel }}）</template>
  </n-tooltip>
</template>

<style scoped>
.time {
  display: inline-block;
  line-height: 1.4;
  cursor: default;
  font-variant-numeric: tabular-nums;
}
.abs {
  font-weight: 500;
  color: var(--text-strong);
  white-space: nowrap;
}
.id {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-muted);
}
</style>
