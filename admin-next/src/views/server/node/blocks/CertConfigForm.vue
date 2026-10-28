<script setup lang="ts">
// Top-level cert_config (certificate provisioning on the node side).
import { computed } from 'vue'
import { NEmpty, NFormItem, NFormItemGi, NGrid, NIcon, NInput, NInputNumber, NSelect } from 'naive-ui'
import { ShieldOutline } from '@vicons/ionicons5'
import type { CertConfig } from '@/api/node'

const props = defineProps<{ cert: CertConfig }>()
const dnsEnvText = defineModel<string>('dnsEnvText', { required: true })

const modeOptions = [
  { label: 'none', value: 'none' },
  { label: 'http-01 (ACME)', value: 'http' },
  { label: 'dns-01 (ACME)', value: 'dns' },
  { label: 'self-signed', value: 'self' },
  { label: 'content (Cert Push)', value: 'content' },
]

const MODE_DESC: Record<string, string> = {
  none: '选择证书申请方式，仅部分后端节点支持',
  self: '自签名模式：仅需填写域名，证书由节点后端自动生成（10年有效期）',
  http: 'HTTP-01 模式：需要 80 端口可正常访问以完成认证',
  dns: 'DNS-01 模式：通过 DNS 解析记录认证，支持申请泛域名证书',
  content: '内容推送模式：直接将证书内容下发至节点',
}

const mode = computed(() => props.cert.cert_mode || 'none')
</script>

<template>
  <n-form-item label="证书模式">
    <n-select v-model:value="cert.cert_mode" :options="modeOptions" />
    <template #feedback><span class="muted">{{ MODE_DESC[mode] ?? MODE_DESC.none }}</span></template>
  </n-form-item>

  <n-empty v-if="mode === 'none'" description="未启用 TLS 证书配置" class="cert-empty">
    <template #icon><n-icon><shield-outline /></n-icon></template>
  </n-empty>

  <n-grid v-else cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi :span="['http', 'dns'].includes(mode) ? 1 : 2" label="证书域名">
      <n-input v-model:value="cert.domain" placeholder="example.com" clearable />
    </n-form-item-gi>
    <n-form-item-gi v-if="mode === 'http' || mode === 'dns'" label="通知邮箱">
      <n-input v-model:value="cert.email" placeholder="admin@example.com" clearable />
    </n-form-item-gi>
    <n-form-item-gi v-if="mode === 'http'" :span="2" label="认证端口">
      <n-input-number v-model:value="cert.http_port" :min="1" :max="65535" :precision="0" placeholder="80" style="width: 100%" />
      <template #feedback><span class="muted">ACME 认证端口 (默认 80)</span></template>
    </n-form-item-gi>
    <template v-if="mode === 'dns'">
      <n-form-item-gi :span="2" label="DNS 提供商">
        <n-input v-model:value="cert.dns_provider" placeholder="cloudflare / alidns / dnspod" clearable />
        <template #feedback>
          <a class="doc-link" href="https://go-acme.github.io/lego/dns/" target="_blank" rel="noopener noreferrer">
            查看 DNS 提供商配置指南
          </a>
        </template>
      </n-form-item-gi>
      <n-form-item-gi :span="2" label="环境变量 (API 密钥)">
        <n-input
          v-model:value="dnsEnvText"
          type="textarea"
          class="mono-area"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :placeholder="'CF_API_TOKEN=xxxxxx\nALIDNS_ACCESS_KEY_ID=xxxx'"
        />
        <template #feedback><span class="muted">每行一个 KEY=VALUE 配置</span></template>
      </n-form-item-gi>
    </template>
    <template v-if="mode === 'content'">
      <n-form-item-gi :span="2" label="证书内容 (Public Key)">
        <n-input
          v-model:value="cert.cert_content"
          type="textarea"
          class="mono-area"
          :autosize="{ minRows: 4, maxRows: 10 }"
          :placeholder="'-----BEGIN CERTIFICATE-----\n...'"
        />
      </n-form-item-gi>
      <n-form-item-gi :span="2" label="密钥内容 (Private Key)">
        <n-input
          v-model:value="cert.key_content"
          type="textarea"
          class="mono-area"
          :autosize="{ minRows: 4, maxRows: 10 }"
          :placeholder="'-----BEGIN RSA PRIVATE KEY-----\n...'"
        />
      </n-form-item-gi>
    </template>
  </n-grid>
</template>

<style scoped>
.cert-empty {
  padding: 24px 0 12px;
}
.doc-link {
  font-size: 12px;
  color: var(--primary-color);
  text-decoration: none;
}
.mono-area :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 12px;
}
</style>
