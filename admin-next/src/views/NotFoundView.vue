<script setup lang="ts">
import { NResult, NButton } from 'naive-ui'
</script>

<template>
  <n-result status="404" title="页面不存在" description="你访问的页面不存在或已移动">
    <template #footer>
      <router-link to="/dashboard"><n-button type="primary">返回仪表盘</n-button></router-link>
    </template>
  </n-result>
</template>
