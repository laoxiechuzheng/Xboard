<script setup lang="ts">
// Reorder all notices (drag or up/down) and persist with POST /notice/sort { ids }.
// Always works on the full list, so search filters can never misplace rows (spec R-S2);
// a failed save keeps the dialog open (spec R-S3).
import { ref, watch } from 'vue'
import { NButton, NModal } from 'naive-ui'
import SortableList from '@/components/SortableList.vue'
import { sortNotices, type Notice } from '@/api/notice'
import { message } from '@/utils/discrete'

const props = defineProps<{ show: boolean; notices: Notice[] }>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: [] }>()

const items = ref<Notice[]>([])
const saving = ref(false)

watch(
  () => props.show,
  (open) => {
    if (open) items.value = props.notices.slice()
  },
)

async function save() {
  saving.value = true
  try {
    await sortNotices(items.value.map((n) => n.id))
    message.success('排序保存成功')
    emit('saved')
    emit('update:show', false)
  } catch {
    /* toasted; keep the dialog so the order is not lost */
  } finally {
    saving.value = false
  }
}

const sub = (n: Notice) =>
  [`ID ${n.id}`, n.show ? '显示中' : '已隐藏', ...(n.tags ?? []).slice(0, 3).map((t) => `#${t}`)].join(' · ')
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="编辑排序"
    :bordered="false"
    :mask-closable="!saving"
    :closable="!saving"
    :style="{ width: 'min(560px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <p class="muted tip">
      拖拽公告或使用右侧箭头调整顺序，用户端按此顺序展示。新建的公告在保存一次排序前会排在最前。
    </p>
    <sortable-list v-model:items="items" :label="(n: Notice) => n.title" :sublabel="sub" />
    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="saving" @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="saving" :disabled="!items.length" @click="save">保存排序</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.tip {
  margin: 0 0 12px;
  font-size: 13px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
