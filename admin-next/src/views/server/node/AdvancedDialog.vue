<script setup lang="ts">
// "高级协议配置": certificate, multiplex, custom outbounds / routes.
// Edits a local copy; nothing is applied to the node form until "保存" (the official dialog applied TLS/MUX instantly).
import { computed, ref, watch } from 'vue'
import { NButton, NForm, NModal, NSpace, NTabPane, NTabs, NText } from 'naive-ui'
import CodeEditor from '@/components/CodeEditor.vue'
import CertConfigForm from './blocks/CertConfigForm.vue'
import MultiplexBlock from './blocks/MultiplexBlock.vue'
import { CERT_TYPES, MULTIPLEX_TYPES } from './meta'
import type { MultiplexState } from './protocol'
import type { CertConfig, NodeType } from '@/api/node'

export type AdvancedTab = 'tls' | 'multiplex' | 'outbounds' | 'routes'

export interface AdvancedResult {
  certConfig: CertConfig | null
  multiplex: MultiplexState | null
  customOutbounds: unknown[]
  customRoutes: unknown[]
}

const props = defineProps<{
  show: boolean
  type: NodeType
  initialTab?: AdvancedTab | null
  certConfig: CertConfig | null
  multiplex: MultiplexState | null
  customOutbounds: unknown[]
  customRoutes: unknown[]
}>()
const emit = defineEmits<{ 'update:show': [boolean]; save: [AdvancedResult] }>()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const defaultCert = (): CertConfig => ({
  cert_mode: 'none',
  domain: '',
  email: '',
  http_port: 80,
  dns_provider: '',
  dns_env: {},
  cert_content: '',
  key_content: '',
})

const hasCert = computed(() => CERT_TYPES.includes(props.type))
const hasMux = computed(() => MULTIPLEX_TYPES.includes(props.type) && !!props.multiplex)

const tab = ref<AdvancedTab>('outbounds')
const cert = ref<CertConfig>(defaultCert())
const dnsEnvText = ref('')
const mux = ref<MultiplexState | null>(null)
const outboundsText = ref('')
const routesText = ref('')
const outboundsError = ref('')
const routesError = ref('')

function envToText(env: unknown): string {
  if (!env || typeof env !== 'object') return ''
  return Object.entries(env as Record<string, unknown>)
    .map(([k, v]) => `${k}=${v ?? ''}`)
    .join('\n')
}

function textToEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf('=')
    if (i <= 0) continue
    const k = line.slice(0, i).trim()
    if (k) out[k] = line.slice(i + 1).trim()
  }
  return out
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    cert.value = { ...defaultCert(), ...(props.certConfig ? clone(props.certConfig) : {}) }
    if (!cert.value.cert_mode && typeof cert.value.mode === 'string') cert.value.cert_mode = cert.value.mode
    dnsEnvText.value = envToText(cert.value.dns_env)
    mux.value = props.multiplex ? clone(props.multiplex) : null
    outboundsText.value = props.customOutbounds?.length ? JSON.stringify(props.customOutbounds, null, 2) : ''
    routesText.value = props.customRoutes?.length ? JSON.stringify(props.customRoutes, null, 2) : ''
    outboundsError.value = ''
    routesError.value = ''
    const wanted = props.initialTab
    if (wanted && (wanted !== 'tls' || hasCert.value) && (wanted !== 'multiplex' || hasMux.value)) tab.value = wanted
    else tab.value = hasCert.value ? 'tls' : hasMux.value ? 'multiplex' : 'outbounds'
  },
)

function parseArray(text: string): { value: unknown[]; error: string } {
  const t = text.trim()
  if (!t) return { value: [], error: '' }
  try {
    const v = JSON.parse(t)
    return Array.isArray(v) ? { value: v, error: '' } : { value: [], error: '必须是一个 JSON 数组 []' }
  } catch {
    return { value: [], error: '无效的 JSON 格式' }
  }
}

function save() {
  const ob = parseArray(outboundsText.value)
  const rt = parseArray(routesText.value)
  outboundsError.value = ob.error
  routesError.value = rt.error
  if (ob.error || rt.error) {
    tab.value = ob.error ? 'outbounds' : 'routes'
    return
  }
  const certOut: CertConfig = { ...cert.value, dns_env: textToEnv(dnsEnvText.value) }
  delete certOut.mode
  emit('save', {
    certConfig: hasCert.value ? certOut : props.certConfig,
    multiplex: mux.value,
    customOutbounds: ob.value,
    customRoutes: rt.value,
  })
  emit('update:show', false)
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="高级协议配置"
    :mask-closable="false"
    :style="{ width: 'min(680px, calc(100vw - 24px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-form class="adv-body" label-placement="top" :show-require-mark="false">
      <n-tabs v-model:value="tab" type="line" animated>
        <n-tab-pane v-if="hasCert" name="tls" tab="TLS 证书">
          <cert-config-form v-model:dns-env-text="dnsEnvText" :cert="cert" />
        </n-tab-pane>
        <n-tab-pane v-if="hasMux && mux" name="multiplex" tab="多路复用">
          <multiplex-block :mux="mux" />
        </n-tab-pane>
        <n-tab-pane name="outbounds" tab="自定义 Outbounds">
          <div class="field-label">自定义 Outbounds (JSON)</div>
          <code-editor
            v-model:value="outboundsText"
            language="json"
            :rows="12"
            placeholder='[{"tag": "proxy", "protocol": "shadowsocks", ...}]'
          />
          <n-text v-if="outboundsError" type="error" class="err">{{ outboundsError }}</n-text>
          <div class="muted tip">追加到节点端的 outbounds，留空表示不使用。</div>
        </n-tab-pane>
        <n-tab-pane name="routes" tab="自定义 Routes">
          <div class="field-label">自定义 Routes (JSON)</div>
          <code-editor
            v-model:value="routesText"
            language="json"
            :rows="12"
            placeholder='[{"outboundTag": "proxy", "domain": ["domain:google.com"], ...}]'
          />
          <n-text v-if="routesError" type="error" class="err">{{ routesError }}</n-text>
          <div class="muted tip">追加到节点端的路由规则，留空表示不使用。</div>
        </n-tab-pane>
      </n-tabs>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" @click="save">保存</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.adv-body {
  max-height: min(70vh, 640px);
  overflow-y: auto;
  padding-right: 2px;
}
.field-label {
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--text-strong);
}
.err {
  display: block;
  font-size: 12px;
  margin-top: 4px;
}
.tip {
  font-size: 12px;
  margin-top: 4px;
}
</style>
