<script setup lang="ts">
// tls_settings / tls: SNI + allow insecure (mutates the passed object in place).
import { NFormItemGi, NGrid, NInput, NSwitch } from 'naive-ui'
import type { TlsState } from '../protocol'

withDefaults(
  defineProps<{
    tls: TlsState
    placeholder?: string
    insecureLabel?: string
  }>(),
  { placeholder: '不使用请留空', insecureLabel: '允许不安全?' },
)
</script>

<template>
  <n-grid cols="1 s:3" responsive="self" :x-gap="12">
    <n-form-item-gi :span="2" label="服务器名称指示(SNI)">
      <n-input v-model:value="tls.server_name" :placeholder="placeholder" clearable />
    </n-form-item-gi>
    <n-form-item-gi :label="insecureLabel">
      <n-switch v-model:value="tls.allow_insecure" />
    </n-form-item-gi>
  </n-grid>
</template>
