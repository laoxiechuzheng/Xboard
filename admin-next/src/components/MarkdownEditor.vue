<script setup lang="ts">
// Markdown editor with live preview (edit / split / preview).
import { computed, ref } from 'vue'
import { NInput, NRadioGroup, NRadioButton } from 'naive-ui'
import { marked } from 'marked'
import { sanitizeHtml } from '@/utils/sanitize'

const props = withDefaults(
  defineProps<{
    value: string | null | undefined
    rows?: number
    placeholder?: string
    /** Applied to the preview source only (e.g. expand {{placeholders}}); v-model is untouched. */
    previewTransform?: (src: string) => string
  }>(),
  { rows: 16, placeholder: '支持 Markdown 与 HTML', previewTransform: undefined },
)
const emit = defineEmits<{ 'update:value': [string] }>()

const mode = ref<'edit' | 'split' | 'preview'>('split')
const html = computed(() => {
  try {
    const src = props.value || ''
    // The admin page holds the admin token, so author HTML is sanitized before v-html.
    // breaks:false matches the user theme's markdown-it defaults.
    const out = marked.parse(props.previewTransform ? props.previewTransform(src) : src, {
      async: false,
      gfm: true,
      breaks: false,
    }) as string
    return sanitizeHtml(out)
  } catch {
    return ''
  }
})
</script>

<template>
  <div class="md-editor">
    <div class="md-toolbar">
      <n-radio-group v-model:value="mode" size="small">
        <n-radio-button value="edit">编辑</n-radio-button>
        <n-radio-button value="split">分屏</n-radio-button>
        <n-radio-button value="preview">预览</n-radio-button>
      </n-radio-group>
    </div>
    <div class="md-panes" :class="mode">
      <n-input
        v-if="mode !== 'preview'"
        type="textarea"
        :value="value ?? ''"
        :rows="rows"
        :placeholder="placeholder"
        :input-props="{ spellcheck: false }"
        class="md-input"
        @update:value="(v: string) => emit('update:value', v)"
      />
      <!-- Sanitized preview of admin-authored content. -->
      <div v-if="mode !== 'edit'" class="md-preview markdown-body" v-html="html" />
    </div>
  </div>
</template>

<style scoped>
.md-editor {
  width: 100%;
}
.md-toolbar {
  margin-bottom: 8px;
}
.md-panes {
  display: grid;
  gap: 12px;
}
.md-panes.split {
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 900px) {
  .md-panes.split {
    grid-template-columns: 1fr;
  }
}
.md-input :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
}
.md-preview {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
  overflow: auto;
  max-height: 560px;
  min-height: 120px;
}
</style>
