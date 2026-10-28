// Settings sub-navigation (spec settings.md §2.2). `key` is the route param of config/system/:tab?.
import { defineAsyncComponent, defineComponent, h, type Component } from 'vue'
import { NButton, NResult, NSpin } from 'naive-ui'
import {
  GlobeOutline,
  ShieldCheckmarkOutline,
  LayersOutline,
  GiftOutline,
  ServerOutline,
  MailOutline,
  PaperPlaneOutline,
  PhonePortraitOutline,
  CodeSlashOutline,
  ColorPaletteOutline,
} from '@vicons/ionicons5'

export interface SettingsTabMeta {
  key: string
  title: string
  description: string
  icon: Component
  component: Component
  /** Not in the sub-navigation (spec core §6.1): reachable by URL, listed only while open. */
  legacy?: boolean
}

const TabLoading = defineComponent({
  name: 'SettingsTabLoading',
  setup: () => () => h('div', { style: 'display:grid;place-items:center;min-height:240px' }, h(NSpin, { size: 'medium' })),
})

// Chunk load failure (e.g. after a redeploy): offer a reload instead of a blank panel.
const TabLoadError = defineComponent({
  name: 'SettingsTabLoadError',
  setup: () => () =>
    h(
      NResult,
      { status: 'error', title: '页面加载失败', description: '可能是后台已更新，请刷新页面后重试。', style: 'padding:48px 0' },
      { footer: () => h(NButton, { onClick: () => window.location.reload() }, { default: () => '刷新页面' }) },
    ),
})

function lazy(loader: () => Promise<{ default: Component }>): Component {
  return defineAsyncComponent({ loader, loadingComponent: TabLoading, errorComponent: TabLoadError, delay: 150 })
}

export const settingsTabs: SettingsTabMeta[] = [
  {
    key: '',
    title: '站点设置',
    description: '配置站点基本信息，包括站点名称、描述、货币单位等核心设置。',
    icon: GlobeOutline,
    component: lazy(() => import('./SiteTab.vue')),
  },
  {
    key: 'safe',
    title: '安全设置',
    description: '配置系统安全相关选项，包括登录验证、密码策略、API访问等安全设置。',
    icon: ShieldCheckmarkOutline,
    component: lazy(() => import('./SafeTab.vue')),
  },
  {
    key: 'subscribe',
    title: '订阅设置',
    description: '管理用户订阅相关配置，包括订阅链接格式、更新频率、流量统计等设置。',
    icon: LayersOutline,
    component: lazy(() => import('./SubscribeTab.vue')),
  },
  {
    key: 'invite',
    title: '邀请&佣金设置',
    description: '邀请注册、佣金相关设置。',
    icon: GiftOutline,
    component: lazy(() => import('./InviteTab.vue')),
  },
  {
    key: 'server',
    title: '节点配置',
    description: '配置节点通信和同步设置，包括通信密钥、轮询间隔、负载均衡等高级选项。',
    icon: ServerOutline,
    component: lazy(() => import('./ServerTab.vue')),
  },
  {
    key: 'email',
    title: '邮件设置',
    description: '配置系统邮件服务，用于发送验证码、密码重置、通知等邮件，支持多种SMTP服务商。',
    icon: MailOutline,
    component: lazy(() => import('./EmailTab.vue')),
  },
  {
    key: 'telegram',
    title: 'Telegram设置',
    description: '配置Telegram机器人功能，实现用户通知、账户绑定、指令交互等自动化服务。',
    icon: PaperPlaneOutline,
    component: lazy(() => import('./TelegramTab.vue')),
  },
  {
    key: 'app',
    title: 'APP设置',
    description: '管理移动应用程序相关配置，包括API接口、版本控制、推送通知等功能设置。',
    icon: PhonePortraitOutline,
    component: lazy(() => import('./AppTab.vue')),
  },
  {
    key: 'subscribe-template',
    title: '订阅模板',
    description: '配置各个客户端的订阅模板',
    icon: CodeSlashOutline,
    component: lazy(() => import('./SubscribeTemplateTab.vue')),
  },
  {
    key: 'frontend',
    title: '个性化设置',
    description: '自定义系统界面外观，包括主题风格、布局、颜色方案、背景图等个性化选项。',
    icon: ColorPaletteOutline,
    component: lazy(() => import('./FrontendTab.vue')),
    legacy: true,
  },
]

/** Route param -> tab; the official route `APP` is upper-case, so match case-insensitively. */
export function resolveSettingsTab(param: unknown): SettingsTabMeta | undefined {
  const raw = Array.isArray(param) ? param[0] : param
  const key = typeof raw === 'string' ? raw.toLowerCase() : ''
  return settingsTabs.find((t) => t.key === key)
}

export function settingsTabPath(key: string): string {
  return key ? `/config/system/${key}` : '/config/system'
}
