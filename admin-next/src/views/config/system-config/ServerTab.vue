<script setup lang="ts">
// 节点配置 (group `server`, spec settings.md §4.5), plus `device_limit_mode`
// which the official admin returns but never renders.
import { computed } from 'vue'
import { NAlert, NButton, NIcon, NInput, NInputNumber, NSelect, NSwitch, NTooltip } from 'naive-ui'
import { DiceOutline } from '@vicons/ionicons5'
import ConfigPanel from './ConfigPanel.vue'
import SettingRow from './SettingRow.vue'
import SettingSection from './SettingSection.vue'
import SaveBar from './SaveBar.vue'
import SecretInput from './SecretInput.vue'
import { useConfigForm } from './useConfigForm'
import { confirmRisks, isInteger, isUrl, randomToken, toBool, toNum, toStr, useSettingsTab, type Risk } from './helpers'

interface ServerForm {
  server_token: string
  server_pull_interval: number | null
  server_push_interval: number | null
  server_ws_enable: boolean
  server_ws_url: string
  device_limit_mode: number
}

const labels: Record<keyof ServerForm, string> = {
  server_token: '通讯密钥',
  server_pull_interval: '节点拉取动作轮询间隔',
  server_push_interval: '节点推送动作轮询间隔',
  server_ws_enable: '启用 WebSocket 通信',
  server_ws_url: 'WebSocket 地址',
  device_limit_mode: '设备限制模式',
}

const deviceModeOptions = [
  { label: '严格模式', value: 0 },
  { label: '宽松模式', value: 1 },
]

// Sent to nodes as-is as their WebSocket endpoint (ServerController::handshake).
const WS_PROTOCOLS = ['ws:', 'wss:']

const ctl = useConfigForm<ServerForm>({
  group: 'server',
  labels,
  secretKeys: ['server_token'],
  toForm: (r) => ({
    server_token: toStr(r.server_token),
    server_pull_interval: toNum(r.server_pull_interval),
    server_push_interval: toNum(r.server_push_interval),
    server_ws_enable: toBool(r.server_ws_enable),
    server_ws_url: toStr(r.server_ws_url),
    device_limit_mode: toNum(r.device_limit_mode) ?? 0,
  }),
  toPayload: {
    server_ws_url: (v) => v.trim().replace(/\/+$/, '') || null,
  },
  validate: (f, dirty) => {
    const e: Record<string, string> = {}
    if (dirty('server_token')) {
      const t = f.server_token.trim()
      if (t && t.length < 16) e.server_token = '通讯密钥长度不能少于16位'
      else if (t && !/[A-Za-z]/.test(t)) e.server_token = '通讯密钥不能是纯数字（纯数字会被读成数值导致节点鉴权失败），请至少包含一个字母'
    }
    for (const k of ['server_pull_interval', 'server_push_interval'] as const) {
      const v = f[k]
      if (dirty(k) && (v === null || !isInteger(v) || v < 1)) e[k] = '请输入大于 0 的整数（秒）'
    }
    const ws = f.server_ws_url.trim()
    if (dirty('server_ws_url') && ws && !isUrl(ws, WS_PROTOCOLS)) e.server_ws_url = '格式不正确，需以 ws:// 或 wss:// 开头'
    return e
  },
  beforeSave: ({ form, baseline, has }) => {
    const risks: Risk[] = []
    if (has('server_token')) {
      risks.push(
        form.server_token.trim()
          ? {
              title: '修改通讯密钥',
              content: '修改后所有节点需要同步更新为新的通讯密钥，否则将无法与面板通信（拉取配置、上报流量都会失败）。',
            }
          : {
              title: '清空通讯密钥',
              content: '清空后所有节点都将鉴权失败并断开，直到重新设置密钥并同步到节点。',
            },
      )
    }
    if (has('server_ws_enable') && !form.server_ws_enable && baseline.server_ws_enable)
      risks.push({ title: '关闭 WebSocket 通信', content: '关闭后节点将回退为定时轮询，配置下发与流量上报的实时性会降低。' })
    return confirmRisks(risks)
  },
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard, reveal, revealed, revealing } =
  ctl

ctl.restoreWhenHidden(() => form.server_ws_enable, ['server_ws_url'])

useSettingsTab({ isDirty: () => dirtyCount.value > 0, save })

function generateToken() {
  form.server_token = randomToken(32)
}

const wsExample = computed(() => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`)
</script>

<template>
  <config-panel
    title="节点配置"
    description="配置节点通信和同步设置，包括通信密钥、轮询间隔、负载均衡等高级选项。"
    :loading="loading"
    :error="loadError"
    :dirty-count="dirtyCount"
    @retry="load()"
  >
    <setting-section title="通信">
      <setting-row
        label="通讯密钥"
        description="Xboard与节点通讯的密钥，以便数据不会被他人获取。至少 16 位且需包含字母，修改后需同步到所有节点。"
        :dirty="isDirty('server_token')"
        :error="errors.server_token"
      >
        <secret-input
          v-model:value="form.server_token"
          :revealed="!!revealed.server_token"
          :revealing="!!revealing.server_token"
          placeholder="请输入通讯密钥"
          @reveal="reveal('server_token')"
        >
          <template #actions>
            <n-tooltip>
              <template #trigger>
                <n-button aria-label="生成随机通信密钥" @click="generateToken">
                  <template #icon><n-icon><dice-outline /></n-icon></template>
                </n-button>
              </template>
              点击生成随机通信密钥
            </n-tooltip>
          </template>
        </secret-input>
      </setting-row>
      <setting-row
        label="节点拉取动作轮询间隔"
        description="节点从面板获取数据的间隔频率。"
        :dirty="isDirty('server_pull_interval')"
        :error="errors.server_pull_interval"
      >
        <n-input-number v-model:value="form.server_pull_interval" :min="1" :precision="0" placeholder="请输入拉取间隔" class="num-input">
          <template #suffix>秒</template>
        </n-input-number>
      </setting-row>
      <setting-row
        label="节点推送动作轮询间隔"
        description="节点推送数据到面板的间隔频率。"
        :dirty="isDirty('server_push_interval')"
        :error="errors.server_push_interval"
      >
        <n-input-number v-model:value="form.server_push_interval" :min="1" :precision="0" placeholder="请输入推送间隔" class="num-input">
          <template #suffix>秒</template>
        </n-input-number>
      </setting-row>
    </setting-section>

    <setting-section title="WebSocket">
      <setting-row
        label="启用 WebSocket 通信"
        description="开启后节点将通过 WebSocket 与面板进行实时通信，延迟更低、推送更及时。仅在 WebSocket 服务运行时才会下发给节点。"
        inline
        :dirty="isDirty('server_ws_enable')"
        :error="errors.server_ws_enable"
      >
        <n-switch v-model:value="form.server_ws_enable" />
      </setting-row>
      <setting-row
        v-if="form.server_ws_enable"
        label="WebSocket 地址"
        :dirty="isDirty('server_ws_url')"
        :error="errors.server_ws_url"
      >
        <template #description>
          节点连接面板的 WebSocket 地址，需以 <code class="mono">ws://</code> 或 <code class="mono">wss://</code> 开头。留空时自动使用
          <code class="mono">ws(s)://&lt;节点请求的面板域名&gt;/ws</code>（不是站点网址）。
        </template>
        <n-input
          v-model:value="form.server_ws_url"
          :placeholder="`留空自动使用，例如 ${wsExample}`"
          :input-props="{ spellcheck: false, inputmode: 'url' }"
        />
      </setting-row>
      <n-alert type="info" :show-icon="true" class="ws-alert">目前支持 WebSocket 通信的节点端：Xboard Node</n-alert>
    </setting-section>

    <setting-section title="设备限制">
      <setting-row
        label="设备限制模式"
        description="宽松模式下，同一IP地址使用多个节点只统计为一个设备。"
        badge="当前后端未使用"
        :dirty="isDirty('device_limit_mode')"
        :error="errors.device_limit_mode"
      >
        <n-select v-model:value="form.device_limit_mode" :options="deviceModeOptions" placeholder="请选择设备限制模式" />
      </setting-row>
    </setting-section>
  </config-panel>
  <save-bar :count="dirtyCount" :saving="saving" @save="save" @discard="discard" />
</template>

<style scoped>
.num-input {
  width: 100%;
  max-width: 240px;
}
.ws-alert {
  margin: 4px 0 8px;
}
</style>
