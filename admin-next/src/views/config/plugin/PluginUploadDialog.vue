<script setup lang="ts">
// Upload a plugin package (spec platform §3.7). A higher version of an installed plugin is upgraded at once.
import { ref } from 'vue'
import { NAlert, NButton, NModal } from 'naive-ui'
import { uploadPlugin } from '@/api/plugin'
import { loadPlugins } from '@/stores/plugins'
import { message } from '@/utils/discrete'
import ZipDropZone from '@/views/plugin/components/ZipDropZone.vue'

const MAX_BYTES = 10 * 1024 * 1024

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
  let problem = ''
  if (!/\.zip$/i.test(file.name)) problem = '仅支持 .zip 格式文件'
  else if (file.size > MAX_BYTES) problem = '插件包大小不能超过10MB'
  if (problem) {
    lastError.value = problem
    message.error(problem)
    return
  }
  lastError.value = ''
  uploading.value = true
  try {
    const res = await uploadPlugin(file)
    message.success(res?.message || '插件上传成功')
    emit('uploaded')
    emit('update:show', false)
  } catch (e) {
    lastError.value = (e as Error).message || '插件上传失败'
    // The backend replaces the files before auto-upgrading; a failed upgrade leaves the plugin
    // disabled (spec §3.9.10), so refresh the shared list (cards + sidebar) even on failure.
    void loadPlugins(true).catch(() => undefined)
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="上传插件"
    :style="{ width: 'min(520px, 94vw)' }"
    :mask-closable="!uploading"
    :closable="!uploading"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="(v: boolean) => (v ? emit('update:show', true) : close())"
  >
    <p class="up-desc">上传插件包 (.zip)。上传后插件出现在列表中，需要手动安装并启用。</p>
    <n-alert type="warning" :bordered="false" class="up-alert">
      插件包含可在服务器上执行的 PHP 代码，仅上传可信来源的插件。上传同名插件的更高版本会覆盖旧文件，并自动升级已安装的插件。
    </n-alert>
    <zip-drop-zone
      :uploading="uploading"
      text="拖拽插件包到此处，或"
      link-text="浏览"
      hint="仅支持 .zip 格式文件，最大 10MB"
      uploading-text="上传中..."
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
