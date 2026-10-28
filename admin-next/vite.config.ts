import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Production assets are served by Laravel from public/assets/admin-next and
// loaded by resources/views/admin-next.blade.php through the Vite manifest.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.XBOARD_DEV_BACKEND || 'http://127.0.0.1:17999'

  return {
    base: '/assets/admin-next/',
    plugins: [vue()],
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
