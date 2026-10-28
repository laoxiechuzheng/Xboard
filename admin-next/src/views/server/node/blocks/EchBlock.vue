<script setup lang="ts">
// Encrypted Client Hello settings with server-side key pair generation.
import { ref } from 'vue'
import { NButton, NFormItem, NIcon, NInput, NInputGroup, NSwitch } from 'naive-ui'
import { KeyOutline } from '@vicons/ionicons5'
import OptionCard from '../OptionCard.vue'
import type { EchState } from '../protocol'
import { generateEchKey } from '@/api/node'
import { confirm, message } from '@/utils/discrete'

const props = defineProps<{ ech: EchState }>()

const generating = ref(false)
// Outer SNI written into the generated ECHConfig. The official admin never sends it (always ech.example.com).
const publicName = ref('')

async function generate() {
  if ((props.ech.key || props.ech.config) &&
    !(await confirm({ title: '覆盖 ECH 配置', content: '将用新生成的密钥对覆盖当前的 ECH 配置与 Key，客户端需同步更新。确定继续吗？' }))) {
    return
  }
  generating.value = true
  try {
    const res = await generateEchKey(publicName.value.trim() || undefined)
    props.ech.key = res.key
    props.ech.config = res.config
    message.success('ECH 密钥对已生成')
  } catch {
    /* toast by http client */
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <option-card
    title="ECH"
    description="为支持的 TLS 客户端启用 Encrypted Client Hello。留空配置时会尝试通过 DNS 查询。"
    :open="ech.enabled"
  >
    <template #action>
      <n-switch v-model:value="ech.enabled" />
    </template>
    <n-form-item label="自动生成 ECH 密钥对" class="gen-item">
      <n-input-group>
        <n-input
          v-model:value="publicName"
          placeholder="外层 SNI (public_name)，可留空"
          maxlength="253"
          clearable
        />
        <n-button :loading="generating" secondary type="primary" @click="generate">
          <template #icon><n-icon><key-outline /></n-icon></template>
          生成
        </n-button>
      </n-input-group>
      <template #feedback>
        <span class="muted">由面板生成并填入下方配置与 Key；外层 SNI 留空时为 ech.example.com</span>
      </template>
    </n-form-item>
    <n-form-item label="ECH 配置 (PEM)">
      <template #feedback><span class="muted">留空时，sing-box 会尝试通过 DNS 加载 ECH 配置。</span></template>
      <n-input
        v-model:value="ech.config"
        type="textarea"
        class="mono-area"
        :autosize="{ minRows: 4, maxRows: 10 }"
        placeholder="粘贴 PEM 格式的 ECH 配置，每行一段内容"
      />
    </n-form-item>
    <n-form-item label="ECH Key">
      <template #feedback><span class="muted">后端需要时可填写的 ECH key 内容。</span></template>
      <n-input
        v-model:value="ech.key"
        type="textarea"
        class="mono-area"
        :autosize="{ minRows: 3, maxRows: 10 }"
        placeholder="当后端需要时粘贴 ECH key 内容"
      />
    </n-form-item>
    <n-form-item label="ECH 查询域名">
      <template #feedback><span class="muted">覆盖用于 ECH HTTPS 记录查询的域名，留空时默认使用 server_name。</span></template>
      <n-input v-model:value="ech.query_server_name" placeholder="可选，用于覆盖 HTTPS 记录查询域名" clearable />
    </n-form-item>
  </option-card>
</template>

<style scoped>
.gen-item {
  margin-bottom: 4px;
}
.mono-area :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 12px;
}
</style>
