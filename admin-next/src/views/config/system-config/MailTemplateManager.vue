<script setup lang="ts">
// 邮件设置 → 模板管理 (spec settings.md §4.6.4, MailTemplateController).
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NIcon,
  NInput,
  NModal,
  NSkeleton,
  NTab,
  NTabs,
  NTag,
  NTooltip,
  type InputInst,
} from 'naive-ui'
import { CheckmarkCircle, CloseCircle, SaveOutline, SendOutline, ArrowUndoOutline, RefreshOutline } from '@vicons/ionicons5'
import {
  fetchConfigGroup,
  getMailTemplate,
  listMailTemplates,
  resetMailTemplate,
  saveMailTemplate,
  testMailTemplate,
  type MailTemplateDetail,
  type MailTemplateSummary,
} from '@/api/config'
import { message } from '@/utils/discrete'
import { formatTime, relativeTime } from '@/utils/format'
import PanelState from './PanelState.vue'
import { confirmAction, isEmail, toStr } from './helpers'

const list = ref<MailTemplateSummary[]>([])
const listLoading = ref(true)
const listError = ref('')
const active = ref('')
const detail = ref<MailTemplateDetail | null>(null)
const detailLoading = ref(false)
const draft = reactive({ subject: '', content: '' })
const saving = ref(false)
const resetting = ref(false)
const site = reactive({ name: '', url: '' })

const activeSummary = computed(() => list.value.find((t) => t.name === active.value) ?? null)
const dirty = computed(
  () => !!detail.value && (draft.subject !== detail.value.subject || draft.content !== detail.value.content),
)

// ---- loading ----

async function loadList(): Promise<boolean> {
  listError.value = ''
  try {
    list.value = await listMailTemplates()
    return true
  } catch (e) {
    listError.value = e instanceof Error ? e.message : '加载失败'
    return false
  }
}

async function loadDetail(name: string) {
  detailLoading.value = true
  try {
    const d = await getMailTemplate(name)
    if (active.value !== name) return
    detail.value = d
    draft.subject = d.subject ?? ''
    draft.content = d.content ?? ''
  } catch {
    if (active.value === name) detail.value = null
  } finally {
    if (active.value === name) detailLoading.value = false
  }
}

async function init() {
  listLoading.value = true
  const ok = await loadList()
  listLoading.value = false
  if (ok && list.value.length) {
    active.value = list.value.some((t) => t.name === active.value) ? active.value : list.value[0].name
    await loadDetail(active.value)
  }
}

onMounted(async () => {
  void init()
  // Sample values for the preview: site name and URL.
  try {
    const s = await fetchConfigGroup('site', { silent: true })
    site.name = toStr(s.app_name)
    site.url = toStr(s.app_url).replace(/\/+$/, '')
  } catch {
    /* fall back to defaults */
  }
})

async function selectTemplate(name: string) {
  if (name === active.value) return
  if (dirty.value) {
    const ok = await confirmAction({
      title: '未保存的修改',
      content: '当前模板有未保存的修改，切换标签页将丢失这些修改。',
      positiveText: '丢弃修改',
    })
    if (!ok) return
  }
  active.value = name
  detail.value = null
  await loadDetail(name)
}

// ---- placeholders ----

const VAR_INFO: Record<string, { desc: string; sample: () => string }> = {
  name: { desc: '站点名称', sample: () => site.name || 'XBoard' },
  url: { desc: '站点网址', sample: () => site.url || 'https://example.com' },
  code: { desc: '验证码', sample: () => '123456' },
  content: { desc: '通知正文', sample: () => '这是一封测试通知邮件。' },
  link: { desc: '登录链接', sample: () => `${site.url || 'https://example.com'}/login?token=test-token` },
}

const vars = computed(() => {
  const d = detail.value
  if (!d) return []
  return [
    ...d.required_vars.map((v) => ({ name: v, required: true })),
    ...d.optional_vars.map((v) => ({ name: v, required: false })),
  ].map((v) => ({
    ...v,
    token: `{{${v.name}}}`,
    desc: VAR_INFO[v.name]?.desc ?? v.name,
    sample: VAR_INFO[v.name]?.sample() ?? '-',
    present: draft.content.includes(`{{${v.name}}}`),
  }))
})
const missingRequired = computed(() => vars.value.filter((v) => v.required && !v.present).map((v) => v.token))

const contentInput = ref<InputInst | null>(null)

async function insertVar(token: string) {
  const el = contentInput.value?.textareaElRef
  if (!el) {
    draft.content += token
    return
  }
  const start = el.selectionStart ?? draft.content.length
  const end = el.selectionEnd ?? start
  draft.content = draft.content.slice(0, start) + token + draft.content.slice(end)
  await nextTick()
  el.focus()
  el.setSelectionRange(start + token.length, start + token.length)
}

// ---- preview (same placeholder syntax as MailService::renderPlaceholders) ----

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.-]+)(?:\|([^}]*))?\s*\}\}/g

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}

/** Only this template's variables are filled, like the backend; others fall back to `|default` or stay literal. */
function renderVars(tpl: string, escape: boolean): string {
  const d = detail.value
  const allowed = new Set(d ? [...d.required_vars, ...d.optional_vars] : [])
  return tpl.replace(PLACEHOLDER_RE, (m, key: string, def: string | undefined) => {
    const info = allowed.has(key) ? VAR_INFO[key] : undefined
    if (!info) return def !== undefined ? def.trim() : m
    const v = info.sample()
    return escape && key !== 'content' ? escapeHtml(v) : v
  })
}

const previewSubject = computed(() => renderVars(draft.subject, false))
const previewDoc = ref('')

function buildPreview() {
  const body = renderVars(draft.content, true)
  if (/<html[\s>]/i.test(body)) return body
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    `<title>${escapeHtml(previewSubject.value)}</title>` +
    '<style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}</style>' +
    `</head><body>${body}</body></html>`
  )
}

let previewTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => [draft.content, draft.subject, site.name, site.url],
  () => {
    clearTimeout(previewTimer)
    previewTimer = setTimeout(() => (previewDoc.value = buildPreview()), 250)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(previewTimer))

// ---- actions ----

function discardDraft() {
  if (!detail.value) return
  draft.subject = detail.value.subject
  draft.content = detail.value.content
}

async function save(): Promise<boolean> {
  const d = detail.value
  if (!d || saving.value) return false
  if (!dirty.value) {
    message.info('没有需要保存的修改')
    return true
  }
  const subject = draft.subject.trim()
  if (!subject) {
    message.error('邮件主题不能为空')
    return false
  }
  if (Array.from(subject).length > 255) {
    message.error('邮件主题不能超过 255 个字符')
    return false
  }
  if (!draft.content.trim()) {
    message.error('模板内容不能为空')
    return false
  }
  if (missingRequired.value.length) {
    message.error(`缺少必要占位符: ${missingRequired.value.join('; ')}`)
    return false
  }
  saving.value = true
  try {
    await saveMailTemplate({ name: d.name, subject: draft.subject, content: draft.content })
    message.success('模板保存成功')
    await Promise.all([loadList(), loadDetail(d.name)])
    return true
  } catch {
    return false
  } finally {
    saving.value = false
  }
}

async function reset() {
  const d = detail.value
  if (!d) return
  const ok = await confirmAction({
    title: '恢复默认模板',
    content: '确定要恢复此模板为默认内容吗？自定义的内容将被删除。',
    positiveText: '确定恢复',
    type: 'error',
  })
  if (!ok) return
  resetting.value = true
  try {
    await resetMailTemplate(d.name)
    message.success('已恢复默认模板')
    await Promise.all([loadList(), loadDetail(d.name)])
  } catch {
    /* toast shown by the http client */
  } finally {
    resetting.value = false
  }
}

// Send-test dialog
const testOpen = ref(false)
const testEmail = ref('')
const testError = ref('')
const testing = ref(false)

function openTest() {
  testEmail.value = ''
  testError.value = ''
  testOpen.value = true
}

async function sendTest() {
  const d = detail.value
  if (!d) return
  const email = testEmail.value.trim()
  if (email && !isEmail(email)) {
    testError.value = '邮箱格式不正确'
    return
  }
  testing.value = true
  try {
    await testMailTemplate(d.name, email || undefined)
    message.success('测试邮件已发送')
    testOpen.value = false
  } catch {
    /* "发送失败: ..." toasted by the http client; keep the dialog open */
  } finally {
    testing.value = false
  }
}

defineExpose({ isDirty: () => dirty.value, save })
</script>

<template>
  <panel-state :loading="listLoading" :error="listError" :rows="3" @retry="init">
    <div class="tpl-manager">
      <n-tabs :value="active" type="line" size="small" class="tpl-tabs" @update:value="(v: string) => selectTemplate(v)">
        <n-tab v-for="t in list" :key="t.name" :name="t.name">
          <span>{{ t.label }}</span>
          <n-tag v-if="t.customized" size="tiny" :bordered="false" class="custom-tag">已自定义</n-tag>
        </n-tab>
      </n-tabs>

      <div v-if="detailLoading && !detail" class="tpl-loading">
        <n-skeleton text :repeat="2" />
        <n-skeleton height="36px" :sharp="false" />
        <n-skeleton height="320px" :sharp="false" />
      </div>
      <div v-else-if="!detail" class="tpl-empty">
        <span class="muted">模板加载失败</span>
        <n-button size="small" @click="loadDetail(active)">
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          重试
        </n-button>
      </div>
      <div v-else class="tpl-body">
        <n-alert type="default" :show-icon="false" class="tpl-notice">
          修改并保存后将覆盖系统默认模板。点击「恢复默认」可随时还原为当前主题的默认模板。
          <template v-if="activeSummary?.customized && activeSummary.updated_at">
            <br />
            <span class="muted" :title="formatTime(activeSummary.updated_at)">
              最后修改：{{ relativeTime(activeSummary.updated_at) }}
            </span>
          </template>
        </n-alert>

        <div class="tpl-field">
          <label class="tpl-label" for="mail-tpl-subject">邮件主题</label>
          <n-input
            v-model:value="draft.subject"
            :input-props="{ id: 'mail-tpl-subject' }"
            placeholder="输入邮件主题，支持 {{name}} 等占位符"
            maxlength="255"
          />
        </div>

        <div class="tpl-field">
          <div class="tpl-label">可用占位符</div>
          <div class="var-table-wrap">
            <table class="var-table">
              <thead>
                <tr>
                  <th>变量</th>
                  <th>说明</th>
                  <th>示例值</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in vars" :key="v.name">
                  <td class="nowrap">
                    <code class="mono var-token">{{ v.token }}</code>
                    <n-tag v-if="v.required" type="error" size="tiny" :bordered="false" class="req-tag">必填</n-tag>
                    <n-tooltip v-if="v.required">
                      <template #trigger>
                        <n-icon :size="15" :class="v.present ? 'ok-icon' : 'miss-icon'">
                          <checkmark-circle v-if="v.present" /><close-circle v-else />
                        </n-icon>
                      </template>
                      {{ v.present ? '模板内容已包含该占位符' : '模板内容缺少该占位符，无法保存' }}
                    </n-tooltip>
                  </td>
                  <td>{{ v.desc }}</td>
                  <td class="sample-cell">{{ v.sample }}</td>
                  <td class="op-cell">
                    <n-button size="tiny" secondary @click="insertVar(v.token)">插入</n-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="tpl-columns">
          <div class="tpl-col">
            <div class="tpl-label">模板内容 (HTML)</div>
            <n-input
              ref="contentInput"
              v-model:value="draft.content"
              type="textarea"
              :rows="22"
              :input-props="{ spellcheck: false, autocomplete: 'off' }"
              class="html-editor"
            />
          </div>
          <div class="tpl-col">
            <div class="tpl-label">
              实时预览
              <span class="preview-subject" :title="previewSubject">主题：{{ previewSubject || '（空）' }}</span>
            </div>
            <iframe class="preview-frame" sandbox="" :srcdoc="previewDoc" title="邮件模板实时预览" />
          </div>
        </div>

        <div class="tpl-actions">
          <n-button type="primary" :disabled="!dirty" :loading="saving" @click="save">
            <template #icon><n-icon><save-outline /></n-icon></template>
            保存
          </n-button>
          <n-tooltip :disabled="!dirty">
            <template #trigger>
              <span>
                <n-button secondary :disabled="dirty" @click="openTest">
                  <template #icon><n-icon><send-outline /></n-icon></template>
                  发送测试
                </n-button>
              </span>
            </template>
            请先保存修改后再发送测试
          </n-tooltip>
          <n-button v-if="dirty" quaternary @click="discardDraft">放弃修改</n-button>
          <n-button v-if="detail.customized" type="error" secondary :loading="resetting" @click="reset">
            <template #icon><n-icon><arrow-undo-outline /></n-icon></template>
            恢复默认
          </n-button>
          <span v-if="dirty" class="dirty-hint"><span class="dirty-dot" />有未保存的修改</span>
        </div>
      </div>
    </div>
  </panel-state>

  <n-modal
    v-model:show="testOpen"
    preset="card"
    title="发送测试邮件"
    :mask-closable="!testing"
    :closable="!testing"
    style="width: min(440px, calc(100vw - 32px))"
  >
    <p class="modal-desc">输入收件邮箱，留空将发送到当前管理员邮箱</p>
    <n-input
      v-model:value="testEmail"
      placeholder="收件邮箱（留空使用当前账号）"
      :input-props="{ type: 'email', autocomplete: 'email' }"
      :status="testError ? 'error' : undefined"
      @update:value="testError = ''"
      @keyup.enter="sendTest"
    />
    <div v-if="testError" class="modal-error">{{ testError }}</div>
    <template #footer>
      <div class="modal-footer">
        <n-button :disabled="testing" @click="testOpen = false">取消</n-button>
        <n-button type="primary" :loading="testing" @click="sendTest">{{ testing ? '发送中...' : '发送测试' }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.tpl-manager {
  container-type: inline-size;
  min-width: 0;
}
.tpl-tabs {
  margin-bottom: 16px;
}
.custom-tag {
  margin-left: 6px;
}
.tpl-loading {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 0 16px;
}
.tpl-empty {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
}
.tpl-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 8px;
}
.tpl-notice {
  font-size: 13px;
}
.tpl-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tpl-label {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}
.var-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.var-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.var-table th,
.var-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--divider-color);
}
.var-table tbody tr:last-child td {
  border-bottom: 0;
}
.var-table th {
  font-weight: 600;
  color: var(--text-muted);
  background: var(--hover-color);
}
.var-token {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--code-bg);
  font-size: 12.5px;
}
.req-tag {
  margin-left: 6px;
}
.ok-icon,
.miss-icon {
  margin-left: 6px;
  vertical-align: -3px;
}
.ok-icon {
  color: var(--success-color);
}
.miss-icon {
  color: var(--error-color);
}
.sample-cell {
  color: var(--text-muted);
  word-break: break-all;
}
.op-cell {
  width: 1%;
  text-align: right;
}
.tpl-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}
.tpl-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.html-editor :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.55;
  tab-size: 2;
  white-space: pre;
}
.preview-subject {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 400;
  color: var(--text-muted);
}
.preview-frame {
  width: 100%;
  height: 478px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  /* Emails are designed for a white canvas; keep the preview faithful in dark mode too. */
  background: #fff;
}
.tpl-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.dirty-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  font-size: 13px;
  color: var(--warning-color);
}
.dirty-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--warning-color);
}
.modal-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-muted);
}
.modal-error {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--error-color);
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@container (max-width: 820px) {
  .tpl-columns {
    grid-template-columns: minmax(0, 1fr);
  }
  .preview-frame {
    height: 420px;
  }
}
</style>
