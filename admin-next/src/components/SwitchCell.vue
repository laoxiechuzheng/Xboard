<script setup lang="ts">
// Table-cell switch that persists immediately; shows a spinner and reverts on failure.
import { ref, watch } from 'vue'
import { NSwitch } from 'naive-ui'

const props = withDefaults(
  defineProps<{
    value: boolean | number | string | null | undefined
    /** Persist the new value; throw/reject to revert. */
    onChange: (v: boolean) => Promise<unknown>
    size?: 'small' | 'medium'
    disabled?: boolean
  }>(),
  { size: 'small', disabled: false },
)

const toBool = (v: unknown) => v === true || v === 1 || v === '1'
const local = ref(toBool(props.value))
const loading = ref(false)

watch(
  () => props.value,
  (v) => (local.value = toBool(v)),
)

async function update(v: boolean) {
  const prev = local.value
  local.value = v
  loading.value = true
  try {
    await props.onChange(v)
  } catch {
    local.value = prev
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <n-switch :value="local" :loading="loading" :size="size" :disabled="disabled" @update:value="update" @click.stop />
</template>
