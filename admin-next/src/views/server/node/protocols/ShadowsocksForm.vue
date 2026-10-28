<script setup lang="ts">
import { computed } from 'vue'
import { NFormItemGi, NGrid, NInput, NSelect, type SelectOption } from 'naive-ui'
import LabelTip from '../LabelTip.vue'
import type { ShadowsocksState } from '../protocol'

const props = defineProps<{ settings: ShadowsocksState }>()

const PRESET_CIPHERS = [
  'aes-128-gcm',
  'aes-192-gcm',
  'aes-256-gcm',
  'chacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm',
  '2022-blake3-aes-256-gcm',
  '2022-blake3-chacha20-poly1305',
]

const cipherOptions = computed<SelectOption[]>(() => {
  const preset: SelectOption[] = PRESET_CIPHERS.map((c) => ({ label: c, value: c }))
  const current = props.settings.cipher
  const group: SelectOption[] = [{ type: 'group', label: '预设加密方式', key: 'preset', children: preset }]
  if (current && !PRESET_CIPHERS.includes(current)) {
    group.push({
      type: 'group',
      label: '自定义加密方式',
      key: 'custom',
      children: [{ label: `${current}（自定义）`, value: current }],
    })
  }
  return group
})

const PLUGINS = [
  { label: 'None', value: 'none' },
  { label: 'Simple Obfs', value: 'obfs' },
  { label: 'V2Ray Plugin', value: 'v2ray-plugin' },
  { label: 'Gost Plugin', value: 'gost-plugin' },
  { label: 'Shadow TLS', value: 'shadow-tls' },
  { label: 'ResTLS', value: 'restls' },
  { label: 'KCPTun', value: 'kcptun' },
]

const PLUGIN_HINTS: Record<string, string> = {
  obfs: '提示：配置格式如 obfs=http;obfs-host=www.bing.com;path=/',
  'v2ray-plugin': '提示：WebSocket模式格式为 mode=websocket;host=mydomain.me;path=/;tls=true，QUIC模式格式为 mode=quic;host=mydomain.me',
  'gost-plugin': '提示：配置格式如 mode=websocket;host=mydomain.me;path=/;tls=true',
  'shadow-tls': '提示：配置格式如 host=cloud.tencent.com;password=auth_password;version=3',
  restls: '提示：配置格式如 host=www.microsoft.com;password=auth_password;version-hint=tls13;restls-script=300?100<1,400~100',
  kcptun: '提示：配置格式如 key=psk;crypt=aes-128-gcm;mode=fast;mtu=1350',
}

const plugin = computed({
  get: () => props.settings.plugin || 'none',
  set: (v: string) => {
    props.settings.plugin = v === 'none' ? '' : v
  },
})

const pluginOptions = computed(() => {
  const cur = props.settings.plugin
  return cur && !PLUGINS.some((p) => p.value === cur) ? [...PLUGINS, { label: `${cur}（自定义）`, value: cur }] : PLUGINS
})

function onCreateCipher(label: string): SelectOption {
  return { label: `使用 "${label}" (自定义)`, value: label.trim() }
}
</script>

<template>
  <n-grid cols="1 s:2" responsive="self" :x-gap="12">
    <n-form-item-gi
      :span="2"
      path="protocol_settings.cipher"
      :rule="{ required: true, message: '请选择或输入加密算法', trigger: ['change', 'blur'] }"
    >
      <template #label>
        <label-tip label="加密算法" tip="选择预设加密方式或输入自定义加密方式（输入后回车）" />
      </template>
      <n-select
        v-model:value="settings.cipher"
        :options="cipherOptions"
        filterable
        tag
        :on-create="onCreateCipher"
        placeholder="选择加密算法"
      >
        <template #empty>
          <div class="muted cipher-empty">未找到匹配的加密方式<br />你可以直接输入自定义的加密方式，如：aes-256-cfb</div>
        </template>
      </n-select>
    </n-form-item-gi>
    <n-form-item-gi :span="plugin === 'none' ? 2 : 1" label="插件">
      <n-select v-model:value="plugin" :options="pluginOptions" placeholder="选择插件" />
      <template v-if="PLUGIN_HINTS[plugin]" #feedback>
        <span class="muted">{{ PLUGIN_HINTS[plugin] }}</span>
      </template>
    </n-form-item-gi>
    <n-form-item-gi v-if="plugin !== 'none'" label="插件选项">
      <n-input v-model:value="settings.plugin_opts" placeholder="例如: mode=tls;host=bing.com" clearable />
      <template #feedback><span class="muted">按照 key=value;key2=value2 格式输入插件选项</span></template>
    </n-form-item-gi>
  </n-grid>
</template>

<style scoped>
.cipher-empty {
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
}
</style>
