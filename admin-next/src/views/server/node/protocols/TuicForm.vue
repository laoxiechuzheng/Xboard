<script setup lang="ts">
import { NFormItemGi, NGrid, NSelect } from 'naive-ui'
import TlsFields from '../blocks/TlsFields.vue'
import EchBlock from '../blocks/EchBlock.vue'
import type { TuicState } from '../protocol'

defineProps<{ settings: TuicState }>()

const versionOptions = [
  { label: 'V5', value: 5 },
  { label: 'V4', value: 4 },
]
const ccOptions = ['bbr', 'cubic', 'new_reno'].map((v) => ({ label: v.toUpperCase(), value: v }))
const alpnOptions = [
  { label: 'HTTP/3', value: 'h3' },
  { label: 'HTTP/2', value: 'h2' },
  { label: 'HTTP/1.1', value: 'http/1.1' },
]
const udpOptions = [
  { label: 'Native', value: 'native' },
  { label: 'QUIC', value: 'quic' },
]
</script>

<template>
  <n-grid cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi label="协议版本">
      <n-select v-model:value="settings.version" :options="versionOptions" placeholder="选择TUIC版本" />
    </n-form-item-gi>
    <n-form-item-gi label="拥塞控制">
      <n-select v-model:value="settings.congestion_control" :options="ccOptions" placeholder="选择拥塞控制算法" />
    </n-form-item-gi>
    <n-form-item-gi label="ALPN">
      <n-select v-model:value="settings.alpn" :options="alpnOptions" multiple placeholder="选择ALPN协议">
        <template #empty><span class="muted">未找到可用的ALPN协议</span></template>
      </n-select>
    </n-form-item-gi>
    <n-form-item-gi label="UDP中继模式">
      <n-select v-model:value="settings.udp_relay_mode" :options="udpOptions" placeholder="选择UDP中继模式" />
    </n-form-item-gi>
  </n-grid>
  <tls-fields :tls="settings.tls" placeholder="当节点地址与证书不一致时用于证书验证" />
  <ech-block :ech="settings.tls.ech" />
</template>
