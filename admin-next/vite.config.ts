import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { devMockApi } from './dev/mock-api.ts'

// Production assets are served by Laravel from public/assets/admin-next and
// loaded by resources/views/admin-next.blade.php through the Vite manifest.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.XBOARD_DEV_BACKEND || 'http://127.0.0.1:17999'
  // Dev only: XBOARD_DEV_MOCK=1 (or `legacy`) answers /api from dev/mock-api.ts instead of the proxy.
  const mock = command === 'serve' ? env.XBOARD_DEV_MOCK : ''

  return {
    base: '/assets/admin-next/',
    plugins: [vue(), ...(mock ? [devMockApi(mock)] : [])],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5180,
      strictPort: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
      },
    },
    build: {
      outDir: '../public/assets/admin-next',
      emptyOutDir: true,
      manifest: 'manifest.json',
      chunkSizeWarningLimit: 1500,
      // No manualChunks: forcing echarts into its own chunk left rolldown's runtime helper in
      // the EChart.vue chunk, creating a circular chunk import that broke the dashboard in
      // production ("e is not a function"). Automatic splitting keeps echarts lazy anyway.
    },
  }
})
