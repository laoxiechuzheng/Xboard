<script setup lang="ts">
// Inline text with a copy button.
import { NButton, NIcon, NEllipsis } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import { copyText } from '@/utils/clipboard'

withDefaults(defineProps<{ text: string; display?: string; maxWidth?: string; mono?: boolean }>(), {
  display: undefined,
  maxWidth: '100%',
  mono: false,
})
</script>

<template>
  <span class="copy-text" :style="{ maxWidth }">
    <n-ellipsis :class="['copy-label', { mono }]">{{ display ?? text }}</n-ellipsis>
    <n-button text size="tiny" class="copy-btn" title="复制" @click.stop="copyText(text)">
      <template #icon>
        <n-icon><copy-outline /></n-icon>
      </template>
    </n-button>
  </span>
</template>

<style scoped>
.copy-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
/* Shrink only when the container is narrower than the text. */
.copy-label {
  flex: 0 1 auto;
  min-width: 0;
  max-width: none;
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.copy-btn {
  flex: none;
  opacity: 0.6;
}
.copy-btn:hover {
  opacity: 1;
}
</style>
