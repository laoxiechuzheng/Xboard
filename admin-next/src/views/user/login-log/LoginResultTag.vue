<script setup lang="ts">
// 成功 is quiet (dot + text); 失败 is an error-toned pill so failed attempts stand out in long lists.
import { NIcon } from 'naive-ui'
import { AlertCircleOutline } from '@vicons/ionicons5'

defineProps<{ success: boolean }>()
</script>

<template>
  <span v-if="success" class="ok"><span class="dot" />成功</span>
  <span v-else class="fail" title="密码错误的登录尝试">
    <n-icon :size="13"><alert-circle-outline /></n-icon>
    失败
  </span>
</template>

<style scoped>
.ok {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-color);
  white-space: nowrap;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success-color) 20%, transparent);
}
.fail {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px 0 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  color: var(--error-color);
  background: color-mix(in srgb, var(--error-color) 13%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error-color) 28%, transparent);
}
</style>
