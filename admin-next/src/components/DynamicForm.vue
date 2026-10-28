<script setup lang="ts">
// Renders a form from normalized field descriptors. Pages adapt backend-specific
// descriptor formats (plugin config.json, payment forms, theme configs) to DynamicField.
import { NForm, NFormItem, NInput, NInputNumber, NSwitch, NSelect, NDynamicTags, NText } from 'naive-ui'
import CodeEditor from '@/components/CodeEditor.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import type { DynamicField } from '@/components/dynamic-form'

const props = withDefaults(
  defineProps<{
    fields: DynamicField[]
    value: Record<string, any>
    labelPlacement?: 'top' | 'left'
    labelWidth?: number | string
    disabled?: boolean
  }>(),
  { labelPlacement: 'top', labelWidth: 'auto', disabled: false },
)
const emit = defineEmits<{ 'update:value': [Record<string, any>] }>()

// Updates made in the same tick merge into one pending object, so a later set()
// cannot overwrite an earlier one before the parent has passed the new value back.
let pending: Record<string, any> | null = null
function set(key: string, v: unknown) {
  pending = { ...(pending ?? props.value), [key]: v }
  emit('update:value', pending)
  const sent = pending
  queueMicrotask(() => {
    if (pending === sent) pending = null
  })
}
</script>

<template>
  <n-form :label-placement="labelPlacement" :label-width="labelWidth" :disabled="disabled" class="dynamic-form">
    <n-form-item
      v-for="f in fields"
      :key="f.key"
      :label="f.label || f.key"
      :required="f.required"
      :show-feedback="!!f.description"
    >
      <n-switch
        v-if="f.type === 'switch'"
        :value="!!value[f.key] && value[f.key] !== '0'"
        @update:value="(v: boolean) => set(f.key, f.switchAsNumber ? (v ? 1 : 0) : v)"
      />
      <n-input-number
        v-else-if="f.type === 'number'"
        :value="value[f.key] === '' || value[f.key] === null || value[f.key] === undefined ? null : Number(value[f.key])"
        :placeholder="f.placeholder"
        :min="f.min"
        :max="f.max"
        style="width: 100%"
        @update:value="(v: number | null) => set(f.key, v)"
      />
      <n-select
        v-else-if="f.type === 'select' || f.type === 'multi-select'"
        :value="value[f.key] ?? null"
        :options="f.options || []"
        :multiple="f.type === 'multi-select'"
        :placeholder="f.placeholder || '请选择'"
        :clearable="f.clearable !== false"
        filterable
        @update:value="(v: unknown) => set(f.key, v)"
      />
      <n-dynamic-tags
        v-else-if="f.type === 'tags'"
        :value="Array.isArray(value[f.key]) ? value[f.key] : []"
        @update:value="(v: string[]) => set(f.key, v)"
      />
      <code-editor
        v-else-if="f.type === 'json' || f.type === 'code'"
        :value="typeof value[f.key] === 'string' ? value[f.key] : value[f.key] == null ? '' : JSON.stringify(value[f.key], null, 2)"
        :language="f.type === 'json' ? 'json' : (f.language ?? 'text')"
        :rows="f.rows || 8"
        :placeholder="f.placeholder"
        @update:value="(v: string) => set(f.key, v)"
      />
      <markdown-editor
        v-else-if="f.type === 'markdown'"
        :value="value[f.key]"
        :rows="f.rows || 10"
        @update:value="(v: string) => set(f.key, v)"
      />
      <n-input
        v-else
        :type="f.type === 'textarea' ? 'textarea' : f.type === 'password' ? 'password' : 'text'"
        :show-password-on="f.type === 'password' ? 'click' : undefined"
        :value="value[f.key] == null ? '' : String(value[f.key])"
        :rows="f.rows || 4"
        :placeholder="f.placeholder"
        @update:value="(v: string) => set(f.key, v)"
      />
      <template v-if="f.description" #feedback>
        <n-text depth="3" style="font-size: 12px">{{ f.description }}</n-text>
      </template>
    </n-form-item>
  </n-form>
</template>

<style scoped>
/* Items without a description render no feedback row; keep consistent spacing. */
.dynamic-form :deep(.n-form-item:not(:has(.n-form-item-feedback-wrapper))) {
  margin-bottom: var(--n-feedback-height, 24px);
}
</style>
