<script setup lang="ts">
// Reorder payment methods (drag or up/down) and persist with POST /payment/sort { ids }.
import { ref, watch } from 'vue'
import { NButton, NModal, NSpace } from 'naive-ui'
import SortableList from '@/components/SortableList.vue'
import { fetchPayments, sortPayments, type Payment } from '@/api/payment'
import { message } from '@/utils/discrete'

const props = defineProps<{ show: boolean; payments: Payment[] }>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: [] }>()

const items = ref<Payment[]>([])
const saving = ref(false)

watch(
  () => props.show,
  (open) => {
    if (open) items.value = props.payments.slice()
  },
)

async function save() {
  saving.value = true
  try {
    // A vanished id makes the backend call null->update() (an Error its catch misses), leaving
    // its DB transaction open; so re-check that the list is unchanged before saving.
    const fresh = await fetchPayments()
    const ids = items.value.map((p) => p.id)
    const freshIds = new Set(fresh.map((p) => p.id))
    if (ids.length !== freshIds.size || ids.some((id) => !freshIds.has(id))) {
      items.value = fresh
      emit('saved')
      message.warning('支付方式列表已被修改，已刷新为最新列表，请重新调整后保存')
      return
    }
    await sortPayments(ids)
    message.success('排序保存成功')
    emit('saved')
    emit('update:show', false)
  } catch {
    /* toasted */
  } finally {
    saving.value = false
  }
}

const sub = (p: Payment) => [`ID ${p.id}`, p.payment, p.enable ? '已启用' : '已停用'].join(' · ')
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="编辑排序"
    :bordered="false"
    :mask-closable="!saving"
    style="width: min(520px, calc(100vw - 32px))"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <p class="muted tip">拖拽支付方式或使用右侧箭头调整顺序，完成后点击保存。用户下单时按此顺序展示支付方式。</p>
    <sortable-list v-model:items="items" :label="(p: Payment) => p.name" :sublabel="sub" />
    <template #footer>
      <n-space justify="end">
        <n-button :disabled="saving" @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="saving" :disabled="!items.length" @click="save">保存排序</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.tip {
  margin: 0 0 12px;
  font-size: 13px;
}
</style>
