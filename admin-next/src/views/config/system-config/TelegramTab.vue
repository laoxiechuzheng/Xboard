<script setup lang="ts">
// Telegram设置 (group `telegram`, spec settings.md §4.7).
import { computed, onMounted, ref } from 'vue'
import { NButton, NIcon, NInput, NSwitch, NTooltip } from 'naive-ui'
import { CopyOutline, EyeOutline, EyeOffOutline, FlashOutline, OpenOutline } from '@vicons/ionicons5'
import { fetchConfigGroup, setTelegramWebhook, type TelegramWebhookResult } from '@/api/config'
import { message } from '@/utils/discrete'
import { copyText } from '@/utils/clipboard'
import ConfigPanel from './ConfigPanel.vue'
import SettingRow from './SettingRow.vue'
import SettingSection from './SettingSection.vue'
import SaveBar from './SaveBar.vue'
import SecretInput from './SecretInput.vue'
import { useConfigForm } from './useConfigForm'
import { confirmAction, isUrl, toBool, toStr, useSettingsTab } from './helpers'

interface TelegramForm {
  telegram_bot_token: string
  telegram_webhook_url: string
  telegram_bot_enable: boolean
  telegram_discuss_link: string
}

const labels: Record<keyof TelegramForm, string> = {
  telegram_bot_token: '机器人令牌',
  telegram_webhook_url: 'Webhook Base URL',
  telegram_bot_enable: '启用Telegram绑定引导',
  telegram_discuss_link: '群组链接',
}

const ctl = useConfigForm<TelegramForm>({
  group: 'telegram',
  labels,
  secretKeys: ['telegram_bot_token'],
  toForm: (r) => ({
    telegram_bot_token: toStr(r.telegram_bot_token),
    telegram_webhook_url: toStr(r.telegram_webhook_url),
    telegram_bot_enable: toBool(r.telegram_bot_enable),
    telegram_discuss_link: toStr(r.telegram_discuss_link),
  }),
  toPayload: {
    telegram_webhook_url: (v) => v.trim().replace(/\/+$/, '') || null,
  },
  validate: (f, dirty) => {
    const e: Record<string, string> = {}
    const token = f.telegram_bot_token.trim()
    if (dirty('telegram_bot_token') && token && !/^\d+:[\w-]+$/.test(token))
      e.telegram_bot_token = '令牌格式应为 数字:字符串，例如 0000000000:xxxxxxxxx_xxxxxxxxxxxxxxx'
    const hook = f.telegram_webhook_url.trim()
    if (dirty('telegram_webhook_url') && hook && !isUrl(hook))
      e.telegram_webhook_url = 'Telegram Webhook地址格式不正确，必须携带http(s)://'
    const link = f.telegram_discuss_link.trim()
    if (dirty('telegram_discuss_link') && link && !isUrl(link))
      e.telegram_discuss_link = 'Telegram群组地址必须为URL格式，必须携带http(s)://'
    return e
  },
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard, reveal, revealed, revealing } =
  ctl

useSettingsTab({ isDirty: () => dirtyCount.value > 0, save })

// Site URL is the fallback webhook base.
const appUrl = ref('')
onMounted(async () => {
  try {
    const site = await fetchConfigGroup('site', { silent: true })
    appUrl.value = toStr(site.app_url).replace(/\/+$/, '')
  } catch {
    appUrl.value = ''
  }
})

const webhookTarget = computed(() => {
  const custom = form.telegram_webhook_url.trim()
  if (custom) return `当前将使用自定义 Webhook Base URL：${custom}`
  return appUrl.value
    ? `当前将使用站点网址作为 Webhook Base URL：${appUrl.value}`
    : '当前将使用站点网址作为 Webhook Base URL，但站点网址尚未配置，请填写此项或先配置站点网址。'
})

// ---- one-click webhook ----

const settingUp = ref(false)
const hookResult = ref<TelegramWebhookResult | null>(null)
const showToken = ref(false)

/** Hide access_token (derived from the bot token) unless asked. */
const maskedHookUrl = computed(() => {
  const url = hookResult.value?.webhook_url ?? ''
  return showToken.value ? url : url.replace(/(access_token=)[^&]+/, '$1••••••••')
})

async function setupWebhook() {
  // The backend uses the saved token and base URL, so pending edits must be saved first.
  if (dirtyCount.value > 0) {
    const ok = await confirmAction({
      title: '先保存修改',
      content: '一键设置会使用已保存的机器人令牌与 Webhook 地址。当前有未保存的修改，需要先保存后再设置。',
      positiveText: '保存并设置',
      type: 'info',
    })
    if (!ok || !(await save())) return
  }
  settingUp.value = true
  hookResult.value = null
  showToken.value = false
  try {
    hookResult.value = await setTelegramWebhook()
    message.success('Webhook 设置成功')
  } catch {
    /* "Telegram Webhook地址未配置" / "Telegram 服务错误: ..." toasted by the http client */
  } finally {
    settingUp.value = false
  }
}
</script>

<template>
  <config-panel
    title="Telegram设置"
    description="配置Telegram机器人功能，实现用户通知、账户绑定、指令交互等自动化服务。"
    :loading="loading"
    :error="loadError"
    :dirty-count="dirtyCount"
    @retry="load()"
  >
    <setting-section title="机器人">
      <setting-row
        label="机器人令牌"
        description="请输入从Botfather获取的令牌。"
        :dirty="isDirty('telegram_bot_token')"
        :error="errors.telegram_bot_token"
      >
        <secret-input
          v-model:value="form.telegram_bot_token"
          :revealed="!!revealed.telegram_bot_token"
          :revealing="!!revealing.telegram_bot_token"
          placeholder="0000000000:xxxxxxxxx_xxxxxxxxxxxxxxx"
          @reveal="reveal('telegram_bot_token')"
        />
      </setting-row>
      <setting-row
        label="Webhook Base URL"
        :dirty="isDirty('telegram_webhook_url')"
        :error="errors.telegram_webhook_url"
      >
        <template #description>
          这里只填写基础地址，系统会自动拼接 Telegram 的完整 Webhook 回调路径。留空时默认使用站点网址。
          <a href="https://core.telegram.org/bots/webhooks" target="_blank" rel="noopener noreferrer" class="doc-link">
            查看 Telegram Webhook 文档
            <n-icon :size="12"><open-outline /></n-icon>
          </a>
        </template>
        <div class="hook-line">
          <n-input
            v-model:value="form.telegram_webhook_url"
            placeholder="https://example.com"
            :input-props="{ inputmode: 'url', spellcheck: false }"
            class="hook-input"
          />
          <n-button type="primary" secondary :loading="settingUp" :disabled="settingUp" @click="setupWebhook">
            <template #icon><n-icon><flash-outline /></n-icon></template>
            {{ settingUp ? '设置中...' : '一键设置' }}
          </n-button>
        </div>
        <template #extra>
          <div class="muted hint">{{ webhookTarget }}</div>
          <div class="muted hint">一键设置会覆盖该机器人在 Telegram 侧的 Webhook 地址与指令列表，请求可能需要较长时间。</div>
          <div v-if="hookResult" class="hook-result">
            <div class="hook-result-title">Webhook 设置成功</div>
            <div class="hook-item">
              <span class="hook-label">Webhook 地址</span>
              <code class="mono hook-value">{{ maskedHookUrl }}</code>
              <n-tooltip>
                <template #trigger>
                  <n-button text size="small" :aria-label="showToken ? '隐藏 access_token' : '显示 access_token'" @click="showToken = !showToken">
                    <template #icon><n-icon><eye-off-outline v-if="showToken" /><eye-outline v-else /></n-icon></template>
                  </n-button>
                </template>
                {{ showToken ? '隐藏' : '显示' }} access_token（由机器人令牌派生，请勿泄露）
              </n-tooltip>
              <n-button text size="small" aria-label="复制 Webhook 地址" @click="copyText(hookResult.webhook_url)">
                <template #icon><n-icon><copy-outline /></n-icon></template>
              </n-button>
            </div>
            <div class="hook-item">
              <span class="hook-label">基础地址</span>
              <code class="mono hook-value">{{ hookResult.webhook_base_url || '-' }}</code>
            </div>
          </div>
        </template>
      </setting-row>
      <setting-row
        label="启用Telegram绑定引导"
        description="开启后将在用户端显示Telegram绑定引导，帮助用户绑定Telegram账户以接收通知。"
        inline
        :dirty="isDirty('telegram_bot_enable')"
        :error="errors.telegram_bot_enable"
      >
        <n-switch v-model:value="form.telegram_bot_enable" />
      </setting-row>
    </setting-section>

    <setting-section title="群组">
      <setting-row
        label="群组链接"
        description="填写后将在用户端显示或在需要的地方使用。"
        :dirty="isDirty('telegram_discuss_link')"
        :error="errors.telegram_discuss_link"
      >
        <n-input
          v-model:value="form.telegram_discuss_link"
          placeholder="https://t.me/xxxxxx"
          :input-props="{ inputmode: 'url', spellcheck: false }"
        />
      </setting-row>
    </setting-section>
  </config-panel>
  <save-bar :count="dirtyCount" :saving="saving" @save="save" @discard="discard" />
</template>

<style scoped>
.doc-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--primary-color);
  text-decoration: none;
}
.doc-link:hover {
  text-decoration: underline;
}
.hook-line {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hook-input {
  flex: 1;
  min-width: 200px;
}
.hint {
  font-size: 12.5px;
  line-height: 1.6;
}
.hook-result {
  margin-top: 4px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--success-color) 40%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--success-color) 8%, transparent);
  font-size: 12.5px;
}
.hook-result-title {
  margin-bottom: 6px;
  font-weight: 650;
  color: var(--success-color);
}
.hook-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.hook-item + .hook-item {
  margin-top: 4px;
}
.hook-label {
  flex: none;
  width: 84px;
  color: var(--text-muted);
}
.hook-value {
  flex: 1;
  min-width: 0;
  word-break: break-all;
}
</style>
