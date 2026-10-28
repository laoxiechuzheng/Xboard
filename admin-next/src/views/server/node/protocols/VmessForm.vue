<script setup lang="ts">
import { NFormItemGi, NGi, NGrid, NSelect } from 'naive-ui'
import TlsFields from '../blocks/TlsFields.vue'
import UtlsBlock from '../blocks/UtlsBlock.vue'
import EchBlock from '../blocks/EchBlock.vue'
import NetworkField from '../blocks/NetworkField.vue'
import { VMESS_NETWORKS, type VmessState } from '../protocol'

defineProps<{ settings: VmessState }>()

const tlsOptions = [
  { label: 'None', value: 0 },
  { label: 'TLS', value: 1 },
]
</script>

<template>
  <n-grid cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi label="TLS">
      <n-select v-model:value="settings.tls" :options="tlsOptions" placeholder="请选择安全性" />
    </n-form-item-gi>
    <n-gi>
      <network-field :settings="settings" :options="VMESS_NETWORKS" />
    </n-gi>
  </n-grid>
  <template v-if="settings.tls === 1">
    <tls-fields :tls="settings.tls_settings" placeholder="不使用请留空" />
    <utls-block :utls="settings.utls" />
    <ech-block :ech="settings.tls_settings.ech" />
  </template>
</template>
