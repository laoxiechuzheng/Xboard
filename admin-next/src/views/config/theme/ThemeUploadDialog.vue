<script setup lang="ts">
// Upload a theme package (spec platform §2.7). Pre-checks extension / size / file name like the backend.
import { ref } from 'vue'
import { NAlert, NButton, NModal } from 'naive-ui'
import { uploadTheme } from '@/api/theme'
import { message } from '@/utils/discrete'
import ZipDropZone from '@/views/plugin/components/ZipDropZone.vue'
import { checkThemePackage } from '@/views/config/theme/fields'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean]; uploaded: [] }>()

const uploading = ref(false)
const lastError = ref('')

function close() {
  if (uploading.value) return
  lastError.value = ''
  emit('update:show', false)
}

async function onSelect(file: File) {
  if (uploading.value) return
  const problem = checkThemePackage(file)
  if (problem) {
    lastError.value = problem
    message.error(problem)
    return
  }
  lastError.value = ''
  uploading.value = true
  try {
    await uploadTheme(file)
    message.success('主题上传成功')
    emit('uploaded')
    emit('update:show', false)
  } catch (e) {
    // Already toasted by the http client; keep the reason visible in the dialog too.
    lastError.value = (e as Error).message || '主题上传失败'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="上传主题"
    :style="{ width: 'min(520px, 94vw)' }"
    :mask-closable="!uploading"
    :closable="!uploading"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="(v: boolean) => (v ? emit('update:show', true) : close())"
  >
    <p class="up-desc">请上传一个有效的主题压缩包（.zip 格式）。主题包应包含完整的主题文件结构（config.json 与 dashboard.blade.php）。</p>
    <n-alert type="warning" :bordered="false" class="up-alert">
      主题包包含可在服务器上执行的模板代码，仅上传可信来源的主题。上传与已有主题同名且版本更高的包会覆盖旧文件，已保存的主题配置会保留。
    </n-alert>
    <zip-drop-zone
      :uploading="uploading"
      text="将主题文件拖放到此处，或者"
      link-text="点击选择"
      hint="支持 .zip 格式的主题包，最大 10MB；文件名只能包含字母、数字、下划线、中划线和点"
      uploading-text="正在上传..."
      @select="onSelect"
    />
    <n-alert v-if="lastError" type="error" :bordered="false" class="up-error">{{ lastError }}</n-alert>
    <template #footer>
      <div class="up-footer">
        <n-button :disabled="uploading" @click="close">关闭</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.up-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}
.up-alert {
  margin-bottom: 14px;
}
.up-error {
  margin-top: 12px;
  word-break: break-word;
}
.up-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
