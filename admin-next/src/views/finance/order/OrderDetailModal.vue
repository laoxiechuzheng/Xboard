<script setup lang="ts">
// Order detail (POST /order/detail) with the same confirmed actions as the table.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NTag, NButton, NSpin, NEmpty, NIcon, NTooltip, NDivider } from 'naive-ui'
import { OpenOutline, HelpCircleOutline, CopyOutline } from '@vicons/ionicons5'
import {
  fetchOrderDetail,
  findEnum,
  ORDER_STATUS,
  ORDER_TYPE,
  COMMISSION_STATUS,
  type OrderDetail,
} from '@/api/order'
import { PERIOD_BY_KEY, PERIOD_BY_LEGACY, type LegacyPeriod, type PlanPeriod } from '@/api/plan'
import { formatMoney, formatTime } from '@/utils/format'
import CopyText from '@/components/CopyText.vue'
import { copyText } from '@/utils/clipboard'
import { useOrderActions } from './useOrderActions'

const props = defineProps<{ show: boolean; orderId: number | null }>()
const emit = defineEmits<{ 'update:show': [boolean]; changed: [] }>()

const router = useRouter()
const loading = ref(false)
const order = ref<OrderDetail | null>(null)
const { busy, markPaid, cancel, setCommission } = useOrderActions()

async function load() {
  if (!props.orderId) return
  loading.value = true
  try {
    order.value = await fetchOrderDetail(props.orderId)
  } catch {
    order.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.show, props.orderId] as const,
  ([open, id], old) => {
    if (!open || !id) return
    if (!old || !old[0] || old[1] !== id) {
      order.value = null
      void load()
    }
  },
  { immediate: true },
)

const status = computed(() => findEnum(ORDER_STATUS, order.value?.status))
const type = computed(() => findEnum(ORDER_TYPE, order.value?.type))
const commission = computed(() => findEnum(COMMISSION_STATUS, order.value?.commission_status))
const hasCommission = computed(() => Number(order.value?.commission_balance) > 0 || Number(order.value?.commission_balance) < 0)
const canHandlePayment = computed(() => order.value?.status === 0)
const canHandleCommission = computed(
  () => !!order.value && order.value.commission_status === 0 && order.value.status === 3 && hasCommission.value,
)
const actionBusy = computed(() => !!order.value && busy.value === order.value.trade_no)

function legacyPeriodLabel(p: string | null | undefined): string {
  if (!p) return '-'
  return PERIOD_BY_LEGACY[p as LegacyPeriod]?.orderLabel ?? PERIOD_BY_KEY[p as PlanPeriod]?.orderLabel ?? p
}

function money(v: number | null | undefined): string {
  return formatMoney(v ?? 0)
}

function goUser(email: string | undefined) {
  if (!email) return
  emit('update:show', false)
  void router.push({ path: '/user/manage', query: { email } })
}

async function act(fn: () => Promise<boolean>) {
  if (await fn()) {
    emit('changed')
    await load()
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="订单信息"
    :bordered="false"
    style="width: min(760px, calc(100vw - 24px))"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-spin :show="loading">
      <div v-if="order" class="detail">
        <div class="detail-head">
          <span class="muted">订单号</span>
          <copy-text :text="order.trade_no" mono max-width="100%" class="head-trade" />
          <div class="head-tags">
            <n-tag v-if="status" :type="status.type" size="small" round :bordered="false">{{ status.label }}</n-tag>
            <n-tag v-if="type" size="small" round :bordered="false">{{ type.label }}</n-tag>
          </div>
        </div>

        <div class="sections">
          <section class="section">
            <h3 class="section-title">基本信息</h3>
            <div class="kv">
              <span class="k">用户邮箱</span>
              <span class="v">
                <a v-if="order.user?.email" class="link" @click="goUser(order.user?.email)">
                  {{ order.user.email }}<n-icon :size="13"><open-outline /></n-icon>
                </a>
                <template v-else>-</template>
              </span>
            </div>
            <div class="kv">
              <span class="k">用户 ID</span><span class="v mono">{{ order.user_id ?? '-' }}</span>
            </div>
            <div class="kv">
              <span class="k">订单周期</span><span class="v">{{ legacyPeriodLabel(order.period) }}</span>
            </div>
            <div class="kv">
              <span class="k">订阅计划</span>
              <span class="v">{{ order.plan?.name ?? '-' }}<span v-if="order.plan_id" class="muted mono"> #{{ order.plan_id }}</span></span>
            </div>
            <div class="kv">
              <span class="k">支付方式</span>
              <span class="v">
                <template v-if="order.payment">{{ order.payment.name }}<span class="muted"> · {{ order.payment.payment }}</span></template>
                <template v-else-if="order.payment_id">已删除的支付方式 #{{ order.payment_id }}</template>
                <template v-else>-</template>
              </span>
            </div>
            <div class="kv">
              <span class="k">回调单号</span>
              <span class="v">
                <n-tag v-if="order.callback_no === 'manual_operation'" size="small" :bordered="false">手动标记已支付</n-tag>
                <span v-else-if="order.callback_no" class="mono-copy">
                  <span class="mono">{{ order.callback_no }}</span>
                  <n-button text size="tiny" title="复制" @click="copyText(order.callback_no)">
                    <template #icon><n-icon><copy-outline /></n-icon></template>
                  </n-button>
                </span>
                <template v-else>-</template>
              </span>
            </div>
            <div v-if="order.coupon_id" class="kv">
              <span class="k">优惠券 ID</span><span class="v mono">{{ order.coupon_id }}</span>
            </div>
          </section>

          <section class="section">
            <h3 class="section-title">金额信息</h3>
            <div class="kv">
              <span class="k">支付金额</span><span class="v num strong primary">{{ money(order.total_amount) }}</span>
            </div>
            <n-divider class="kv-divider" />
            <div class="kv">
              <span class="k">余额支付</span><span class="v num">{{ money(order.balance_amount) }}</span>
            </div>
            <div class="kv">
              <span class="k">优惠金额</span><span class="v num success">{{ money(order.discount_amount) }}</span>
            </div>
            <div class="kv">
              <span class="k">折抵金额</span><span class="v num">{{ money(order.surplus_amount) }}</span>
            </div>
            <div class="kv">
              <span class="k">
                退回金额
                <n-tooltip>
                  <template #trigger>
                    <n-icon class="help" :size="13"><help-circle-outline /></n-icon>
                  </template>
                  升级折抵后超出新订单的部分，开通时退回用户余额
                </n-tooltip>
              </span>
              <span class="v num error">{{ money(order.surplus_credit) }}</span>
            </div>
            <div class="kv">
              <span class="k">手续费</span><span class="v num">{{ money(order.handling_amount) }}</span>
            </div>
          </section>

          <section class="section">
            <h3 class="section-title">时间信息</h3>
            <div class="kv">
              <span class="k">创建时间</span><span class="v num">{{ formatTime(order.created_at) }}</span>
            </div>
            <div class="kv">
              <span class="k">支付时间</span><span class="v num">{{ formatTime(order.paid_at) }}</span>
            </div>
            <div class="kv">
              <span class="k">更新时间</span><span class="v num">{{ formatTime(order.updated_at) }}</span>
            </div>
          </section>

          <section v-if="hasCommission" class="section">
            <h3 class="section-title">佣金信息</h3>
            <div class="kv">
              <span class="k">佣金状态</span>
              <span class="v">
                <n-tag v-if="commission" :type="commission.type" size="small" round :bordered="false">{{ commission.label }}</n-tag>
                <template v-else>-</template>
              </span>
            </div>
            <div class="kv">
              <span class="k">佣金金额</span><span class="v num warning">{{ money(order.commission_balance) }}</span>
            </div>
            <div v-if="order.actual_commission_balance !== null && order.actual_commission_balance !== undefined" class="kv">
              <span class="k">实际佣金</span><span class="v num">{{ money(order.actual_commission_balance) }}</span>
            </div>
            <template v-if="order.invite_user_id">
              <n-divider class="kv-divider" />
              <div class="kv">
                <span class="k">邀请人</span>
                <span class="v">
                  <a v-if="order.invite_user?.email" class="link" @click="goUser(order.invite_user?.email)">
                    {{ order.invite_user.email }}<n-icon :size="13"><open-outline /></n-icon>
                  </a>
                  <template v-else>已删除的用户</template>
                </span>
              </div>
              <div class="kv">
                <span class="k">邀请人 ID</span><span class="v mono">{{ order.invite_user_id }}</span>
              </div>
            </template>
          </section>
        </div>

        <section v-if="order.commission_log?.length" class="section">
          <h3 class="section-title">佣金发放记录</h3>
          <div class="mini-table">
            <div class="mini-row mini-head">
              <span>发放时间</span><span>获得者 ID</span><span class="r">订单金额</span><span class="r">佣金</span>
            </div>
            <div v-for="log in order.commission_log" :key="log.id" class="mini-row">
              <span class="num">{{ formatTime(log.created_at) }}</span>
              <span class="mono">{{ log.invite_user_id }}</span>
              <span class="num r">{{ money(log.order_amount) }}</span>
              <span class="num r warning">{{ money(log.get_amount) }}</span>
            </div>
          </div>
        </section>

        <section v-if="order.surplus_orders?.length" class="section">
          <h3 class="section-title">被折抵的订单</h3>
          <div class="mini-table">
            <div class="mini-row mini-head">
              <span>订单号</span><span>周期</span><span class="r">金额</span><span>状态</span>
            </div>
            <div v-for="o in order.surplus_orders" :key="o.id" class="mini-row">
              <span class="mono ellipsis" :title="o.trade_no">{{ o.trade_no }}</span>
              <span>{{ legacyPeriodLabel(o.period) }}</span>
              <span class="num r">{{ money(o.total_amount) }}</span>
              <span>{{ findEnum(ORDER_STATUS, o.status)?.label ?? o.status }}</span>
            </div>
          </div>
        </section>
      </div>
      <n-empty v-else-if="!loading" description="未能加载订单信息" class="detail-empty" />
      <div v-else class="detail-placeholder" />
    </n-spin>

    <template v-if="order && (canHandlePayment || canHandleCommission)" #footer>
      <div class="detail-actions">
        <template v-if="canHandlePayment">
          <n-button type="error" ghost :disabled="actionBusy" @click="act(() => cancel(order!))">取消订单</n-button>
          <n-button type="primary" :loading="actionBusy" @click="act(() => markPaid(order!))">标记为已支付</n-button>
        </template>
        <template v-if="canHandleCommission">
          <n-button type="error" ghost :disabled="actionBusy" @click="act(() => setCommission(order!, 3))">佣金无效</n-button>
          <n-button type="primary" :loading="actionBusy" @click="act(() => setCommission(order!, 1))">佣金发放中</n-button>
        </template>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.detail-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--hover-color);
  font-size: 13px;
}
.head-trade {
  min-width: 0;
  flex: 1 1 220px;
}
.head-tags {
  display: flex;
  gap: 6px;
}
.sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 640px) {
  .sections {
    grid-template-columns: 1fr;
  }
}
.section {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  min-width: 0;
}
.section-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.kv {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 4px 0;
  font-size: 13px;
  min-width: 0;
}
.k {
  flex: none;
  width: 6.5em;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.v {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  color: var(--text-strong);
}
.kv-divider {
  margin: 6px 0 !important;
}
.num {
  font-variant-numeric: tabular-nums;
}
.strong {
  font-weight: 650;
  font-size: 15px;
}
.primary {
  color: var(--primary-color);
}
.success {
  color: var(--success-color);
}
.warning {
  color: var(--warning-color);
}
.error {
  color: var(--error-color);
}
.help {
  color: var(--text-muted);
  cursor: help;
}
.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary-color);
  cursor: pointer;
  word-break: break-all;
}
.link:hover {
  text-decoration: underline;
}
.mini-table {
  display: flex;
  flex-direction: column;
  font-size: 12.5px;
}
.mono-copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  word-break: break-all;
}
.mono-copy .mono {
  font-size: 12px;
}
.mini-row {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.8fr);
  gap: 16px;
  padding: 6px 0;
  border-bottom: 1px solid var(--divider-color);
}
.mini-row:last-child {
  border-bottom: 0;
}
.mini-head {
  color: var(--text-muted);
  font-weight: 500;
}
.r {
  text-align: right;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.detail-empty,
.detail-placeholder {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
