<script setup lang="ts">
// Lightweight code editor (monospace textarea) with optional JSON validation/formatting.
import { computed } from 'vue'
import { NInput, NButton, NText } from 'naive-ui'

const props = withDefaults(
  defineProps<{
    value: string | null | undefined
    language?: 'json' | 'yaml' | 'text' | 'html' | 'conf'
    rows?: number
    placeholder?: string
    readonly?: boolean
  }>(),
  { language: 'text', rows: 12, placeholder: '', readonly: false },
)
const emit = defineEmits<{ 'update:value': [string] }>()

const jsonError = computed(() => {
  if (props.language !== 'json' || !props.value || !props.value.trim()) return ''
  try {
    JSON.parse(props.value)
    return ''
  } catch (e) {
    return (e as Error).message
  }
})

function formatJson() {
  if (!props.value) return
  try {
    emit('update:value', JSON.stringify(JSON.parse(props.value), null, 2))
  } catch {
    /* keep as is */
  }
}
</script>

<template>
  <div class="code-editor">
    <n-input
      type="textarea"
      :value="value ?? ''"
      :rows="rows"
      :placeholder="placeholder"
      :readonly="readonly"
      :input-props="{ spellcheck: false, autocomplete: 'off' }"
      class="code-input"
      @update:value="(v: string) => emit('update:value', v)"
    />
    <div v-if="language === 'json'" class="code-footer">
      <n-text v-if="jsonError" type="error" class="code-status">JSON 格式错误：{{ jsonError }}</n-text>
      <n-text v-else depth="3" class="code-status">JSON</n-text>
      <n-button v-if="!readonly" size="tiny" quaternary :disabled="!!jsonError || !value" @click="formatJson">格式化</n-button>
    </div>
  </div>
</template>

<style scoped>
.code-editor {
  width: 100%;
}
.code-input :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.55;
  tab-size: 2;
  white-space: pre;
}
.code-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}
.code-status {
  font-size: 12px;
}
</style>
