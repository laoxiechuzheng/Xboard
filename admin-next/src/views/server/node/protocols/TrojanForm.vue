<script setup lang="ts">
import { NFormItemGi, NGi, NGrid, NSelect } from 'naive-ui'
import TlsFields from '../blocks/TlsFields.vue'
import UtlsBlock from '../blocks/UtlsBlock.vue'
import EchBlock from '../blocks/EchBlock.vue'
import RealityBlock from '../blocks/RealityBlock.vue'
import NetworkField from '../blocks/NetworkField.vue'
import { TROJAN_NETWORKS, type TrojanState } from '../protocol'

defineProps<{ settings: TrojanState }>()

const tlsOptions = [
  { label: 'TLS', value: 1 },
  { label: 'Reality', value: 2 },
]
</script>

<template>
  <n-grid cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi label="安全性">
      <n-select v-model:value="settings.tls" :options="tlsOptions" placeholder="请选择安全性" />
    </n-form-item-gi>
    <n-gi>
      <network-field :settings="settings" :options="TROJAN_NETWORKS" />
    </n-gi>
  </n-grid>

  <tls-fields
    v-if="settings.tls !== 2"
    :tls="settings.tls_settings"
    placeholder="当节点地址与证书不一致时用于证书验证"
  />
  <reality-block v-else :reality="settings.reality_settings" />
  <utls-block :utls="settings.utls" />
  <!-- ECH only applies to the TLS mode; Reality ignores tls_settings. -->
  <ech-block v-if="settings.tls !== 2" :ech="settings.tls_settings.ech" />
</template>
