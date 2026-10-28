<script setup lang="ts">
// Loading / error / content switch for one status block; a failed block never affects the others.
import { NSpin, NButton, NIcon } from 'naive-ui'
import { AlertCircle } from '@vicons/ionicons5'

withDefaults(defineProps<{ loading: boolean; error: string; hasData: boolean; minHeight?: string }>(), {
  minHeight: '120px',
})
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="!hasData && error && !loading" class="section-state error" :style="{ minHeight }">
    <n-icon :size="20"><alert-circle /></n-icon>
    <span>加载失败：{{ error }}</span>
    <n-button size="small" @click="emit('retry')">点击重试</n-button>
  </div>
  <div v-else-if="!hasData" class="section-state" :style="{ minHeight }">
    <n-spin size="small" />
  </div>
  <template v-else>
    <slot />
    <div v-if="error" class="stale">
      刷新失败：{{ error }}，当前显示的是上次成功获取的数据。
      <n-button text type="primary" size="tiny" @click="emit('retry')">重试</n-button>
    </div>
  </template>
</template>

<style scoped>
.section-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  text-align: center;
}
.section-state.error {
  color: var(--error-color);
}
.stale {
  margin-top: 10px;
  font-size: 12px;
  color: var(--warning-color);
}
</style>
