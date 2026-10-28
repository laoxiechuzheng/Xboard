<script setup lang="ts">
// Bulk mail dialog (spec §6.2). One request per scope; never sends sort (R-3); filtered requires filters (R-4).
import { computed, ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NSelect, NInput, NButton, NIcon, NTag, NAlert } from 'naive-ui'
import { SendOutline, DocumentTextOutline } from '@vicons/ionicons5'
import { countUsers, sendUserMail, type BulkScopePayload, type UserFilter } from '@/api/user'
import { confirm, message } from '@/utils/discrete'
import { formatNumber } from '@/utils/format'
import { scopePayload, type BulkScope } from './scope'

const props = defineProps<{
  show: boolean
  defaultScope: BulkScope
  selectedIds: number[]
  filter: UserFilter[]
  /** Row count of the current filtered list (table total). */
  filteredTotal: number
}>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const VARIABLES = [
  'app.name',
  'app.url',
  'now',
  'user.id',
  'user.email',
  'user.uuid',
  'user.plan_name',
  'user.expired_at',
  'user.transfer_enable',
  'user.transfer_used',
  'user.transfer_left',
]

const scope = ref<BulkScope>('all')
const subject = ref('')
const content = ref('')
const sending = ref(false)
const contentWrap = ref<HTMLElement | null>(null)
const varToken = (v: string) => '{{' + v + '}}'

watch(
  () => props.show,
  (v) => {
    if (v) scope.value = props.defaultScope
  },
)

const scopeOptions = computed(() => [
  { label: `仅选中（${props.selectedIds.length}）`, value: 'selected', disabled: !props.selectedIds.length },
  {
    label: props.filter.length ? `筛选后的用户（${formatNumber(props.filteredTotal)}）` : '筛选后的用户',
    value: 'filtered',
    disabled: !props.filter.length,
  },
  { label: '全部用户', value: 'all' },
])

function fillTemplate() {
  subject.value = '【{{app.name}}】系统通知（{{now}}）'
  content.value =
    '尊敬的用户 {{user.email}} 您好：\n\n这里是来自 {{app.name}} 的系统通知。\n\n如有问题请访问：{{app.url}}\n'
}

function insertVar(v: string) {
  const token = varToken(v)
  const el = contentWrap.value?.querySelector('textarea')
  if (el && typeof el.selectionStart === 'number') {
    const start = el.selectionStart
    const end = el.selectionEnd
    content.value = content.value.slice(0, start) + token + content.value.slice(end)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  } else {
    content.value += token
  }
}

function buildScope(): BulkScopePayload | null {
  return scopePayload(scope.value, [...props.selectedIds], props.filter)
}

async function submit() {
  if (!subject.value.trim() || !content.value.trim()) {
    message.warning('请填写所有必填字段')
    return
  }
  const payload = buildScope()
  if (!payload) {
    message.warning(scope.value === 'selected' ? '请先选择用户' : '当前没有筛选条件')
    return
  }
  sending.value = true
  try {
    let count: number
    if (payload.scope === 'selected') count = payload.user_ids.length
    else if (payload.scope === 'filtered') count = props.filteredTotal
    else count = await countUsers()
    const ok = await confirm({
      title: payload.scope === 'all' ? '确认向全部用户发送邮件' : '确认发送邮件',
      content:
        payload.scope === 'all'
          ? `将向系统中全部 ${formatNumber(count)} 个用户发送邮件（包括已封禁和已过期的用户）。邮件进入队列后无法撤回，确定继续吗？`
          : `将向 ${formatNumber(count)} 个用户发送邮件，邮件进入队列后无法撤回。确定继续吗？`,
      positiveText: '发送',
      type: payload.scope === 'all' ? 'error' : 'warning',
    })
    if (!ok) return
    await sendUserMail(payload, subject.value, content.value)
    message.success('邮件发送成功，已加入发送队列')
    subject.value = ''
    content.value = ''
    emit('update:show', false)
  } catch {
    /* toast handled by http client */
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :bordered="false"
    :style="{ width: 'min(680px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template #header>
      <div>
        <div>发送邮件</div>
        <div class="head-desc">向所选或已筛选的用户发送邮件</div>
      </div>
    </template>

    <n-form label-placement="top">
      <n-form-item label="发送范围" required>
        <n-select v-model:value="scope" :options="scopeOptions" />
      </n-form-item>
      <n-alert v-if="scope === 'all'" type="warning" :show-icon="true" class="mb">将发送给系统中的所有用户，请确认内容无误。</n-alert>

      <n-form-item label="主题" required>
        <div class="field">
          <n-input v-model:value="subject" placeholder="例如：系统通知（支持占位符）" />
          <div class="hint">支持占位符：<code v-pre>{{key}}</code> 或 <code v-pre>{{key|默认值}}</code>（未知变量会原样保留）</div>
        </div>
      </n-form-item>

      <n-form-item required>
        <template #label>
          <div class="label-row">
            <span>内容</span>
            <n-button text type="primary" size="small" @click="fillTemplate">
              <template #icon><n-icon><document-text-outline /></n-icon></template>
              填入系统通知模板
            </n-button>
          </div>
        </template>
        <div ref="contentWrap" class="field">
          <n-input
            v-model:value="content"
            type="textarea"
            placeholder="请输入邮件正文（可使用占位符）"
            :autosize="{ minRows: 9, maxRows: 18 }"
          />
          <div class="hint">content 默认按纯文本处理（会转义），不支持 HTML 富文本。</div>
        </div>
      </n-form-item>

      <div class="vars">
        <div class="vars-title">可用变量 <span class="muted">（点击插入到光标处）</span></div>
        <div class="vars-list">
          <n-tag v-for="v in VARIABLES" :key="v" size="small" class="var" round @click="insertVar(v)">
            <span class="mono">{{ varToken(v) }}</span>
          </n-tag>
        </div>
        <div class="hint">流量类变量为原始字节数。</div>
      </div>
    </n-form>

    <template #footer>
      <div class="footer">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="sending" @click="submit">
          <template #icon><n-icon><send-outline /></n-icon></template>
          {{ sending ? '发送中...' : '发送' }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.head-desc {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}
.mb {
  margin-bottom: 16px;
}
.field {
  width: 100%;
}
.hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.hint code,
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.vars {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--hover-color);
}
.vars-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}
.vars-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.var {
  cursor: pointer;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
