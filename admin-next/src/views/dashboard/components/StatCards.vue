<script setup lang="ts">
// Dashboard stat cards (spec core §7.2): stat/getStats, refreshed every 5 minutes.
import { computed, type Component } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { NIcon, NSkeleton, NButton } from 'naive-ui'
import {
  CashOutline,
  BarChartOutline,
  ChatbubblesOutline,
  NotificationsOutline,
  PersonAddOutline,
  PeopleOutline,
  CloudUploadOutline,
  CloudDownloadOutline,
  TrendingUpOutline,
  TrendingDownOutline,
  RemoveOutline,
  ChevronForwardOutline,
  PulseOutline,
  PhonePortraitOutline,
  GitNetworkOutline,
  SwapVerticalOutline,
  WalletOutline,
} from '@vicons/ionicons5'
import { getStats } from '@/api/stat'
import { formatBytes, formatMoney, formatNumber } from '@/utils/format'
import { jsonEqual, useAsyncState, usePolling } from '../composables'

type Tone = 'success' | 'info' | 'warning' | 'primary' | 'muted'

interface StatCard {
  key: string
  title: string
  value: string
  icon: Component
  tone: Tone
  /** `noBase`: the comparison base is 0, so the backend's growth of 0 is meaningless; shown as "—" with this text. */
  trend?: { value: number; label: string; hint?: string; noBase?: string }
  desc?: string
  to?: RouteLocationRaw
  highlight?: boolean
}

const router = useRouter()
const state = useAsyncState(() => getStats({ silent: true }), { same: jsonEqual })
const refresh = usePolling(state.run, 5 * 60_000)
const hasError = computed(() => !!state.error.value)
defineExpose({ refresh, loading: state.loading, lastSuccess: state.lastSuccess, hasError })

const TONE_VAR: Record<Tone, string> = {
  success: 'var(--success-color)',
  info: 'var(--info-color)',
  warning: 'var(--warning-color)',
  primary: 'var(--primary-color)',
  muted: 'var(--text-muted)',
}

const cards = computed<StatCard[]>(() => {
  const s = state.data.value
  if (!s) return []
  const tickets = s.ticketPendingTotal
  const commissions = s.commissionPendingTotal
  return [
    {
      key: 'todayIncome',
      title: '今日收入',
      value: formatMoney(s.todayIncome),
      icon: CashOutline,
      tone: 'success',
      trend: { value: s.dayIncomeGrowth, label: '对比昨日' },
    },
    {
      key: 'monthIncome',
      title: '月收入',
      value: formatMoney(s.currentMonthIncome),
      icon: BarChartOutline,
      tone: 'info',
      trend: {
        value: s.monthIncomeGrowth,
        label: '对比上月',
        hint: '本月至今收入与上月全月收入对比',
        // Backend returns growth 0 whenever last month is 0; dayIncomeGrowth / userGrowth carry no base to check.
        noBase: s.lastMonthIncome > 0 ? undefined : '上月无收入，无法对比',
      },
    },
    {
      key: 'tickets',
      title: '待处理工单',
      value: formatNumber(tickets),
      icon: ChatbubblesOutline,
      tone: tickets > 0 ? 'warning' : 'muted',
      desc: tickets > 0 ? '有工单需要处理' : '无待处理工单',
      to: '/user/ticket',
      highlight: tickets > 0,
    },
    {
      key: 'commissions',
      title: '待处理佣金',
      value: formatNumber(commissions),
      icon: NotificationsOutline,
      tone: commissions > 0 ? 'info' : 'muted',
      desc: commissions > 0 ? '有佣金需要确认' : '无待处理佣金',
      to: { path: '/finance/order', query: { commission_status: '0', status: '3', commission_balance: 'gt:0' } },
      highlight: commissions > 0,
    },
    {
      key: 'newUsers',
      title: '月新增用户',
      value: formatNumber(s.currentMonthNewUsers),
      icon: PersonAddOutline,
      tone: 'primary',
      trend: { value: s.userGrowth, label: '对比上月', hint: '本月至今新增与上月全月新增对比' },
    },
    {
      key: 'totalUsers',
      title: '总用户',
      value: formatNumber(s.totalUsers),
      icon: PeopleOutline,
      tone: 'muted',
      desc: `活跃用户: ${formatNumber(s.activeUsers)}`,
    },
    {
      key: 'monthUpload',
      title: '月上传',
      value: formatBytes(s.monthTraffic.upload),
      icon: CloudUploadOutline,
      tone: 'success',
      desc: `今日: ${formatBytes(s.todayTraffic.upload)}`,
    },
    {
      key: 'monthDownload',
      title: '月下载',
      value: formatBytes(s.monthTraffic.download),
      icon: CloudDownloadOutline,
      tone: 'info',
      desc: `今日: ${formatBytes(s.todayTraffic.download)}`,
    },
  ]
})

// Extra figures returned by getStats but not shown by the official dashboard.
const extras = computed(() => {
  const s = state.data.value
  if (!s) return []
  return [
    { key: 'onlineUsers', label: '在线用户', value: formatNumber(s.onlineUsers), icon: PulseOutline, hint: '最近 10 分钟内有活动的用户' },
    { key: 'onlineDevices', label: '在线设备', value: formatNumber(s.onlineDevices), icon: PhonePortraitOutline, hint: '在线用户的设备数合计' },
    { key: 'onlineNodes', label: '在线节点', value: formatNumber(s.onlineNodes), icon: GitNetworkOutline, hint: '当前在线的节点数量' },
    { key: 'totalTraffic', label: '累计流量', value: formatBytes(s.totalTraffic.total), icon: SwapVerticalOutline, hint: '全部节点的历史上下行流量合计' },
    {
      key: 'commissionPayout',
      label: '本月佣金发放',
      value: formatMoney(s.currentMonthCommissionPayout),
      icon: WalletOutline,
      hint: `上月发放 ${formatMoney(s.lastMonthCommissionPayout)}`,
    },
  ]
})

function trendClass(v: number) {
  return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'
}
function trendText(v: number) {
  // Official shows 0 as a red "-0%"; show it as neutral instead.
  return v > 0 ? `+${v}%` : v < 0 ? `-${Math.abs(v)}%` : '0%'
}
function trendIcon(v: number) {
  return v > 0 ? TrendingUpOutline : v < 0 ? TrendingDownOutline : RemoveOutline
}

function open(card: StatCard) {
  if (card.to) router.push(card.to)
}
</script>

<template>
  <div>
    <div v-if="!state.data.value && state.error.value && !state.loading.value" class="stat-error">
      <span>统计数据加载失败：{{ state.error.value }}</span>
      <n-button size="small" @click="refresh">重试</n-button>
    </div>

    <div v-else class="stat-cards">
      <template v-if="!state.data.value">
        <div v-for="i in 8" :key="i" class="stat-card">
          <n-skeleton text width="40%" />
          <n-skeleton text :height="28" width="60%" style="margin-top: 6px" />
          <n-skeleton text width="50%" />
        </div>
      </template>
      <!-- `cards` is empty until data arrives, so skeletons and cards never overlap. -->
      <div
        v-for="card in cards"
        :key="card.key"
        class="stat-card"
        :class="{ clickable: !!card.to, highlight: card.highlight }"
        :role="card.to ? 'link' : undefined"
        :tabindex="card.to ? 0 : undefined"
        @click="open(card)"
        @keydown.enter="open(card)"
      >
        <div class="stat-head">
          <span class="stat-title">{{ card.title }}</span>
          <span class="stat-icon" :style="{ '--tone': TONE_VAR[card.tone] }">
            <n-icon :size="18"><component :is="card.icon" /></n-icon>
          </span>
        </div>
        <div class="stat-value">{{ card.value }}</div>
        <div class="stat-foot">
          <template v-if="card.trend?.noBase">
            <span class="trend flat">—</span>
            <span :title="card.trend.hint">{{ card.trend.noBase }}</span>
          </template>
          <template v-else-if="card.trend">
            <span class="trend" :class="trendClass(card.trend.value)">
              <n-icon :size="14"><component :is="trendIcon(card.trend.value)" /></n-icon>
              {{ trendText(card.trend.value) }}
            </span>
            <span :title="card.trend.hint">{{ card.trend.label }}</span>
          </template>
          <span v-else>{{ card.desc }}</span>
          <n-icon v-if="card.to" class="go" :size="14"><chevron-forward-outline /></n-icon>
        </div>
      </div>
    </div>

    <div v-if="state.data.value" class="extras">
      <div v-for="x in extras" :key="x.key" class="extra" :title="x.hint">
        <n-icon class="extra-icon" :size="16"><component :is="x.icon" /></n-icon>
        <span class="extra-label">{{ x.label }}</span>
        <span class="extra-value">{{ x.value }}</span>
      </div>
      <span v-if="state.error.value" class="extra-warn">
        刷新失败：{{ state.error.value }}
        <n-button text type="primary" size="tiny" @click="refresh">重试</n-button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.stat-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (min-width: 1200px) {
  .stat-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-color);
  transition:
    background-color 0.2s,
    border-color 0.2s;
}
.stat-card.clickable {
  cursor: pointer;
}
.stat-card.clickable:hover,
.stat-card.clickable:focus-visible {
  background: linear-gradient(var(--hover-color), var(--hover-color)), var(--card-color);
  outline: none;
}
.stat-card.highlight {
  border-color: color-mix(in srgb, var(--primary-color) 50%, transparent);
}
.stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.stat-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
}
.stat-icon {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 12%, transparent);
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.stat-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
  font-size: 12px;
  color: var(--text-muted);
}
.trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.trend.up {
  color: var(--success-color);
}
.trend.down {
  color: var(--error-color);
}
.trend.flat {
  color: var(--text-muted);
}
.go {
  margin-left: auto;
  opacity: 0.6;
}
.stat-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px 18px;
  border: 1px dashed color-mix(in srgb, var(--error-color) 50%, transparent);
  border-radius: 12px;
  color: var(--error-color);
  font-size: 13px;
}
.extras {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  margin-top: 12px;
  padding: 10px 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--card-color);
  font-size: 13px;
}
.extra {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: default;
}
.extra-icon {
  color: var(--text-muted);
}
.extra-label {
  color: var(--text-muted);
}
.extra-value {
  font-weight: 600;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}
.extra-warn {
  margin-left: auto;
  color: var(--warning-color);
  font-size: 12px;
}
/* Phones: keep two columns but tighten spacing. */
@media (max-width: 559px) {
  .stat-cards {
    gap: 10px;
  }
  .stat-card {
    padding: 12px;
  }
  .stat-icon {
    width: 28px;
    height: 28px;
  }
  .stat-value {
    font-size: 19px;
  }
  .stat-foot {
    flex-wrap: wrap;
    gap: 2px 6px;
  }
  .go {
    display: none;
  }
  .extras {
    gap: 6px 14px;
    padding: 10px 12px;
  }
}
</style>
