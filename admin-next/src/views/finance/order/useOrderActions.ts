// Confirmed order / commission actions shared by the order table and the detail modal.
import { ref } from 'vue'
import { cancelOrder, markOrderPaid, updateCommissionStatus, type Order } from '@/api/order'
import { confirm, message } from '@/utils/discrete'
import { formatMoney } from '@/utils/format'

type OrderLike = Pick<Order, 'trade_no' | 'total_amount' | 'balance_amount' | 'commission_balance' | 'user' | 'plan' | 'invite_user'>

export function shortTradeNo(tradeNo: string | null | undefined): string {
  const s = tradeNo || ''
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s
}

function describe(o: OrderLike): string {
  const parts = [o.user?.email, o.plan?.name, formatMoney(o.total_amount)].filter(Boolean)
  return `订单 ${shortTradeNo(o.trade_no)}（${parts.join('，')}）`
}

/** Each action asks for confirmation, calls the API and resolves true on success. */
export function useOrderActions() {
  /** trade_no of the order whose action is running (for button loading). */
  const busy = ref<string | null>(null)

  async function run(o: OrderLike, fn: () => Promise<unknown>, okText: string): Promise<boolean> {
    busy.value = o.trade_no
    try {
      await fn()
      message.success(okText)
      return true
    } catch {
      return false
    } finally {
      busy.value = null
    }
  }

  async function markPaid(o: OrderLike): Promise<boolean> {
    const ok = await confirm({
      title: '标记为已支付',
      content: `${describe(o)}将被标记为已支付，系统会立即为该用户开通或变更套餐，回调单号记为 manual_operation。此操作不可撤销。`,
      positiveText: '确认已支付',
      type: 'warning',
    })
    return ok ? run(o, () => markOrderPaid(o.trade_no), '已标记为已支付') : false
  }

  async function cancel(o: OrderLike): Promise<boolean> {
    const refund = Number(o.balance_amount) > 0 ? `，订单使用的余额 ${formatMoney(o.balance_amount)} 将退回用户账户` : ''
    const ok = await confirm({
      title: '取消订单',
      content: `${describe(o)}将被取消${refund}。取消后无法恢复。`,
      positiveText: '取消订单',
      type: 'error',
    })
    return ok ? run(o, () => cancelOrder(o.trade_no), '订单已取消') : false
  }

  async function setCommission(o: OrderLike, status: 1 | 3): Promise<boolean> {
    const amount = formatMoney(o.commission_balance)
    const inviter = o.invite_user?.email ? `邀请人 ${o.invite_user.email}` : '邀请人'
    const ok =
      status === 1
        ? await confirm({
            title: '确认发放佣金',
            content: `${describe(o)}的佣金 ${amount} 将标记为「发放中」，系统定时任务会把这笔佣金发放给${inviter}。`,
            positiveText: '确认发放',
            type: 'warning',
          })
        : await confirm({
            title: '标记佣金无效',
            content: `${describe(o)}的佣金 ${amount} 将标记为「无效」，${inviter} 不会获得这笔佣金。`,
            positiveText: '标记无效',
            type: 'error',
          })
    if (!ok) return false
    return run(
      o,
      () => updateCommissionStatus(o.trade_no, status),
      status === 1 ? '佣金已标记为发放中' : '佣金已标记为无效',
    )
  }

  return { busy, markPaid, cancel, setCommission }
}
