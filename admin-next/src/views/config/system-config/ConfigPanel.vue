<script setup lang="ts">
// Frame of one settings tab: heading, unsaved badge, loading skeleton and load-error state.
import { NTag } from 'naive-ui'
import PanelState from './PanelState.vue'

defineProps<{
  title: string
  description?: string
  loading?: boolean
  error?: string
  dirtyCount?: number
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="config-panel">
    <header class="panel-head">
      <div class="panel-heading">
        <h3 class="panel-title">{{ title }}</h3>
        <p v-if="description" class="panel-desc">{{ description }}</p>
      </div>
      <div v-if="dirtyCount || $slots.extra" class="panel-extra">
        <n-tag v-if="dirtyCount" type="warning" size="small" round :bordered="false">{{ dirtyCount }} 项未保存</n-tag>
        <slot name="extra" />
      </div>
    </header>
    <div class="panel-body">
      <panel-state :loading="loading" :error="error" @retry="emit('retry')">
        <slot />
      </panel-state>
    </div>
  </section>
</template>

<style scoped>
.config-panel {
  min-width: 0;
  padding: 20px 24px 8px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-color);
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--divider-color);
}
.panel-heading {
  min-width: 0;
}
.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.4;
  color: var(--text-strong);
}
.panel-desc {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
}
.panel-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.panel-body {
  container-type: inline-size;
  container-name: settings-panel;
  min-width: 0;
  padding-bottom: 12px;
}
@media (max-width: 767px) {
  .config-panel {
    padding: 16px 14px 4px;
  }
}
</style>
