<script setup lang="ts">
import { NButton, NFormItemGi, NGrid, NIcon, NInput, NInputGroup, NInputNumber, NSelect, NSwitch, NTooltip } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import TlsFields from '../blocks/TlsFields.vue'
import EchBlock from '../blocks/EchBlock.vue'
import OptionCard from '../OptionCard.vue'
import type { HysteriaState } from '../protocol'
import { generatePassword } from '../crypto'
import { message } from '@/utils/discrete'

const props = defineProps<{ settings: HysteriaState }>()

const versionOptions = [
  { label: 'V1', value: 1 },
  { label: 'V2', value: 2 },
]
const obfsTypeOptions = [{ label: 'Salamander', value: 'salamander' }]

function genPassword() {
  props.settings.obfs.password = generatePassword(16)
  message.success('混淆密码生成成功')
}
</script>

<template>
  <n-grid cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi label="协议版本">
      <n-select v-model:value="settings.version" :options="versionOptions" />
    </n-form-item-gi>
    <n-form-item-gi label="Hop 间隔 (秒)">
      <n-input-number v-model:value="settings.hop_interval" :min="0" :precision="0" clearable placeholder="例如: 30" style="width: 100%" />
      <template #feedback><span class="muted">Hop 间隔时间，单位为秒；端口跳跃请把连接端口写成区间，如 20000-30000</span></template>
    </n-form-item-gi>
    <n-form-item-gi label="上行宽带">
      <n-input-number
        v-model:value="settings.bandwidth.up"
        :min="0"
        :precision="0"
        clearable
        :placeholder="settings.version === 2 ? '请输入上行宽带，留空则使用BBR' : '请输入上行宽带'"
        style="width: 100%"
      >
        <template #suffix>Mbps</template>
      </n-input-number>
    </n-form-item-gi>
    <n-form-item-gi label="下行宽带">
      <n-input-number
        v-model:value="settings.bandwidth.down"
        :min="0"
        :precision="0"
        clearable
        :placeholder="settings.version === 2 ? '请输入下行宽带，留空则使用BBR' : '请输入下行宽带'"
        style="width: 100%"
      >
        <template #suffix>Mbps</template>
      </n-input-number>
    </n-form-item-gi>
  </n-grid>

  <option-card title="混淆" description="启用后客户端需使用相同的混淆密码" :open="settings.obfs.open">
    <template #action>
      <n-switch v-model:value="settings.obfs.open" />
    </template>
    <n-grid cols="1 s:2" responsive="self" :x-gap="12">
      <n-form-item-gi v-if="settings.version === 2" label="混淆实现">
        <n-select v-model:value="settings.obfs.type" :options="obfsTypeOptions" placeholder="选择混淆实现" />
      </n-form-item-gi>
      <n-form-item-gi :span="settings.version === 2 ? 1 : 2" label="混淆密码">
        <n-input-group>
          <n-input v-model:value="settings.obfs.password" placeholder="请输入混淆密码" class="mono-input" />
          <n-tooltip>
            <template #trigger>
              <n-button secondary @click="genPassword">
                <template #icon><n-icon><refresh-outline /></n-icon></template>
              </n-button>
            </template>
            生成随机密码
          </n-tooltip>
        </n-input-group>
      </n-form-item-gi>
    </n-grid>
  </option-card>

  <tls-fields :tls="settings.tls" placeholder="当节点地址与证书不一致时用于证书验证" />
  <ech-block :ech="settings.tls.ech" />
</template>

<style scoped>
.mono-input :deep(input) {
  font-family: var(--font-mono);
  font-size: 12.5px;
}
</style>
