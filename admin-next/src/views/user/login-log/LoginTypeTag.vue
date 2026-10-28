<script setup lang="ts">
// Login log type pill (登录 / 注册 / 链接登录) tinted with the theme colour of its tone.
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { loginTypeMeta } from './meta'

const props = defineProps<{ type: string }>()
const meta = computed(() => loginTypeMeta(props.type))
</script>

<template>
  <span class="type-pill" :class="`tone-${meta.tone}`" :title="meta.hint || undefined">
    <n-icon :size="13"><component :is="meta.icon" /></n-icon>
    {{ meta.label }}
  </span>
</template>

<style scoped>
.type-pill {
  --tone: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px 0 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 22%, transparent);
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
