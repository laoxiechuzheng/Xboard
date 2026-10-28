<script setup lang="ts">
// README rendered as safe Markdown (raw HTML escaped, unsafe links dropped).
import { computed } from 'vue'
import { NEmpty } from 'naive-ui'
import { renderSafeMarkdown } from '@/views/plugin/markdown'

const props = withDefaults(defineProps<{ source?: string | null; emptyText?: string; maxHeight?: string }>(), {
  source: '',
  emptyText: '该插件没有提供文档。',
  maxHeight: '60vh',
})

const html = computed(() => renderSafeMarkdown(props.source))
</script>

<template>
  <!-- Raw HTML is escaped by renderSafeMarkdown. -->
  <div v-if="html" class="readme markdown-body" :style="{ maxHeight }" v-html="html" />
  <n-empty v-else :description="emptyText" class="readme-empty" />
</template>

<style scoped>
.readme {
  overflow: auto;
  padding-right: 4px;
}
.readme :deep(h1) {
  font-size: 20px;
  margin: 0 0 12px;
}
.readme :deep(h2) {
  font-size: 17px;
  margin: 20px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--divider-color);
}
.readme :deep(h3) {
  font-size: 15px;
  margin: 16px 0 8px;
}
.readme :deep(p),
.readme :deep(ul),
.readme :deep(ol) {
  margin: 8px 0;
}
.readme :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  margin: 8px 0;
}
.readme :deep(a) {
  color: var(--primary-color);
}
.readme :deep(:not(pre) > code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--code-bg);
}
.readme-empty {
  padding: 24px 0;
}
</style>
