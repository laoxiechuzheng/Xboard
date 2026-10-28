<script setup lang="ts">
// Reorder all plans (drag or up/down) and persist with POST /plan/sort { ids }.
import { ref, watch } from 'vue'
import { NModal, NButton, NSpace } from 'naive-ui'
import SortableList from '@/components/SortableList.vue'
import { sortPlans, type Plan } from '@/api/plan'
import { message } from '@/utils/discrete'

const props = defineProps<{ show: boolean; plans: Plan[] }>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: [] }>()

const items = ref<Plan[]>([])
const saving = ref(false)

watch(
  () => props.show,
  (open) => {
    if (open) items.value = props.plans.slice()
  },
)

async function save() {
  saving.value = true
  try {
    await sortPlans(items.value.map((p) => p.id))
    message.success('排序保存成功')
    emit('saved')
    emit('update:show', false)
  } catch {
    /* toasted */
  } finally {
    saving.value = false
  }
}

const sub = (p: Plan) =>
  [`ID ${p.id}`, p.group?.name ? `权限组 ${p.group.name}` : '', p.show ? '显示中' : '已隐藏'].filter(Boolean).join(' · ')
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
    <p class="muted tip">拖拽套餐或使用右侧箭头调整顺序，用户端按此顺序展示套餐。</p>
    <sortable-list v-model:items="items" :label="(p: Plan) => p.name" :sublabel="sub" />
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
