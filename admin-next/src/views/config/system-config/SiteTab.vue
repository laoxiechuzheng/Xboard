<script setup lang="ts">
// 站点设置 (group `site`, spec settings.md §4.1).
import { computed, onMounted, ref } from 'vue'
import { NInput, NInputNumber, NSelect, NSwitch, type SelectOption } from 'naive-ui'
import { fetchPlanOptions, type PlanBrief } from '@/api/common'
import ConfigPanel from './ConfigPanel.vue'
import SettingRow from './SettingRow.vue'
import SettingSection from './SettingSection.vue'
import SaveBar from './SaveBar.vue'
import { useConfigForm } from './useConfigForm'
import { confirmRisks, isUrl, toBool, toNum, toStr, useSettingsTab, type Risk } from './helpers'

interface SiteForm {
  app_name: string
  app_description: string
  app_url: string
  force_https: boolean
  logo: string
  subscribe_url: string
  tos_url: string
  stop_register: boolean
  ticket_must_wait_reply: boolean
  try_out_plan_id: number
  try_out_hour: number | null
  currency: string
  currency_symbol: string
}

const labels: Record<keyof SiteForm, string> = {
  app_name: '站点名称',
  app_description: '站点描述',
  app_url: '站点网址',
  force_https: '强制HTTPS',
  logo: 'LOGO',
  subscribe_url: '订阅URL',
  tos_url: '用户条款(TOS)URL',
  stop_register: '停止新用户注册',
  ticket_must_wait_reply: '工单等待回复限制',
  try_out_plan_id: '注册试用',
  try_out_hour: '注册试用时长',
  currency: '货币单位',
  currency_symbol: '货币符号',
}

const stripSlash = (s: string) => s.replace(/\/+$/, '')

/** Multiple subscribe URLs: one per line (or comma separated) in the editor, stored comma separated. */
function subscribeUrlList(v: string): string[] {
  return v
    .split(/[,\n，]/)
    .map((s) => stripSlash(s.trim()))
    .filter(Boolean)
}

const ctl = useConfigForm<SiteForm>({
  group: 'site',
  labels,
  toForm: (r) => ({
    app_name: toStr(r.app_name),
    app_description: toStr(r.app_description),
    app_url: toStr(r.app_url),
    force_https: toBool(r.force_https),
    logo: toStr(r.logo),
    subscribe_url: toStr(r.subscribe_url).split(',').map((s) => s.trim()).filter(Boolean).join('\n'),
    tos_url: toStr(r.tos_url),
    stop_register: toBool(r.stop_register),
    ticket_must_wait_reply: toBool(r.ticket_must_wait_reply),
    try_out_plan_id: toNum(r.try_out_plan_id) ?? 0,
    try_out_hour: toNum(r.try_out_hour),
    currency: toStr(r.currency),
    currency_symbol: toStr(r.currency_symbol),
  }),
  toPayload: {
    app_url: (v) => stripSlash(v.trim()) || null,
    subscribe_url: (v) => subscribeUrlList(v).join(',') || null,
    // The official admin submits these switches as 0/1.
    force_https: (v) => (v ? 1 : 0),
    stop_register: (v) => (v ? 1 : 0),
    ticket_must_wait_reply: (v) => (v ? 1 : 0),
    try_out_plan_id: (v) => Number(v) || 0,
  },
  validate: (f, dirty) => {
    const e: Record<string, string> = {}
    const url = (k: 'app_url' | 'logo' | 'tos_url') => {
      const v = f[k].trim()
      if (dirty(k) && v && !isUrl(v)) e[k] = '格式不正确，必须携带 http(s)://'
    }
    url('app_url')
    url('logo')
    url('tos_url')
    if (dirty('try_out_hour') || (dirty('try_out_plan_id') && f.try_out_plan_id)) {
      if (f.try_out_plan_id && (f.try_out_hour === null || f.try_out_hour <= 0)) e.try_out_hour = '请输入大于 0 的试用时长'
    }
    return e
  },
  beforeSave: ({ form, baseline, has, payload }) => {
    const risks: Risk[] = []
    if (has('app_url'))
      risks.push({
        title: `修改站点网址为 ${payload.app_url ?? '（空）'}`,
        content:
          '站点网址会作为系统生成链接的根地址（邮件链接、支付回调、页面资源等），并影响安全模式与 Telegram Webhook。填写错误可能导致页面或回调失效。',
      })
    if (has('force_https') && form.force_https && !baseline.force_https)
      risks.push({
        title: '开启强制 HTTPS',
        content: '开启后系统生成的所有链接（含页面资源与支付回调）都将使用 https://。若站点未正确启用 HTTPS，页面资源将无法加载。',
      })
    if (has('stop_register') && form.stop_register && !baseline.stop_register)
      risks.push({ title: '停止新用户注册', content: '开启后任何人都将无法注册新账号（包括持有邀请码的用户）。' })
    return confirmRisks(risks)
  },
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard } = ctl

// 试用时长 is only shown (and only meaningful) while a trial plan is selected.
ctl.restoreWhenHidden(() => !!form.try_out_plan_id, ['try_out_hour'])

useSettingsTab({ isDirty: () => dirtyCount.value > 0, save })

// 注册试用：plans are reloaded every time the tab opens (spec §5).
const plans = ref<PlanBrief[]>([])
const plansLoading = ref(false)
onMounted(async () => {
  plansLoading.value = true
  try {
    plans.value = await fetchPlanOptions()
  } catch {
    plans.value = []
  } finally {
    plansLoading.value = false
  }
})

const planOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [{ label: '关闭', value: 0 }]
  for (const p of plans.value) opts.push({ label: p.name, value: p.id })
  const current = form.try_out_plan_id
  if (current && !plansLoading.value && !plans.value.some((p) => p.id === current)) {
    opts.push({ label: `套餐 #${current}（不存在或已删除）`, value: current })
  }
  return opts
})

const subscribeUrlWarning = computed(() => {
  // Placeholders are substituted per request by Helper::replaceByPattern.
  const sample = (u: string) => u.replace(/\[(\d+)-(\d+)\]/g, '$1').replace(/\[uuid\]/g, 'uuid')
  const bad = subscribeUrlList(form.subscribe_url).filter((u) => !isUrl(sample(u)))
  return bad.length ? `以下地址缺少 http(s):// 或格式不正确：${bad.join('、')}` : ''
})
</script>

<template>
  <config-panel
    title="站点设置"
    description="配置站点基本信息，包括站点名称、描述、货币单位等核心设置。"
    :loading="loading"
    :error="loadError"
    :dirty-count="dirtyCount"
    @retry="load()"
  >
    <setting-section title="基本信息">
      <setting-row
        label="站点名称"
        description="用于显示需要站点名称的地方。"
        :dirty="isDirty('app_name')"
        :error="errors.app_name"
      >
        <n-input v-model:value="form.app_name" placeholder="请输入站点名称" />
      </setting-row>
      <setting-row
        label="站点描述"
        description="用于显示需要站点描述的地方。"
        :dirty="isDirty('app_description')"
        :error="errors.app_description"
      >
        <n-input v-model:value="form.app_description" placeholder="请输入站点描述" />
      </setting-row>
      <setting-row
        label="站点网址"
        description="当前网站最新网址，将会在邮件等需要用于网址处体现。末尾的 / 会被自动去除。"
        :dirty="isDirty('app_url')"
        :error="errors.app_url"
      >
        <n-input v-model:value="form.app_url" placeholder="https://example.com" :input-props="{ inputmode: 'url' }" />
      </setting-row>
      <setting-row
        label="强制HTTPS"
        description="当站点没有使用HTTPS，CDN或反代开启强制HTTPS时需要开启。"
        inline
        :dirty="isDirty('force_https')"
        :error="errors.force_https"
      >
        <n-switch v-model:value="form.force_https" />
      </setting-row>
      <setting-row label="LOGO" description="用于显示需要LOGO的地方。" :dirty="isDirty('logo')" :error="errors.logo">
        <n-input v-model:value="form.logo" placeholder="https://example.com/logo.png" :input-props="{ inputmode: 'url' }" />
      </setting-row>
      <setting-row
        label="订阅URL"
        :dirty="isDirty('subscribe_url')"
        :error="errors.subscribe_url"
        :warning="subscribeUrlWarning"
      >
        <template #description>
          用于订阅所使用，留空则为站点URL。可填写多个地址（每行一个），系统会随机选用其中一个；支持
          <code class="mono">[1-100]</code> 随机数与 <code class="mono">[uuid]</code> 占位。
        </template>
        <n-input
          v-model:value="form.subscribe_url"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="每行一个订阅地址，留空则使用站点网址"
        />
      </setting-row>
      <setting-row
        label="用户条款(TOS)URL"
        description="用于跳转到用户条款(TOS)"
        :dirty="isDirty('tos_url')"
        :error="errors.tos_url"
      >
        <n-input v-model:value="form.tos_url" placeholder="https://example.com/tos" :input-props="{ inputmode: 'url' }" />
      </setting-row>
    </setting-section>

    <setting-section title="注册与工单">
      <setting-row
        label="停止新用户注册"
        description="开启后任何人都将无法进行注册。"
        inline
        :dirty="isDirty('stop_register')"
        :error="errors.stop_register"
      >
        <n-switch v-model:value="form.stop_register" />
      </setting-row>
      <setting-row
        label="工单等待回复限制"
        description="开启后，用户在管理员回复前无法在同一工单内连续发送消息。"
        inline
        :dirty="isDirty('ticket_must_wait_reply')"
        :error="errors.ticket_must_wait_reply"
      >
        <n-switch v-model:value="form.ticket_must_wait_reply" />
      </setting-row>
      <setting-row
        label="注册试用"
        description="选择需要试用的订阅，如果没有选项请先前往订阅管理添加。"
        :dirty="isDirty('try_out_plan_id')"
        :error="errors.try_out_plan_id"
      >
        <n-select v-model:value="form.try_out_plan_id" :options="planOptions" :loading="plansLoading" placeholder="关闭" />
      </setting-row>
      <setting-row
        v-if="form.try_out_plan_id"
        label="注册试用时长"
        description="注册试用时长，单位为小时。支持小数（如 0.5），但后端读取时会取整显示。"
        :dirty="isDirty('try_out_hour')"
        :error="errors.try_out_hour"
      >
        <n-input-number v-model:value="form.try_out_hour" :min="0" :step="1" placeholder="0" class="num-input">
          <template #suffix>小时</template>
        </n-input-number>
      </setting-row>
    </setting-section>

    <setting-section title="货币">
      <setting-row
        label="货币单位"
        description="仅用于展示使用，更改后系统中所有的货币单位都将发生变更。"
        :dirty="isDirty('currency')"
        :error="errors.currency"
      >
        <n-input v-model:value="form.currency" placeholder="CNY" />
      </setting-row>
      <setting-row
        label="货币符号"
        description="仅用于展示使用，更改后系统中所有的货币单位都将发生变更。"
        :dirty="isDirty('currency_symbol')"
        :error="errors.currency_symbol"
      >
        <n-input v-model:value="form.currency_symbol" placeholder="¥" />
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
</style>
