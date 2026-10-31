<script setup lang="ts">
// 后续排期: cycles after the current one up to the expiry (drawer and edit preview).
import { computed } from 'vue'
import { NTooltip } from 'naive-ui'
import type { UpcomingCycle } from '@/api/trafficCycle'
import { formatBytes, formatTime } from '@/utils/format'
import { shortTime } from '../login-log/meta'
import CyclePill from './CyclePill.vue'

const props = withDefaults(defineProps<{ items: UpcomingCycle[]; max?: number; baseQuota?: number | null }>(), {
  max: 12,
  baseQuota: null,
})

const shown = computed(() => props.items.slice(0, props.max))
const hidden = computed(() => Math.max(0, props.items.length - shown.value.length))
</script>

<template>
  <ol class="upcoming">
    <li v-for="c in shown" :key="c.index" class="item">
      <span class="idx num">{{ c.index }}</span>
      <n-tooltip :delay="250" placement="top-start">
        <template #trigger>
          <span class="range num">{{ shortTime(c.starts_at) }} → {{ c.ends_at ? shortTime(c.ends_at) : '不排期' }}</span>
        </template>
        {{ formatTime(c.starts_at) }} → {{ c.ends_at ? formatTime(c.ends_at) : '不排期' }}
      </n-tooltip>
      <span class="quota num" :class="{ diff: baseQuota !== null && c.quota !== baseQuota }">{{ formatBytes(c.quota) }}</span>
      <cycle-pill v-if="c.is_final" label="到期结束" tone="info" title="这个周期结束时订阅到期，不再重置" />
    </li>
  </ol>
  <div v-if="hidden" class="more">… 之后还有 {{ hidden }} 个周期</div>
</template>

<style scoped>
.upcoming {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  min-width: 0;
  padding: 7px 10px;
  border-radius: 9px;
  background: var(--hover-color);
  font-size: 13px;
}
.idx {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
}
.range {
  color: var(--text-color);
  white-space: nowrap;
  cursor: default;
}
.quota {
  margin-left: auto;
  font-weight: 600;
  color: var(--text-strong);
  white-space: nowrap;
}
.quota.diff {
  color: var(--primary-color);
}
.num {
  font-variant-numeric: tabular-nums;
}
.more {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
