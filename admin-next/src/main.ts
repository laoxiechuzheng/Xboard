import { createApp } from 'vue'
import App from '@/App.vue'
import { router } from '@/router'
import '@/styles/global.css'

// Naive UI injects its styles at runtime; keep them ahead of our global CSS.
const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)

createApp(App).use(router).mount('#app')
