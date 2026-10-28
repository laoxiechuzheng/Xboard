<script setup lang="ts">
// Loading skeleton / load-error state in front of a settings form.
import { NButton, NResult, NSkeleton } from 'naive-ui'

defineProps<{ loading?: boolean; error?: string; rows?: number }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="loading" class="panel-loading" aria-busy="true">
    <div v-for="i in rows ?? 5" :key="i" class="skeleton-row">
      <div class="skeleton-meta">
        <n-skeleton text style="width: 40%" />
        <n-skeleton text style="width: 80%" />
      </div>
      <n-skeleton height="34px" :sharp="false" />
    </div>
  </div>
  <n-result v-else-if="error" status="error" title="配置加载失败" :description="error" size="small" class="panel-error">
    <template #footer>
      <n-button type="primary" secondary @click="emit('retry')">重新加载</n-button>
    </template>
  </n-result>
  <slot v-else />
</template>

<style scoped>
.panel-loading {
  display: flex;
  flex-direction: column;
}
.skeleton-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: 32px;
  padding: 18px 0;
}
.skeleton-row + .skeleton-row {
  border-top: 1px solid var(--divider-color);
}
.skeleton-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.panel-error {
  padding: 32px 0 20px;
}
@media (max-width: 767px) {
  .skeleton-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}
</style>
