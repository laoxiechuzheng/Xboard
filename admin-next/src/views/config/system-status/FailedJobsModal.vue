<script setup lang="ts">
// "失败任务详情" dialog; the list is only requested while the dialog is open.
import { ref } from 'vue'
import { NModal, NButton, NIcon } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import FailedJobsTable from './FailedJobsTable.vue'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const tableRef = ref<InstanceType<typeof FailedJobsTable> | null>(null)
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="失败任务详情"
    :style="{ width: 'min(1000px, calc(100vw - 32px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <failed-jobs-table v-if="show" ref="tableRef" :page-sizes="[10, 20, 50]" max-height="calc(90vh - 260px)" />
    <template #footer>
      <div class="footer">
        <n-button :loading="tableRef?.loading" @click="tableRef?.reload()">
          <template #icon>
            <n-icon><refresh-outline /></n-icon>
          </template>
          刷新
        </n-button>
        <n-button @click="emit('update:show', false)">关闭</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
