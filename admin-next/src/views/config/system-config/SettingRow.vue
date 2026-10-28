<script setup lang="ts">
// One settings row: label + description on the left, control on the right
// (stacked in narrow panels). `inline` keeps switches on the same line.
import { NTag } from 'naive-ui'

defineProps<{
  label: string
  description?: string
  error?: string
  warning?: string
  dirty?: boolean
  inline?: boolean
  badge?: string
}>()
</script>

<template>
  <div class="setting-row" :class="{ inline }">
    <div class="setting-meta">
      <div class="setting-label">
        <span>{{ label }}</span>
        <n-tag v-if="badge" size="tiny" :bordered="false">{{ badge }}</n-tag>
        <span v-if="dirty" class="dirty-dot" title="已修改，尚未保存" />
      </div>
      <div v-if="description || $slots.description" class="setting-desc">
        <slot name="description">{{ description }}</slot>
      </div>
    </div>
    <div class="setting-control">
      <slot />
      <div v-if="error" class="setting-feedback is-error" role="alert">{{ error }}</div>
      <div v-else-if="warning" class="setting-feedback is-warning">{{ warning }}</div>
      <slot name="extra" />
    </div>
  </div>
</template>

<style scoped>
.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: 10px 32px;
  padding: 18px 0;
}
.setting-row + .setting-row {
  border-top: 1px solid var(--divider-color);
}
.setting-row.inline {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}
.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-strong);
}
.setting-desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-muted);
  word-break: break-word;
}
.setting-control {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.inline .setting-control {
  align-items: flex-end;
}
.setting-feedback {
  font-size: 12.5px;
  line-height: 1.5;
}
.is-error {
  color: var(--error-color);
}
.is-warning {
  color: var(--warning-color);
}
.dirty-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--warning-color);
}
@container settings-panel (max-width: 680px) {
  .setting-row:not(.inline) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
