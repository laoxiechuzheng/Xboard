<script setup lang="ts">
// 邮件设置 (group `email`, spec settings.md §4.6): 基本设置 + 模板管理 sub-tabs
// (`?sub=templates` keeps the sub-tab across reloads).
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NIcon, NInput, NInputNumber, NModal, NSelect, NSwitch, NTabPane, NTabs } from 'naive-ui'
import { CheckmarkCircle, CloseCircle, SendOutline } from '@vicons/ionicons5'
import { sendTestMail, type TestMailResult } from '@/api/config'
import { message } from '@/utils/discrete'
import ConfigPanel from './ConfigPanel.vue'
import PanelState from './PanelState.vue'
import SettingRow from './SettingRow.vue'
import SaveBar from './SaveBar.vue'
import SecretInput from './SecretInput.vue'
import MailTemplateManager from './MailTemplateManager.vue'
import { useConfigForm } from './useConfigForm'
import { confirmAction, isEmail, isInteger, toBool, toNum, toStr, useSettingsTab } from './helpers'

type Encryption = 'none' | 'ssl' | 'tls'

interface EmailForm {
  email_host: string
  email_port: number | null
  email_encryption: Encryption
  email_username: string
  email_password: string
  email_from_address: string
  remind_mail_enable: boolean
}

const labels: Record<keyof EmailForm, string> = {
  email_host: 'SMTP主机',
  email_port: 'SMTP端口',
  email_encryption: '加密方式',
  email_username: 'SMTP用户名',
  email_password: 'SMTP密码',
  email_from_address: '发件人地址',
  remind_mail_enable: '邮件提醒',
}

const encryptionOptions = [
  { label: '无', value: 'none' },
  { label: 'SSL/TLS', value: 'ssl' },
  { label: 'STARTTLS', value: 'tls' },
]

const route = useRoute()
const router = useRouter()
const sub = computed(() => (route.query.sub === 'templates' ? 'templates' : 'basic'))
function setSub(v: string) {
  const query = { ...route.query }
  if (v === 'templates') query.sub = 'templates'
  else delete query.sub
  void router.replace({ query })
}

const ctl = useConfigForm<EmailForm>({
  group: 'email',
  labels,
  secretKeys: ['email_password'],
  toForm: (r) => {
    const enc = toStr(r.email_encryption).toLowerCase()
    return {
      email_host: toStr(r.email_host),
      email_port: toNum(r.email_port),
      email_encryption: (enc === 'ssl' || enc === 'tls' ? enc : 'none') as Encryption,
      email_username: toStr(r.email_username),
      email_password: toStr(r.email_password),
      email_from_address: toStr(r.email_from_address),
      remind_mail_enable: toBool(r.remind_mail_enable),
    }
  },
  toPayload: {
    // "无" is stored as null (the official admin sends "").
    email_encryption: (v) => (v === 'none' ? null : v),
  },
  validate: (f, dirty) => {
    const e: Record<string, string> = {}
    const port = f.email_port
    if (dirty('email_port') && port !== null && (!isInteger(port) || port < 1 || port > 65535))
      e.email_port = '端口需为 1-65535 之间的整数'
    const from = f.email_from_address.trim()
    if (dirty('email_from_address') && from && !isEmail(from)) e.email_from_address = '邮箱格式不正确'
    return e
  },
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard, reveal, revealed, revealing } =
  ctl

const templateManager = ref<InstanceType<typeof MailTemplateManager> | null>(null)

useSettingsTab({
  isDirty: () => dirtyCount.value > 0 || !!templateManager.value?.isDirty(),
  save: () => (sub.value === 'templates' ? templateManager.value?.save() : save()),
})

// ---- test mail ----

const testing = ref(false)
const result = ref<TestMailResult | null>(null)
const resultOpen = ref(false)

async function sendTest() {
  if (dirtyCount.value > 0) {
    const ok = await confirmAction({
      title: '先保存修改',
      content: '测试邮件会使用已保存的 SMTP 配置发送。当前有未保存的修改，需要先保存后再发送。',
      positiveText: '保存并发送',
      type: 'info',
    })
    if (!ok || !(await save())) return
  }
  testing.value = true
  result.value = null
  try {
    const r = await sendTestMail()
    result.value = r
    resultOpen.value = true
    if (r.error) message.error('测试邮件发送失败')
    else message.success('测试邮件发送成功')
  } catch {
    /* toast shown by the http client */
  } finally {
    testing.value = false
  }
}

const fromText = computed(() => {
  const c = result.value?.config
  if (!c?.fromAddress) return '未设置'
  return c.fromName ? `${c.fromAddress} (${c.fromName})` : c.fromAddress
})
</script>

<template>
  <config-panel
    title="邮件设置"
    description="配置系统邮件服务，用于发送验证码、密码重置、通知等邮件，支持多种SMTP服务商。"
    :dirty-count="dirtyCount"
  >
    <n-tabs :value="sub" type="line" class="email-tabs" display-directive="show:lazy" @update:value="setSub">
      <n-tab-pane name="basic" tab="基本设置">
        <panel-state :loading="loading" :error="loadError" @retry="load()">
          <setting-row
            label="SMTP主机"
            description="SMTP服务器地址，例如：smtp.gmail.com。留空时系统使用 .env 中的 MAIL_* 配置。"
            :dirty="isDirty('email_host')"
            :error="errors.email_host"
          >
            <n-input v-model:value="form.email_host" placeholder="请输入" :input-props="{ spellcheck: false }" />
          </setting-row>
          <setting-row
            label="SMTP端口"
            description="SMTP服务器端口，常用端口：25, 465, 587"
            :dirty="isDirty('email_port')"
            :error="errors.email_port"
          >
            <n-input-number v-model:value="form.email_port" :min="1" :max="65535" :precision="0" placeholder="请输入" clearable class="num-input" />
          </setting-row>
          <setting-row
            label="加密方式"
            description="邮件加密方式。选择“无”时将回落到 .env 的 MAIL_ENCRYPTION（默认 tls），并不一定是明文连接。"
            :dirty="isDirty('email_encryption')"
            :error="errors.email_encryption"
          >
            <n-select v-model:value="form.email_encryption" :options="encryptionOptions" placeholder="请选择加密方式" />
          </setting-row>
          <setting-row
            label="SMTP用户名"
            description="SMTP认证用户名"
            :dirty="isDirty('email_username')"
            :error="errors.email_username"
          >
            <n-input v-model:value="form.email_username" placeholder="请输入" :input-props="{ autocomplete: 'off', spellcheck: false }" />
          </setting-row>
          <setting-row
            label="SMTP密码"
            description="SMTP认证密码或应用专用密码"
            :dirty="isDirty('email_password')"
            :error="errors.email_password"
          >
            <secret-input
              v-model:value="form.email_password"
              :revealed="!!revealed.email_password"
              :revealing="!!revealing.email_password"
              placeholder="请输入"
              @reveal="reveal('email_password')"
            />
          </setting-row>
          <setting-row
            label="发件人地址"
            description="发件人邮箱地址。发件人名称固定使用站点名称。"
            :dirty="isDirty('email_from_address')"
            :error="errors.email_from_address"
          >
            <n-input v-model:value="form.email_from_address" placeholder="noreply@example.com" :input-props="{ type: 'email' }" />
          </setting-row>
          <setting-row
            label="邮件提醒"
            description="开启后用户订阅即将到期或流量不足时会收到邮件通知。"
            inline
            :dirty="isDirty('remind_mail_enable')"
            :error="errors.remind_mail_enable"
          >
            <n-switch v-model:value="form.remind_mail_enable" />
          </setting-row>
          <setting-row label="发送测试邮件" description="使用已保存的 SMTP 配置向当前管理员邮箱发送一封测试邮件。">
            <div>
              <n-button secondary type="primary" :loading="testing" :disabled="testing" @click="sendTest">
                <template #icon><n-icon><send-outline /></n-icon></template>
                {{ testing ? '发送中...' : '发送测试邮件' }}
              </n-button>
            </div>
          </setting-row>
        </panel-state>
      </n-tab-pane>
      <n-tab-pane name="templates" tab="模板管理">
        <mail-template-manager ref="templateManager" />
      </n-tab-pane>
    </n-tabs>
  </config-panel>
  <save-bar
    :count="dirtyCount"
    :saving="saving"
    :save-text="sub === 'templates' ? '保存基本设置' : '保存修改'"
    @save="save"
    @discard="discard"
  />

  <n-modal v-model:show="resultOpen" preset="card" :bordered="false" style="width: min(460px, calc(100vw - 32px))">
    <template #header>
      <div v-if="result" class="result-title" :class="result.error ? 'is-fail' : 'is-ok'">
        <n-icon :size="22"><close-circle v-if="result.error" /><checkmark-circle v-else /></n-icon>
        {{ result.error ? '邮件发送失败' : '邮件发送成功' }}
      </div>
    </template>
    <div v-if="result" class="result-body">
      <p class="result-desc">{{ result.error ? '发送测试邮件时遇到错误' : '测试邮件已成功发送，请检查收件箱' }}</p>
      <div class="result-section">发送详情</div>
      <dl class="result-grid">
        <dt>收件地址</dt>
        <dd>{{ result.email || '-' }}</dd>
        <dt>邮件主题</dt>
        <dd>{{ result.subject || '-' }}</dd>
        <dt>模板名称</dt>
        <dd class="mono">{{ result.template_name || '-' }}</dd>
      </dl>
      <template v-if="result.error">
        <div class="result-section">错误信息</div>
        <div class="result-error">{{ result.error }}</div>
      </template>
      <div class="result-section">配置信息</div>
      <dl class="result-grid">
        <dt>驱动</dt>
        <dd>{{ result.config.driver || '-' }}</dd>
        <dt>服务器</dt>
        <dd class="mono">{{ result.config.host || '-' }}</dd>
        <dt>端口</dt>
        <dd class="mono">{{ result.config.port || '-' }}</dd>
        <dt>加密方式</dt>
        <dd>{{ result.config.encryption || '无' }}</dd>
        <dt>发件人</dt>
        <dd>{{ fromText }}</dd>
        <dt>用户名</dt>
        <dd>{{ result.config.username || '未设置' }}</dd>
      </dl>
    </div>
  </n-modal>
</template>

<style scoped>
.email-tabs {
  margin-top: 4px;
}
.num-input {
  width: 100%;
  max-width: 240px;
}
.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 650;
}
.result-title.is-ok :deep(.n-icon) {
  color: var(--success-color);
}
.result-title.is-fail :deep(.n-icon) {
  color: var(--error-color);
}
.result-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-muted);
}
.result-section {
  margin: 14px 0 6px;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-strong);
}
.result-grid {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
  font-size: 13px;
}
.result-grid dt {
  color: var(--text-muted);
}
.result-grid dd {
  margin: 0;
  word-break: break-all;
}
.result-error {
  padding: 8px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--error-color) 10%, transparent);
  color: var(--error-color);
  font-size: 12.5px;
  line-height: 1.6;
  word-break: break-all;
}
</style>
