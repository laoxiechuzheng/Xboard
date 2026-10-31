<script setup lang="ts">
// Small pill tinted with a theme tone (reasons, cycle kinds, flags); same look as the login log type pill.
import type { Component } from 'vue'
import { NIcon } from 'naive-ui'
import type { Tone } from './meta'

withDefaults(defineProps<{ label: string; tone?: Tone; icon?: Component | null; title?: string }>(), {
  tone: 'neutral',
  icon: null,
  title: undefined,
})
</script>

<template>
  <span class="pill" :class="[`tone-${tone}`, { 'has-icon': !!icon }]" :title="title">
    <n-icon v-if="icon" :size="13"><component :is="icon" /></n-icon>
    {{ label }}
  </span>
</template>

<style scoped>
.pill {
  --tone: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 22%, transparent);
}
.pill.has-icon {
  padding-left: 6px;
}
.tone-primary {
  --tone: var(--primary-color);
}
.tone-success {
  --tone: var(--success-color);
}
.tone-info {
  --tone: var(--info-color);
}
.tone-warning {
  --tone: var(--warning-color);
}
.tone-error {
  --tone: var(--error-color);
}
</style>
