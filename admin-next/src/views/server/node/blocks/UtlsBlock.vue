<script setup lang="ts">
// uTLS client fingerprint.
import { NFormItem, NSelect, NSwitch } from 'naive-ui'
import OptionCard from '../OptionCard.vue'
import { UTLS_FINGERPRINTS, type UtlsState } from '../protocol'

const props = defineProps<{ utls: UtlsState }>()

function toggle(v: boolean) {
  props.utls.enabled = v
  if (v && !props.utls.fingerprint) props.utls.fingerprint = 'chrome'
}
</script>

<template>
  <option-card title="uTLS" description="客户端伪装指纹，用于降低被识别风险" :open="utls.enabled">
    <template #action>
      <n-switch :value="utls.enabled" @update:value="toggle" />
    </template>
    <n-form-item label="客户端指纹 (uTLS)" :show-feedback="false">
      <n-select v-model:value="utls.fingerprint" :options="UTLS_FINGERPRINTS" />
    </n-form-item>
  </option-card>
</template>
