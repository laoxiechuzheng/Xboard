<script setup lang="ts">
// Tag input: Enter / comma adds, pasting "a,b" adds several, Backspace on empty removes the last.
// Tags are trimmed, de-duplicated and blanks dropped (fixes spec R-N4); the stored JSON must fit
// varchar(255) (spec R-N6), so additions beyond that are refused with a hint.
import { computed, ref } from 'vue'
import { NButton, NIcon, NTag } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { message } from '@/utils/discrete'
import { TAGS_MAX_JSON, phpJsonLength, splitTags } from './tags'

const props = withDefaults(
  defineProps<{
    value: string[]
    placeholder?: string
    /** Quick-add chips (tags not yet present are shown). */
    suggestions?: string[]
    /** Tag rendered with a warning color (e.g. 弹窗). */
    highlight?: string
  }>(),
  { placeholder: '输入后回车添加标签', suggestions: () => [], highlight: '' },
)
const emit = defineEmits<{ 'update:value': [string[]] }>()

const draft = ref('')
const focused = ref(false)
const composing = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

const used = computed(() => phpJsonLength(props.value))
const usage = computed(() => used.value / TAGS_MAX_JSON)
const quick = computed(() => props.suggestions.filter((s) => !props.value.includes(s)).slice(0, 8))

function add(tokens: string[]) {
  const next = [...props.value]
  const rejected: string[] = []
  for (const t of tokens) {
    const s = t.trim()
    if (!s || next.includes(s)) continue
    if (phpJsonLength([...next, s]) > TAGS_MAX_JSON) {
      rejected.push(s)
      continue
    }
    next.push(s)
  }
  if (rejected.length) message.warning(`标签总长度超出限制（存储上限 ${TAGS_MAX_JSON} 字节），未添加：${rejected.join('、')}`)
  if (next.length !== props.value.length) emit('update:value', next)
}

function commitDraft() {
  const tokens = splitTags(draft.value)
  draft.value = ''
  if (tokens.length) add(tokens)
}

function remove(tag: string) {
  emit(
    'update:value',
    props.value.filter((t) => t !== tag),
  )
}

function onKeydown(e: KeyboardEvent) {
  if (composing.value || e.isComposing || e.keyCode === 229) return
  if (e.key === 'Enter' || e.key === ',' || e.key === '，' || e.key === ';' || e.key === '；') {
    e.preventDefault()
    commitDraft()
  } else if (e.key === 'Backspace' && draft.value === '' && props.value.length) {
    e.preventDefault()
    remove(props.value[props.value.length - 1])
  }
}

function onInput() {
  // IME commits of full-width separators arrive via input rather than keydown.
  if (!composing.value && /[,，;；\n]/.test(draft.value)) commitDraft()
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') ?? ''
  if (!/[,，;；\r\n]/.test(text)) return
  e.preventDefault()
  add(splitTags(draft.value + text))
  draft.value = ''
}

function onBlur() {
  focused.value = false
  commitDraft()
}

function onCompositionEnd() {
  composing.value = false
  onInput()
}

const focusInput = () => inputEl.value?.focus()
</script>

<template>
  <div class="tag-field">
    <div class="tag-box" :class="{ focused }" @click="focusInput">
      <n-tag
        v-for="t in value"
        :key="t"
        size="small"
        closable
        :bordered="false"
        :type="t === highlight ? 'warning' : 'default'"
        class="tag"
        @close="remove(t)"
      >
        {{ t }}
      </n-tag>
      <input
        ref="inputEl"
        v-model="draft"
        class="tag-input"
        :placeholder="value.length ? '' : placeholder"
        aria-label="添加标签"
        @keydown="onKeydown"
        @input="onInput"
        @paste="onPaste"
        @focus="focused = true"
        @blur="onBlur"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
      />
    </div>
    <div class="tag-foot">
      <div v-if="quick.length" class="quick">
        <span class="muted">快捷添加</span>
        <n-button
          v-for="s in quick"
          :key="s"
          size="tiny"
          secondary
          :type="s === highlight ? 'warning' : 'default'"
          @click="add([s])"
        >
          <template #icon><n-icon><add-outline /></n-icon></template>
          {{ s }}
        </n-button>
      </div>
      <span class="usage" :class="{ warn: usage > 0.8 }">已用 {{ used }} / {{ TAGS_MAX_JSON }}</span>
    </div>
  </div>
</template>

<style scoped>
.tag-field {
  width: 100%;
  min-width: 0;
}
.tag-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: text;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.tag-box:hover {
  border-color: var(--primary-color-hover);
}
.tag-box.focused {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
}
.tag {
  max-width: 100%;
}
.tag-input {
  flex: 1;
  min-width: 140px;
  height: 24px;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-color);
  font: inherit;
  font-size: 14px;
}
.tag-input::placeholder {
  color: var(--text-muted);
  opacity: 0.8;
}
.tag-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
}
.quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
}
.usage {
  flex: none;
  margin-left: auto;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.usage.warn {
  color: var(--warning-color);
}
</style>
