<script setup lang="ts">
// 订阅设置 (group `subscribe`, spec settings.md §4.3), including the two
// new-user reminder defaults that the official admin never rendered.
import { computed } from 'vue'
import { NInput, NSelect, NSwitch } from 'naive-ui'
import ConfigPanel from './ConfigPanel.vue'
import SettingRow from './SettingRow.vue'
import SettingSection from './SettingSection.vue'
import SaveBar from './SaveBar.vue'
import { useConfigForm } from './useConfigForm'
import { confirmRisks, toBool, toNum, toStr, useSettingsTab, type Risk } from './helpers'

interface SubscribeForm {
  plan_change_enable: boolean
  reset_traffic_method: number
  surplus_enable: boolean
  new_order_event_id: number
  renew_order_event_id: number
  change_order_event_id: number
  subscribe_path: string
  show_info_to_server_enable: boolean
  show_protocol_to_server_enable: boolean
  default_remind_expire: boolean
  default_remind_traffic: boolean
}

const labels: Record<keyof SubscribeForm, string> = {
  plan_change_enable: '允许用户更改订阅',
  reset_traffic_method: '月流量重置方式',
  surplus_enable: '开启折抵方案',
  new_order_event_id: '当订阅新购时触发事件',
  renew_order_event_id: '当订阅续费时触发事件',
  change_order_event_id: '当订阅变更时触发事件',
  subscribe_path: '订阅路径',
  show_info_to_server_enable: '在订阅中展示订阅信息',
  show_protocol_to_server_enable: '在订阅中线路名称中显示协议名称',
  default_remind_expire: '新用户默认开启到期提醒',
  default_remind_traffic: '新用户默认开启流量提醒',
}

// Same values as Plan::RESET_TRAFFIC_*.
const resetOptions = [
  { label: '每月1号', value: 0 },
  { label: '按月重置', value: 1 },
  { label: '不重置', value: 2 },
  { label: '每年1月1号', value: 3 },
  { label: '按年重置', value: 4 },
]
const eventOptions = [
  { label: '不执行任何动作', value: 0 },
  { label: '重置用户流量', value: 1 },
]

// Route prefix `/{path}/{token}`: segments of letters, digits, "_" or "-", separated by single "/".
const PATH_RE = /^[\w-]+(\/[\w-]+)*$/
const cleanPath = (v: string) => v.trim().replace(/^\/+|\/+$/g, '')

const ctl = useConfigForm<SubscribeForm>({
  group: 'subscribe',
  labels,
  toForm: (r) => ({
    plan_change_enable: toBool(r.plan_change_enable),
    reset_traffic_method: toNum(r.reset_traffic_method) ?? 0,
    surplus_enable: toBool(r.surplus_enable),
    new_order_event_id: toNum(r.new_order_event_id) ?? 0,
    renew_order_event_id: toNum(r.renew_order_event_id) ?? 0,
    change_order_event_id: toNum(r.change_order_event_id) ?? 0,
    subscribe_path: toStr(r.subscribe_path),
    show_info_to_server_enable: toBool(r.show_info_to_server_enable),
    show_protocol_to_server_enable: toBool(r.show_protocol_to_server_enable),
    default_remind_expire: toBool(r.default_remind_expire),
    default_remind_traffic: toBool(r.default_remind_traffic),
  }),
  toPayload: {
    subscribe_path: (v) => cleanPath(v),
  },
  validate: (f, dirty) => {
    const e: Record<string, string> = {}
    if (dirty('subscribe_path')) {
      const p = cleanPath(f.subscribe_path)
      if (!p) e.subscribe_path = '订阅路径不能为空'
      else if (!PATH_RE.test(p)) e.subscribe_path = '只能包含字母、数字、下划线、短横线，多级路径用 / 分隔'
    }
    return e
  },
  beforeSave: ({ form, baseline, has }) => {
    const risks: Risk[] = []
    if (has('subscribe_path'))
      risks.push({
        title: `修改订阅路径为 /${cleanPath(form.subscribe_path)}`,
        content: '修改后所有用户的订阅链接都会变化，旧订阅地址将失效（可能需要重启服务后生效），用户需要在客户端重新导入订阅。',
      })
    if (has('reset_traffic_method')) {
      const label = resetOptions.find((o) => o.value === form.reset_traffic_method)?.label ?? ''
      risks.push({
        title: `全局流量重置方式改为「${label}」`,
        content: '将影响所有未在订阅管理中单独设置重置方式的套餐用户的流量重置时机。',
      })
    }
    const events: Array<[keyof SubscribeForm, string]> = [
      ['new_order_event_id', '新购'],
      ['renew_order_event_id', '续费'],
      ['change_order_event_id', '变更'],
    ]
    for (const [k, name] of events) {
      if (has(k) && form[k] === 1 && baseline[k] !== 1)
        risks.push({ title: `订阅${name}时重置用户流量`, content: `开启后用户${name}订阅完成时，其已用流量会被清零。` })
    }
    return confirmRisks(risks)
  },
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard } = ctl

useSettingsTab({ isDirty: () => dirtyCount.value > 0, save })

const pathPreview = computed(() => cleanPath(form.subscribe_path) || 's')
</script>

<template>
  <config-panel
    title="订阅设置"
    description="管理用户订阅相关配置，包括订阅链接格式、更新频率、流量统计等设置。"
    :loading="loading"
    :error="loadError"
    :dirty-count="dirtyCount"
    @retry="load()"
  >
    <setting-section title="订阅变更">
      <setting-row
        label="允许用户更改订阅"
        description="开启后用户将会可以对订阅计划进行变更。"
        inline
        :dirty="isDirty('plan_change_enable')"
        :error="errors.plan_change_enable"
      >
        <n-switch v-model:value="form.plan_change_enable" />
      </setting-row>
      <setting-row
        label="月流量重置方式"
        description="全局流量重置方式，默认每月1号。可以在订阅管理为订阅单独设置。"
        :dirty="isDirty('reset_traffic_method')"
        :error="errors.reset_traffic_method"
      >
        <n-select v-model:value="form.reset_traffic_method" :options="resetOptions" placeholder="请选择重置方式" />
      </setting-row>
      <setting-row
        label="开启折抵方案"
        description="开启后用户更换订阅将会由系统对原有订阅进行折抵，方案参考文档。"
        inline
        :dirty="isDirty('surplus_enable')"
        :error="errors.surplus_enable"
      >
        <n-switch v-model:value="form.surplus_enable" />
      </setting-row>
      <setting-row
        label="当订阅新购时触发事件"
        description="新购订阅完成时将触发该任务。"
        :dirty="isDirty('new_order_event_id')"
        :error="errors.new_order_event_id"
      >
        <n-select v-model:value="form.new_order_event_id" :options="eventOptions" placeholder="请选择" />
      </setting-row>
      <setting-row
        label="当订阅续费时触发事件"
        description="续费订阅完成时将触发该任务。"
        :dirty="isDirty('renew_order_event_id')"
        :error="errors.renew_order_event_id"
      >
        <n-select v-model:value="form.renew_order_event_id" :options="eventOptions" placeholder="请选择" />
      </setting-row>
      <setting-row
        label="当订阅变更时触发事件"
        description="变更订阅完成时将触发该任务。选择“重置用户流量”时，折抵会按剩余时长与剩余流量比例中的较小值计算。"
        :dirty="isDirty('change_order_event_id')"
        :error="errors.change_order_event_id"
      >
        <n-select v-model:value="form.change_order_event_id" :options="eventOptions" placeholder="请选择" />
      </setting-row>
    </setting-section>

    <setting-section title="订阅链接与内容">
      <setting-row label="订阅路径" :dirty="isDirty('subscribe_path')" :error="errors.subscribe_path">
        <template #description>
          订阅路径，修改后将会改变原有的subscribe路径。<br />
          当前订阅路径格式：<code class="mono path-code">/{{ pathPreview }}/xxxxxxxxxx</code><br />
          修改订阅路径后，可能需要重启服务才能生效。
        </template>
        <n-input v-model:value="form.subscribe_path" placeholder="subscribe" :input-props="{ spellcheck: false, autocomplete: 'off' }" class="mono-field">
          <template #prefix><span class="muted">/</span></template>
        </n-input>
      </setting-row>
      <setting-row
        label="在订阅中展示订阅信息"
        description="开启后将会在用户订阅节点时输出订阅信息。"
        inline
        :dirty="isDirty('show_info_to_server_enable')"
        :error="errors.show_info_to_server_enable"
      >
        <n-switch v-model:value="form.show_info_to_server_enable" />
      </setting-row>
      <setting-row
        label="在订阅中线路名称中显示协议名称"
        description="开启后订阅线路会附带协议名称（例如: [Hy2]香港）"
        inline
        :dirty="isDirty('show_protocol_to_server_enable')"
        :error="errors.show_protocol_to_server_enable"
      >
        <n-switch v-model:value="form.show_protocol_to_server_enable" />
      </setting-row>
    </setting-section>

    <setting-section title="新用户提醒默认值" description="官方后台未提供入口的后端设置，只影响之后注册的新用户。">
      <setting-row
        label="新用户默认开启到期提醒"
        description="新注册用户的“到期邮件提醒”初始状态。"
        inline
        :dirty="isDirty('default_remind_expire')"
        :error="errors.default_remind_expire"
      >
        <n-switch v-model:value="form.default_remind_expire" />
      </setting-row>
      <setting-row
        label="新用户默认开启流量提醒"
        description="新注册用户的“流量邮件提醒”初始状态。"
        inline
        :dirty="isDirty('default_remind_traffic')"
        :error="errors.default_remind_traffic"
      >
        <n-switch v-model:value="form.default_remind_traffic" />
      </setting-row>
    </setting-section>
  </config-panel>
  <save-bar :count="dirtyCount" :saving="saving" @save="save" @discard="discard" />
</template>

<style scoped>
.mono-field :deep(input) {
  font-family: var(--font-mono);
}
.path-code {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--code-bg);
  font-size: 12px;
}
</style>
