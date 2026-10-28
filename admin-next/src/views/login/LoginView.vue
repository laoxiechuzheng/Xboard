<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, NIcon, NAlert, type FormInst, type FormRules } from 'naive-ui'
import { MailOutline, LockClosedOutline, MoonOutline, SunnyOutline, ContrastOutline } from '@vicons/ionicons5'
import { publicHttp, ApiError } from '@/api/http'
import { setAuth } from '@/stores/auth'
import { settings } from '@/settings'
import { appState, cycleThemeMode } from '@/stores/app'

const route = useRoute()
const router = useRouter()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const error = ref('')
const form = reactive({ email: '', password: '' })

const rules: FormRules = {
  email: [{ required: true, message: '请输入管理员邮箱', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function submit() {
  error.value = ''
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    const res = await publicHttp.post<{ auth_data: string; is_admin: boolean | number }>(
      '/api/v2/passport/auth/login',
      { email: form.email.trim(), password: form.password },
      { silent: true },
    )
    if (!res?.auth_data) throw new ApiError('登录响应异常', 500, res)
    if (!Number(res.is_admin)) {
      error.value = '该账号不是管理员，无法登录后台'
      return
    }
    setAuth(res.auth_data)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.replace(redirect.startsWith('/') && !redirect.startsWith('/login') ? redirect : '/dashboard')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <button class="theme-toggle" type="button" title="切换主题" @click="cycleThemeMode">
      <n-icon :size="18">
        <sunny-outline v-if="appState.themeMode === 'light'" />
        <moon-outline v-else-if="appState.themeMode === 'dark'" />
        <contrast-outline v-else />
      </n-icon>
    </button>
    <div class="login-card">
      <div class="login-brand">
        <img v-if="settings.logo" :src="settings.logo" class="login-logo" alt="" />
        <div v-else class="login-mark">{{ settings.title.slice(0, 1) }}</div>
        <div>
          <div class="login-title">{{ settings.title }}</div>
          <div class="login-sub">管理后台</div>
        </div>
      </div>
      <n-alert v-if="error" type="error" :show-icon="true" class="login-alert">{{ error }}</n-alert>
      <n-form ref="formRef" :model="form" :rules="rules" size="large" :show-label="false" @submit.prevent="submit">
        <n-form-item path="email">
          <n-input v-model:value="form.email" placeholder="管理员邮箱" :input-props="{ autocomplete: 'username', type: 'email' }">
            <template #prefix><n-icon><mail-outline /></n-icon></template>
          </n-input>
        </n-form-item>
        <n-form-item path="password">
          <n-input
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            placeholder="密码"
            :input-props="{ autocomplete: 'current-password' }"
            @keyup.enter="submit"
          >
            <template #prefix><n-icon><lock-closed-outline /></n-icon></template>
          </n-input>
        </n-form-item>
        <n-button type="primary" block size="large" attr-type="submit" :loading="loading">登录</n-button>
      </n-form>
      <div class="login-foot">
        <a :href="settings.legacyAdminUrl">前往旧版后台</a>
        <span>v{{ settings.version }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background:
    radial-gradient(1200px 600px at 10% -10%, color-mix(in srgb, var(--primary-color) 18%, transparent), transparent 60%),
    radial-gradient(900px 500px at 110% 110%, color-mix(in srgb, #8b5cf6 16%, transparent), transparent 60%),
    var(--body-color);
  position: relative;
}
.theme-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--card-color);
  color: var(--text-color);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.login-card {
  width: 100%;
  max-width: 380px;
  padding: 32px 28px 20px;
  border-radius: 16px;
  background: var(--card-color);
  border: 1px solid var(--border-color);
  box-shadow: 0 20px 50px -24px rgba(15, 23, 42, 0.35);
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.login-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
}
.login-mark {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-color), #8b5cf6);
}
.login-title {
  font-size: 18px;
  font-weight: 650;
  line-height: 1.3;
}
.login-sub {
  font-size: 13px;
  color: var(--text-muted);
}
.login-alert {
  margin-bottom: 16px;
}
.login-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
  font-size: 12px;
  color: var(--text-muted);
}
.login-foot a {
  color: var(--primary-color);
  text-decoration: none;
}
</style>
