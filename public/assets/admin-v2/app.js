import { login, session } from './api.js';
import { esc } from './ui.js';
import { renderUsers } from './pages/users.js';
import { renderPlans } from './pages/plans.js';
import { renderNodes } from './pages/nodes.js';
import { renderOrders } from './pages/orders.js';
import { renderTickets } from './pages/tickets.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderCommissions } from './pages/commissions.js';

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
  const state = { page: 'dashboard' };
  app.innerHTML = '<div class="admin-shell"><aside><div class="brand"><span class="mark">X</span><span>' + esc(window.xboardAdmin?.title || 'Xboard') + '<small>自主后台 · 第一阶段</small></span></div>' +
    '<nav><button class="nav-link active" data-page="dashboard">运营仪表盘</button><button class="nav-link" data-page="users">用户管理</button><button class="nav-link" data-page="plans">套餐管理</button><button class="nav-link" data-page="nodes">节点管理</button><button class="nav-link" data-page="orders">订单管理</button><button class="nav-link" data-page="commissions">佣金运营</button><button class="nav-link" data-page="tickets">工单管理</button></nav><p class="sidebar-note">已接入的页面均读写现有管理员接口；未实现的模块不会伪装成可用。</p></aside>' +
    '<main><header class="admin-topbar"><div><strong>运营仪表盘</strong><span>所有保存请求均由现有管理员 API 校验</span></div><button class="button secondary" data-logout>退出登录</button></header><div id="page-root"></div></main></div>' +
    '<div id="admin-modal"></div><div id="admin-toast" class="toast"></div>';
  const root = app.querySelector('#page-root');
  const renderPage = page => {
    state.page = page;
    app.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    app.querySelector('.admin-topbar strong').textContent = page === 'dashboard' ? '运营仪表盘' : (page === 'plans' ? '套餐管理' : (page === 'nodes' ? '节点管理' : (page === 'orders' ? '订单管理' : (page === 'commissions' ? '佣金运营' : (page === 'tickets' ? '工单管理' : '用户管理')))));
    (page === 'dashboard' ? renderDashboard : (page === 'plans' ? renderPlans : (page === 'nodes' ? renderNodes : (page === 'orders' ? renderOrders : (page === 'commissions' ? renderCommissions : (page === 'tickets' ? renderTickets : renderUsers))))))(root);
  };
  app.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => renderPage(button.dataset.page)));
  app.querySelector('[data-logout]').addEventListener('click', () => { session.token = ''; render(); });
  renderPage(state.page);
}

function render() { session.token ? renderShell() : renderLogin(); }
render();
