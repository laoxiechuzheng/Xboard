<script setup lang="ts">
// Monospace block with a one-click copy button (tokens, install commands).
import { onBeforeUnmount, ref } from 'vue'
import { NButton, NIcon, NSkeleton } from 'naive-ui'
import { CheckmarkOutline, CopyOutline } from '@vicons/ionicons5'
import { message } from '@/utils/discrete'

const props = withDefaults(
  defineProps<{
    text: string
    loading?: boolean
    loadingText?: string
    /** Toast shown after copying. */
    copiedMessage?: string
    /** Also render a full-width copy button under the block. */
    copyButton?: string
    /** Emphasize as a terminal command. */
    command?: boolean
  }>(),
  { loading: false, loadingText: '加载中...', copiedMessage: '已复制', copyButton: '', command: false },
)

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

/** Clipboard API first; fall back to execCommand when it is missing or permission is denied (embedded webviews). */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

async function copy() {
  if (!props.text || props.loading) return
  const ok = await writeClipboard(props.text)
  if (!ok) {
    message.error('复制失败，请手动选中复制')
    return
  }
  message.success(props.copiedMessage)
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 2000)
}

onBeforeUnmount(() => clearTimeout(timer))
defineExpose({ copy })
</script>

<template>
  <div class="code-wrap">
    <div class="code-block" :class="{ command }">
      <template v-if="loading">
        <span class="muted loading-text">{{ loadingText }}</span>
        <n-skeleton text :repeat="2" style="margin-top: 6px" />
      </template>
      <pre v-else class="code-text"><span v-if="command" class="prompt">$ </span>{{ text }}</pre>
      <n-button
        v-if="!loading && text"
        class="copy-icon"
        size="tiny"
        quaternary
        circle
        :type="copied ? 'success' : 'default'"
        :aria-label="copied ? '已复制' : '复制'"
        :title="copied ? '已复制' : '复制'"
        @click="copy"
      >
        <template #icon>
          <n-icon><checkmark-outline v-if="copied" /><copy-outline v-else /></n-icon>
        </template>
      </n-button>
    </div>
    <n-button
      v-if="copyButton"
      block
      secondary
      :type="copied ? 'success' : 'primary'"
      :disabled="loading || !text"
      class="copy-full"
      @click="copy"
    >
      <template #icon>
        <n-icon><checkmark-outline v-if="copied" /><copy-outline v-else /></n-icon>
      </template>
      {{ copied ? '已复制!' : copyButton }}
    </n-button>
  </div>
</template>

<style scoped>
.code-block {
  position: relative;
  padding: 10px 40px 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--code-bg);
  min-height: 40px;
}
.code-text {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-strong);
  /* one click selects everything, for manual copying */
  user-select: all;
}
.prompt {
  color: var(--success-color);
  user-select: none;
}
.loading-text {
  font-size: 12px;
}
.copy-icon {
  position: absolute;
  top: 6px;
  right: 6px;
}
.copy-full {
  margin-top: 10px;
}
</style>
