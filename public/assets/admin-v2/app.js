import { login, session } from './api.js';
import { esc } from './ui.js';
import { renderUsers } from './pages/users.js';

const app = document.querySelector('#app');

function renderLogin() {
  app.innerHTML = '<main class="admin-login"><form class="login-card" data-login>' +
    '<div class="mark">X</div><h1>' + esc(window.xboardAdmin?.title || 'Xboard') + ' 管理后台</h1>' +
    '<p>独立维护的管理界面。登录凭据仅保存在当前浏览器会话。</p>' +
    '<label>管理员邮箱<input class="input" name="email" type="email" required autocomplete="username"></label>' +
    '<label>密码<input class="input" name="password" type="password" required autocomplete="current-password"></label>' +
    '<p class="form-error" data-login-error></p><button class="button primary wide">登录</button></form></main>';
  app.querySelector('[data-login]').addEventListener('submit', async event => {
    event.preventDefault();
    const error = app.querySelector('[data-login-error]');
    error.textContent = '';
    try {
      await login(Object.fromEntries(new FormData(event.currentTarget).entries()));
      render();
    } catch (reason) {
      error.textContent = reason.message || '登录失败';
    }
  });
}

function renderShell() {
  app.innerHTML = '<div class="admin-shell"><aside><div class="brand"><span class="mark">X</span><span>' + esc(window.xboardAdmin?.title || 'Xboard') + '<small>自主后台 · 第一阶段</small></span></div>' +
    '<nav><button class="nav-link active">用户管理</button></nav><p class="sidebar-note">只显示已经实现且可写入的模块，不用空白页面充数。</p></aside>' +
    '<main><header class="admin-topbar"><div><strong>用户管理</strong><span>所有保存请求均由现有管理员 API 校验</span></div><button class="button secondary" data-logout>退出登录</button></header><div id="page-root"></div></main></div>' +
    '<div id="admin-modal"></div><div id="admin-toast" class="toast"></div>';
  app.querySelector('[data-logout]').addEventListener('click', () => { session.token = ''; render(); });
  renderUsers(app.querySelector('#page-root'));
}

function render() { session.token ? renderShell() : renderLogin(); }
render();
