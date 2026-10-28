<script setup lang="ts">
// Conversation bubbles. Messages are user-supplied plain text: rendered with text interpolation
// only (never v-html / Markdown, spec R-X2), keeping line breaks via CSS.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { NEmpty, NSkeleton } from 'naive-ui'
import type { TicketMessage } from '@/api/ticket'
import { appState } from '@/stores/app'
import { formatDate, formatTime } from '@/utils/format'

const props = defineProps<{
  ticketId: number
  messages: TicketMessage[] | null
  loading: boolean
}>()

const box = ref<HTMLElement | null>(null)
let forceNext = false

const items = computed(() => {
  const list = [...(props.messages ?? [])].sort((a, b) => a.id - b.id)
  let lastDay = ''
  return list.map((m) => {
    const day = formatDate(m.created_at)
    const showDay = day !== lastDay
    lastDay = day
    const isAdmin = m.is_from_admin ?? false
    return { m, isAdmin, day: showDay ? day : '' }
  })
})

function scrollToBottom(smooth = false) {
  const el = box.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
}

/** Jump instantly, then settle smoothly once late layout (fonts, wrapping) is done. */
function settleBottom() {
  void nextTick(() => {
    scrollToBottom(false)
    setTimeout(() => scrollToBottom(true), 300)
  })
}

function nearBottom() {
  const el = box.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
}

/** Next content change scrolls to the bottom even if the reader scrolled up (after own reply). */
function stickNext() {
  forceNext = true
}

// Switching tickets always lands at the newest message.
watch(
  () => props.ticketId,
  () => {
    forceNext = true
  },
  { immediate: true },
)

const signature = computed(() => {
  const list = props.messages ?? []
  return `${props.ticketId}:${list.length}:${list.reduce((max, m) => Math.max(max, m.id), 0)}`
})

watch(
  signature,
  () => {
    if (!props.messages) return
    // Polling only moves the view when something new arrived and the reader is already at the end.
    if (forceNext || nearBottom()) settleBottom()
    forceNext = false
  },
  { flush: 'pre' },
)

// Mounted with the conversation already loaded (e.g. the error view was retried): the signature
// watcher does not run for the initial value, so start at the newest message here.
onMounted(() => {
  if (!props.messages?.length) return
  settleBottom()
  forceNext = false
})

defineExpose({ stickNext, scrollToBottom })
</script>

<template>
  <div ref="box" class="messages" :class="{ dark: appState.isDark }" role="log" aria-live="polite">
    <template v-if="loading && !messages">
      <div class="sk-row left"><n-skeleton height="58px" width="46%" :sharp="false" /></div>
      <div class="sk-row right"><n-skeleton height="44px" width="38%" :sharp="false" /></div>
      <div class="sk-row left"><n-skeleton height="72px" width="52%" :sharp="false" /></div>
    </template>
    <n-empty v-else-if="!items.length" description="暂无消息记录" class="empty" />
    <template v-else>
      <template v-for="it in items" :key="it.m.id">
        <div v-if="it.day" class="day"><span>{{ it.day }}</span></div>
        <div class="msg" :class="it.isAdmin ? 'sent' : 'received'">
          <div class="bubble">
            <div class="sender">
              {{ it.isAdmin ? '管理员' : '用户' }}
              <span v-if="it.m.user?.email" class="sender-email">{{ it.m.user.email }}</span>
            </div>
            <div class="text">{{ it.m.message }}</div>
            <div class="time">{{ formatTime(it.m.created_at) }}</div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  margin: auto;
}
.sk-row {
  display: flex;
}
.sk-row.right {
  justify-content: flex-end;
}
.day {
  display: flex;
  justify-content: center;
  margin: 4px 0;
}
.day span {
  font-size: 11px;
  color: var(--text-muted);
  padding: 1px 10px;
  border-radius: 10px;
  background: var(--hover-color);
  font-variant-numeric: tabular-nums;
}
.msg {
  display: flex;
}
.msg.sent {
  justify-content: flex-end;
}
.bubble {
  max-width: min(72%, 640px);
  padding: 8px 12px 6px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 96px;
}
.received .bubble {
  background: var(--hover-color);
  color: var(--text-strong);
  border-top-left-radius: 4px;
}
.sent .bubble {
  background: var(--primary-color);
  color: #fff;
  border-top-right-radius: 4px;
}
/* The dark theme's lighter primary needs dark text for contrast (like Naive's primary buttons). */
.dark .sent .bubble {
  color: #0d1024;
}
.sender {
  font-size: 11px;
  opacity: 0.72;
  display: flex;
  gap: 6px;
  min-width: 0;
}
.sender-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.text {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.time {
  align-self: flex-end;
  font-size: 10px;
  opacity: 0.66;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 767px) {
  .messages {
    padding: 12px;
  }
  .bubble {
    max-width: 86%;
  }
}
</style>
