<script setup lang="ts">
// Markdown editor shared by notices and knowledge: formatting toolbar + sanitized live preview.
// The default user theme renders with markdown-it (html: true, breaks: false); the preview mirrors
// that with marked and strips scripts/handlers, because this page holds the admin token (spec R-X3).
import { computed, nextTick, ref, watch } from 'vue'
import { NButton, NButtonGroup, NIcon, NInput, NTooltip, type InputInst } from 'naive-ui'
import {
  ChatbubbleEllipsesOutline,
  CodeSlashOutline,
  GridOutline,
  ImageOutline,
  LinkOutline,
  ListOutline,
  RemoveOutline,
} from '@vicons/ionicons5'
import { marked } from 'marked'
import { appState } from '@/stores/app'
import { sanitizeHtml } from '@/utils/sanitize'

const props = withDefaults(
  defineProps<{
    value: string
    placeholder?: string
    minRows?: number
    maxRows?: number
    disabled?: boolean
  }>(),
  { placeholder: '支持 Markdown 与 HTML', minRows: 14, maxRows: 26, disabled: false },
)
const emit = defineEmits<{ 'update:value': [string] }>()

type Mode = 'edit' | 'split' | 'preview'
const mode = ref<Mode>(appState.isMobile ? 'edit' : 'split')
watch(
  () => appState.isMobile,
  (m) => {
    if (m && mode.value === 'split') mode.value = 'edit'
  },
)
// Plain buttons, not a radio group: inside an NFormItem a radio group fires the form's
// change/input/blur triggers and would validate the empty content on a mode switch.
const modes = computed<{ value: Mode; label: string }[]>(() => [
  { value: 'edit', label: '编辑' },
  ...(appState.isMobile ? [] : [{ value: 'split' as const, label: '分屏' }]),
  { value: 'preview', label: '预览' },
])

const inputRef = ref<InputInst | null>(null)
const textarea = () => inputRef.value?.textareaElRef ?? null

const html = computed(() => {
  if (mode.value === 'edit' || !props.value.trim()) return ''
  try {
    return sanitizeHtml(marked.parse(props.value, { async: false, gfm: true, breaks: false }) as string)
  } catch {
    return ''
  }
})

// ---------- editing helpers (operate on the current selection) ----------
function selection() {
  const v = props.value ?? ''
  const t = textarea()
  return { v, start: t ? t.selectionStart : v.length, end: t ? t.selectionEnd : v.length }
}

/**
 * Replace [from, to) with `text`, then select [selStart, selEnd) of the new value.
 * Uses execCommand('insertText') when available so Ctrl+Z keeps working.
 */
function replaceRange(from: number, to: number, text: string, selStart: number, selEnd = selStart) {
  if (props.disabled) return
  const v = props.value ?? ''
  const expected = v.slice(0, from) + text + v.slice(to)
  const t = textarea()
  let done = false
  if (t) {
    t.focus()
    t.setSelectionRange(from, to)
    try {
      done = document.execCommand('insertText', false, text) && t.value === expected
    } catch {
      done = false
    }
  }
  if (!done) emit('update:value', expected)
  void nextTick(() => {
    const el = textarea()
    if (!el) return
    el.focus()
    el.setSelectionRange(selStart, selEnd)
  })
}

function wrap(prefix: string, suffix: string, placeholder: string) {
  const { v, start, end } = selection()
  const selected = v.slice(start, end)
  // Clicking again on an already wrapped selection unwraps it.
  if (selected && v.slice(start - prefix.length, start) === prefix && v.slice(end, end + suffix.length) === suffix) {
    replaceRange(start - prefix.length, end + suffix.length, selected, start - prefix.length, end - prefix.length)
    return
  }
  const text = selected || placeholder
  const s = start + prefix.length
  replaceRange(start, end, prefix + text + suffix, s, s + text.length)
}

/** Like wrap(), but keeps prefix/suffix on their own lines (e.g. HTML comment markers). */
function wrapBlock(prefix: string, suffix: string, placeholder: string) {
  const { v, start, end } = selection()
  const text = v.slice(start, end) || placeholder
  const before = v.slice(0, start)
  const after = v.slice(end)
  const pre = before === '' || before.endsWith('\n') ? '' : '\n'
  const post = after === '' || after.startsWith('\n') ? '' : '\n'
  const s = start + pre.length + prefix.length
  replaceRange(start, end, pre + prefix + text + suffix + post, s, s + text.length)
}

function prefixLines(make: (i: number) => string) {
  const { v, start, end } = selection()
  const lineStart = start === 0 ? 0 : v.lastIndexOf('\n', start - 1) + 1
  const endAnchor = end > start && v[end - 1] === '\n' ? end - 1 : end
  let lineEnd = v.indexOf('\n', endAnchor)
  if (lineEnd === -1) lineEnd = v.length
  const block = v
    .slice(lineStart, lineEnd)
    .split('\n')
    .map((l, i) => make(i) + l)
    .join('\n')
  replaceRange(lineStart, lineEnd, block, lineStart, lineStart + block.length)
}

/** Insert a block on its own paragraph; `inner` selects a sub-range of `text` afterwards. */
function insertBlock(text: string, inner?: [number, number]) {
  const { v, start, end } = selection()
  const before = v.slice(0, start)
  const after = v.slice(end)
  const pre = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const post = after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const base = start + pre.length
  replaceRange(start, end, pre + text + post, base + (inner?.[0] ?? text.length), base + (inner?.[1] ?? text.length))
}

function insertLink(image: boolean) {
  const { v, start, end } = selection()
  const label = v.slice(start, end) || (image ? '图片描述' : '链接文字')
  const head = `${image ? '!' : ''}[${label}](`
  const url = 'https://'
  replaceRange(start, end, `${head}${url})`, start + head.length, start + head.length + url.length)
}

function insertCode() {
  const { v, start, end } = selection()
  const selected = v.slice(start, end)
  if (selected && !selected.includes('\n')) {
    wrap('`', '`', '')
    return
  }
  const body = selected || '代码'
  insertBlock('```\n' + body + '\n```', [4, 4 + body.length])
}

const TABLE = '| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |'

/** Insert plain text at the cursor (used by placeholder buttons). */
function insert(text: string) {
  const { start, end } = selection()
  replaceRange(start, end, text, start + text.length)
}

function onKeydown(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
  const k = e.key.toLowerCase()
  if (k === 'b') wrap('**', '**', '粗体文字')
  else if (k === 'i') wrap('*', '*', '斜体文字')
  else if (k === 'k') insertLink(false)
  else return
  e.preventDefault()
  // Keep handled shortcuts away from window listeners (Ctrl/Cmd+K also opens the command palette).
  e.stopPropagation()
}

defineExpose({ insert, wrap, wrapBlock })

interface Tool {
  key: string
  label: string
  glyph?: string
  icon?: typeof LinkOutline
  run: () => void
}
const tools: Tool[][] = [
  [
    { key: 'h', label: '标题', glyph: 'H', run: () => prefixLines(() => '## ') },
    { key: 'b', label: '粗体（Ctrl+B）', glyph: 'B', run: () => wrap('**', '**', '粗体文字') },
    { key: 'i', label: '斜体（Ctrl+I）', glyph: 'I', run: () => wrap('*', '*', '斜体文字') },
    { key: 's', label: '删除线', glyph: 'S', run: () => wrap('~~', '~~', '删除线文字') },
  ],
  [
    { key: 'ul', label: '无序列表', icon: ListOutline, run: () => prefixLines(() => '- ') },
    { key: 'ol', label: '有序列表', glyph: '1.', run: () => prefixLines((i) => `${i + 1}. `) },
    { key: 'quote', label: '引用', icon: ChatbubbleEllipsesOutline, run: () => prefixLines(() => '> ') },
    { key: 'code', label: '代码', icon: CodeSlashOutline, run: insertCode },
  ],
  [
    { key: 'link', label: '链接（Ctrl+K）', icon: LinkOutline, run: () => insertLink(false) },
    { key: 'img', label: '图片', icon: ImageOutline, run: () => insertLink(true) },
    { key: 'table', label: '表格', icon: GridOutline, run: () => insertBlock(TABLE, [2, 5]) },
    { key: 'hr', label: '分割线', icon: RemoveOutline, run: () => insertBlock('---') },
  ],
]
</script>

<template>
  <div class="md-editor" :class="{ disabled }">
    <div class="md-toolbar">
      <div class="md-tools">
        <template v-for="(group, gi) in tools" :key="gi">
          <span v-if="gi > 0" class="md-sep" />
          <n-tooltip v-for="t in group" :key="t.key" :delay="400">
            <template #trigger>
              <n-button
                quaternary
                size="small"
                class="md-tool"
                :class="`tool-${t.key}`"
                :aria-label="t.label"
                :disabled="disabled || mode === 'preview'"
                @mousedown.prevent
                @click="t.run"
              >
                <n-icon v-if="t.icon" :size="16"><component :is="t.icon" /></n-icon>
                <span v-else class="glyph">{{ t.glyph }}</span>
              </n-button>
            </template>
            {{ t.label }}
          </n-tooltip>
        </template>
        <template v-if="$slots.tools">
          <span class="md-sep" />
          <slot
            name="tools"
            :insert="insert"
            :wrap="wrap"
            :wrapBlock="wrapBlock"
            :disabled="disabled || mode === 'preview'"
          />
        </template>
      </div>
      <n-button-group size="small" class="md-mode" role="group" aria-label="编辑模式">
        <n-button
          v-for="m in modes"
          :key="m.value"
          secondary
          :type="mode === m.value ? 'primary' : 'default'"
          :aria-pressed="mode === m.value"
          @click="mode = m.value"
        >
          {{ m.label }}
        </n-button>
      </n-button-group>
    </div>

    <div class="md-panes" :class="mode">
      <n-input
        v-show="mode !== 'preview'"
        ref="inputRef"
        type="textarea"
        :value="value"
        :disabled="disabled"
        :autosize="{ minRows, maxRows }"
        :placeholder="placeholder"
        :input-props="{ spellcheck: false }"
        class="md-input"
        @update:value="(v: string) => emit('update:value', v)"
        @keydown="onKeydown"
      />
      <div v-if="mode !== 'edit'" class="md-preview-wrap">
        <!-- Sanitized (sanitize.ts): scripts, event handlers and javascript: URLs are removed. -->
        <div v-if="html" class="md-preview markdown-body" v-html="html" />
        <div v-else class="md-preview md-empty">暂无内容，输入后在此显示预览</div>
      </div>
    </div>
    <div class="md-foot">
      <span>支持 Markdown 与 HTML；预览已移除脚本等不安全内容，用户端实际效果以主题渲染为准。</span>
      <span class="md-count">{{ value.length }} 字符</span>
    </div>
  </div>
</template>

<style scoped>
.md-editor {
  width: 100%;
  min-width: 0;
}
.md-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: 4px 6px;
  margin-bottom: 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.md-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  min-width: 0;
}
.md-sep {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--divider-color);
}
.md-tool {
  min-width: 30px;
  padding: 0 7px;
}
.glyph {
  font-size: 14px;
  line-height: 1;
  font-family: Georgia, 'Times New Roman', serif;
}
.tool-b .glyph {
  font-weight: 700;
}
.tool-i .glyph {
  font-style: italic;
}
.tool-s .glyph {
  text-decoration: line-through;
}
.tool-ol .glyph {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}
.md-mode {
  flex: none;
  margin-left: auto;
}
.md-panes {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.md-panes.split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.md-input :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
}
.md-preview-wrap {
  min-width: 0;
  display: flex;
}
.md-preview {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 16px;
  overflow: auto;
}
/* In split mode the textarea sets the row height; the preview scrolls inside it. */
.split .md-preview {
  contain: size;
}
.preview .md-preview {
  min-height: 320px;
  max-height: 62vh;
}
.md-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
}
.md-preview > :deep(:first-child) {
  margin-top: 0;
}
.md-preview > :deep(:last-child) {
  margin-bottom: 0;
}
.md-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.md-count {
  flex: none;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 767px) {
  .md-foot > span:first-child {
    display: none;
  }
  .md-foot {
    justify-content: flex-end;
  }
}
</style>
