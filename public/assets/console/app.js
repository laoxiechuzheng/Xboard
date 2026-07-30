const cfg = window.xboardAdmin || {};
const state = {
  token: sessionStorage.getItem('xboard.console.token') || '',
  page: 'dashboard',
  current: 1,
  menu: false,
  notice: '',
};

const navigation = [
  ['运营概览', [['dashboard', '概览', '◈'], ['statistics', '数据分析', '◌']]],
  ['业务管理', [['users', '用户', '♙'], ['orders', '订单', '▣'], ['plans', '套餐', '◇'], ['coupons', '优惠券', '⌁'], ['gift-cards', '礼品卡', '▤']]],
  ['服务与支持', [['nodes', '节点', '◉'], ['groups', '节点分组', '◫'], ['routes', '路由规则', '⌘'], ['machines', '机器', '▦'], ['tickets', '工单', '◍'], ['notices', '公告', '▱'], ['knowledge', '知识库', '▨']]],
  ['系统设置', [['payments', '支付方式', '◈'], ['mail', '邮件模板', '✉'], ['settings', '系统设置', '⚙'], ['themes', '主题', '◐'], ['plugins', '插件', '⧉'], ['health', '运行状态', '♥'], ['audit', '操作审计', '◷']]],
];

const pages = {
  dashboard: ['运营概览', '收入、流量和系统运行状态', null],
  statistics: ['数据分析', '收入、注册、流量与排行', 'stat/getOrder'],
  users: ['用户管理', '搜索、筛选和维护账户', 'user/fetch'],
  orders: ['订单管理', '查询和处理订单状态', 'order/fetch'],
  plans: ['套餐管理', '维护销售套餐与价格', 'plan/fetch'],
  coupons: ['优惠券', '生成和管理优惠券', 'coupon/fetch'],
  'gift-cards': ['礼品卡', '模板、兑换码和使用记录', 'gift-card/templates'],
  nodes: ['节点管理', '节点状态、流量和批量维护', 'server/manage/getNodes'],
  groups: ['节点分组', '维护节点展示和权限分组', 'server/group/fetch'],
  routes: ['路由规则', '维护流量匹配与分流规则', 'server/route/fetch'],
  machines: ['机器管理', '连接机器并查看同步状态', 'server/machine/fetch'],
  tickets: ['工单', '及时响应用户支持请求', 'ticket/fetch'],
  notices: ['公告', '维护全站公告内容和排序', 'notice/fetch'],
  knowledge: ['知识库', '维护帮助中心和常见问题', 'knowledge/fetch'],
  payments: ['支付方式', '管理支付通道及其排序', 'payment/fetch'],
  mail: ['邮件模板', '维护通知邮件和测试发送', 'mail/template/list'],
  settings: ['系统设置', '集中管理面板配置', 'config/fetch'],
  themes: ['主题管理', '管理用户前台主题', 'theme/getThemes'],
  plugins: ['插件管理', '管理已安装的功能扩展', 'plugin/getPlugins'],
  health: ['运行状态', '队列、计划任务和 Horizon 运行状况', 'system/getSystemStatus'],
  audit: ['操作审计', '查看管理员操作记录', 'system/getAuditLog'],
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}
function amount(value) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(Number(value || 0));
}
function num(value) { return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Number(value || 0)); }
function bytes(value) {
  let number = Number(value || 0); let index = 0; const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  while (number >= 1024 && index < units.length - 1) { number /= 1024; index += 1; }
  return num(number) + ' ' + units[index];
}
function time(value) {
  if (!value) return '—';
  const date = new Date(Number(value) < 20000000000 ? Number(value) * 1000 : value);
  return Number.isNaN(date.valueOf()) ? esc(value) : date.toLocaleString('zh-CN', { hour12: false });
}
function apiPath(endpoint) { return '/api/v2/' + encodeURIComponent(cfg.securePath || '') + '/' + endpoint; }
async function api(endpoint, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = state.token;
  const request = { ...options, headers };
  if (request.body && !(request.body instanceof FormData)) {
    request.headers['Content-Type'] = 'application/json'; request.body = JSON.stringify(request.body);
  }
  const response = await fetch(apiPath(endpoint), request);
  const payload = await response.json().catch(() => ({ message: '服务器没有返回 JSON 数据' }));
  if (!response.ok || (payload.code && payload.code !== 0)) {
    const error = new Error(payload.message || '请求失败 (' + response.status + ')'); error.status = response.status; throw error;
  }
  return payload.data ?? payload;
}
function metric(label, value, hint, tone = '') {
  return '<article class="card metric"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '</div><div class="metric-foot ' + tone + '">' + hint + '</div></article>';
}
function sidebar() {
  let html = '<aside class="sidebar ' + (state.menu ? 'open' : '') + '"><div class="brand"><span class="brand-mark">X</span><span>' + esc(cfg.title || 'Xboard') + '<small>自主后台 · ' + esc(cfg.version || '') + '</small></span></div>';
  for (const [group, items] of navigation) {
    html += '<div class="nav-group">' + group + '</div>';
    for (const [id, label, icon] of items) html += '<button class="nav-link ' + (id === state.page ? 'active' : '') + '" data-page="' + id + '"><span class="nav-icon">' + icon + '</span>' + label + '</button>';
  }
  return html + '</aside>';
}
function topbar() {
  const page = pages[state.page] || pages.dashboard;
  return '<header class="topbar"><div class="crumb"><button class="mobile-toggle" data-menu aria-label="打开菜单">☰</button><strong>' + page[0] + '</strong><span>' + page[1] + '</span></div><div class="top-actions"><button class="quiet" data-refresh>刷新数据</button><button class="quiet logout" data-logout>退出登录</button></div></header>';
}
function shell(content) { return '<div class="app-shell">' + sidebar() + '<main class="content">' + topbar() + content + '</main></div>'; }
function login() {
  return '<main class="login-shell"><section class="login-card"><div class="brand"><span class="brand-mark">X</span><span>' + esc(cfg.title || 'Xboard') + '<small>自主维护管理中心</small></span></div><h1>管理员登录</h1><p>登录令牌仅保存在当前浏览器会话中，关闭浏览器后自动清除。</p><form data-login><div class="field"><label for="email">邮箱</label><input class="input" id="email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="password">密码</label><input class="input" id="password" name="password" type="password" autocomplete="current-password" required></div><button class="primary wide" type="submit">安全登录</button><span class="form-error" data-login-error></span></form></section></main>';
}
function healthLine(label, healthy, detail) {
  return '<div class="status-line"><span>' + label + '</span><span class="status"><i class="dot ' + (healthy ? 'good' : 'bad') + '"></i>' + detail + '</span></div>';
}
async function dashboard() {
  const results = await Promise.allSettled([api('stat/getOverride'), api('system/getSystemStatus'), api('system/getQueueStats')]);
  const overview = results[0].status === 'fulfilled' ? results[0].value : {};
  const system = results[1].status === 'fulfilled' ? results[1].value : {};
  const queue = results[2].status === 'fulfilled' ? results[2].value : {};
  const first = '<section class="page"><div class="page-head"><div><h1>欢迎回来</h1><p>这是 ' + esc(cfg.title || 'Xboard') + ' 的实时运营概览。</p></div><div class="button-row"><button class="secondary" data-page="users">管理用户</button><button class="primary" data-page="orders">查看订单</button></div></div>';
  const metrics = '<div class="grid metrics">' + metric('本月收入', amount(overview.month_income), '上月 ' + amount(overview.last_month_income)) + metric('今日收入', amount(overview.day_income), '已支付订单累计') + metric('本月新增用户', num(overview.month_register_total), num(overview.online_users) + ' 位用户近 10 分钟活跃', 'good') + metric('待处理工单', num(overview.ticket_pending_total), num(overview.commission_pending_total) + ' 笔佣金待处理', overview.ticket_pending_total ? 'warn' : 'good') + '</div>';
  const traffic = '<section class="card"><div class="card-head"><h2>网络与流量</h2><span class="badge good">实时</span></div><div class="grid metrics">' + metric('在线节点', num(overview.online_nodes), num(overview.online_devices) + ' 台在线设备', 'good') + metric('今日流量', bytes(overview.today_traffic?.total), '上传 ' + bytes(overview.today_traffic?.upload) + ' · 下载 ' + bytes(overview.today_traffic?.download)) + metric('本月流量', bytes(overview.month_traffic?.total), '累计 ' + bytes(overview.total_traffic?.total)) + metric('在线用户', num(overview.online_users), '最近 10 分钟内活跃') + '</div></section>';
  const health = '<section class="card"><div class="card-head"><h2>系统健康</h2><button class="quiet" data-page="health">详情</button></div><div class="status-list">' + healthLine('计划任务', system.schedule, system.schedule ? '正常' : '需要检查') + healthLine('队列 Horizon', system.horizon, system.horizon ? '正常' : '需要检查') + healthLine('失败任务', !Number(queue.failedJobs || 0), num(queue.failedJobs) + ' 个') + healthLine('最近队列任务', true, num(queue.recentJobs) + ' 个') + '</div></section>';
  return first + metrics + '<div class="grid two-col">' + traffic + health + '</div></section>';
}
function toRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.items)) return data.items;
  if (data && typeof data === 'object') return [data];
  return [];
}
function preferredKeys(page, row) {
  const map = { users: ['id', 'email', 'plan_id', 'transfer_enable', 'u', 'd', 'expired_at', 'banned'], orders: ['trade_no', 'user_id', 'total_amount', 'status', 'created_at'], nodes: ['id', 'name', 'type', 'host', 'port', 'is_online'], tickets: ['id', 'subject', 'status', 'updated_at'], plans: ['id', 'name', 'month_price', 'year_price', 'transfer_enable'], audit: ['id', 'action', 'uri', 'created_at'] };
  const keys = (map[page] || Object.keys(row)).filter(key => Object.hasOwn(row, key) && !['password', 'token', 'uuid', 'request_data'].includes(key));
  return keys.slice(0, 8);
}
function cell(value, key) {
  if (value === null || value === undefined || value === '') return '<span class="badge">—</span>';
  if (typeof value === 'boolean' || ['banned', 'is_online', 'show'].includes(key)) return '<span class="badge ' + (value === true || value === 1 || value === '1' ? 'good' : 'bad') + '">' + (value === true || value === 1 || value === '1' ? '是' : '否') + '</span>';
  if (key.includes('amount') || key.includes('price')) return amount(value);
  if (['u', 'd', 'transfer_enable', 'total_used'].includes(key)) return bytes(value);
  if (key.endsWith('_at') || key === 'record_at') return time(value);
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return '<span class="ellipsis" title="' + esc(text) + '">' + esc(text) + '</span>';
}
function actionCell(page, row) {
  if (page === 'users' && row.id) return '<div class="table-actions"><button class="table-action" data-action="ban-user" data-id="' + Number(row.id) + '">封禁</button><button class="table-action" data-action="reset-user-secret" data-id="' + Number(row.id) + '">重置凭据</button></div>';
  if (page === 'orders' && row.trade_no && Number(row.status) === 0) return '<div class="table-actions"><button class="table-action" data-action="pay-order" data-trade="' + esc(row.trade_no) + '">标记已支付</button><button class="table-action" data-action="cancel-order" data-trade="' + esc(row.trade_no) + '">取消</button></div>';
  if (page === 'nodes' && row.id) return '<div class="table-actions"><button class="table-action" data-action="toggle-node" data-id="' + Number(row.id) + '" data-show="' + (Number(row.show) ? '0' : '1') + '">' + (Number(row.show) ? '隐藏' : '展示') + '</button><button class="table-action" data-action="reset-node-traffic" data-id="' + Number(row.id) + '">清零流量</button></div>';
  return '<span class="badge">只读</span>';
}
async function resource(page) {
  const spec = pages[page];
  const paged = ['users', 'orders', 'tickets', 'coupons', 'audit'].includes(page);
  const endpoint = paged ? spec[2] + '?current=' + state.current + '&pageSize=20' : spec[2];
  const data = await api(endpoint); const rows = toRows(data); const keys = rows.length ? preferredKeys(page, rows[0]) : [];
  const total = data?.total ?? data?.count ?? rows.length;
  let table = '<div class="empty">暂无可展示的数据。请检查权限或现有记录。</div>';
  if (rows.length) {
    const writable = ['users', 'orders', 'nodes'].includes(page);
    const head = keys.map(key => '<th>' + esc(key.replaceAll('_', ' ')) + '</th>').join('') + (writable ? '<th>操作</th>' : '');
    const body = rows.map(row => '<tr>' + keys.map(key => '<td>' + cell(row[key], key) + '</td>').join('') + (writable ? '<td>' + actionCell(page, row) + '</td>' : '') + '</tr>').join('');
    table = '<div class="table-wrap"><table><thead><tr>' + head + '</tr></thead><tbody data-table-body>' + body + '</tbody></table></div>';
  }
  const pagesTotal = Number(data?.last_page || Math.ceil(Number(total || 0) / 20) || 1);
  const pager = paged ? '<div class="pager"><span>第 ' + state.current + ' / ' + pagesTotal + ' 页</span><button data-prev ' + (state.current <= 1 ? 'disabled' : '') + '>上一页</button><button data-next ' + (state.current >= pagesTotal ? 'disabled' : '') + '>下一页</button></div>' : '';
  return '<section class="page"><div class="page-head"><div><h1>' + spec[0] + '</h1><p>' + spec[1] + ' · 当前加载 ' + num(total) + ' 条记录</p></div></div><section class="card"><div class="toolbar"><input class="input" data-filter placeholder="在当前结果中搜索…" aria-label="搜索"><button class="secondary" data-refresh>重新加载</button><span class="hint">写操作按后端校验规则和二次确认逐项开放。</span></div>' + table + pager + '</section></section>';
}
async function draw() {
  const app = document.querySelector('#app');
  if (!state.token) { app.innerHTML = login(); bind(); return; }
  app.innerHTML = shell('<section class="page"><div class="page-head"><div><h1>正在加载</h1><p>请稍候…</p></div></div><div class="grid metrics"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></section>'); bind();
  try {
    const content = state.page === 'dashboard' ? await dashboard() : await resource(state.page);
    app.innerHTML = shell(content) + (state.notice ? '<div class="notice">' + esc(state.notice) + '</div>' : ''); bind();
  } catch (error) {
    if (error.status === 401 || error.status === 403) { sessionStorage.removeItem('xboard.console.token'); state.token = ''; state.notice = '登录已过期或没有管理员权限。'; draw(); return; }
    app.innerHTML = shell('<section class="page"><div class="page-head"><div><h1>加载失败</h1><p>' + esc(error.message) + '</p></div></div><section class="card empty"><button class="primary" data-refresh>重新尝试</button></section></section>'); bind();
  }
}
function bind() {
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { state.page = button.dataset.page; state.current = 1; state.menu = false; draw(); }));
  document.querySelector('[data-menu]')?.addEventListener('click', () => { state.menu = !state.menu; draw(); });
  document.querySelectorAll('[data-refresh]').forEach(button => button.addEventListener('click', draw));
  document.querySelector('[data-logout]')?.addEventListener('click', () => { sessionStorage.removeItem('xboard.console.token'); state.token = ''; draw(); });
  document.querySelector('[data-filter]')?.addEventListener('input', event => { const query = event.target.value.toLowerCase(); document.querySelectorAll('[data-table-body] tr').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query); }); });
  document.querySelector('[data-prev]')?.addEventListener('click', () => { state.current = Math.max(1, state.current - 1); draw(); });
  document.querySelector('[data-next]')?.addEventListener('click', () => { state.current += 1; draw(); });
  document.querySelector('[data-login]')?.addEventListener('submit', async event => {
    event.preventDefault(); const message = document.querySelector('[data-login-error]'); message.textContent = '正在验证账户…';
    try {
      const form = new FormData(event.currentTarget); const response = await fetch('/api/v2/passport/auth/login', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form.entries())) });
      const payload = await response.json().catch(() => ({})); const result = payload.data ?? payload;
      if (!response.ok || !result.auth_data) throw new Error(payload.message || '登录失败');
      if (!result.is_admin) throw new Error('该账户不是管理员，无法访问管理中心。');
      state.token = result.auth_data; sessionStorage.setItem('xboard.console.token', state.token); state.page = 'dashboard'; draw();
    } catch (error) { message.textContent = error.message || '登录失败，请稍后重试。'; }
  });
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
    const action = button.dataset.action; const id = Number(button.dataset.id); const trade = button.dataset.trade;
    const jobs = {
      'ban-user': ['确认封禁该用户？这会立即阻止其登录和使用服务。', 'user/ban', { method: 'POST', body: { scope: 'selected', user_ids: [id] } }, '用户已封禁。'],
      'reset-user-secret': ['确认重置该用户的订阅凭据？旧订阅链接将立即失效。', 'user/resetSecret', { method: 'POST', body: { id } }, '用户订阅凭据已重置。'],
      'pay-order': ['确认将此待支付订单标记为已支付？该操作会触发订单发货流程。', 'order/paid', { method: 'POST', body: { trade_no: trade } }, '订单已标记为已支付。'],
      'cancel-order': ['确认取消此待支付订单？取消后不能通过此操作恢复。', 'order/cancel', { method: 'POST', body: { trade_no: trade } }, '订单已取消。'],
      'toggle-node': ['确认更新节点展示状态？', 'server/manage/update', { method: 'POST', body: { id, show: Number(button.dataset.show) } }, '节点展示状态已更新。'],
      'reset-node-traffic': ['确认清零该节点的上传和下载流量？此操作不可恢复。', 'server/manage/resetTraffic', { method: 'POST', body: { id } }, '节点流量已清零。'],
    };
    const job = jobs[action]; if (!job || !window.confirm(job[0])) return;
    button.disabled = true; button.textContent = '处理中…';
    try { await api(job[1], job[2]); state.notice = job[3]; draw(); } catch (error) { state.notice = error.message || '操作失败'; draw(); }
  }));
}
draw();
