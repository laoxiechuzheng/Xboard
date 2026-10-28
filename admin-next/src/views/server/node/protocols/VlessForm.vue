<script setup lang="ts">
import { computed } from 'vue'
import { NFormItemGi, NGi, NGrid, NInput, NSelect, NSwitch } from 'naive-ui'
import TlsFields from '../blocks/TlsFields.vue'
import UtlsBlock from '../blocks/UtlsBlock.vue'
import EchBlock from '../blocks/EchBlock.vue'
import RealityBlock from '../blocks/RealityBlock.vue'
import NetworkField from '../blocks/NetworkField.vue'
import OptionCard from '../OptionCard.vue'
import { VLESS_NETWORKS, type VlessState } from '../protocol'

const props = defineProps<{ settings: VlessState }>()

const tlsOptions = [
  { label: '无', value: 0 },
  { label: 'TLS', value: 1 },
  { label: 'Reality', value: 2 },
]

const FLOWS = ['xtls-rprx-direct', 'xtls-rprx-splice', 'xtls-rprx-vision']

const flow = computed({
  get: () => props.settings.flow || 'none',
  set: (v: string) => {
    props.settings.flow = v === 'none' ? '' : v
  },
})

const flowOptions = computed(() => {
  const opts = [{ label: 'none', value: 'none' }, ...FLOWS.map((f) => ({ label: f, value: f }))]
  const cur = props.settings.flow
  if (cur && !FLOWS.includes(cur)) opts.push({ label: cur, value: cur })
  return opts
})
</script>

<template>
  <n-grid cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi label="安全性">
      <n-select v-model:value="settings.tls" :options="tlsOptions" placeholder="请选择安全性" />
    </n-form-item-gi>
    <n-gi>
      <network-field :settings="settings" :options="VLESS_NETWORKS" />
    </n-gi>
    <n-form-item-gi :span="2" label="流控">
      <n-select v-model:value="flow" :options="flowOptions" placeholder="选择流控" />
    </n-form-item-gi>
  </n-grid>

  <template v-if="settings.tls === 1">
    <tls-fields :tls="settings.tls_settings" placeholder="不使用请留空" />
    <utls-block :utls="settings.utls" />
    <ech-block :ech="settings.tls_settings.ech" />
  </template>
  <template v-else-if="settings.tls === 2">
    <reality-block :reality="settings.reality_settings" />
    <utls-block :utls="settings.utls" />
  </template>

  <option-card title="VLESS Encryption" description="启用 VLESS 加密" :open="settings.encryption.enabled">
    <template #action>
      <n-switch v-model:value="settings.encryption.enabled" />
    </template>
    <n-grid cols="1" :x-gap="12">
      <n-form-item-gi label="decryption">
        <n-input v-model:value="settings.encryption.decryption" class="mono-input" placeholder="./xray vlessenc 生成" />
        <template #feedback><span class="muted">服务端使用（下发给节点）</span></template>
      </n-form-item-gi>
      <n-form-item-gi label="encryption">
        <n-input v-model:value="settings.encryption.encryption" class="mono-input" placeholder="./xray vlessenc 生成" />
        <template #feedback><span class="muted">客户端使用（写入订阅）</span></template>
      </n-form-item-gi>
    </n-grid>
    <em class="muted enc-tip">* ./xray vlessenc 生成</em>
  </option-card>
</template>

<style scoped>
.mono-input :deep(input) {
  font-family: var(--font-mono);
  font-size: 12.5px;
}
.enc-tip {
  font-size: 12px;
}
</style>
