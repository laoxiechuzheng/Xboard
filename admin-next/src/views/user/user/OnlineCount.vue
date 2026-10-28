<script setup lang="ts">
// "online / limit" badge; red when the device limit is reached.
import { computed } from 'vue'
import { NTag, NTooltip } from 'naive-ui'

const props = defineProps<{ online: number | null; limit: number | null }>()

const hasLimit = computed(() => props.limit !== null && props.limit !== undefined)
const full = computed(() => hasLimit.value && (props.online || 0) >= Number(props.limit))
</script>

<template>
  <n-tooltip :delay="200">
    <template #trigger>
      <n-tag size="small" round :type="full ? 'error' : 'primary'" :bordered="true">
        <span class="num">{{ online || 0 }} / {{ hasLimit ? limit : '∞' }}</span>
      </n-tag>
    </template>
    {{ hasLimit ? `最多可同时在线 ${limit} 台设备` : '无设备数限制' }}
  </n-tooltip>
</template>

<style scoped>
.num {
  font-variant-numeric: tabular-nums;
}
</style>
