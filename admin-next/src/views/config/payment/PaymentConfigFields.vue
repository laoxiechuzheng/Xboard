<script setup lang="ts">
// Renders a payment plugin's dynamic config form (rendered inside the parent <n-form>).
import { NFormItem, NInput, NInputNumber, NSelect, NSwitch, NText } from 'naive-ui'
import CodeEditor from '@/components/CodeEditor.vue'
import type { ConfigField } from './payment-form'

const props = defineProps<{
  fields: ConfigField[]
  value: Record<string, unknown>
}>()
const emit = defineEmits<{ 'update:value': [Record<string, unknown>] }>()

function set(key: string, v: unknown) {
  emit('update:value', { ...props.value, [key]: v })
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}
</script>

<template>
  <n-form-item
    v-for="f in fields"
    :key="f.key"
    :label="f.label"
    :show-feedback="!!f.description"
    :label-props="{ for: `pay-cfg-${f.key}` }"
  >
    <div v-if="f.kind === 'switch'" class="switch-row">
      <span class="switch-text">{{ value[f.key] ? '已开启' : '已关闭' }}</span>
      <n-switch :value="!!value[f.key]" @update:value="(v: boolean) => set(f.key, v)" />
    </div>
    <n-input-number
      v-else-if="f.kind === 'number' || f.kind === 'percentage'"
      :value="num(value[f.key])"
      :placeholder="f.placeholder || undefined"
      :min="f.kind === 'percentage' ? 0 : undefined"
      :max="f.kind === 'percentage' ? 100 : undefined"
      clearable
      class="full"
      @update:value="(v: number | null) => set(f.key, v)"
    >
      <template v-if="f.kind === 'percentage'" #suffix>%</template>
    </n-input-number>
    <n-select
      v-else-if="f.kind === 'select'"
      :value="(value[f.key] as string | number | null | undefined) ?? null"
      :options="f.options"
      :placeholder="f.placeholder || '请选择'"
      clearable
      filterable
      @update:value="(v: unknown) => set(f.key, v)"
    />
    <code-editor
      v-else-if="f.kind === 'json' || f.kind === 'yaml'"
      :value="str(value[f.key])"
      :language="f.kind"
      :rows="7"
      :placeholder="f.placeholder"
      @update:value="(v: string) => set(f.key, v)"
    />
    <n-input
      v-else-if="f.kind === 'textarea'"
      type="textarea"
      :value="str(value[f.key])"
      :placeholder="f.placeholder || undefined"
      :autosize="{ minRows: 3, maxRows: 10 }"
      :input-props="{ id: `pay-cfg-${f.key}`, spellcheck: false }"
      class="mono-input"
      @update:value="(v: string) => set(f.key, v)"
    />
    <n-input
      v-else
      :type="f.kind === 'password' ? 'password' : 'text'"
      :show-password-on="f.kind === 'password' ? 'click' : undefined"
      :value="str(value[f.key])"
      :placeholder="f.placeholder || undefined"
      :input-props="{ id: `pay-cfg-${f.key}`, spellcheck: false, autocomplete: 'off' }"
      @update:value="(v: string) => set(f.key, v)"
    />
    <template v-if="f.description" #feedback>
      <n-text depth="3" class="hint">{{ f.description }}</n-text>
    </template>
  </n-form-item>
</template>

<style scoped>
.full {
  width: 100%;
}
.hint {
  font-size: 12px;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}
.switch-text {
  font-size: 13px;
  color: var(--text-muted);
}
.mono-input :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 12px;
}
</style>
