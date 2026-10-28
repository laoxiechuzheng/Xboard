<script setup lang="ts">
// Result of a batch generation: list codes, copy them, re-download the CSV.
import { computed } from 'vue'
import { NAlert, NButton, NIcon, NInput, NModal } from 'naive-ui'
import { CopyOutline, DownloadOutline } from '@vicons/ionicons5'
import { copyText, saveFile } from '@/utils/clipboard'
import { batchCsvFile, parseBatchCsv } from './coupon-utils'

const props = defineProps<{
  show: boolean
  csv: string
  count: number
  name: string
  /** ms timestamp used in the file name. */
  stamp: number
}>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const rows = computed(() => parseBatchCsv(props.csv))
/** Column 8 of the backend CSV is the code. */
const codes = computed(() => rows.value.map((r) => r[7]).filter(Boolean))

function download() {
  saveFile(batchCsvFile(props.csv), `coupons_${props.stamp}.csv`, 'text/csv;charset=utf-8')
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="批量生成完成"
    :style="{ width: 'min(520px, calc(100vw - 32px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <n-alert type="success" :show-icon="true" class="summary">
      已生成 <strong class="num">{{ codes.length }}</strong> 张「{{ name }}」优惠券并已启用，CSV 文件已开始下载。
      <template v-if="codes.length !== count">（请求 {{ count }} 张，解析到 {{ codes.length }} 张，请以 CSV 为准）</template>
    </n-alert>
    <n-input
      type="textarea"
      :value="codes.join('\n')"
      readonly
      :autosize="{ minRows: 6, maxRows: 14 }"
      class="codes"
    />
    <template #footer>
      <div class="dialog-footer">
        <n-button @click="download">
          <template #icon><n-icon><download-outline /></n-icon></template>
          重新下载 CSV
        </n-button>
        <n-button type="primary" :disabled="!codes.length" @click="copyText(codes.join('\n'), `已复制 ${codes.length} 个券码`)">
          <template #icon><n-icon><copy-outline /></n-icon></template>
          复制全部券码
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.summary {
  margin-bottom: 12px;
}
.num {
  font-variant-numeric: tabular-nums;
}
.codes :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 13px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
