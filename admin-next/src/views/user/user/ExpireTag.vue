<script setup lang="ts">
// Expiry badge: 长期有效 (primary) / expired (red) / active (green) with remaining-days tooltip.
import { computed } from 'vue'
import { NTag, NTooltip } from 'naive-ui'
import { expireInfo } from './helpers'

const props = withDefaults(
  defineProps<{ expiredAt: number | null; nextResetAt?: number | null; block?: boolean }>(),
  { nextResetAt: null, block: false },
)

const info = computed(() => expireInfo({ expired_at: props.expiredAt, next_reset_at: props.nextResetAt ?? null }))
const tagType = computed(() => (info.value.state === 'forever' ? 'primary' : info.value.state === 'expired' ? 'error' : 'success'))
</script>

<template>
  <n-tooltip :delay="200">
    <template #trigger>
      <n-tag size="small" :type="tagType" :bordered="true" round class="expire-tag" :class="{ block }">
        <span class="mono">{{ info.label }}</span>
      </n-tag>
    </template>
    <div v-for="l in info.lines" :key="l">{{ l }}</div>
  </n-tooltip>
</template>

<style scoped>
.expire-tag.block {
  width: 100%;
  justify-content: center;
}
.mono {
  font-variant-numeric: tabular-nums;
}
</style>
