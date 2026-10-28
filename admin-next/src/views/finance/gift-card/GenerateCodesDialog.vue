<script setup lang="ts">
// 生成兑换码 (spec commerce §6.3.4). Adds a "永久有效" option and a result step with batch export.
import { computed, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NResult,
  NSelect,
  NSwitch,
} from 'naive-ui'
import { CopyOutline, DownloadOutline, ListOutline } from '@vicons/ionicons5'
import { generateCodes, generateCodesCsv, type GeneratePayload, type GenerateResult } from '@/api/giftCard'
import { copyText, saveFile } from '@/utils/clipboard'
import { message } from '@/utils/discrete'
import { formatTime } from '@/utils/format'
import { downloadBatch, fileStamp, loadTemplateOptions, templateOptions, templateSelectOptions } from './helpers'

const props = defineProps<{
  show: boolean
  /** Preselected template. */
  templateId?: number | null
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** Codes were generated (refresh lists). */
  (e: 'generated'): void
  /** Show the generated batch in the codes tab. */
  (e: 'view-batch', batchId: string): void
}>()

const form = reactive({
  template_id: null as number | null,
  count: 10 as number | null,
  prefix: '',
  permanent: false,
  expires_hours: 720 as number | null,
  max_usage: 1 as number | null,
  download_csv: false,
})
const submitted = ref(false)
const submitting = ref(false)
const result = ref<GenerateResult | null>(null)
const exporting = ref(false)

function reset(keepTemplate = false) {
  form.template_id = keepTemplate ? form.template_id : (props.templateId ?? null)
  form.count = 10
  form.prefix = ''
  form.permanent = false
  form.expires_hours = 720
  form.max_usage = 1
  form.download_csv = false
  submitted.value = false
  result.value = null
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    reset()
    void loadTemplateOptions(true).then(() => {
      // Drop a preset that is disabled or gone.
      const t = templateOptions.list.find((x) => x.id === form.template_id)
      if (form.template_id !== null && (!t || !t.status)) form.template_id = null
    })
  },
)

const options = computed(() => templateSelectOptions({ disableInactive: true }))

const errors = computed(() => {
  const e: Record<string, string> = {}
  if (!form.template_id) e.template_id = '请选择一个模板'
  if (!form.count || form.count < 1) e.count = '生成数量必须大于0'
  else if (form.count > 10000) e.count = '单次最多生成10000个'
  if (form.prefix && !/^[A-Z0-9]{1,10}$/.test(form.prefix)) e.prefix = '前缀只能包含大写字母和数字，最多 10 位'
  if (!form.permanent && (!form.expires_hours || form.expires_hours < 1)) e.expires_hours = '有效期必须大于0'
  if (!form.max_usage || form.max_usage < 1) e.max_usage = '最大使用次数必须大于0'
  else if (form.max_usage > 1000) e.max_usage = '最大使用次数不能超过 1000'
  return e
})
const err = (k: string) => (submitted.value ? errors.value[k] : undefined)

function onPrefix(v: string) {
  form.prefix = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
}

const sample = computed(() => `${form.prefix || 'GC'}${'X'.repeat(12)}`)
const expiryPreview = computed(() => {
  if (form.permanent) return '生成的兑换码长期有效'
  if (!form.expires_hours || form.expires_hours < 1) return ''
  return `将于 ${formatTime(Date.now() + form.expires_hours * 3600_000, false)} 左右过期（约 ${Number((form.expires_hours / 24).toFixed(1))} 天）`
})

function payload(): GeneratePayload {
  const body: GeneratePayload = {
    template_id: form.template_id!,
    count: form.count!,
    max_usage: form.max_usage!,
  }
  if (form.prefix) body.prefix = form.prefix
  // Omit expires_hours for permanent codes: an explicit null would make them expire immediately.
  if (!form.permanent) body.expires_hours = form.expires_hours!
  return body
}

async function submit() {
  submitted.value = true
  if (Object.keys(errors.value).length || submitting.value) return
  submitting.value = true
  try {
    if (form.download_csv) {
      const blob = await generateCodesCsv(payload())
      // Prepend a BOM so Excel opens the UTF-8 CSV with the correct encoding.
      saveFile(new Blob(['\ufeff', blob], { type: 'text/csv;charset=utf-8' }), `gift_codes_${fileStamp()}.csv`)
      message.success('兑换码生成成功，CSV 已下载')
      emit('generated')
      emit('update:show', false)
    } else {
      result.value = await generateCodes(payload())
      message.success('兑换码生成成功')
      emit('generated')
    }
  } catch {
    /* toast handled by http client */
  } finally {
    submitting.value = false
  }
}

async function exportResult() {
  if (!result.value) return
  exporting.value = true
  await downloadBatch(result.value.batch_id)
  exporting.value = false
}

function viewBatch() {
  if (!result.value) return
  emit('view-batch', result.value.batch_id)
  emit('update:show', false)
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="result ? '生成完成' : '生成兑换码'"
    :style="{ width: 'min(520px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <template v-if="result">
      <n-result status="success" :title="`已生成 ${result.count} 个兑换码`" size="small">
        <template #footer>
          <div class="batch-box">
            <span class="muted">批次号</span>
            <span class="mono batch-id">{{ result.batch_id }}</span>
            <n-button text size="small" aria-label="复制批次号" @click="copyText(result.batch_id, '复制成功')">
              <template #icon><n-icon><copy-outline /></n-icon></template>
            </n-button>
          </div>
          <p class="muted result-hint">可随时在兑换码列表中按批次号筛选或导出本批次。</p>
        </template>
      </n-result>
    </template>

    <n-form v-else label-placement="top" @submit.prevent="submit">
      <n-form-item label="选择模板" required :validation-status="err('template_id') ? 'error' : undefined" :feedback="err('template_id')">
        <n-select
          v-model:value="form.template_id"
          :options="options"
          :loading="templateOptions.loading"
          filterable
          placeholder="请选择一个模板来生成兑换码"
        />
      </n-form-item>
      <div class="grid-2">
        <n-form-item label="生成数量" required :validation-status="err('count') ? 'error' : undefined" :feedback="err('count')">
          <n-input-number v-model:value="form.count" :min="1" :max="10000" :precision="0" class="full">
            <template #suffix>个</template>
          </n-input-number>
        </n-form-item>
        <n-form-item label="最大使用次数" required :validation-status="err('max_usage') ? 'error' : undefined" :feedback="err('max_usage')">
          <n-input-number v-model:value="form.max_usage" :min="1" :max="1000" :precision="0" class="full">
            <template #suffix>次</template>
          </n-input-number>
        </n-form-item>
      </div>
      <n-form-item label="自定义前缀 (可选)" :validation-status="err('prefix') ? 'error' : undefined">
        <n-input :value="form.prefix" placeholder="留空默认 GC" maxlength="10" clearable class="mono-input" @update:value="onPrefix" />
        <template #feedback>
          <span v-if="err('prefix')">{{ err('prefix') }}</span>
          <span v-else class="muted">仅大写字母和数字；兑换码格式：<span class="mono">{{ sample }}</span></span>
        </template>
      </n-form-item>
      <n-form-item label="有效期 (小时)" :required="!form.permanent" :validation-status="err('expires_hours') ? 'error' : undefined">
        <div class="expiry-row">
          <n-input-number
            v-model:value="form.expires_hours"
            :min="1"
            :precision="0"
            :disabled="form.permanent"
            class="expiry-input"
          >
            <template #suffix>H</template>
          </n-input-number>
          <span class="inline-switch">
            <n-switch v-model:value="form.permanent" size="small" />
            <span class="switch-label" @click="form.permanent = !form.permanent">永久有效</span>
          </span>
        </div>
        <template #feedback>
          <span v-if="err('expires_hours')">{{ err('expires_hours') }}</span>
          <span v-else class="muted">{{ expiryPreview }}</span>
        </template>
      </n-form-item>
      <div class="switch-row">
        <div>
          <div class="switch-title">导出CSV</div>
          <div class="switch-desc">生成后直接下载包含全部兑换码的 CSV 文件。</div>
        </div>
        <n-switch v-model:value="form.download_csv" />
      </div>
      <n-alert v-if="(form.max_usage ?? 1) > 1" type="info" :show-icon="false" class="tip">
        最大使用次数大于 1 时，同一兑换码可被多次兑换（同一用户也可重复兑换），可在模板的“使用限制”中限制单用户次数。
      </n-alert>
      <n-alert v-if="(form.count ?? 0) > 2000" type="warning" :show-icon="false" class="tip">
        数量较大，生成可能需要较长时间，请耐心等待。
      </n-alert>
    </n-form>

    <template #footer>
      <div class="footer">
        <template v-if="result">
          <n-button :loading="exporting" @click="exportResult">
            <template #icon><n-icon><download-outline /></n-icon></template>
            导出 TXT
          </n-button>
          <n-button @click="viewBatch">
            <template #icon><n-icon><list-outline /></n-icon></template>
            查看本批次
          </n-button>
          <n-button @click="reset(true)">继续生成</n-button>
          <n-button type="primary" @click="emit('update:show', false)">完成</n-button>
        </template>
        <template v-else>
          <n-button :disabled="submitting" @click="emit('update:show', false)">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="submit">生成</n-button>
        </template>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
.full {
  width: 100%;
}
.mono-input :deep(input) {
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}
.expiry-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  flex-wrap: wrap;
}
.expiry-input {
  flex: 1;
  min-width: 160px;
}
.inline-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.switch-label {
  cursor: pointer;
  user-select: none;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.switch-title {
  font-size: 13px;
  font-weight: 500;
}
.switch-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}
.tip {
  margin-top: 12px;
  font-size: 12px;
}
.batch-box {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--code-bg);
  max-width: 100%;
}
.batch-id {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.result-hint {
  margin: 10px 0 0;
  font-size: 12px;
}
.footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 520px) {
  .grid-2 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
