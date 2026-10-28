<script setup lang="ts">
// 支付配置 /config/payment (spec commerce §4).
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NDataTable,
  NEllipsis,
  NEmpty,
  NIcon,
  NInput,
  NTag,
  NTooltip,
  type DataTableColumns,
  type PaginationProps,
} from 'naive-ui'
import {
  AddOutline,
  CardOutline,
  CreateOutline,
  HelpCircleOutline,
  RefreshOutline,
  SearchOutline,
  SwapVerticalOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import CopyText from '@/components/CopyText.vue'
import SwitchCell from '@/components/SwitchCell.vue'
import PaymentFormDialog from './payment/PaymentFormDialog.vue'
import PaymentSortModal from './payment/PaymentSortModal.vue'
import {
  dropPayment,
  fetchPaymentMethods,
  fetchPayments,
  fetchSiteAppUrl,
  togglePayment,
  type Payment,
} from '@/api/payment'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { formatMoney } from '@/utils/format'

const router = useRouter()

const list = ref<Payment[]>([])
const loading = ref(false)
const keyword = ref('')
/** null = not loaded (don't flag rows). */
const methods = ref<Set<string> | null>(null)
const siteUrl = ref<string | null>(null)
const siteUrlMissing = ref(false)

const formShow = ref(false)
const editing = ref<Payment | null>(null)
const sortShow = ref(false)

async function load(showSpinner = true) {
  if (showSpinner) loading.value = true
  try {
    list.value = await fetchPayments()
  } catch {
    /* toast handled by http client */
  } finally {
    loading.value = false
  }
}

async function loadMethods() {
  try {
    methods.value = new Set(await fetchPaymentMethods())
  } catch {
    methods.value = null
  }
}

async function checkSiteUrl() {
  try {
    siteUrl.value = await fetchSiteAppUrl()
    siteUrlMissing.value = !siteUrl.value
  } catch {
    siteUrl.value = null
    siteUrlMissing.value = false
  }
}

function refresh() {
  void load()
  void loadMethods()
  void checkSiteUrl()
}

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return list.value
  return list.value.filter(
    (p) => p.name.toLowerCase().includes(k) || p.payment.toLowerCase().includes(k) || String(p.id) === k,
  )
})

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 40, 50, 100, 500],
  prefix: ({ itemCount }) => `共 ${itemCount ?? 0} 项`,
  onUpdatePage: (p: number) => (pagination.page = p),
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
  },
})
watch(keyword, () => (pagination.page = 1))

function openCreate() {
  editing.value = null
  formShow.value = true
}

function openEdit(row: Payment) {
  editing.value = row
  formShow.value = true
}

function onSaved() {
  void load(false)
}

async function toggle(row: Payment, v: boolean) {
  // /payment/show flips the stored flag, so read the current state first: a stale list must not invert it.
  const fresh = await fetchPayments()
  const current = fresh.find((p) => p.id === row.id)
  if (!current) {
    list.value = fresh
    message.error('支付方式不存在，可能已被删除')
    throw new Error('payment missing')
  }
  if (current.enable !== v) await togglePayment(row.id)
  row.enable = v
  message.success(v ? `已启用「${row.name}」` : `已停用「${row.name}」`)
  void load(false)
}

async function remove(row: Payment) {
  const ok = await confirm({
    title: '删除确认',
    content: `确定要删除支付方式「${row.name}」吗？此操作无法撤销：用户将无法再选择该方式付款，其回调地址随即失效，历史订单详情中也不再显示该支付方式。`,
    positiveText: '删除',
    type: 'error',
  })
  if (!ok) return
  try {
    await dropPayment(row.id)
    message.success('删除成功')
    await load(false)
  } catch {
    /* toast handled by http client */
  }
}

function methodAvailable(row: Payment) {
  return !methods.value || methods.value.has(row.payment)
}

function nameCell(row: Payment) {
  return h('div', { class: 'name-cell' }, [
    row.icon
      ? h(
          NAvatar,
          { src: row.icon, size: 22, color: 'transparent', objectFit: 'contain', class: 'pay-icon' },
          { fallback: () => h(NIcon, { size: 16 }, { default: () => h(CardOutline) }) },
        )
      : h('span', { class: 'pay-icon placeholder' }, [h(NIcon, { size: 14 }, { default: () => h(CardOutline) })]),
    h(NEllipsis, { style: 'max-width: 200px; font-weight: 600' }, { default: () => row.name }),
  ])
}

function methodCell(row: Payment) {
  const tag = h(NTag, { size: 'small', bordered: false, class: 'mono' }, { default: () => row.payment })
  if (methodAvailable(row)) return tag
  return h('div', { class: 'method-cell' }, [
    tag,
    h(NTooltip, null, {
      trigger: () => h(NTag, { size: 'small', type: 'warning', bordered: false, round: true }, { default: () => '插件未启用' }),
      default: () => '提供该支付接口的插件未启用或已卸载：用户无法使用，编辑时也无法加载配置。请先到插件管理启用对应插件。',
    }),
  ])
}

function feeText(row: Payment) {
  const fixed = Number(row.handling_fee_fixed ?? 0)
  const percent = Number(row.handling_fee_percent ?? 0)
  const parts: string[] = []
  if (percent > 0) parts.push(`${Number(percent.toFixed(2))}%`)
  if (fixed > 0) parts.push(formatMoney(fixed))
  return parts.length ? parts.join(' + ') : null
}

function feeCell(row: Payment) {
  const t = feeText(row)
  return t ? h('span', { class: 'num' }, t) : h('span', { class: 'muted' }, '无')
}

function notifyCell(row: Payment) {
  return h(CopyText, { text: row.notify_url, maxWidth: '260px', mono: true })
}

function actionButtons(row: Payment) {
  const btn = (label: string, icon: typeof CreateOutline, onClick: () => void, danger = false) =>
    h(NTooltip, null, {
      trigger: () =>
        h(
          NButton,
          { size: 'small', quaternary: true, circle: true, type: danger ? 'error' : 'default', onClick, 'aria-label': label },
          { icon: () => h(NIcon, null, { default: () => h(icon) }) },
        ),
      default: () => label,
    })
  return h('div', { class: 'row-actions' }, [
    btn('编辑', CreateOutline, () => openEdit(row)),
    btn('删除', TrashOutline, () => remove(row), true),
  ])
}

function switchCell(row: Payment) {
  return h(SwitchCell, { value: row.enable, onChange: (v: boolean) => toggle(row, v) })
}

const notifyTitle = () =>
  h('span', { class: 'th-help' }, [
    '通知地址',
    h(NTooltip, null, {
      trigger: () => h(NIcon, { size: 14, class: 'help-icon' }, { default: () => h(HelpCircleOutline) }),
      default: () => '支付网关将会把数据通知到本地址，请通过防火墙放行本地址。',
    }),
  ])

const desktopColumns = computed<DataTableColumns<Payment>>(() => [
  {
    title: 'ID',
    key: 'id',
    width: 72,
    sorter: (a, b) => a.id - b.id,
    render: (row) => h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id }),
  },
  { title: '启用', key: 'enable', width: 72, render: switchCell },
  { title: '显示名称', key: 'name', minWidth: 180, render: nameCell },
  { title: '支付接口', key: 'payment', width: 190, render: methodCell },
  { title: '手续费', key: 'fee', width: 140, render: feeCell },
  { title: notifyTitle, key: 'notify_url', minWidth: 280, render: notifyCell },
  { title: '操作', key: 'actions', width: 100, align: 'center', fixed: 'right', render: actionButtons },
])

const mobileColumns = computed<DataTableColumns<Payment>>(() => [
  {
    title: '支付方式',
    key: 'card',
    render: (row) =>
      h('div', { class: 'm-card' }, [
        h('div', { class: 'm-head' }, [
          h(NTag, { size: 'small', bordered: true, class: 'id-tag' }, { default: () => row.id }),
          h('div', { class: 'm-title' }, [nameCell(row)]),
          actionButtons(row),
        ]),
        h('div', { class: 'm-grid' }, [
          h('div', null, [h('div', { class: 'm-label' }, '支付接口'), methodCell(row)]),
          h('div', null, [h('div', { class: 'm-label' }, '启用'), switchCell(row)]),
          h('div', null, [h('div', { class: 'm-label' }, '手续费'), feeCell(row)]),
        ]),
        h('div', null, [h('div', { class: 'm-label' }, '通知地址'), h(CopyText, { text: row.notify_url, mono: true })]),
      ]),
  },
])

const columns = computed(() => (appState.isMobile ? mobileColumns.value : desktopColumns.value))

onMounted(refresh)
</script>

<template>
  <page-container title="支付配置" description="在这里可以配置支付方式，包括支付宝、微信等。">
    <template #extra>
      <n-button type="primary" @click="openCreate">
        <template #icon><n-icon><add-outline /></n-icon></template>
        添加支付方式
      </n-button>
    </template>

    <n-alert v-if="siteUrlMissing" type="warning" title="站点地址未配置">
      后端要求先设置站点地址（app_url）才能添加或修改支付方式，回调地址也依赖该配置。
      <n-button text type="primary" @click="router.push('/config/system')">前往系统配置 → 站点</n-button>
    </n-alert>

    <n-card size="small">
      <div class="toolbar table-toolbar">
        <n-input v-model:value="keyword" placeholder="搜索支付方式..." clearable class="search-input">
          <template #prefix><n-icon><search-outline /></n-icon></template>
        </n-input>
        <n-button v-if="keyword" quaternary @click="keyword = ''">重置</n-button>
        <span class="grow" />
        <span class="muted total-hint">共 {{ list.length }} 个支付方式，已启用 {{ list.filter((p) => p.enable).length }} 个</span>
        <n-button v-if="list.length > 1" @click="sortShow = true">
          <template #icon><n-icon><swap-vertical-outline /></n-icon></template>
          编辑排序
        </n-button>
        <n-tooltip>
          <template #trigger>
            <n-button quaternary circle :loading="loading" aria-label="刷新" @click="refresh">
              <template #icon><n-icon><refresh-outline /></n-icon></template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </div>
      <n-data-table
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :pagination="pagination"
        :row-key="(r: Payment) => r.id"
        :scroll-x="appState.isMobile ? undefined : 960"
        :bordered="false"
        size="small"
        class="data-table"
      >
        <template #empty>
          <n-empty :description="keyword ? '没有匹配的支付方式' : '暂无支付方式'">
            <template v-if="!keyword" #extra>
              <n-button size="small" @click="openCreate">添加支付方式</n-button>
            </template>
          </n-empty>
        </template>
      </n-data-table>
    </n-card>

    <payment-form-dialog
      v-model:show="formShow"
      :payment="editing"
      :site-url-missing="siteUrlMissing"
      :site-url="siteUrl"
      @success="onSaved"
    />
    <payment-sort-modal v-model:show="sortShow" :payments="list" @saved="onSaved" />
  </page-container>
</template>

<style scoped>
.table-toolbar {
  margin-bottom: 12px;
}
.search-input {
  width: 280px;
  max-width: 100%;
}
.total-hint {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 767px) {
  .search-input {
    width: 100%;
  }
  .total-hint {
    display: none;
  }
}
.data-table :deep(.id-tag) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.num) {
  font-variant-numeric: tabular-nums;
}
.data-table :deep(.name-cell) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.data-table :deep(.pay-icon) {
  flex: none;
}
.data-table :deep(.pay-icon.placeholder) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--hover-color);
  color: var(--text-muted);
}
.data-table :deep(.method-cell) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.data-table :deep(.th-help) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.data-table :deep(.help-icon) {
  color: var(--text-muted);
  cursor: help;
}
.data-table :deep(.row-actions) {
  display: inline-flex;
  gap: 2px;
}
.data-table :deep(.m-card) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 0;
}
.data-table :deep(.m-head) {
  display: flex;
  align-items: center;
  gap: 8px;
}
.data-table :deep(.m-title) {
  flex: 1;
  min-width: 0;
}
.data-table :deep(.m-grid) {
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: start;
  gap: 16px;
}
.data-table :deep(.m-label) {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
</style>
