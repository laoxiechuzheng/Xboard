<script setup lang="ts">
// Add / edit a notice (spec content.md §3.4). Never sends `popup` (R-N1); legacy rows with
// tags=null / img_url=null are normalized (R-N2); the form is rebuilt on every open (R-N3).
import { computed, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NInput,
  NModal,
  NSwitch,
  type FormInst,
  type FormItemRule,
  type FormRules,
} from 'naive-ui'
import { ApiError } from '@/api/http'
import { POPUP_TAG, saveNotice, type Notice, type NoticeSavePayload } from '@/api/notice'
import { confirm, message } from '@/utils/discrete'
import ContentEditor from './ContentEditor.vue'
import TagInput from './TagInput.vue'
import { TAGS_MAX_JSON, normalizeTags, phpJsonLength } from './tags'

const props = withDefaults(defineProps<{ show: boolean; notice: Notice | null; tagSuggestions?: string[] }>(), {
  tagSuggestions: () => [],
})
const emit = defineEmits<{
  'update:show': [boolean]
  saved: [created: boolean]
  /** The edited notice no longer exists: the parent should reload. */
  missing: []
}>()

interface FormModel {
  title: string
  content: string
  img_url: string
  tags: string[]
  show: boolean
}
const blank = (): FormModel => ({ title: '', content: '', img_url: '', tags: [], show: false })

const formRef = ref<FormInst | null>(null)
const form = reactive<FormModel>(blank())
const submitting = ref(false)
const hasError = ref(false)
const imgFailed = ref(false)
let snapshot = ''

const isEdit = computed(() => !!props.notice?.id)
const suggestions = computed(() => [POPUP_TAG, ...props.tagSuggestions.filter((t) => t !== POPUP_TAG)])

watch(
  () => props.show,
  (open) => {
    if (!open) return
    const n = props.notice
    Object.assign(
      form,
      n
        ? {
            title: n.title ?? '',
            content: n.content ?? '',
            img_url: n.img_url ?? '',
            tags: normalizeTags(n.tags),
            show: !!n.show,
          }
        : blank(),
    )
    snapshot = JSON.stringify(form)
    hasError.value = false
    imgFailed.value = false
    formRef.value?.restoreValidation()
  },
  { immediate: true },
)

const URL_RE = /^https?:\/\/\S+$/i
const imgUrl = computed(() => form.img_url.trim())
const imgValid = computed(() => URL_RE.test(imgUrl.value) && imgUrl.value.length <= 255)
watch(imgUrl, () => (imgFailed.value = false))

const rules: FormRules = {
  title: [
    {
      required: true,
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: string) => {
        const s = (v ?? '').trim()
        if (!s) return new Error('标题不能为空')
        return s.length > 250 ? new Error('标题不能超过 250 个字符') : true
      },
    },
  ],
  content: [
    {
      required: true,
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: string) => ((v ?? '').trim() ? true : new Error('内容不能为空')),
    },
  ],
  img_url: [
    {
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: string) => {
        const s = (v ?? '').trim()
        if (!s) return true
        if (s.length > 255) return new Error('图片URL不能超过 255 个字符')
        return URL_RE.test(s) ? true : new Error('图片URL格式不正确，需以 http:// 或 https:// 开头')
      },
    },
  ],
  tags: [
    {
      trigger: 'change',
      validator: (_r: FormItemRule, v: string[]) =>
        phpJsonLength(v ?? []) <= TAGS_MAX_JSON ? true : new Error(`标签总长度超出存储上限（${TAGS_MAX_JSON} 字节）`),
    },
  ],
}

const dirty = () => JSON.stringify(form) !== snapshot

async function requestClose() {
  if (submitting.value) return
  if (dirty()) {
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
  try {
    await formRef.value?.validate()
    hasError.value = false
  } catch {
    hasError.value = true
    return
  }
  const payload: NoticeSavePayload = {
    id: props.notice?.id ?? null,
    title: form.title.trim(),
    content: form.content,
    img_url: imgUrl.value || null,
    tags: normalizeTags(form.tags),
    show: form.show,
  }
  submitting.value = true
  try {
    await saveNotice(payload, { silent: true })
    message.success('提交成功')
    snapshot = JSON.stringify(form)
    emit('saved', !isEdit.value)
    emit('update:show', false)
  } catch (e) {
    const err = e instanceof ApiError ? e : null
    // Updating a deleted id crashes server-side (generic 500, not a `fail` envelope; spec R-K4).
    const vanished =
      isEdit.value && err?.status === 500 && (err.body as { status?: string } | null)?.status !== 'fail'
    if (vanished) {
      message.error('该公告已不存在（可能已被删除），列表已刷新')
      emit('missing')
      emit('update:show', false)
    } else {
      message.error(err?.message || '提交失败')
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
    :title="isEdit ? '编辑公告' : '添加公告'"
    :bordered="false"
    :style="{ width: 'min(980px, calc(100vw - 24px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    :auto-focus="false"
    @update:show="(v: boolean) => (v ? emit('update:show', true) : requestClose())"
  >
    <p class="subtitle">发布或编辑系统公告，内容支持 Markdown 格式。</p>
    <n-alert v-if="hasError" type="error" :show-icon="true" class="form-alert">表单校验未通过，请检查标红的字段</n-alert>
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" require-mark-placement="right-hanging">
      <n-form-item label="标题" path="title">
        <n-input v-model:value="form.title" placeholder="请输入公告标题" maxlength="250" show-count clearable />
      </n-form-item>

      <n-form-item label="公告内容" path="content">
        <content-editor v-model:value="form.content" placeholder="请输入公告内容，支持 Markdown 与 HTML" />
      </n-form-item>

      <n-form-item label="公告背景" path="img_url">
        <div class="field-stack">
          <div class="img-field">
            <n-input v-model:value="form.img_url" placeholder="请输入公告背景图片URL（可选）" maxlength="255" clearable />
            <div v-if="imgValid" class="img-thumb" :class="{ failed: imgFailed }">
              <img v-if="!imgFailed" :src="imgUrl" alt="公告背景预览" @error="imgFailed = true" />
              <span v-else>无法加载</span>
            </div>
          </div>
          <div class="hint">默认主题会将其作为公告卡片的背景图，留空则使用默认样式。</div>
        </div>
      </n-form-item>

      <n-grid cols="1 600:3" responsive="self" :x-gap="20">
        <n-form-item-gi span="1 600:2" label="公告标签" path="tags">
          <div class="field-stack">
            <tag-input v-model:value="form.tags" :suggestions="suggestions" :highlight="POPUP_TAG" />
            <div class="hint">
              默认主题会把带「{{ POPUP_TAG }}」标签的第一条显示中公告，在用户登录后以弹窗形式展示。
            </div>
          </div>
        </n-form-item-gi>
        <n-form-item-gi label="显示" path="show">
          <div class="switch-field">
            <n-switch v-model:value="form.show" />
            <span class="muted">{{ form.show ? '保存后立即在用户端显示' : '暂不在用户端显示' }}</span>
          </div>
        </n-form-item-gi>
      </n-grid>
    </n-form>

    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="submitting" @click="requestClose">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">提交</n-button>
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
.img-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.img-thumb {
  flex: none;
  width: 72px;
  height: 34px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-muted);
}
.img-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.img-thumb.failed {
  border-style: dashed;
  color: var(--warning-color);
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
.field-stack {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.switch-field {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  font-size: 13px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
