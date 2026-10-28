<script setup lang="ts">
// Add / edit a knowledge article (spec content.md §4.4). Editing always reloads the full record
// (the list lacks language/body) and blocks submit until it arrives. Category is required here
// as on the backend and offers existing names (spec R-K2); language is limited to char(5) codes.
import { computed, h, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NAutoComplete,
  NButton,
  NDropdown,
  NForm,
  NFormItemGi,
  NGrid,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
  type DropdownOption,
  type FormInst,
  type FormItemRule,
  type FormRules,
} from 'naive-ui'
import { ChevronDown, CodeOutline } from '@vicons/ionicons5'
import { ApiError } from '@/api/http'
import {
  KNOWLEDGE_LANGUAGES,
  fetchKnowledge,
  saveKnowledge,
  type KnowledgeListItem,
  type KnowledgeSavePayload,
} from '@/api/knowledge'
import { confirm, message } from '@/utils/discrete'
import ContentEditor from '../notice/ContentEditor.vue'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** Row being edited (null = create). */
    row: KnowledgeListItem | null
    /** Category prefilled when creating from a group. */
    presetCategory?: string
    categories?: string[]
  }>(),
  { presetCategory: '', categories: () => [] },
)
const emit = defineEmits<{
  'update:show': [boolean]
  saved: [created: boolean]
  /** The edited article no longer exists: the parent should reload. */
  missing: []
}>()

interface FormModel {
  title: string
  category: string
  language: string
  show: boolean
  body: string
}
const blank = (category = ''): FormModel => ({ title: '', category, language: 'zh-CN', show: false, body: '' })

const formRef = ref<FormInst | null>(null)
const form = reactive<FormModel>(blank())
const detailLoading = ref(false)
const detailError = ref('')
const submitting = ref(false)
const hasError = ref(false)
let snapshot = ''
let loadSeq = 0

const isEdit = computed(() => !!props.row?.id)
const locked = computed(() => isEdit.value && (detailLoading.value || !!detailError.value))

const vanished = (e: unknown) =>
  e instanceof ApiError && e.status === 500 && (e.body as { status?: string } | null)?.status !== 'fail'

async function loadDetail() {
  const row = props.row
  if (!row) return
  const my = ++loadSeq
  detailLoading.value = true
  detailError.value = ''
  try {
    const k = await fetchKnowledge(row.id, { silent: true })
    if (my !== loadSeq || !props.show) return
    Object.assign(form, {
      title: k.title ?? '',
      category: k.category ?? '',
      language: (k.language ?? '').trim() || 'zh-CN',
      show: !!k.show,
      body: k.body ?? '',
    })
    snapshot = JSON.stringify(form)
  } catch (e) {
    if (my !== loadSeq) return
    // Unknown ids crash server-side with a generic 500 (spec R-K4).
    if (vanished(e)) {
      message.error('该知识已不存在（可能已被删除），列表已刷新')
      emit('missing')
      emit('update:show', false)
    } else {
      detailError.value = e instanceof ApiError ? e.message : '加载失败'
    }
  } finally {
    if (my === loadSeq) detailLoading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (!open) {
      loadSeq++
      return
    }
    hasError.value = false
    detailError.value = ''
    formRef.value?.restoreValidation()
    const row = props.row
    if (row) {
      // Show what the list knows while the full record loads.
      Object.assign(form, { ...blank(row.category ?? ''), title: row.title ?? '', show: !!row.show })
      snapshot = JSON.stringify(form)
      void loadDetail()
    } else {
      Object.assign(form, blank(props.presetCategory))
      snapshot = JSON.stringify(form)
    }
  },
  { immediate: true },
)

// ---------- options ----------
const languageOptions = computed(() => {
  const opts = KNOWLEDGE_LANGUAGES.map((l) => ({ label: `${l.label}（${l.value}）`, value: l.value }))
  // Keep legacy codes visible instead of silently changing them.
  if (form.language && !opts.some((o) => o.value === form.language)) {
    opts.push({ label: `${form.language}（未知语言）`, value: form.language })
  }
  return opts
})

const categoryOptions = computed(() => {
  const kw = form.category.trim().toLowerCase()
  const uniq = [...new Set(props.categories.filter((c) => !!c))]
  return uniq
    .filter((c) => c !== form.category && (!kw || c.toLowerCase().includes(kw)))
    .slice(0, 20)
    .map((c) => ({ label: c, value: c }))
})

const VARIABLES = [
  { token: '{{siteName}}', label: '站点名称' },
  { token: '{{subscribeUrl}}', label: '当前用户的订阅链接' },
  { token: '{{urlEncodeSubscribeUrl}}', label: 'URL 编码后的订阅链接' },
  { token: '{{safeBase64SubscribeUrl}}', label: 'URL 安全 Base64 编码的订阅链接' },
]
const ACCESS_START = '<!--access start-->'
const ACCESS_END = '<!--access end-->'

const insertOptions: DropdownOption[] = [
  ...VARIABLES.map((v) => ({
    key: v.token,
    label: () => h('span', { class: 'kb-opt' }, [h('code', null, v.token), h('span', { class: 'kb-opt-desc' }, v.label)]),
  })),
  { type: 'divider', key: 'd1' },
  {
    key: 'access',
    label: () =>
      h('span', { class: 'kb-opt' }, [h('span', null, '付费可见区块'), h('span', { class: 'kb-opt-desc' }, '仅有效订阅用户可见')]),
  },
]

function onInsert(
  key: string | number,
  api: { insert: (t: string) => void; wrapBlock: (p: string, s: string, placeholder: string) => void },
) {
  if (key === 'access') api.wrapBlock(`${ACCESS_START}\n`, `\n${ACCESS_END}`, '此处内容仅对有效订阅用户可见')
  else api.insert(String(key))
}

// ---------- validation ----------
const required = (msg: string, max?: number) => [
  {
    required: true,
    trigger: ['input', 'blur', 'change'],
    validator: (_r: FormItemRule, v: string) => {
      const s = (v ?? '').trim()
      if (!s) return new Error(msg)
      return max && s.length > max ? new Error(`不能超过 ${max} 个字符`) : true
    },
  },
]
const rules: FormRules = {
  title: required('标题不能为空', 250),
  category: required('分类不能为空', 250),
  language: required('语言不能为空'),
  body: required('内容不能为空'),
}

// ---------- close / submit ----------
const dirty = () => JSON.stringify(form) !== snapshot

async function requestClose() {
  if (submitting.value) return
  if (!locked.value && dirty()) {
    const ok = await confirm({
      title: '放弃修改',
      content: '表单内容尚未提交，关闭后本次修改将丢失。确定关闭吗？',
      positiveText: '放弃修改',
      type: 'warning',
    })
    if (!ok) return
  }
  emit('update:show', false)
}

async function submit() {
  if (locked.value) return
  try {
    await formRef.value?.validate()
    hasError.value = false
  } catch {
    hasError.value = true
    return
  }
  const payload: KnowledgeSavePayload = {
    id: props.row?.id ?? null,
    language: form.language,
    category: form.category.trim(),
    title: form.title.trim(),
    body: form.body,
    show: form.show,
  }
  submitting.value = true
  try {
    await saveKnowledge(payload, { silent: true })
    message.success('操作成功')
    snapshot = JSON.stringify(form)
    emit('saved', !isEdit.value)
    emit('update:show', false)
  } catch (e) {
    if (isEdit.value && vanished(e)) {
      message.error('该知识已不存在（可能已被删除），列表已刷新')
      emit('missing')
      emit('update:show', false)
    } else {
      message.error(e instanceof ApiError ? e.message : '提交失败')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="isEdit ? '编辑知识' : '添加知识'"
    :bordered="false"
    :style="{ width: 'min(980px, calc(100vw - 24px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    :auto-focus="false"
    @update:show="(v: boolean) => (v ? emit('update:show', true) : requestClose())"
  >
    <p class="subtitle">发布或编辑知识库文章，支持多语言和 Markdown 格式。用户端按界面语言显示对应文章，并按分类分组。</p>
    <n-alert v-if="detailError" type="error" :show-icon="true" class="form-alert">
      加载文章详情失败：{{ detailError }}
      <n-button size="tiny" secondary class="retry" @click="loadDetail">重试</n-button>
    </n-alert>
    <n-alert v-else-if="hasError" type="error" :show-icon="true" class="form-alert">表单校验未通过，请检查标红的字段</n-alert>

    <n-spin :show="detailLoading" description="正在加载文章内容...">
      <n-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :disabled="locked"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-grid cols="1 600:2" responsive="self" :x-gap="20">
          <n-form-item-gi label="标题" path="title">
            <n-input v-model:value="form.title" placeholder="请输入知识标题" maxlength="250" show-count clearable />
          </n-form-item-gi>
          <n-form-item-gi label="分类" path="category">
            <n-auto-complete
              v-model:value="form.category"
              :options="categoryOptions"
              :get-show="() => true"
              :input-props="{ maxlength: 250 }"
              placeholder="请输入分类，可选择已有分类；同名分类会自动归为一组"
              clearable
            />
          </n-form-item-gi>
          <n-form-item-gi label="语言" path="language">
            <n-select v-model:value="form.language" :options="languageOptions" placeholder="请选择语言" />
          </n-form-item-gi>
          <n-form-item-gi label="显示" path="show">
            <div class="switch-field">
              <n-switch v-model:value="form.show" />
              <span class="muted">{{ form.show ? '保存后立即在用户端显示' : '暂不在用户端显示' }}</span>
            </div>
          </n-form-item-gi>
          <n-form-item-gi span="1 600:2" label="内容" path="body">
            <div class="field-stack">
              <content-editor v-model:value="form.body" :disabled="locked" placeholder="请输入文章内容，支持 Markdown 与 HTML">
                <template #tools="api">
                  <n-dropdown
                    trigger="click"
                    :options="insertOptions"
                    :disabled="api.disabled"
                    @select="(key: string | number) => onInsert(key, api)"
                  >
                    <n-button quaternary size="small" :disabled="api.disabled" @mousedown.prevent>
                      <template #icon><n-icon><code-outline /></n-icon></template>
                      插入变量
                      <n-icon :size="12" class="caret"><chevron-down /></n-icon>
                    </n-button>
                  </n-dropdown>
                </template>
              </content-editor>
              <div class="vars">
                <span class="vars-title">可用变量</span>
                <span v-for="v in VARIABLES" :key="v.token" class="var">
                  <code>{{ v.token }}</code>
                  {{ v.label }}
                </span>
                <span class="var">
                  <code>{{ ACCESS_START }}…{{ ACCESS_END }}</code>
                  之间的内容仅对有效订阅用户显示，其他用户看到“需要有效订阅”提示
                </span>
              </div>
            </div>
          </n-form-item-gi>
        </n-grid>
      </n-form>
    </n-spin>

    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="submitting" @click="requestClose">取消</n-button>
        <n-button type="primary" :loading="submitting" :disabled="locked" @click="submit">提交</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.subtitle {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.form-alert {
  margin-bottom: 14px;
}
.retry {
  margin-left: 8px;
}
.switch-field {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  font-size: 13px;
}
.field-stack {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.caret {
  margin-left: 2px;
  opacity: 0.7;
}
.vars {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--hover-color);
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}
.vars-title {
  font-weight: 600;
  color: var(--text-color);
}
.var code {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--code-bg);
  color: var(--text-strong);
}
:global(.kb-opt code) {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--code-bg);
  color: var(--text-strong);
}
:global(.kb-opt) {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}
:global(.kb-opt-desc) {
  font-size: 12px;
  color: var(--text-muted);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
