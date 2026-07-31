import { api, paged } from '../api.js';
import { date, esc, getForm } from '../ui.js';

const state = { current: 1, status: 0, replyStatus: '', query: '' };

function toast(message, error) {
  const node = document.querySelector('#admin-toast');
  node.textContent = message;
  node.className = 'toast show' + (error ? ' error' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.className = 'toast'; }, 4000);
}

function close() { document.querySelector('#admin-modal').replaceChildren(); }

function modal(title, content, submit, handler, description, danger) {
  const root = document.querySelector('#admin-modal');
  root.innerHTML = '<div class="modal-backdrop"><form class="modal-card ticket-modal" data-form><header><div><h2>' + esc(title) + '</h2><p>' + esc(description || '') + '</p></div><button class="icon-button" type="button" data-close aria-label="关闭">×</button></header><div class="modal-content">' + content + '</div><p class="form-error" data-error></p><footer><button class="button secondary" type="button" data-close>取消</button><button class="button ' + (danger ? 'danger' : 'primary') + '" type="submit">' + esc(submit) + '</button></footer></form></div>';
  root.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
  root.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type=submit]');
    const error = event.currentTarget.querySelector('[data-error]');
    error.textContent = ''; button.disabled = true;
    try { await handler(event.currentTarget); close(); }
    catch (reason) { error.textContent = reason.message || '操作失败'; button.disabled = false; }
  });
}

function ticketStatus(value) { return Number(value) === 1 ? '已关闭' : '已开启'; }
function replyState(value) { return Number(value) === 0 ? ['待管理员回复', 'bad'] : ['管理员已回复', 'good']; }
function lastReply(ticket) {
  const actor = ticket.last_reply_user;
  if (!actor) return ticket.last_reply_user_id ? '用户 #' + ticket.last_reply_user_id : '暂无回复记录';
  const role = Number(actor.id) === Number(ticket.user_id) ? '用户' : (actor.is_admin ? '管理员' : (actor.is_staff ? '员工' : '客服'));
  return role + ' · ' + (actor.email || ('#' + actor.id));
}

function rows(tickets) {
  if (!tickets.length) return '<div class="empty">' + (state.status === 0 ? '暂无匹配的已开启工单。' : '暂无匹配的已关闭工单。') + '</div>';
  return '<div class="table-wrap"><table><thead><tr><th>工单</th><th>用户</th><th>回复状态</th><th>最后回复者</th><th>最后回复时间</th><th>操作</th></tr></thead><tbody>' + tickets.map(ticket => {
    const reply = replyState(ticket.reply_status);
    return '<tr><td><strong>' + esc(ticket.subject || '未命名工单') + '</strong><small>#' + ticket.id + ' · ' + ticketStatus(ticket.status) + '</small></td><td>' + esc(ticket.user?.email || ('用户 #' + ticket.user_id)) + '</td><td><span class="status ' + reply[1] + '">' + reply[0] + '</span></td><td>' + esc(lastReply(ticket)) + '</td><td>' + date(ticket.updated_at) + '</td><td class="row-actions"><button class="link-button" data-detail="' + ticket.id + '">查看对话</button>' + (Number(ticket.status) === 0 ? '<button class="link-button danger-text" data-close-ticket="' + ticket.id + '">关闭工单</button>' : '') + '</td></tr>';
  }).join('') + '</tbody></table></div>';
}

function queryString() {
  const params = new URLSearchParams({ current: String(state.current), pageSize: '20', status: String(state.status) });
  if (state.replyStatus !== '') params.append('reply_status[]', state.replyStatus);
  if (state.query) params.set('filter[0][id]', 'subject'), params.set('filter[0][value]', state.query);
  return params.toString();
}

async function load(root) {
  root.innerHTML = '<div class="loading">正在加载工单…</div>';
  const result = paged(await api('ticket/fetch?' + queryString()));
  root.innerHTML = '<section class="page-heading"><div><h1>工单管理</h1><p>开启与关闭工单分开查看，回复状态和最后回复者直接读取业务数据库。</p></div></section><section class="panel"><div class="resource-tabs ticket-tabs"><button class="button ' + (state.status === 0 ? 'primary' : 'secondary') + '" data-tab="0">已开启工单</button><button class="button ' + (state.status === 1 ? 'primary' : 'secondary') + '" data-tab="1">已关闭工单</button></div><form class="filter-toolbar ticket-filter" data-filter-form><label class="filter-grow">工单主题<input class="input" name="query" value="' + esc(state.query) + '" placeholder="支持模糊搜索主题"></label><label>回复状态<select class="input" name="reply_status"><option value="">全部回复状态</option><option value="0" ' + (state.replyStatus === '0' ? 'selected' : '') + '>待管理员回复</option><option value="1" ' + (state.replyStatus === '1' ? 'selected' : '') + '>管理员已回复</option></select></label><div class="filter-actions"><button class="button primary" type="submit">筛选</button><button class="button secondary" type="button" data-clear>清空</button></div></form>' + rows(result.rows) + '<footer class="pagination"><button class="button secondary" data-prev ' + (state.current <= 1 ? 'disabled' : '') + '>上一页</button><span>第 ' + state.current + ' 页 · 共 ' + result.total + ' 条</span><button class="button secondary" data-next ' + (result.rows.length < 20 ? 'disabled' : '') + '>下一页</button></footer></section>';
  bind(root);
}

function bind(root) {
  root.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.status = Number(button.dataset.tab); state.current = 1; load(root).catch(showError); }));
  root.querySelector('[data-filter-form]').addEventListener('submit', event => { event.preventDefault(); const data = getForm(event.currentTarget); state.query = data.query.trim(); state.replyStatus = data.reply_status === '' ? '' : String(data.reply_status); state.current = 1; load(root).catch(showError); });
  root.querySelector('[data-clear]').addEventListener('click', () => { state.query = ''; state.replyStatus = ''; state.current = 1; load(root).catch(showError); });
  root.querySelector('[data-prev]').addEventListener('click', () => { state.current -= 1; load(root).catch(showError); });
  root.querySelector('[data-next]').addEventListener('click', () => { state.current += 1; load(root).catch(showError); });
  root.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => detail(root, Number(button.dataset.detail)).catch(showError)));
  root.querySelectorAll('[data-close-ticket]').forEach(button => button.addEventListener('click', () => modal('关闭工单 #' + button.dataset.closeTicket, '<p class="danger-note">关闭后会进入“已关闭工单”列表，历史对话不会删除。</p>', '确认关闭', async () => { await api('ticket/close', { method: 'POST', body: { id: Number(button.dataset.closeTicket) } }); toast('工单已关闭'); await load(root); }, '确认问题已经处理完成。', true)));
}

async function detail(root, id) {
  const ticket = await api('ticket/fetch?id=' + id);
  const messages = (ticket.messages || []).map(message => {
    const fromAdmin = Boolean(message.is_from_admin);
    const actor = message.user?.email || (fromAdmin ? '管理员 / 客服' : ticket.user?.email || '用户');
    return '<article class="ticket-message ' + (fromAdmin ? 'admin' : 'user') + '"><small><b>' + (fromAdmin ? '管理员回复' : '用户回复') + '</b> · ' + esc(actor) + ' · ' + date(message.created_at) + '</small><p>' + esc(message.message || '') + '</p></article>';
  }).join('');
  const summary = '<dl class="detail-list ticket-summary"><div><dt>发起用户</dt><dd>' + esc(ticket.user?.email || ('#' + ticket.user_id)) + '</dd></div><div><dt>工单状态</dt><dd>' + ticketStatus(ticket.status) + '</dd></div><div><dt>当前回复状态</dt><dd>' + replyState(ticket.reply_status)[0] + '</dd></div><div><dt>最后回复者</dt><dd>' + esc(lastReply(ticket)) + '</dd></div></dl>';
  modal('工单 #' + id + '：' + (ticket.subject || ''), summary + '<h3 class="form-section">完整对话</h3><div class="ticket-thread">' + (messages || '<p class="empty">暂无消息</p>') + '</div><label>管理员回复<textarea class="input" name="message" required placeholder="输入给用户的回复内容"></textarea></label>' + (Number(ticket.status) === 1 ? '<p class="danger-note">此工单已关闭；继续回复会追加到历史对话，但不会自动重新开启。</p>' : ''), '发送回复', async form => { const data = getForm(form); await api('ticket/reply', { method: 'POST', body: { id, message: data.message } }); toast('管理员回复已发送'); await load(root); }, '每条消息都按真实发送人标记，不再推测回复角色。');
}

function showError(error) { toast(error.message || '请求失败', true); }
export function renderTickets(root, options = {}) {
  if (options.status !== undefined) state.status = Number(options.status);
  if (options.replyStatus !== undefined) state.replyStatus = String(options.replyStatus);
  state.current = 1;
  load(root).catch(showError);
}
