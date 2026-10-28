<script setup lang="ts">
// Reality (vless / trojan with tls=2). Key pair and short id are generated locally.
import { NButton, NFormItemGi, NGrid, NIcon, NInput, NInputGroup, NSwitch, NTooltip, type FormItemRule } from 'naive-ui'
import { KeyOutline, RefreshOutline } from '@vicons/ionicons5'
import OptionCard from '../OptionCard.vue'
import type { RealityState } from '../protocol'
import { generateRealityKeyPair, generateShortId } from '../crypto'
import { confirm, message } from '@/utils/discrete'

const props = defineProps<{ reality: RealityState }>()

async function genKeyPair() {
  if (
    props.reality.private_key &&
    !(await confirm({
      title: '重新生成密钥对',
      content: '将覆盖当前的私钥与公钥，保存后使用旧公钥的客户端将无法连接，需要重新获取订阅。确定继续吗？',
    }))
  ) {
    return
  }
  try {
    const kp = generateRealityKeyPair()
    props.reality.private_key = kp.privateKey
    props.reality.public_key = kp.publicKey
    message.success('密钥对生成成功')
  } catch {
    message.error('生成密钥对失败')
  }
}

function genShortId() {
  props.reality.short_id = generateShortId()
  message.success('Short ID 生成成功')
}

const shortIdRule: FormItemRule = {
  trigger: ['input', 'blur'],
  validator: (_: unknown, v: string) => {
    if (!v) return true
    if (!/^[0-9a-fA-F]*$/.test(v)) return new Error('Short ID 只能包含 0-9、a-f 的十六进制字符')
    if (v.length % 2 !== 0 || v.length > 16) return new Error('Short ID 长度须为 2 的倍数，最长 16 位')
    return true
  },
}

const portRule: FormItemRule = {
  trigger: ['input', 'blur'],
  validator: (_: unknown, v: string) => {
    if (v === '' || v === null || v === undefined) return true
    const n = Number(v)
    return Number.isInteger(n) && n >= 1 && n <= 65535 ? true : new Error('端口须为 1-65535 的整数')
  },
}
</script>

<template>
  <option-card title="Reality" description="伪装站点与密钥配置，客户端使用公钥与 Short ID 连接">
    <n-grid cols="1 s:3" responsive="self" :x-gap="12">
      <n-form-item-gi :span="2" label="伪装站点(dest)">
        <n-input v-model:value="reality.server_name" placeholder="例如：example.com" clearable />
      </n-form-item-gi>
      <n-form-item-gi label="端口(port)" :rule="portRule" path="protocol_settings.reality_settings.server_port">
        <n-input v-model:value="reality.server_port" placeholder="例如：443" class="mono-input" />
      </n-form-item-gi>
      <n-form-item-gi :span="3" label="允许不安全?">
        <n-switch v-model:value="reality.allow_insecure" />
      </n-form-item-gi>
      <n-form-item-gi :span="3" label="私钥(Private key)">
        <n-input-group>
          <n-input v-model:value="reality.private_key" class="mono-input" placeholder="点击右侧按钮生成密钥对" />
          <n-tooltip>
            <template #trigger>
              <n-button secondary @click="genKeyPair">
                <template #icon><n-icon><key-outline /></n-icon></template>
              </n-button>
            </template>
            生成密钥对
          </n-tooltip>
        </n-input-group>
      </n-form-item-gi>
      <n-form-item-gi :span="3" label="公钥(Public key)">
        <n-input v-model:value="reality.public_key" class="mono-input" />
      </n-form-item-gi>
      <n-form-item-gi :span="3" label="Short ID" :rule="shortIdRule" path="protocol_settings.reality_settings.short_id">
        <n-input-group>
          <n-input v-model:value="reality.short_id" class="mono-input" placeholder="可留空，长度为2的倍数，最长16位" />
          <n-tooltip>
            <template #trigger>
              <n-button secondary @click="genShortId">
                <template #icon><n-icon><refresh-outline /></n-icon></template>
              </n-button>
            </template>
            生成 Short ID
          </n-tooltip>
        </n-input-group>
      </n-form-item-gi>
    </n-grid>
    <div class="muted hint">客户端可用的 shortId 列表，可用于区分不同的客户端，使用0-f的十六进制字符</div>
  </option-card>
</template>

<style scoped>
.mono-input :deep(input) {
  font-family: var(--font-mono);
  font-size: 12.5px;
}
.hint {
  font-size: 12px;
  margin-top: -6px;
}
</style>
