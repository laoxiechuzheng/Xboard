<script setup lang="ts">
// Time-of-day rate rules (rate_time_ranges). Backend matches `start <= now <= end` as HH:mm strings,
// so a range cannot cross midnight and the first matching rule wins.
import { NButton, NEmpty, NFormItemGi, NGrid, NIcon, NInputNumber, NTimePicker, type FormItemRule } from 'naive-ui'
import { AddOutline, TrashOutline } from '@vicons/ionicons5'
import type { RateRangeState } from './form'

const ranges = defineModel<RateRangeState[]>({ required: true })

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function timeRule(field: 'start' | 'end', index: number): FormItemRule {
  return {
    trigger: ['change', 'blur'],
    validator: () => {
      const r = ranges.value[index]
      if (!r) return true
      const v = r[field]
      if (!v) return new Error(field === 'start' ? '开始时间不能为空' : '结束时间不能为空')
      if (!HHMM.test(v)) return new Error('时间格式须为 HH:mm')
      if (field === 'end' && r.start && HHMM.test(r.start) && r.start > v) {
        return new Error('结束时间早于开始时间（不支持跨午夜，请拆成两段）')
      }
      return true
    },
  }
}

const rateRule: FormItemRule = {
  trigger: ['change', 'blur'],
  validator: (_: unknown, v: number | null) => {
    if (v === null || v === undefined) return new Error('倍率乘数不能为空')
    if (!Number.isFinite(v)) return new Error('倍率乘数必须是数字')
    if (v < 0) return new Error('倍率乘数必须大于或等于0')
    return true
  },
}

function add() {
  ranges.value.push({ start: '00:00', end: '23:59', rate: 1 })
}

function remove(i: number) {
  ranges.value.splice(i, 1)
}
</script>

<template>
  <div class="ranges">
    <div class="ranges-head">
      <div>
        <div class="ranges-title">时间段规则</div>
        <div class="muted ranges-desc">按服务器时间匹配，多条重叠时取第一条命中；不支持跨午夜（如 22:00–02:00 请拆成两段）。</div>
      </div>
      <n-button size="small" secondary type="primary" @click="add">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加规则
      </n-button>
    </div>
    <n-empty v-if="!ranges.length" size="small" description="暂无规则，点击上方按钮添加" class="ranges-empty" />
    <div v-for="(r, i) in ranges" :key="i" class="range-item">
      <div class="range-head">
        <span class="range-name">规则 {{ i + 1 }}</span>
        <n-button quaternary circle size="tiny" type="error" title="删除规则" @click="remove(i)">
          <template #icon><n-icon><trash-outline /></n-icon></template>
        </n-button>
      </div>
      <n-grid cols="1 s:3" responsive="self" :x-gap="10">
        <n-form-item-gi label="开始时间" :path="`rate_time_ranges[${i}].start`" :rule="timeRule('start', i)">
          <n-time-picker
            :formatted-value="r.start"
            @update:formatted-value="(v: string | null) => (r.start = v ?? '')"
            value-format="HH:mm"
            format="HH:mm"
            :clearable="false"
            style="width: 100%"
          />
        </n-form-item-gi>
        <n-form-item-gi label="结束时间" :path="`rate_time_ranges[${i}].end`" :rule="timeRule('end', i)">
          <n-time-picker
            :formatted-value="r.end"
            @update:formatted-value="(v: string | null) => (r.end = v ?? '')"
            value-format="HH:mm"
            format="HH:mm"
            :clearable="false"
            style="width: 100%"
          />
        </n-form-item-gi>
        <n-form-item-gi label="倍率乘数" :path="`rate_time_ranges[${i}].rate`" :rule="rateRule">
          <n-input-number v-model:value="r.rate" :min="0" :step="0.1" placeholder="1.0" style="width: 100%">
            <template #suffix>x</template>
          </n-input-number>
        </n-form-item-gi>
      </n-grid>
    </div>
  </div>
</template>

<style scoped>
.ranges {
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  padding: 10px 12px 2px;
  margin-bottom: 16px;
}
.ranges-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.ranges-title {
  font-weight: 600;
  font-size: 13.5px;
}
.ranges-desc {
  font-size: 12px;
  margin-top: 2px;
}
.ranges-empty {
  padding: 8px 0 14px;
}
.range-item {
  border-top: 1px solid var(--divider-color);
  padding-top: 8px;
}
.range-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.range-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
}
</style>
