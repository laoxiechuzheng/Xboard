<script setup lang="ts">
import { NButton, NFormItemGi, NGrid, NIcon, NInput, NInputGroup, NSelect, NTooltip, type FormItemRule } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import LabelTip from '../LabelTip.vue'
import type { MieruState } from '../protocol'
import { generateMieruTrafficPattern } from '../crypto'
import { message } from '@/utils/discrete'

const props = defineProps<{ settings: MieruState }>()

const transportOptions = [
  { label: 'TCP', value: 'TCP' },
  { label: 'UDP', value: 'UDP' },
]

function gen() {
  props.settings.traffic_pattern = generateMieruTrafficPattern()
  message.success('流量模式已生成')
}

const patternRule: FormItemRule = {
  trigger: ['input', 'blur'],
  validator: (_: unknown, v: string) => {
    if (!v || !v.trim()) return true
    return /^[A-Za-z0-9+/]+={0,2}$/.test(v.trim()) ? true : new Error('请输入有效的 Base64 字符串')
  },
}
</script>

<template>
  <n-grid cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi label="传输协议">
      <n-select v-model:value="settings.transport" :options="transportOptions" placeholder="选择传输协议" />
    </n-form-item-gi>
    <n-form-item-gi path="protocol_settings.traffic_pattern" :rule="patternRule">
      <template #label>
        <label-tip label="流量 (Base64)" tip="用于微调网络行为的流量模式，可点击右侧按钮随机生成；留空则不下发" />
      </template>
      <n-input-group>
        <n-input v-model:value="settings.traffic_pattern" class="mono-input" placeholder="请输入 Base64 字符串用于微调网络行为" />
        <n-tooltip>
          <template #trigger>
            <n-button secondary @click="gen">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          随机生成流量模式
        </n-tooltip>
      </n-input-group>
    </n-form-item-gi>
  </n-grid>
</template>

<style scoped>
.mono-input :deep(input) {
  font-family: var(--font-mono);
  font-size: 12.5px;
}
</style>
