<script setup lang="ts">
// Ticket detail body: sidebar + header + conversation + reply box (spec content.md §2.4).
// Mounted only while the dialog/drawer is open; polls the active ticket every 5 s while visible.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NIcon, NInput, NResult, NSkeleton, NTag, NTooltip } from 'naive-ui'
import {
  ChevronBackOutline,
  CloseCircleOutline,
  CloseOutline,
  ListOutline,
  OpenOutline,
  PersonCircleOutline,
  PersonOutline,
  ReceiptOutline,
  SendOutline,
  StatsChartOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import { ApiError } from '@/api/http'
import { fetchTicketDetail, replyTicket, type TicketDetail, type TicketUser } from '@/api/ticket'
import { formatTime } from '@/utils/format'
import { copyText } from '@/utils/clipboard'
import TicketSidebar from './TicketSidebar.vue'
import TicketMessages from './TicketMessages.vue'
import { renderLevelTag, renderStatusTag } from './TicketTags'
import { confirmCloseTicket, isClosed, replyDrafts } from './meta'

const POLL_MS = 5000

const props = defineProps<{
  ticketId: number
  status: 0 | 1
  mobile: boolean
}>()
const emit = defineEmits<{
  /** Something changed server-side (reply / close): parent list should reload. */
  changed: []
  close: []
  'user-info': [TicketUser]
  traffic: [TicketUser]
}>()

const router = useRouter()

const activeId = ref(props.ticketId)
const sideStatus = ref<0 | 1>(props.status)
/**
 * The `status` prop is a guess for deep links (?id= without ?status=1): once the opened ticket
 * loads, show the sidebar tab it belongs to so it is listed and highlighted. Cleared after the
 * first sync, or as soon as the admin picks a tab.
 */
let syncSideFor: number | null = props.ticketId
function onSideStatus(v: 0 | 1) {
  syncSideFor = null
  sideStatus.value = v
}
const sideCollapsed = ref(props.mobile)
const sideRefresh = ref(0)

const detail = ref<TicketDetail | null>(null)
const loading = ref(false)
const loadError = ref('')
const sending = ref(false)
const messagesRef = ref<InstanceType<typeof TicketMessages> | null>(null)
const inputRef = ref<InstanceType<typeof NInput> | null>(null)

let seq = 0
let inflight = false

/**
 * `quiet`: keep the current view and skip error toasts (polling / after actions).
 * `force`: run even while a poll is in flight (that poll may predate a reply we just sent).
 */
async function loadDetail(opts: { quiet?: boolean; force?: boolean } = {}) {
  const silent = !!opts.quiet
  const id = activeId.value
  if (silent && !opts.force && inflight) return
  const my = ++seq
  inflight = true
  if (!silent) loading.value = true
  try {
    const d = await fetchTicketDetail(id, { silent: true })
    if (my !== seq) return
    const prev = detail.value
    detail.value = d
    loadError.value = ''
    if (syncSideFor === d.id) {
      syncSideFor = null
      const st = isClosed(d) ? 1 : 0
      if (sideStatus.value !== st) sideStatus.value = st
    }
    // A user/Telegram reply arrived while open: refresh the sidebar badges too.
    if (prev && prev.id === d.id && (prev.updated_at !== d.updated_at || prev.status !== d.status)) {
      sideRefresh.value++
    }
  } catch (e) {
    if (my !== seq) return
    // Polling hiccups keep the last good view; only a first load or a vanished ticket shows an error.
    if (!silent || (e instanceof ApiError && e.status === 400)) {
      loadError.value = e instanceof ApiError ? e.message : '加载失败'
      if (e instanceof ApiError && e.status === 400) detail.value = null
    }
  } finally {
    if (my === seq) {
      loading.value = false
      inflight = false
    }
  }
}

function select(id: number) {
  if (id !== activeId.value) {
    activeId.value = id
    detail.value = null
    loadError.value = ''
    void loadDetail()
  }
  if (props.mobile) sideCollapsed.value = true
}

watch(
  () => props.ticketId,
  (id) => {
    activeId.value = id
    sideStatus.value = props.status
    syncSideFor = id
    detail.value = null
    loadError.value = ''
    void loadDetail()
  },
)

// ---- polling (paused while the tab is hidden) ----
let timer: ReturnType<typeof setInterval> | undefined
function onVisibility() {
  if (document.visibilityState === 'visible') void loadDetail({ quiet: true })
}
onMounted(() => {
  void loadDetail()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void loadDetail({ quiet: true })
  }, POLL_MS)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})

// ---- header ----
const closed = computed(() => (detail.value ? isClosed(detail.value) : false))
const user = computed(() => detail.value?.user ?? null)

async function closeActive() {
  const d = detail.value
  if (!d) return
  if (await confirmCloseTicket(d)) {
    sideRefresh.value++
    emit('changed')
    await loadDetail({ quiet: true, force: true })
  }
}

function openOrders() {
  if (!user.value) return
  // eq: avoids the official `like %id%` match that mixes in other users (spec R-T1).
  void router.push({ path: '/finance/order', query: { user_id: `eq:${user.value.id}` } })
}

function openUserPage() {
  if (!user.value) return
  void router.push({ path: '/user/manage', query: { email: user.value.email } })
}

// ---- reply ----
const draft = computed({
  get: () => replyDrafts[activeId.value] ?? '',
  set: (v: string) => {
    replyDrafts[activeId.value] = v
  },
})
const canSend = computed(() => !sending.value && !!draft.value.trim() && !!detail.value)

async function send() {
  const id = activeId.value
  const text = (replyDrafts[id] ?? '').trim()
  if (!text || sending.value || !detail.value) return
  sending.value = true
  try {
    await replyTicket(id, text)
    replyDrafts[id] = ''
    messagesRef.value?.stickNext()
    sideRefresh.value++
    emit('changed')
    await loadDetail({ quiet: true, force: true })
  } catch {
    /* toasted by the http client; the draft is kept */
  } finally {
    sending.value = false
    void nextTick(() => inputRef.value?.focus())
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.shiftKey || e.altKey) return
  // IME composition (e.g. picking Chinese candidates) must not send (spec R-T5).
  if (e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  void send()
}
</script>

<template>
  <div class="ws" :class="{ mobile }">
    <aside class="side" :class="{ collapsed: sideCollapsed }">
      <div class="side-inner">
        <ticket-sidebar
          :status="sideStatus"
          @update:status="onSideStatus"
          :active-id="activeId"
          :refresh-key="sideRefresh"
          @select="select"
        />
      </div>
    </aside>
    <div v-if="mobile && !sideCollapsed" class="side-mask" @click="sideCollapsed = true" />

    <section class="main">
      <header class="head">
        <div class="head-top">
          <n-tooltip v-if="!mobile">
            <template #trigger>
              <n-button
                size="small"
                secondary
                class="collapse-btn"
                :class="{ flipped: sideCollapsed }"
                :aria-label="sideCollapsed ? '展开列表' : '收起列表'"
                @click="sideCollapsed = !sideCollapsed"
              >
                <template #icon><n-icon><chevron-back-outline /></n-icon></template>
              </n-button>
            </template>
            {{ sideCollapsed ? '展开列表' : '收起列表' }}
          </n-tooltip>
          <n-button
            v-else
            size="small"
            circle
            secondary
            :aria-label="sideCollapsed ? '展开列表' : '收起列表'"
            @click="sideCollapsed = !sideCollapsed"
          >
            <template #icon>
              <n-icon><list-outline /></n-icon>
            </template>
          </n-button>

          <div class="title-wrap">
            <n-skeleton v-if="!detail && loading" text style="width: 40%; max-width: 280px" />
            <template v-else>
              <h2 class="title" :title="detail?.subject">{{ detail?.subject ?? '查看工单' }}</h2>
              <component :is="renderStatusTag(detail)" v-if="detail" />
              <n-tag v-else-if="!loadError" size="small" :bordered="false" round>处理中</n-tag>
            </template>
          </div>

          <n-button
            v-if="detail && !closed"
            size="small"
            quaternary
            type="error"
            class="close-ticket"
            @click="closeActive"
          >
            <template #icon><n-icon><close-circle-outline /></n-icon></template>
            <span v-if="!mobile">关闭工单</span>
          </n-button>
          <n-button quaternary circle size="small" aria-label="关闭" @click="emit('close')">
            <template #icon><n-icon :size="18"><close-outline /></n-icon></template>
          </n-button>
        </div>

        <div v-if="detail" class="head-meta">
          <span class="meta-item email" title="复制邮箱" @click="user && copyText(user.email)">
            <n-icon><person-outline /></n-icon>
            {{ user?.email ?? `用户 #${detail.user_id}` }}
          </span>
          <span class="sep" />
          <span class="meta-item num">
            <n-icon><time-outline /></n-icon>
            创建于 {{ formatTime(detail.created_at) }}
          </span>
          <span class="sep" />
          <span class="meta-item num">#{{ detail.id }}</span>
          <component :is="renderLevelTag(detail.level, 'tiny')" />

          <span class="grow" />
          <div v-if="user" class="quick">
            <n-tooltip>
              <template #trigger>
                <n-button size="small" quaternary circle aria-label="用户信息" @click="user && emit('user-info', user)">
                  <template #icon><n-icon><person-circle-outline /></n-icon></template>
                </n-button>
              </template>
              用户信息
            </n-tooltip>
            <n-tooltip>
              <template #trigger>
                <n-button size="small" quaternary circle aria-label="流量记录" @click="user && emit('traffic', user)">
                  <template #icon><n-icon><stats-chart-outline /></n-icon></template>
                </n-button>
              </template>
              流量记录
            </n-tooltip>
            <n-tooltip>
              <template #trigger>
                <n-button size="small" quaternary circle aria-label="订单记录" @click="openOrders">
                  <template #icon><n-icon><receipt-outline /></n-icon></template>
                </n-button>
              </template>
              订单记录
            </n-tooltip>
            <n-tooltip>
              <template #trigger>
                <n-button size="small" quaternary circle aria-label="在用户管理中查看" @click="openUserPage">
                  <template #icon><n-icon><open-outline /></n-icon></template>
                </n-button>
              </template>
              在用户管理中查看
            </n-tooltip>
          </div>
        </div>
      </header>

      <n-result
        v-if="loadError && !detail"
        status="warning"
        :title="loadError"
        description="工单可能已被删除，或网络暂时不可用。"
        class="error"
      >
        <template #footer>
          <n-button size="small" @click="loadDetail()">重试</n-button>
        </template>
      </n-result>
      <ticket-messages
        v-else
        ref="messagesRef"
        :ticket-id="activeId"
        :messages="detail?.messages ?? null"
        :loading="loading"
      />

      <footer class="composer">
        <n-alert v-if="closed" type="warning" :show-icon="true" class="closed-hint">
          该工单已关闭，你仍可以继续回复，新的消息会追加到当前工单（用户端无法再回复）。
        </n-alert>
        <div class="compose-row">
          <n-input
            ref="inputRef"
            v-model:value="draft"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 6 }"
            :disabled="sending || !detail"
            :placeholder="closed ? '工单已关闭，仍可继续回复...' : '输入回复内容...'"
            class="compose-input"
            @keydown="onKeydown"
          />
          <n-button type="primary" class="send-btn" :loading="sending" :disabled="!canSend" @click="send">
            <template #icon><n-icon><send-outline /></n-icon></template>
            {{ sending ? '发送中...' : '发送' }}
          </n-button>
        </div>
        <div class="compose-hint">Enter 发送，Shift + Enter 换行；回复会通过邮件通知用户（同一用户 30 分钟内最多一封）。</div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.ws {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.side {
  flex: none;
  width: 320px;
  border-right: 1px solid var(--divider-color);
  overflow: hidden;
  transition:
    width 0.25s ease,
    border-color 0.25s ease;
}
.side.collapsed {
  width: 0;
  border-right-color: transparent;
}
.side-inner {
  width: 320px;
  height: 100%;
}
.ws.mobile .side {
  position: absolute;
  z-index: 3;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(86vw, 320px);
  background: var(--card-color);
  border-right: 1px solid var(--divider-color);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
  transform: translateX(0);
  transition: transform 0.25s ease;
}
.ws.mobile .side.collapsed {
  transform: translateX(-105%);
}
.ws.mobile .side-inner {
  width: 100%;
}
.side-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(0, 0, 0, 0.35);
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.head {
  padding: 14px 16px 12px 20px;
  border-bottom: 1px solid var(--divider-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.head-top {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.collapse-btn :deep(.n-icon) {
  transition: transform 0.25s ease;
}
.collapse-btn.flipped :deep(.n-icon) {
  transform: rotate(180deg);
}
.title-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close-ticket {
  flex: none;
}
.head-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 12px;
  color: var(--text-muted);
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.meta-item.email {
  cursor: copy;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.num {
  font-variant-numeric: tabular-nums;
}
.sep {
  width: 1px;
  height: 12px;
  background: var(--divider-color);
}
.grow {
  flex: 1;
}
.quick {
  display: inline-flex;
  gap: 2px;
}
.error {
  flex: 1;
  padding-top: 48px;
}
.composer {
  border-top: 1px solid var(--divider-color);
  padding: 12px 16px 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.closed-hint {
  font-size: 12px;
}
.compose-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.compose-input {
  flex: 1;
}
.send-btn {
  flex: none;
}
.compose-hint {
  font-size: 11px;
  color: var(--text-muted);
}
@media (max-width: 767px) {
  .head {
    padding: 10px 12px;
  }
  .composer {
    padding: 10px 12px;
  }
  .compose-row {
    flex-direction: column;
    align-items: stretch;
  }
  .send-btn {
    width: 100%;
  }
  .compose-hint {
    display: none;
  }
}
</style>
