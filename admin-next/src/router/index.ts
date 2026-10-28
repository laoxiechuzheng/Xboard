import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { isLoggedIn } from '@/stores/auth'
import { settings } from '@/settings'
import { loadingBar } from '@/utils/discrete'

const AdminLayout = () => import('@/layouts/AdminLayout.vue')

// Route paths follow the official admin (spec core §6.4) so links stay familiar.
const pages: RouteRecordRaw[] = [
  { path: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue'), meta: { title: '仪表盘' } },

  // System settings: tab is a sub-path like the official /config/system/safe.
  {
    path: 'config/system/:tab?',
    component: () => import('@/views/config/SystemConfigView.vue'),
    meta: { title: '系统配置', reuse: true },
  },
  { path: 'config/plugin', component: () => import('@/views/config/PluginView.vue'), meta: { title: '插件管理' } },
  {
    path: 'config/plugin/menu-demo',
    component: () => import('@/views/config/PluginMenuDemoView.vue'),
    meta: { title: '插件菜单演示' },
  },
  {
    path: 'config/plugin/crud-demo',
    component: () => import('@/views/config/PluginCrudDemoView.vue'),
    meta: { title: 'Schema CRUD 演示' },
  },
  { path: 'config/theme', component: () => import('@/views/config/ThemeView.vue'), meta: { title: '主题配置' } },
  { path: 'config/notice', component: () => import('@/views/config/NoticeView.vue'), meta: { title: '公告管理' } },
  { path: 'config/payment', component: () => import('@/views/config/PaymentView.vue'), meta: { title: '支付配置' } },
  { path: 'config/knowledge', component: () => import('@/views/config/KnowledgeView.vue'), meta: { title: '知识库管理' } },
  {
    path: 'config/system-status',
    component: () => import('@/views/config/SystemStatusView.vue'),
    meta: { title: '系统状态' },
  },
  { path: 'config/audit-log', component: () => import('@/views/config/AuditLogView.vue'), meta: { title: '审计日志' } },

  { path: 'server/machine', component: () => import('@/views/server/MachineView.vue'), meta: { title: '服务器管理' } },
  { path: 'server/manage', component: () => import('@/views/server/NodeView.vue'), meta: { title: '节点管理' } },
  { path: 'server/group', component: () => import('@/views/server/GroupView.vue'), meta: { title: '权限组管理' } },
  { path: 'server/route', component: () => import('@/views/server/RouteView.vue'), meta: { title: '路由管理' } },

  { path: 'finance/plan', component: () => import('@/views/finance/PlanView.vue'), meta: { title: '套餐管理' } },
  { path: 'finance/order', component: () => import('@/views/finance/OrderView.vue'), meta: { title: '订单管理' } },
  { path: 'finance/coupon', component: () => import('@/views/finance/CouponView.vue'), meta: { title: '优惠券管理' } },
  { path: 'finance/gift-card', component: () => import('@/views/finance/GiftCardView.vue'), meta: { title: '礼品卡管理' } },

  { path: 'user/manage', component: () => import('@/views/user/UserView.vue'), meta: { title: '用户管理' } },
  { path: 'user/ticket', component: () => import('@/views/user/TicketView.vue'), meta: { title: '工单管理' } },
  {
    path: 'user/traffic-reset-logs',
    component: () => import('@/views/user/TrafficResetView.vue'),
    meta: { title: '流量重置日志' },
  },
  { path: 'user/login-log', component: () => import('@/views/user/LoginLogView.vue'), meta: { title: '登录记录' } },

  // Plugin pages declared via config.json admin_menus / admin_crud (spec platform §4).
  {
    path: 'plugins/:pluginCode/:subPath(.*)*',
    component: () => import('@/views/plugin/PluginRuntimeView.vue'),
    meta: { title: '插件页面' },
  },
]

const routes: RouteRecordRaw[] = [
  { path: '/login', component: () => import('@/views/login/LoginView.vue'), meta: { title: '登录', public: true } },
  // Official admin uses #/sign-in; keep old bookmarks working.
  { path: '/sign-in', redirect: (to) => ({ path: '/login', query: to.query }) },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      ...pages,
      { path: ':pathMatch(.*)*', component: () => import('@/views/NotFoundView.vue'), meta: { title: '页面不存在' } },
    ],
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  loadingBar.start()
  if (!to.meta.public && !isLoggedIn()) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && isLoggedIn()) {
    return { path: '/dashboard' }
  }
  return true
})

router.afterEach((to) => {
  loadingBar.finish()
  const t = (to.meta.title as string) || ''
  document.title = t ? `${t} · ${settings.title}` : settings.title
})

router.onError(() => loadingBar.error())
