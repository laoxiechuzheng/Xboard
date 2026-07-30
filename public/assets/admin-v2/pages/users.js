import { api, paged } from '../api.js';
import { bytes, date, esc, getForm, localFromUnix, unixFromLocal } from '../ui.js';

const state = { current: 1, query: '', selected: new Set(), plans: [] };
const GIB = 1024 ** 3;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function gib(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(number(value) / GIB);
}

function traffic(user) {
  const quota = number(user.transfer_enable);
  const upload = number(user.u);
  const download = number(user.d);
  const used = upload + download;
  const remaining = Math.max(quota - used, 0);
  const ratio = quota ? Math.min(used / quota * 100, 100) : 0;
  return { quota, upload, download, used, remaining, ratio };
}

function trafficMetric(label, value, detail) {
  return '<div class="traffic-metric"><span>' + esc(label) + '</span><strong>' + bytes(value) + '</strong><small>' + esc(detail || (gib(value) + ' GB')) + '</small></div>';
}

function trafficSummary(user) {
  const stats = traffic(user);
  return '<section class="traffic-summary"><div class="traffic-summary-head"><strong>流量统计</strong><span>' + stats.ratio.toFixed(1) + '% 已使用</span></div><div class="traffic-progress" aria-label="流量已使用 ' + stats.ratio.toFixed(1) + '%"><span style="width:' + stats.ratio.toFixed(2) + '%"></span></div><div class="traffic-grid">' +
    trafficMetric('总配额', stats.quota) +
    trafficMetric('已用上行', stats.upload) +
    trafficMetric('已用下行', stats.download) +
    trafficMetric('合计已用', stats.used) +
    trafficMetric('剩余流量', stats.remaining) +
    '</div></section>';
}

function trafficCell(value) {
  return '<strong>' + bytes(value) + '</strong><small>' + gib(value) + ' GB</small>';
}

function toast(message, error) {
  const node = document.querySelector('#admin-toast');
  node.textContent = message;
  node.className = 'toast show' + (error ? ' error' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.className = 'toast'; }, 4000);
}

function closeModal() { document.querySelector('#admin-modal').replaceChildren(); }

function modal(title, content, submit, handler, description) {
  const root = document.querySelector('#admin-modal');
  root.innerHTML = '<div class="modal-backdrop"><form class="modal-card" data-form><header><div><h2>' + esc(title) + '</h2><p>' + esc(description || '') + '</p></div><button class="icon-button" type="button" data-close aria-label="关闭">×</button></header><div class="modal-content">' + content + '</div><p class="form-error" data-error></p><footer><button class="button secondary" type="button" data-close>取消</button><button class="button primary" type="submit">' + esc(submit) + '</button></footer></form></div>';
  root.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type=submit]');
    const error = event.currentTarget.querySelector('[data-error]');
    error.textContent = '';
    button.disabled = true;
    try { await handler(event.currentTarget); closeModal(); }
    catch (reason) { error.textContent = reason.message || '操作失败'; button.disabled = false; }
  });
}

function confirm(title, description, action) {
  modal(title, '<p class="danger-note">' + esc(description) + '</p>', '确认执行', async () => { await action(); }, description);
}

function planOptions(value) {
  return '<option value="">不分配套餐</option>' + state.plans.map(plan => '<option value="' + plan.id + '" ' + (Number(value) === Number(plan.id) ? 'selected' : '') + '>' + esc(plan.name) + ' (#' + plan.id + ')</option>').join('');
}

function userForm(user) {
  user = user || {};
  const balance = user.balance === null || user.balance === undefined ? 0 : Number(user.balance) / 100;
  return '<div class="form-grid"><label>邮箱<input class="input" name="email" type="email" required value="' + esc(user.email || '') + '"></label>' +
    '<label>套餐<select class="input" name="plan_id">' + planOptions(user.plan_id) + '</select></label>' +
    '<label>总流量（GB）<input class="input" name="transfer_enable" type="number" min="0" step="0.01" required value="' + esc(number(user.transfer_enable) / GIB) + '"><small>保存时会自动换算为字节；已用上行、下行仅展示，不会被本表单重置。</small></label>' +
    '<label>到期时间<input class="input" name="expired_at" type="datetime-local" value="' + localFromUnix(user.expired_at) + '"></label>' +
    '<label>余额（元）<input class="input" name="balance" type="number" step="0.01" value="' + esc(balance) + '"></label>' +
    '<label>设备限制（0 表示不限）<input class="input" name="device_limit" type="number" min="0" value="' + esc(user.device_limit || 0) + '"></label>' +
    '<label class="full">邀请人邮箱（留空表示没有邀请人）<input class="input" name="invite_user_email" type="email" value="' + esc(user.invite_user?.email || '') + '"></label>' +
    '<label class="full">新密码（留空则不修改）<input class="input" name="password" type="password" minlength="8"></label>' +
    '<label class="full">备注<textarea class="input" name="remarks">' + esc(user.remarks || '') + '</textarea></label>' +
    '<label class="check"><input name="banned" type="checkbox" ' + (user.banned ? 'checked' : '') + '> 封禁此用户</label>' +
    '<label class="check"><input name="is_staff" type="checkbox" ' + (user.is_staff ? 'checked' : '') + '> 标记为员工</label>' +
    '<label class="check"><input name="is_admin" type="checkbox" ' + (user.is_admin ? 'checked' : '') + '> 管理员权限</label></div>' + trafficSummary(user);
}

function renderRows(rows) {
  if (!rows.length) return '<div class="empty">没有匹配的用户。</div>';
  return '<div class="table-wrap"><table class="users-table"><thead><tr><th><input type="checkbox" data-all></th><th>用户</th><th>套餐</th><th>总配额</th><th>已用上行</th><th>已用下行</th><th>已用 / 剩余</th><th>到期</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows.map(user => { const stats = traffic(user); return '<tr><td><input type="checkbox" data-select="' + user.id + '" ' + (state.selected.has(user.id) ? 'checked' : '') + '></td><td><strong>' + esc(user.email) + '</strong><small>#' + user.id + '</small></td><td>' + esc(user.plan?.name || '未分配') + '</td><td>' + trafficCell(stats.quota) + '</td><td>' + trafficCell(stats.upload) + '</td><td>' + trafficCell(stats.download) + '</td><td class="usage-cell"><strong>' + bytes(stats.used) + '</strong><small>剩余 ' + bytes(stats.remaining) + '</small><div class="mini-progress"><span style="width:' + stats.ratio.toFixed(2) + '%"></span></div><small>' + stats.ratio.toFixed(1) + '%</small></td><td>' + date(user.expired_at) + '</td><td><span class="status ' + (user.banned ? 'bad' : 'good') + '">' + (user.banned ? '已封禁' : '正常') + '</span></td><td class="row-actions"><button class="link-button" data-traffic="' + user.id + '">流量详情</button><button class="link-button" data-edit="' + user.id + '">编辑</button><button class="link-button" data-reset="' + user.id + '">重置订阅</button><button class="link-button danger-text" data-delete="' + user.id + '" data-email="' + esc(user.email) + '">删除</button></td></tr>'; }).join('') + '</tbody></table></div>';
}

async function load(root) {
  root.innerHTML = '<div class="loading">正在加载用户…</div>';
  const payload = { current: state.current, pageSize: 20 };
  if (state.query) payload.filter = [{ id: 'email', value: state.query }];
  const values = await Promise.all([api('user/fetch', { method: 'POST', body: payload }), api('plan/fetch')]);
  const result = paged(values[0]);
  state.plans = Array.isArray(values[1]) ? values[1] : [];
  root.innerHTML = '<section class="page-heading"><div><h1>用户管理</h1><p>创建、编辑、封禁、重置订阅、删除与邮件发送都会调用现有管理员接口。</p></div><button class="button primary" data-create>新建用户</button></section><section class="panel"><div class="toolbar"><input class="input" data-search placeholder="按邮箱搜索" value="' + esc(state.query) + '"><button class="button secondary" data-search-button>搜索</button><span class="count">共 ' + result.total + ' 位用户</span><span class="toolbar-spacer"></span><button class="button secondary" data-ban ' + (state.selected.size ? '' : 'disabled') + '>封禁已选（' + state.selected.size + '）</button><button class="button secondary" data-mail ' + (state.selected.size ? '' : 'disabled') + '>发邮件</button></div>' + renderRows(result.rows) + '<footer class="pagination"><button class="button secondary" data-prev ' + (state.current <= 1 ? 'disabled' : '') + '>上一页</button><span>第 ' + state.current + ' 页</span><button class="button secondary" data-next ' + (result.rows.length < 20 ? 'disabled' : '') + '>下一页</button></footer></section>';
  bind(root, result.rows);
}

function createUser(root) {
  modal('创建用户', '<div class="form-grid"><label>邮箱前缀<input class="input" name="email_prefix" required placeholder="alice"></label><label>邮箱域名<input class="input" name="email_suffix" required placeholder="example.com"></label><label>初始密码<input class="input" name="password" type="password" minlength="8"></label><label>套餐<select class="input" name="plan_id">' + planOptions() + '</select></label><label>到期时间<input class="input" name="expired_at" type="datetime-local"></label></div>', '创建用户', async form => { const data = getForm(form); data.generate_count = 1; data.expired_at = unixFromLocal(data.expired_at); if (!data.plan_id) delete data.plan_id; if (!data.expired_at) delete data.expired_at; await api('user/generate', { method: 'POST', body: data }); toast('用户已创建'); await load(root); }, '用户创建后会立即写入业务数据库。');
}

async function editUser(root, id) {
  const user = await api('user/getUserInfoById?id=' + id);
  modal('编辑用户 #' + id, userForm(user), '保存用户', async form => { const data = getForm(form); const quotaGb = Number(data.transfer_enable); if (!Number.isFinite(quotaGb) || quotaGb < 0) throw new Error('总流量必须是大于或等于 0 的 GB 数值'); data.transfer_enable = Math.round(quotaGb * GIB); data.id = id; data.expired_at = unixFromLocal(data.expired_at); if (!data.expired_at) data.expired_at = null; if (!data.plan_id) data.plan_id = null; if (!data.password) delete data.password; await api('user/update', { method: 'POST', body: data }); toast('用户资料已保存'); await load(root); }, '总流量以 GB 编辑并自动换算；已用流量只读，避免误清空真实统计数据。');
}

function showTraffic(user) {
  modal('流量详情：' + user.email, trafficSummary(user), '关闭', async () => {}, '上行和下行来自现有统计数据。本窗口不会修改任何流量。');
}

function bind(root, rows) {
  root.querySelector('[data-search-button]').addEventListener('click', () => { state.query = root.querySelector('[data-search]').value.trim(); state.current = 1; load(root).catch(showError); });
  root.querySelector('[data-search]').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); root.querySelector('[data-search-button]').click(); } });
  root.querySelector('[data-create]').addEventListener('click', () => createUser(root));
  root.querySelector('[data-prev]').addEventListener('click', () => { state.current -= 1; load(root).catch(showError); });
  root.querySelector('[data-next]').addEventListener('click', () => { state.current += 1; load(root).catch(showError); });
  root.querySelector('[data-all]').addEventListener('change', event => { rows.forEach(user => { if (event.target.checked) state.selected.add(user.id); else state.selected.delete(user.id); }); load(root).catch(showError); });
  root.querySelectorAll('[data-select]').forEach(box => box.addEventListener('change', () => { const id = Number(box.dataset.select); if (box.checked) state.selected.add(id); else state.selected.delete(id); load(root).catch(showError); }));
  root.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => editUser(root, Number(button.dataset.edit)).catch(showError)));
  root.querySelectorAll('[data-traffic]').forEach(button => button.addEventListener('click', () => { const user = rows.find(item => Number(item.id) === Number(button.dataset.traffic)); if (user) showTraffic(user); }));
  root.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => confirm('重置订阅凭据', '旧订阅链接会立即失效。', async () => { await api('user/resetSecret', { method: 'POST', body: { id: Number(button.dataset.reset) } }); toast('订阅凭据已重置'); })));
  root.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => confirm('删除用户 ' + button.dataset.email, '会同时删除该用户的订单、工单、统计和兑换记录，且不能恢复。', async () => { const id = Number(button.dataset.delete); await api('user/destroy', { method: 'POST', body: { id } }); state.selected.delete(id); toast('用户已删除'); await load(root); })));
  root.querySelector('[data-ban]').addEventListener('click', () => confirm('封禁 ' + state.selected.size + ' 位用户', '被选中的用户将无法登录或使用服务。', async () => { await api('user/ban', { method: 'POST', body: { scope: 'selected', user_ids: [...state.selected] } }); state.selected.clear(); toast('已封禁所选用户'); await load(root); }));
  root.querySelector('[data-mail]').addEventListener('click', () => modal('给 ' + state.selected.size + ' 位用户发邮件', '<label>主题<input class="input" name="subject" required></label><label>内容<textarea class="input" name="content" required></textarea></label>', '加入发送队列', async form => { const data = getForm(form); data.scope = 'selected'; data.user_ids = [...state.selected]; await api('user/sendMail', { method: 'POST', body: data }); toast('邮件已加入发送队列'); }, '发送工作会进入后台队列。'));
}

function showError(error) { toast(error.message || '请求失败', true); }
export function renderUsers(root) { load(root).catch(showError); }
