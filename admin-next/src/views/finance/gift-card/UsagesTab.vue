<script setup lang="ts">
// 使用记录 tab (spec commerce §6.4). The backend filters only by template_id / user_id, so the user
// box resolves an exact email or ID to a user id first. Adds reward columns and a detail drawer.
import { computed, h, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NDataTable,
  NEmpty,
  NIcon,
  NInput,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
} from 'naive-ui'
import { CloseOutline, CopyOutline, EyeOutline, PersonOutline, RefreshOutline, SearchOutline } from '@vicons/ionicons5'
import { fetchPlanOptions, type PlanBrief } from '@/api/common'
import { usePagedTable } from '@/composables/usePagedTable'
import { asObject, fetchUsages, findUser, type GiftCardRewards, type GiftCardUsage, type UserBrief } from '@/api/giftCard'
import { appState } from '@/stores/app'
import { copyText } from '@/utils/clipboard'
import { message } from '@/utils/discrete'
import { formatTime } from '@/utils/format'
import UsageDetailDrawer from './UsageDetailDrawer.vue'
import {
  formatMultiplier,
  isFieldError,
  loadTemplateOptions,
  rewardItems,
  templateOptions,
  templateSelectOptions,
  toastApiError,
  type TabIntent,
} from './helpers'

const props = defineProps<{ intent: TabIntent | null }>()

const router = useRouter()

const filters = reactive({
  template_id: (props.intent?.template_id ?? null) as number | null,
  user: null as UserBrief | null,
})
const userInput = ref('')
const resolving = ref(false)
const hasFilter = computed(() => filters.template_id !== null || !!filters.user)

const table = usePagedTable<GiftCardUsage>(
  async (q) => {
    try {
      const res = await fetchUsages(
        {
          page: q.current,
          per_page: q.pageSize,
          template_id: filters.template_id,
          user_id: filters.user?.id ?? null,
        },
        { silent: true },
      )
      return { data: res.data ?? [], total: res.total ?? 0 }
    } catch (e) {
      // A filter pointing at a template / user that no longer exists (deep link, deleted elsewhere).
      if (isFieldError(e, 'template_id') && filters.template_id !== null) {
        message.warning(`模板 #${filters.template_id} 不存在（可能已被删除），已清除模板筛选`)
        filters.template_id = null // the filter watcher reloads
      } else if (isFieldError(e, 'user_id') && filters.user) {
        message.warning(`用户 ${filters.user.email} 已不存在，已清除用户筛选`)
        clearUser()
      } else toastApiError(e)
      throw e
    }
  },
  // A user from the intent is resolved first, then searched.
  { pageSize: 20, pageSizes: [10, 20, 30, 40, 50, 100, 500], immediate: !props.intent?.user },
)
table.pagination.showQuickJumper = true
table.pagination.prefix = ({ itemCount }) => `共 ${itemCount ?? 0} 条记录`

watch(
  () => [filters.template_id, filters.user?.id],
  () => void table.search(),
)

async function applyUser(keyword = userInput.value) {
  const k = keyword.trim()
  if (!k) {
    filters.user = null
    return
  }
  if (filters.user && (k === filters.user.email || k === String(filters.user.id))) return
  resolving.value = true
  try {
    const u = await findUser(k)
    if (!u) {
      message.warning(/^\d+$/.test(k) ? `未找到 ID 为 ${k} 的用户` : `未找到邮箱为 ${k} 的用户（需输入完整邮箱）`)
      return
    }
    filters.user = u
    userInput.value = u.email
  } catch {
    /* toast handled by http client */
  } finally {
    resolving.value = false
  }
}

function clearUser() {
  userInput.value = ''
  filters.user = null
}

function resetFilters() {
  filters.template_id = null
  clearUser()
}

watch(
  () => props.intent?.seq,
  () => {
    const it = props.intent
    if (!it) return
    filters.template_id = it.template_id ?? null
    if (it.user) {
      userInput.value = it.user
      void applyUser(it.user)
    } else clearUser()
  },
)
if (props.intent?.user) {
  userInput.value = props.intent.user
  void applyUser(props.intent.user).finally(() => {
    // Nothing changed (user not found): load the unfiltered list.
    if (!filters.user) void table.search()
  })
}

void loadTemplateOptions()
const templateFilterOptions = computed(() => templateSelectOptions())

// Plan names for type-2 rewards.
const plans = ref<PlanBrief[]>([])
fetchPlanOptions()
  .then((list) => (plans.value = list))
  .catch(() => {
    /* toast handled by http client */
  })
const planName = (id: number) => plans.value.find((p) => p.id === id)?.name ?? `#${id}`

// ---------- detail ----------
const detailShow = ref(false)
const detail = ref<GiftCardUsage | null>(null)
function openDetail(row: GiftCardUsage) {
  detail.value = row
  detailShow.value = true
}

function openUser(email: string) {
  void router.push({ path: '/user/manage', query: { email } })
}

// ---------- cells ----------
function givenItems(row: GiftCardUsage): string[] {
  const r: GiftCardRewards = { ...asObject<GiftCardRewards>(row.rewards_given) }
  delete r.random_rewards
  delete r.invite_reward_rate
  return rewardItems(r, planName)
}

function rewardsCell(row: GiftCardUsage) {
  const items = givenItems(row)
  if (!items.length) return h('span', { class: 'muted small' }, '无')
  const shown = items.slice(0, 3)
  return h('div', { class: 'tag-wrap' }, [
    ...shown.map((t) => h(NTag, { size: 'small', type: 'success', bordered: false, class: 'reward-tag' }, { default: () => t })),
    items.length > shown.length
      ? h(NTooltip, null, {
          trigger: () => h(NTag, { size: 'small', bordered: false }, { default: () => `+${items.length - shown.length}` }),
          default: () => items.slice(shown.length).join('、'),
        })
      : null,
  ])
}

function inviteCell(row: GiftCardUsage) {
  const items = rewardItems(asObject<GiftCardRewards>(row.invite_rewards))
  if (!row.invite_user_email && !items.length) return h('span', { class: 'muted small' }, '-')
  return h('div', { class: 'two-line' }, [
    h('span', { class: 'small' }, row.invite_user_email ?? '-'),
    h('span', { class: items.length ? 'small invite-reward' : 'muted small' }, items.length ? items.join('、') : '未获得奖励'),
  ])
}

function multiplierCell(row: GiftCardUsage) {
  const m = Number(row.multiplier_applied)
  if (!Number.isFinite(m) || m === 1) return h('span', { class: 'muted num' }, '×1')
  return h(NTag, { size: 'small', type: 'warning', bordered: false, class: 'num' }, { default: () => formatMultiplier(m) })
}

function userCell(row: GiftCardUsage) {
  if (!row.user_email) return h('span', { class: 'muted' }, '用户已删除')
  return h(NTooltip, null, {
    trigger: () =>
      h(
        NButton,
        { text: true, type: 'primary', size: 'small', class: 'email-link', onClick: () => openUser(row.user_email) },
        { default: () => row.user_email },
      ),
    default: () => '查看用户',
  })
}

const idTag = (row: GiftCardUsage) => h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id })
const codeCell = (row: GiftCardUsage) =>
  row.code
    ? h('span', { class: 'code-cell' }, [
        h('span', { class: 'code-text' }, row.code),
        h(
          NButton,
          { text: true, size: 'tiny', class: 'copy-btn', title: '复制', 'aria-label': '复制兑换码', onClick: () => copyText(row.code, '复制成功') },
          { icon: () => h(NIcon, null, { default: () => h(CopyOutline) }) },
        ),
      ])
    : h('span', { class: 'muted' }, '兑换码已删除')
const detailBtn = (row: GiftCardUsage) =>
  h(NTooltip, null, {
    trigger: () =>
      h(
        NButton,
        { size: 'small', quaternary: true, circle: true, 'aria-label': '查看详情', onClick: () => openDetail(row) },
        { icon: () => h(NIcon, null, { default: () => h(EyeOutline) }) },
      ),
    default: () => '查看详情',
  })

const desktopColumns = computed<DataTableColumns<GiftCardUsage>>(() => [
  { title: 'ID', key: 'id', width: 76, render: idTag },
  { title: '兑换码', key: 'code', width: 200, render: codeCell },
  { title: '用户邮箱', key: 'user_email', minWidth: 210, render: userCell },
  {
    title: '模板名称',
    key: 'template_name',
    minWidth: 130,
    ellipsis: { tooltip: true },
    render: (row) => row.template_name || h('span', { class: 'muted' }, '模板已删除'),
  },
  { title: '获得奖励', key: 'rewards_given', minWidth: 220, render: rewardsCell },
  { title: '邀请奖励', key: 'invite_rewards', minWidth: 160, render: inviteCell },
  { title: '倍数加成', key: 'multiplier_applied', width: 90, align: 'center', render: multiplierCell },
  {
    title: '使用时间',
    key: 'created_at',
    width: 165,
    render: (row) => h('span', { class: 'mono small' }, formatTime(row.created_at)),
  },
  { title: '操作', key: 'actions', width: 64, align: 'center', fixed: 'right', render: detailBtn },
])

const mobileColumns = computed<DataTableColumns<GiftCardUsage>>(() => [
  {
    title: '使用记录',
    key: 'card',
    render: (row) =>
      h('div', { class: 'm-card' }, [
        h('div', { class: 'm-head' }, [h('div', { class: 'm-code' }, [codeCell(row)]), detailBtn(row)]),
        h('div', { class: 'm-line' }, [userCell(row)]),
        h('div', { class: 'm-line muted small' }, [row.template_name || '模板已删除', h('span', { class: 'mono' }, formatTime(row.created_at))]),
        rewardsCell(row),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : desktopColumns.value))

defineExpose({ reload: () => table.reload() })
</script>

<template>
  <div class="tab-pane">
    <div class="toolbar tab-toolbar">
      <n-input
        v-model:value="userInput"
        placeholder="输入完整邮箱或用户 ID，回车搜索"
        clearable
        class="user-input"
        :loading="resolving"
        @keyup.enter="applyUser()"
        @clear="clearUser"
      >
        <template #prefix><n-icon><search-outline /></n-icon></template>
      </n-input>
      <n-select
        v-model:value="filters.template_id"
        :options="templateFilterOptions"
        :loading="templateOptions.loading"
        placeholder="全部模板"
        filterable
        clearable
        class="template-select"
      />
      <n-tag v-if="filters.user" closable round :bordered="false" type="info" class="user-chip" @close="clearUser">
        <template #icon><n-icon><person-outline /></n-icon></template>
        {{ filters.user.email }}（ID {{ filters.user.id }}）
      </n-tag>
      <n-button v-if="hasFilter" quaternary @click="resetFilters">
        <template #icon><n-icon><close-outline /></n-icon></template>
        重置
      </n-button>
      <span class="grow" />
      <n-tooltip>
        <template #trigger>
          <n-button quaternary circle :loading="table.loading.value" aria-label="刷新" @click="table.reload">
            <template #icon><n-icon><refresh-outline /></n-icon></template>
          </n-button>
        </template>
        刷新
      </n-tooltip>
    </div>

    <n-data-table
      remote
      :columns="columns"
      :data="table.data.value"
      :loading="table.loading.value"
      :pagination="table.pagination"
      :row-key="(r: GiftCardUsage) => r.id"
      :scroll-x="appState.isMobile ? undefined : 1320"
      :bordered="false"
      size="small"
      class="data-table"
    >
      <template #empty>
        <n-empty :description="hasFilter ? '没有符合条件的使用记录' : '暂无使用记录，用户兑换礼品卡后会显示在这里'" />
      </template>
    </n-data-table>
    <p class="muted foot-hint">用户在前台兑换礼品卡后生成使用记录；后端只支持按模板和用户筛选，邮箱需完整输入。</p>

    <usage-detail-drawer v-model:show="detailShow" :usage="detail" :plan-name="planName" />
  </div>
</template>

<style scoped>
.tab-toolbar {
  margin-bottom: 12px;
}
.user-input {
  width: 260px;
}
.template-select {
  width: 200px;
}
.user-chip {
  max-width: 100%;
}
.foot-hint {
  margin: 10px 0 0;
  font-size: 12px;
}
@media (max-width: 767px) {
  .user-input {
    width: 100%;
  }
  .template-select {
    flex: 1;
    width: auto;
    min-width: 140px;
  }
}
.data-table :deep(.id-tag),
.data-table :deep(.num) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.small) {
  font-size: 12px;
}
.data-table :deep(.code-cell) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}
.data-table :deep(.code-text) {
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.data-table :deep(.copy-btn) {
  flex: none;
  opacity: 0.6;
}
.data-table :deep(.copy-btn:hover) {
  opacity: 1;
}
.data-table :deep(.tag-wrap) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.data-table :deep(.reward-tag) {
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.two-line) {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.5;
}
.data-table :deep(.invite-reward) {
  color: var(--success-color);
}
.data-table :deep(.email-link) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.data-table :deep(.m-card) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 0;
}
.data-table :deep(.m-head),
.data-table :deep(.m-line) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.data-table :deep(.m-code) {
  flex: 1;
  min-width: 0;
}
</style>
