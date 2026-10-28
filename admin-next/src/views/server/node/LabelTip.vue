<script setup lang="ts">
// Form label with a help tooltip (used where the feedback line is reserved for validation errors).
import { NIcon, NTooltip } from 'naive-ui'
import { HelpCircleOutline } from '@vicons/ionicons5'

defineProps<{ label: string; tip: string }>()
</script>

<template>
  <span class="label-tip">
    <span>{{ label }}</span>
    <n-tooltip :style="{ maxWidth: '320px' }">
      <template #trigger>
        <n-icon class="tip-icon" :size="14"><help-circle-outline /></n-icon>
      </template>
      {{ tip }}
    </n-tooltip>
    <slot />
  </span>
</template>

<style scoped>
.label-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tip-icon {
  color: var(--text-muted);
  cursor: help;
}
</style>
