<script setup lang="ts">
// Read-only monospace block with a title bar and copy button (exceptions, payloads, request bodies).
import { NButton, NIcon } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import { copyText } from '@/utils/clipboard'

withDefaults(
  defineProps<{ code: string; title?: string; tone?: 'default' | 'error'; maxHeight?: string; wrap?: boolean }>(),
  { title: '', tone: 'default', maxHeight: '240px', wrap: false },
)
</script>

<template>
  <div class="code-block" :class="tone">
    <div class="code-head">
      <span class="code-title">{{ title }}</span>
      <n-button size="tiny" quaternary :disabled="!code" @click="copyText(code)">
        <template #icon>
          <n-icon><copy-outline /></n-icon>
        </template>
        复制
      </n-button>
    </div>
    <pre :class="{ wrap }" :style="{ maxHeight }">{{ code || '（空）' }}</pre>
  </div>
</template>

<style scoped>
.code-block {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--code-bg);
}
.code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px 4px 12px;
  border-bottom: 1px solid var(--border-color);
}
.code-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.code-block.error {
  border-color: color-mix(in srgb, var(--error-color) 35%, transparent);
  background: color-mix(in srgb, var(--error-color) 7%, var(--card-color));
}
.code-block.error .code-head {
  border-bottom-color: color-mix(in srgb, var(--error-color) 25%, transparent);
}
.code-block.error pre {
  color: var(--error-color);
}
pre {
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre;
  color: var(--text-color);
}
pre.wrap {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
