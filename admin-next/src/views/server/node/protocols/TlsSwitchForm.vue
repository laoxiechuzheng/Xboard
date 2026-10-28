<script setup lang="ts">
// socks / naive / http: TLS on/off + TLS settings + ECH.
// socks has no TLS fields in the official admin; the backend and node config support them, so they are exposed here.
import { computed } from 'vue'
import { NFormItemGi, NGrid, NSelect } from 'naive-ui'
import TlsFields from '../blocks/TlsFields.vue'
import EchBlock from '../blocks/EchBlock.vue'
import type { TlsSwitchState } from '../protocol'
import type { NodeType } from '@/api/node'

const props = defineProps<{ settings: TlsSwitchState; type: NodeType }>()

const tlsOptions = [
  { label: '不支持', value: 0 },
  { label: '支持', value: 1 },
]

const sniPlaceholder = computed(() => (props.type === 'naive' ? '不使用请留空' : '当节点地址与证书不一致时用于证书验证'))
const insecureLabel = computed(() => (props.type === 'naive' ? '允许不安全?' : '允许不安全连接'))
</script>

<template>
  <n-grid cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi label="TLS">
      <n-select v-model:value="settings.tls" :options="tlsOptions" placeholder="请选择安全性" />
      <template v-if="type === 'socks'" #feedback>
        <span class="muted">官方后台未提供此项；后端与节点端支持 SOCKS over TLS</span>
      </template>
    </n-form-item-gi>
  </n-grid>
  <template v-if="settings.tls === 1">
    <tls-fields :tls="settings.tls_settings" :placeholder="sniPlaceholder" :insecure-label="insecureLabel" />
    <ech-block :ech="settings.tls_settings.ech" />
  </template>
</template>
