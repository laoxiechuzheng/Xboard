<script setup lang="ts">
// Shows the JSON result of a batch generate (official only toasted it).
import { computed, h } from 'vue'
import { NModal, NDataTable, NButton, NIcon, NAlert, type DataTableColumns } from 'naive-ui'
import { CopyOutline, DownloadOutline } from '@vicons/ionicons5'
import type { GeneratedUser } from '@/api/user'
import { copyText, saveFile } from '@/utils/clipboard'
import CopyText from '@/components/CopyText.vue'

const props = defineProps<{ show: boolean; users: GeneratedUser[] }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const HEAD = ['账号', '密码', '过期时间', 'UUID', '创建时间', '订阅地址']
const rowValues = (u: GeneratedUser) => [u.email, u.password, u.expired_at, u.uuid, u.created_at, u.subscribe_url]

function csvCell(v: string) {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function downloadCsv() {
  const lines = [HEAD, ...props.users.map(rowValues)].map((r) => r.map((c) => csvCell(String(c ?? ''))).join(','))
  saveFile('﻿' + lines.join('\r\n'), `users_generated_${Date.now()}.csv`, 'text/csv;charset=utf-8')
}

function copyAll() {
  const text = [HEAD, ...props.users.map(rowValues)].map((r) => r.join('\t')).join('\n')
  void copyText(text, '已复制全部结果')
}

const columns = computed<DataTableColumns<GeneratedUser>>(() => [
  { title: '账号', key: 'email', minWidth: 200, render: (r) => h(CopyText, { text: r.email }) },
  { title: '密码', key: 'password', minWidth: 160, render: (r) => h(CopyText, { text: r.password, mono: true }) },
  { title: '过期时间', key: 'expired_at', width: 170 },
  { title: '订阅地址', key: 'subscribe_url', minWidth: 260, render: (r) => h(CopyText, { text: r.subscribe_url, mono: true }) },
])
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="批量生成结果"
    :bordered="false"
    :style="{ width: 'min(900px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-alert type="warning" :show-icon="true" class="mb">
      结果包含明文密码，关闭后无法再次查看，请及时复制或下载保存。
    </n-alert>
    <n-data-table
      size="small"
      :columns="columns"
      :data="users"
      :row-key="(r: GeneratedUser) => r.email"
      :max-height="420"
      :scroll-x="800"
      :pagination="users.length > 50 ? { pageSize: 50 } : false"
    />
    <template #footer>
      <div class="footer">
        <span class="muted">共 {{ users.length }} 个用户</span>
        <div class="actions">
          <n-button @click="copyAll">
            <template #icon><n-icon><copy-outline /></n-icon></template>
            复制全部
          </n-button>
          <n-button type="primary" @click="downloadCsv">
            <template #icon><n-icon><download-outline /></n-icon></template>
            下载 CSV
          </n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.mb {
  margin-bottom: 12px;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.actions {
  display: flex;
  gap: 8px;
}
</style>
