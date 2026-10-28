<script setup lang="ts">
// 安全设置 (group `safe`, spec settings.md §4.2). `recaptcha_enable` is a read-only
// compatibility field and is never submitted.
import { computed, h } from 'vue'
import { NButton, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { fetchConfigGroup } from '@/api/config'
import { settings } from '@/settings'
import { dialog } from '@/utils/discrete'
import { copyText } from '@/utils/clipboard'
import ConfigPanel from './ConfigPanel.vue'
import SettingRow from './SettingRow.vue'
import SettingSection from './SettingSection.vue'
import SaveBar from './SaveBar.vue'
import SecretInput from './SecretInput.vue'
import { useConfigForm } from './useConfigForm'
import { confirmRisks, isInteger, toBool, toNum, toStr, toStrList, uniq, useSettingsTab, type Risk } from './helpers'

type CaptchaType = 'recaptcha' | 'recaptcha-v3' | 'turnstile'

interface SafeForm {
  email_verify: boolean
  email_gmail_limit_enable: boolean
  safe_mode_enable: boolean
  secure_path: string
  email_whitelist_enable: boolean
  email_whitelist_suffix: string
  captcha_enable: boolean
  captcha_type: CaptchaType
  recaptcha_site_key: string
  recaptcha_key: string
  recaptcha_v3_site_key: string
  recaptcha_v3_secret_key: string
  recaptcha_v3_score_threshold: number | null
  turnstile_site_key: string
  turnstile_secret_key: string
  register_limit_by_ip_enable: boolean
  register_limit_count: number | null
  register_limit_expire: number | null
  password_limit_enable: boolean
  password_limit_count: number | null
  password_limit_expire: number | null
}

const labels: Record<keyof SafeForm, string> = {
  email_verify: '邮箱验证',
  email_gmail_limit_enable: '禁止使用Gmail多别名',
  safe_mode_enable: '安全模式',
  secure_path: '后台路径',
  email_whitelist_enable: '邮箱后缀白名单',
  email_whitelist_suffix: '邮箱后缀',
  captcha_enable: '启用验证码',
  captcha_type: '验证码类型',
  recaptcha_site_key: 'reCAPTCHA站点密钥',
  recaptcha_key: 'reCAPTCHA密钥',
  recaptcha_v3_site_key: 'reCAPTCHA v3站点密钥',
  recaptcha_v3_secret_key: 'reCAPTCHA v3密钥',
  recaptcha_v3_score_threshold: '分数阈值',
  turnstile_site_key: 'Turnstile站点密钥',
  turnstile_secret_key: 'Turnstile密钥',
  register_limit_by_ip_enable: 'IP注册限制',
  register_limit_count: '注册次数',
  register_limit_expire: '限制时长',
  password_limit_enable: '密码尝试限制',
  password_limit_count: '尝试次数',
  password_limit_expire: '锁定时长',
}

const captchaOptions = [
  { label: 'Google reCAPTCHA v2', value: 'recaptcha' },
  { label: 'Google reCAPTCHA v3', value: 'recaptcha-v3' },
  { label: 'Cloudflare Turnstile', value: 'turnstile' },
]

/** One suffix per line (commas also accepted); trimmed, leading "@" removed, de-duplicated. */
function suffixList(v: string): string[] {
  return uniq(
    v
      .split(/[\n,，\s]+/)
      .map((s) => s.trim().replace(/^@+/, '').toLowerCase())
      .filter(Boolean),
  )
}

const intOrNull = (v: number | null) => (v === null ? null : v)

const ctl = useConfigForm<SafeForm>({
  group: 'safe',
  labels,
  secretKeys: ['recaptcha_key', 'recaptcha_v3_secret_key', 'turnstile_secret_key'],
  toForm: (r) => {
    const type = toStr(r.captcha_type)
    return {
      email_verify: toBool(r.email_verify),
      email_gmail_limit_enable: toBool(r.email_gmail_limit_enable),
      safe_mode_enable: toBool(r.safe_mode_enable),
      secure_path: toStr(r.secure_path),
      email_whitelist_enable: toBool(r.email_whitelist_enable),
      // Historic data may be a comma separated string (Helper::getEmailSuffix accepts both).
      email_whitelist_suffix: toStrList(r.email_whitelist_suffix).join('\n'),
      captcha_enable: toBool(r.captcha_enable),
      captcha_type: (['recaptcha', 'recaptcha-v3', 'turnstile'].includes(type) ? type : 'recaptcha') as CaptchaType,
      recaptcha_site_key: toStr(r.recaptcha_site_key),
      recaptcha_key: toStr(r.recaptcha_key),
      recaptcha_v3_site_key: toStr(r.recaptcha_v3_site_key),
      recaptcha_v3_secret_key: toStr(r.recaptcha_v3_secret_key),
      recaptcha_v3_score_threshold: toNum(r.recaptcha_v3_score_threshold),
      turnstile_site_key: toStr(r.turnstile_site_key),
      turnstile_secret_key: toStr(r.turnstile_secret_key),
      register_limit_by_ip_enable: toBool(r.register_limit_by_ip_enable),
      register_limit_count: toNum(r.register_limit_count),
      register_limit_expire: toNum(r.register_limit_expire),
      password_limit_enable: toBool(r.password_limit_enable),
      password_limit_count: toNum(r.password_limit_count),
      password_limit_expire: toNum(r.password_limit_expire),
    }
  },
  toPayload: {
    secure_path: (v) => v.trim(),
    email_whitelist_suffix: (v) => suffixList(v),
    register_limit_count: intOrNull,
    register_limit_expire: intOrNull,
    password_limit_count: intOrNull,
    password_limit_expire: intOrNull,
  },
  validate: (f, dirty) => {
    const e: Record<string, string> = {}
    if (dirty('secure_path')) {
      const p = f.secure_path.trim()
      if (p.length < 8) e.secure_path = '后台路径长度最小为8位'
      else if (!/^[\w-]+$/.test(p)) e.secure_path = '后台路径只能包含字母、数字、下划线或短横线'
    }
    if ((dirty('email_whitelist_enable') || dirty('email_whitelist_suffix')) && f.email_whitelist_enable) {
      if (!suffixList(f.email_whitelist_suffix).length) e.email_whitelist_suffix = '白名单为空时所有注册都会被拒绝，请至少填写一个后缀'
    }
    if (dirty('recaptcha_v3_score_threshold')) {
      const t = f.recaptcha_v3_score_threshold
      if (t === null) e.recaptcha_v3_score_threshold = '请输入 0 到 1 之间的数字'
      else if (t < 0) e.recaptcha_v3_score_threshold = 'reCAPTCHA v3 分数阈值不能小于0'
      else if (t > 1) e.recaptcha_v3_score_threshold = 'reCAPTCHA v3 分数阈值不能大于1'
    }
    const positiveInt = (k: 'register_limit_count' | 'register_limit_expire' | 'password_limit_count' | 'password_limit_expire') => {
      if (!dirty(k)) return
      const v = f[k]
      if (v === null || !isInteger(v) || v < 1) e[k] = '请输入大于 0 的整数'
    }
    positiveInt('register_limit_count')
    positiveInt('register_limit_expire')
    positiveInt('password_limit_count')
    positiveInt('password_limit_expire')
    // Enabling a captcha without its public key breaks every registration.
    if ((dirty('captcha_enable') || dirty('captcha_type')) && f.captcha_enable) {
      const siteKey = {
        recaptcha: 'recaptcha_site_key',
        'recaptcha-v3': 'recaptcha_v3_site_key',
        turnstile: 'turnstile_site_key',
      }[f.captcha_type] as 'recaptcha_site_key' | 'recaptcha_v3_site_key' | 'turnstile_site_key'
      if (!f[siteKey].trim()) e[siteKey] = '启用验证码前请填写站点密钥'
    }
    return e
  },
  beforeSave: async ({ form, baseline, has }) => {
    const risks: Risk[] = []
    if (has('secure_path')) {
      const next = form.secure_path.trim()
      risks.push({
        title: '修改后台路径',
        content: `新的后台地址为 ${adminAddress(next)}，旧地址 ${adminAddress(settings.securePath)} 将立即失效（Octane 或开启路由缓存的部署需重启后生效）。当前页面后续的所有操作都会失败，请先记录新地址。`,
      })
    }
    if (has('safe_mode_enable') && form.safe_mode_enable && !baseline.safe_mode_enable) {
      risks.push({ title: '开启安全模式', content: await safeModeHint() })
    }
    if (has('password_limit_enable') && !form.password_limit_enable && baseline.password_limit_enable) {
      risks.push({ title: '关闭密码尝试限制', content: '关闭后将不再限制密码错误次数，账号更容易被暴力破解。' })
    }
    if (has('email_whitelist_enable') && form.email_whitelist_enable && !baseline.email_whitelist_enable) {
      risks.push({ title: '开启邮箱后缀白名单', content: '开启后只有名单内后缀的邮箱才能注册新账号。' })
    }
    if (has('captcha_enable') && form.captcha_enable && !baseline.captcha_enable) {
      risks.push({
        title: '启用注册验证码',
        content: '请确认已正确填写所选验证服务的站点密钥与服务端密钥，否则所有新用户都将无法通过验证完成注册。',
      })
    }
    return confirmRisks(risks)
  },
  afterSave: ({ has, form }) => {
    if (!has('secure_path')) return
    showNewAdminPath(form.secure_path.trim())
    return false // the old admin prefix no longer answers; skip the reload
  },
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard, reveal, revealed, revealing } =
  ctl

// Rows hidden by their switch / captcha type go back to the saved values (never submitted while hidden).
ctl.restoreWhenHidden(() => form.email_whitelist_enable, ['email_whitelist_suffix'])
ctl.restoreWhenHidden(() => form.captcha_enable, ['captcha_type'])
ctl.restoreWhenHidden(() => form.captcha_enable && form.captcha_type === 'recaptcha', ['recaptcha_site_key', 'recaptcha_key'])
ctl.restoreWhenHidden(() => form.captcha_enable && form.captcha_type === 'recaptcha-v3', [
  'recaptcha_v3_site_key',
  'recaptcha_v3_secret_key',
  'recaptcha_v3_score_threshold',
])
ctl.restoreWhenHidden(() => form.captcha_enable && form.captcha_type === 'turnstile', [
  'turnstile_site_key',
  'turnstile_secret_key',
])
ctl.restoreWhenHidden(() => form.register_limit_by_ip_enable, ['register_limit_count', 'register_limit_expire'])
ctl.restoreWhenHidden(() => form.password_limit_enable, ['password_limit_count', 'password_limit_expire'])

useSettingsTab({ isDirty: () => dirtyCount.value > 0, save })

/** URL of this admin under another secure_path (keeps the /next suffix used to reach this page). */
function adminAddress(path: string): string {
  const { origin, pathname } = window.location
  const current = `/${settings.securePath}/`
  const next = pathname.includes(current) ? pathname.replace(current, `/${path}/`) : `/${path}/next`
  return `${origin}${next}`
}

async function safeModeHint(): Promise<string> {
  const base = '开启后，除站点网址外的其它域名访问用户前台首页都将返回 403（后台与 API 不受影响）。'
  try {
    const site = await fetchConfigGroup('site', { silent: true })
    const appUrl = toStr(site.app_url).trim()
    if (!appUrl) return `${base}\n\n当前未配置站点网址，安全模式不会生效。`
    let host = ''
    try {
      host = new URL(appUrl).hostname
    } catch {
      return `${base}\n\n当前站点网址 ${appUrl} 格式不正确，请先修正。`
    }
    if (host !== window.location.hostname)
      return `${base}\n\n注意：站点网址的域名为 ${host}，与当前访问的域名 ${window.location.hostname} 不一致，通过当前域名访问用户前台将被拒绝。`
    return `${base}\n\n站点网址：${appUrl}`
  } catch {
    return base
  }
}

function showNewAdminPath(path: string) {
  const url = adminAddress(path)
  dialog.success({
    title: '后台路径已修改',
    style: 'width: min(520px, calc(100vw - 32px))',
    content: () =>
      h('div', { style: 'line-height:1.7' }, [
        h(
          'div',
          null,
          '请使用新的后台地址重新访问。php-fpm 部署立即生效，旧地址已失效；Octane 或开启路由缓存的部署需重启服务后生效。',
        ),
        h(
          'div',
          {
            style:
              'margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--code-bg);font-family:var(--font-mono);font-size:12.5px;word-break:break-all',
          },
          url,
        ),
        h(
          NButton,
          { size: 'small', quaternary: true, type: 'primary', style: 'margin-top:6px', onClick: () => copyText(url) },
          { default: () => '复制新地址' },
        ),
      ]),
    positiveText: '前往新地址',
    negativeText: '稍后',
    closable: false,
    maskClosable: false,
    onPositiveClick: () => {
      window.location.href = url
    },
  })
}

const secureHint = computed(() => {
  const p = form.secure_path.trim()
  return p && isDirty('secure_path') && p.length >= 8 && /^[\w-]+$/.test(p) ? `保存后新的后台地址：${adminAddress(p)}` : ''
})
const suffixCount = computed(() => suffixList(form.email_whitelist_suffix).length)
</script>

<template>
  <config-panel
    title="安全设置"
    description="配置系统安全相关选项，包括登录验证、密码策略、API访问等安全设置。"
    :loading="loading"
    :error="loadError"
    :dirty-count="dirtyCount"
    @retry="load()"
  >
    <setting-section title="注册与访问">
      <setting-row
        label="邮箱验证"
        description="开启后将会强制要求用户进行邮箱验证。"
        inline
        :dirty="isDirty('email_verify')"
        :error="errors.email_verify"
      >
        <n-switch v-model:value="form.email_verify" />
      </setting-row>
      <setting-row
        label="禁止使用Gmail多别名"
        description="开启后Gmail多别名将无法注册。"
        inline
        :dirty="isDirty('email_gmail_limit_enable')"
        :error="errors.email_gmail_limit_enable"
      >
        <n-switch v-model:value="form.email_gmail_limit_enable" />
      </setting-row>
      <setting-row
        label="安全模式"
        description="开启后除了站点URL以外的绑定本站点的域名访问都将会被403。仅在已配置站点网址时生效，只拦截用户前台首页。"
        inline
        :dirty="isDirty('safe_mode_enable')"
        :error="errors.safe_mode_enable"
      >
        <n-switch v-model:value="form.safe_mode_enable" />
      </setting-row>
      <setting-row
        label="后台路径"
        description="后台管理路径，修改后将会改变原有的admin路径。至少 8 位，只能包含字母、数字、下划线或短横线。"
        :dirty="isDirty('secure_path')"
        :error="errors.secure_path"
        :warning="secureHint"
      >
        <n-input v-model:value="form.secure_path" placeholder="admin" :input-props="{ spellcheck: false, autocomplete: 'off' }" class="mono-field" />
      </setting-row>
      <setting-row
        label="邮箱后缀白名单"
        description="开启后在名单中的邮箱后缀才允许进行注册。"
        inline
        :dirty="isDirty('email_whitelist_enable')"
        :error="errors.email_whitelist_enable"
      >
        <n-switch v-model:value="form.email_whitelist_enable" />
      </setting-row>
      <setting-row
        v-if="form.email_whitelist_enable"
        label="邮箱后缀"
        description="输入允许的邮箱后缀，每行一个（如 gmail.com）。保存时会自动去除空行、重复项和开头的 @。"
        :dirty="isDirty('email_whitelist_suffix')"
        :error="errors.email_whitelist_suffix"
      >
        <n-input
          v-model:value="form.email_whitelist_suffix"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 12 }"
          placeholder="输入邮箱后缀，每行一个"
          class="mono-field"
        />
        <template #extra>
          <span class="muted count-hint">共 {{ suffixCount }} 个后缀</span>
        </template>
      </setting-row>
    </setting-section>

    <setting-section title="人机验证">
      <setting-row
        label="启用验证码"
        description="开启后用户注册时需要通过验证码验证。"
        inline
        :dirty="isDirty('captcha_enable')"
        :error="errors.captcha_enable"
      >
        <n-switch v-model:value="form.captcha_enable" />
      </setting-row>
      <template v-if="form.captcha_enable">
        <setting-row
          label="验证码类型"
          description="选择要使用的验证码服务类型"
          :dirty="isDirty('captcha_type')"
          :error="errors.captcha_type"
        >
          <n-select v-model:value="form.captcha_type" :options="captchaOptions" placeholder="选择要使用的验证码服务类型" />
        </setting-row>
        <template v-if="form.captcha_type === 'recaptcha'">
          <setting-row
            label="reCAPTCHA站点密钥"
            description="输入您的reCAPTCHA站点密钥"
            :dirty="isDirty('recaptcha_site_key')"
            :error="errors.recaptcha_site_key"
          >
            <n-input v-model:value="form.recaptcha_site_key" placeholder="输入reCAPTCHA站点密钥" class="mono-field" />
          </setting-row>
          <setting-row
            label="reCAPTCHA密钥"
            description="输入您的reCAPTCHA密钥"
            :dirty="isDirty('recaptcha_key')"
            :error="errors.recaptcha_key"
          >
            <secret-input
              v-model:value="form.recaptcha_key"
              :revealed="!!revealed.recaptcha_key"
              :revealing="!!revealing.recaptcha_key"
              placeholder="输入reCAPTCHA密钥"
              @reveal="reveal('recaptcha_key')"
            />
          </setting-row>
        </template>
        <template v-else-if="form.captcha_type === 'recaptcha-v3'">
          <setting-row
            label="reCAPTCHA v3站点密钥"
            description="输入您的reCAPTCHA v3站点密钥"
            :dirty="isDirty('recaptcha_v3_site_key')"
            :error="errors.recaptcha_v3_site_key"
          >
            <n-input v-model:value="form.recaptcha_v3_site_key" placeholder="输入reCAPTCHA v3站点密钥" class="mono-field" />
          </setting-row>
          <setting-row
            label="reCAPTCHA v3密钥"
            description="输入您的reCAPTCHA v3服务器密钥"
            :dirty="isDirty('recaptcha_v3_secret_key')"
            :error="errors.recaptcha_v3_secret_key"
          >
            <secret-input
              v-model:value="form.recaptcha_v3_secret_key"
              :revealed="!!revealed.recaptcha_v3_secret_key"
              :revealing="!!revealing.recaptcha_v3_secret_key"
              placeholder="输入reCAPTCHA v3密钥"
              @reveal="reveal('recaptcha_v3_secret_key')"
            />
          </setting-row>
          <setting-row
            label="分数阈值"
            description="设置验证分数阈值（0-1），分数越高表示越可能是真人操作"
            :dirty="isDirty('recaptcha_v3_score_threshold')"
            :error="errors.recaptcha_v3_score_threshold"
          >
            <n-input-number
              v-model:value="form.recaptcha_v3_score_threshold"
              :min="0"
              :max="1"
              :step="0.1"
              placeholder="0.5"
              class="num-input"
            />
          </setting-row>
        </template>
        <template v-else>
          <setting-row
            label="Turnstile站点密钥"
            description="输入您的Cloudflare Turnstile站点密钥"
            :dirty="isDirty('turnstile_site_key')"
            :error="errors.turnstile_site_key"
          >
            <n-input v-model:value="form.turnstile_site_key" placeholder="输入Turnstile站点密钥" class="mono-field" />
          </setting-row>
          <setting-row
            label="Turnstile密钥"
            description="输入您的Cloudflare Turnstile密钥"
            :dirty="isDirty('turnstile_secret_key')"
            :error="errors.turnstile_secret_key"
          >
            <secret-input
              v-model:value="form.turnstile_secret_key"
              :revealed="!!revealed.turnstile_secret_key"
              :revealing="!!revealing.turnstile_secret_key"
              placeholder="输入Turnstile密钥"
              @reveal="reveal('turnstile_secret_key')"
            />
          </setting-row>
        </template>
      </template>
    </setting-section>

    <setting-section title="频率限制">
      <setting-row
        label="IP注册限制"
        description="开启后将限制同一IP的注册次数。"
        inline
        :dirty="isDirty('register_limit_by_ip_enable')"
        :error="errors.register_limit_by_ip_enable"
      >
        <n-switch v-model:value="form.register_limit_by_ip_enable" />
      </setting-row>
      <template v-if="form.register_limit_by_ip_enable">
        <setting-row
          label="注册次数"
          description="同一IP允许的最大注册次数"
          :dirty="isDirty('register_limit_count')"
          :error="errors.register_limit_count"
        >
          <n-input-number v-model:value="form.register_limit_count" :min="1" :precision="0" placeholder="输入最大注册次数" class="num-input">
            <template #suffix>次</template>
          </n-input-number>
        </setting-row>
        <setting-row
          label="限制时长"
          description="注册限制的持续时间（分钟）"
          :dirty="isDirty('register_limit_expire')"
          :error="errors.register_limit_expire"
        >
          <n-input-number v-model:value="form.register_limit_expire" :min="1" :precision="0" placeholder="输入限制时长（分钟）" class="num-input">
            <template #suffix>分钟</template>
          </n-input-number>
        </setting-row>
      </template>
      <setting-row
        label="密码尝试限制"
        description="开启后将限制密码尝试次数。"
        inline
        :dirty="isDirty('password_limit_enable')"
        :error="errors.password_limit_enable"
      >
        <n-switch v-model:value="form.password_limit_enable" />
      </setting-row>
      <template v-if="form.password_limit_enable">
        <setting-row
          label="尝试次数"
          description="允许的最大密码尝试次数"
          :dirty="isDirty('password_limit_count')"
          :error="errors.password_limit_count"
        >
          <n-input-number v-model:value="form.password_limit_count" :min="1" :precision="0" placeholder="输入最大尝试次数" class="num-input">
            <template #suffix>次</template>
          </n-input-number>
        </setting-row>
        <setting-row
          label="锁定时长"
          description="账户锁定的持续时间（分钟）"
          :dirty="isDirty('password_limit_expire')"
          :error="errors.password_limit_expire"
        >
          <n-input-number v-model:value="form.password_limit_expire" :min="1" :precision="0" placeholder="输入锁定时长（分钟）" class="num-input">
            <template #suffix>分钟</template>
          </n-input-number>
        </setting-row>
      </template>
    </setting-section>

  </config-panel>
  <save-bar :count="dirtyCount" :saving="saving" @save="save" @discard="discard" />
</template>

<style scoped>
.num-input {
  width: 100%;
  max-width: 240px;
}
.mono-field :deep(input),
.mono-field :deep(textarea) {
  font-family: var(--font-mono);
}
.count-hint {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

</style>
