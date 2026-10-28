<script setup lang="ts">
// 邀请&佣金设置 (group `invite`, spec settings.md §4.4).
import { computed } from 'vue'
import { NDynamicTags, NInputNumber, NSwitch } from 'naive-ui'
import ConfigPanel from './ConfigPanel.vue'
import SettingRow from './SettingRow.vue'
import SettingSection from './SettingSection.vue'
import SaveBar from './SaveBar.vue'
import { useConfigForm } from './useConfigForm'
import { confirmRisks, isInteger, toBool, toNum, toStrList, uniq, useSettingsTab, type Risk } from './helpers'

interface InviteForm {
  invite_force: boolean
  invite_commission: number | null
  invite_gen_limit: number | null
  invite_never_expire: boolean
  commission_first_time_enable: boolean
  commission_auto_check_enable: boolean
  commission_withdraw_limit: number | null
  commission_withdraw_method: string[]
  withdraw_close_enable: boolean
  commission_distribution_enable: boolean
  commission_distribution_l1: number | null
  commission_distribution_l2: number | null
  commission_distribution_l3: number | null
}

const labels: Record<keyof InviteForm, string> = {
  invite_force: '开启强制邀请',
  invite_commission: '邀请佣金百分比',
  invite_gen_limit: '用户可创建邀请码上限',
  invite_never_expire: '邀请码永不失效',
  commission_first_time_enable: '佣金仅首次发放',
  commission_auto_check_enable: '佣金自动确认',
  commission_withdraw_limit: '提现单申请门槛(元)',
  commission_withdraw_method: '提现方式',
  withdraw_close_enable: '关闭提现',
  commission_distribution_enable: '三级分销',
  commission_distribution_l1: '一级邀请人比例',
  commission_distribution_l2: '二级邀请人比例',
  commission_distribution_l3: '三级邀请人比例',
}

/** Withdraw methods: trimmed, empty removed, de-duplicated (also splits pasted "a,b"). */
function methodList(v: string[]): string[] {
  return uniq(v.flatMap((s) => s.split(/[,，]/)).map((s) => s.trim()).filter(Boolean))
}

const ctl = useConfigForm<InviteForm>({
  group: 'invite',
  labels,
  toForm: (r) => ({
    invite_force: toBool(r.invite_force),
    invite_commission: toNum(r.invite_commission),
    invite_gen_limit: toNum(r.invite_gen_limit),
    invite_never_expire: toBool(r.invite_never_expire),
    commission_first_time_enable: toBool(r.commission_first_time_enable),
    commission_auto_check_enable: toBool(r.commission_auto_check_enable),
    commission_withdraw_limit: toNum(r.commission_withdraw_limit),
    commission_withdraw_method: toStrList(r.commission_withdraw_method),
    withdraw_close_enable: toBool(r.withdraw_close_enable),
    commission_distribution_enable: toBool(r.commission_distribution_enable),
    commission_distribution_l1: toNum(r.commission_distribution_l1),
    commission_distribution_l2: toNum(r.commission_distribution_l2),
    commission_distribution_l3: toNum(r.commission_distribution_l3),
  }),
  toPayload: {
    commission_withdraw_method: (v) => methodList(v),
  },
  validate: (f, dirty) => {
    const e: Record<string, string> = {}
    const int = (k: 'invite_commission' | 'invite_gen_limit', max?: number) => {
      const v = f[k]
      if (!dirty(k) || v === null) return
      if (!isInteger(v) || v < 0) e[k] = '请输入不小于 0 的整数'
      else if (max !== undefined && v > max) e[k] = `不能大于 ${max}`
    }
    int('invite_commission', 100)
    int('invite_gen_limit')
    if (dirty('commission_withdraw_limit') && f.commission_withdraw_limit !== null && f.commission_withdraw_limit < 0)
      e.commission_withdraw_limit = '提现门槛不能为负数'
    // CheckCommission casts each level with (int): 33.5 would silently pay 33%.
    for (const k of ['commission_distribution_l1', 'commission_distribution_l2', 'commission_distribution_l3'] as const) {
      const v = f[k]
      if (dirty(k) && v !== null && (!isInteger(v) || v < 0 || v > 100)) e[k] = '请输入 0 到 100 之间的整数'
    }
    return e
  },
  beforeSave: ({ form, baseline, has }) => {
    const risks: Risk[] = []
    if (has('invite_force') && form.invite_force && !baseline.invite_force)
      risks.push({ title: '开启强制邀请', content: '开启后只有填写有效邀请码的用户才能注册。' })
    if (has('commission_withdraw_method') && !methodList(form.commission_withdraw_method).length && !form.withdraw_close_enable)
      risks.push({ title: '提现方式为空', content: '用户将没有可选的提现方式，无法提交提现申请。' })
    if (has('withdraw_close_enable') && form.withdraw_close_enable && !baseline.withdraw_close_enable)
      risks.push({ title: '关闭提现', content: '关闭后用户将无法申请提现，之后产生的邀请佣金会直接进入用户余额。' })
    if (form.commission_distribution_enable && distributionTotal.value > 100)
      risks.push({
        title: `三级分销比例合计 ${distributionTotal.value}%`,
        content: '三级比例合计超过 100%，发放的佣金将超过订单佣金总额。',
      })
    return confirmRisks(risks)
  },
})
const { form, errors, loading, loadError, saving, dirtyCount, isDirty, load, save, discard } = ctl

ctl.restoreWhenHidden(() => form.commission_distribution_enable, [
  'commission_distribution_l1',
  'commission_distribution_l2',
  'commission_distribution_l3',
])

useSettingsTab({ isDirty: () => dirtyCount.value > 0, save })

const distributionTotal = computed(
  () =>
    (form.commission_distribution_l1 ?? 0) + (form.commission_distribution_l2 ?? 0) + (form.commission_distribution_l3 ?? 0),
)
const distributionWarning = computed(() =>
  distributionTotal.value > 100 ? `当前三级比例合计 ${distributionTotal.value}%，请不要大于 100%` : '',
)
const methodWarning = computed(() =>
  !methodList(form.commission_withdraw_method).length && !form.withdraw_close_enable ? '提现方式为空时用户无法申请提现' : '',
)
</script>

<template>
  <config-panel
    title="邀请&佣金设置"
    description="邀请注册、佣金相关设置。"
    :loading="loading"
    :error="loadError"
    :dirty-count="dirtyCount"
    @retry="load()"
  >
    <setting-section title="邀请">
      <setting-row
        label="开启强制邀请"
        description="开启后只有被邀请的用户才可以进行注册。"
        inline
        :dirty="isDirty('invite_force')"
        :error="errors.invite_force"
      >
        <n-switch v-model:value="form.invite_force" />
      </setting-row>
      <setting-row
        label="邀请佣金百分比"
        description="默认全局的佣金分配比例，你可以在用户管理单独配置单个比例。留空则恢复默认值 10。"
        :dirty="isDirty('invite_commission')"
        :error="errors.invite_commission"
      >
        <n-input-number v-model:value="form.invite_commission" :min="0" :max="100" :precision="0" placeholder="请输入佣金百分比" clearable class="num-input">
          <template #suffix>%</template>
        </n-input-number>
      </setting-row>
      <setting-row
        label="用户可创建邀请码上限"
        description="用户可创建邀请码上限。留空则恢复默认值 5。"
        :dirty="isDirty('invite_gen_limit')"
        :error="errors.invite_gen_limit"
      >
        <n-input-number v-model:value="form.invite_gen_limit" :min="0" :precision="0" placeholder="请输入创建上限" clearable class="num-input">
          <template #suffix>个</template>
        </n-input-number>
      </setting-row>
      <setting-row
        label="邀请码永不失效"
        description="开启后邀请码被使用后将不会失效，否则使用过后即失效。"
        inline
        :dirty="isDirty('invite_never_expire')"
        :error="errors.invite_never_expire"
      >
        <n-switch v-model:value="form.invite_never_expire" />
      </setting-row>
    </setting-section>

    <setting-section title="佣金">
      <setting-row
        label="佣金仅首次发放"
        description="开启后被邀请人首次支付时才会产生佣金，可以在用户管理对用户进行单独配置。"
        inline
        :dirty="isDirty('commission_first_time_enable')"
        :error="errors.commission_first_time_enable"
      >
        <n-switch v-model:value="form.commission_first_time_enable" />
      </setting-row>
      <setting-row
        label="佣金自动确认"
        description="开启后佣金将会在订单完成3日后自动进行确认。"
        inline
        :dirty="isDirty('commission_auto_check_enable')"
        :error="errors.commission_auto_check_enable"
      >
        <n-switch v-model:value="form.commission_auto_check_enable" />
      </setting-row>
      <setting-row
        label="提现单申请门槛(元)"
        description="小于门槛金额的提现单将不会被提交。单位为元。留空则恢复默认值 100。"
        :dirty="isDirty('commission_withdraw_limit')"
        :error="errors.commission_withdraw_limit"
      >
        <n-input-number v-model:value="form.commission_withdraw_limit" :min="0" placeholder="请输入提现门槛" clearable class="num-input">
          <template #suffix>元</template>
        </n-input-number>
      </setting-row>
      <setting-row
        label="提现方式"
        description="可以支持的提现方式。输入后按回车添加，点击标签上的 × 删除。"
        :dirty="isDirty('commission_withdraw_method')"
        :error="errors.commission_withdraw_method"
        :warning="methodWarning"
      >
        <n-dynamic-tags v-model:value="form.commission_withdraw_method" />
      </setting-row>
      <setting-row
        label="关闭提现"
        description="关闭后将禁止用户申请提现，且邀请佣金将会直接进入用户余额。"
        inline
        :dirty="isDirty('withdraw_close_enable')"
        :error="errors.withdraw_close_enable"
      >
        <n-switch v-model:value="form.withdraw_close_enable" />
      </setting-row>
    </setting-section>

    <setting-section title="三级分销">
      <setting-row
        label="三级分销"
        description="开启后将佣金将按照设置的3成比例进行分成，三成比例合计请不要大于100%。"
        inline
        :dirty="isDirty('commission_distribution_enable')"
        :error="errors.commission_distribution_enable"
      >
        <n-switch v-model:value="form.commission_distribution_enable" />
      </setting-row>
      <template v-if="form.commission_distribution_enable">
        <setting-row
          label="一级邀请人比例"
          description="直接邀请人获得的佣金比例（按整数百分比计算）。"
          :dirty="isDirty('commission_distribution_l1')"
          :error="errors.commission_distribution_l1"
        >
          <n-input-number v-model:value="form.commission_distribution_l1" :min="0" :max="100" :precision="0" placeholder="请输入比例，如：50" clearable class="num-input">
            <template #suffix>%</template>
          </n-input-number>
        </setting-row>
        <setting-row
          label="二级邀请人比例"
          :dirty="isDirty('commission_distribution_l2')"
          :error="errors.commission_distribution_l2"
        >
          <n-input-number v-model:value="form.commission_distribution_l2" :min="0" :max="100" :precision="0" placeholder="请输入比例，如：50" clearable class="num-input">
            <template #suffix>%</template>
          </n-input-number>
        </setting-row>
        <setting-row
          label="三级邀请人比例"
          :dirty="isDirty('commission_distribution_l3')"
          :error="errors.commission_distribution_l3"
          :warning="distributionWarning"
        >
          <n-input-number v-model:value="form.commission_distribution_l3" :min="0" :max="100" :precision="0" placeholder="请输入比例，如：50" clearable class="num-input">
            <template #suffix>%</template>
          </n-input-number>
          <template #extra>
            <span class="muted total-hint">三级合计：{{ distributionTotal }}%</span>
          </template>
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
.total-hint {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
</style>
