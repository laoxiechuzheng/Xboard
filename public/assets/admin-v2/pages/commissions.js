import { api, paged } from '../api.js';
import { date, esc } from '../ui.js';

const state = { current: 1 };

function money(value) {
  return '¥' + (Number(value || 0) / 100).toFixed(2);
}

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
  root.innerHTML = '<div class="modal-backdrop"><form class="modal-card" data-form><header><div><h2>' + esc(title) + '</h2><p>' + esc(description || '') + '</p></div><button class="icon-button" type="button" data-close aria-label="关闭">×</button></header><div class="modal-content">' + content + '</div><p class="form-error" data-error></p><footer><button class="button secondary" type="button" data-close>取消</button><button class="button ' + (danger ? 'danger' : 'primary') + '" type="submit">' + esc(submit) + '</button></footer></form></div>';
  root.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
  root.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type=submit]');
    const error = root.querySelector('[data-error]');
    error.textContent = '';
    button.disabled = true;
    try { await handler(); close(); } catch (reason) { error.textContent = reason.message || '操作失败'; button.disabled = false; }
  });
}

function commissionStatus(value) {
  return ({ 0: ['待核算', 'pending'], 1: ['核算中', 'processing'], 2: ['已结算', 'settled'], 3: ['已拒绝', 'rejected'] })[Number(value)] || ['未知', 'rejected'];
}

function rows(orders) {
  if (!orders.length) return '<div class="empty">暂无可结算佣金订单。</div>';
  return '<div class="table-wrap"><table class="commissions-table"><thead><tr><th>订单</th><th>购买用户</th><th>邀请人</th><th>订单金额</th><th>应发佣金</th><th>实发佣金</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>' + orders.map(order => {
    const status = commissionStatus(order.commission_status);
    return '<tr><td><strong>' + esc(order.trade_no) + '</strong><small>#' + order.id + ' · ' + esc(order.plan?.name || '') + '</small></td><td>' + esc(order.user?.email || order.user_id || '') + '</td><td>' + esc(order.invite_user?.email || order.invite_user_id || '—') + '</td><td>' + money(order.total_amount) + '</td><td><strong>' + money(order.commission_balance) + '</strong><small>费率 ' + Number(order.commission_rate || 0) + '%</small></td><td>' + money(order.actual_commission_balance) + '</td><td><span class="status commission-' + status[1] + '">' + status[0] + '</span></td><td>' + date(order.created_at) + '</td><td class="row-actions"><button class="link-button" data-detail="' + order.id + '">明细</button>' + (Number(order.commission_status) !== 2 ? '<button class="link-button" data-state="' + esc(order.trade_no) + '" data-current="' + Number(order.commission_status) + '">处理状态</button>' : '') + '</td></tr>';
  }).join('') + '</tbody></table></div>';
}

function summary(orders) {
  const amounts = orders.reduce((total, order) => {
    total.expected += Number(order.commission_balance || 0);
    total.actual += Number(order.actual_commission_balance || 0);
    total.pending += Number(order.commission_status) === 0 ? 1 : 0;
    total.processing += Number(order.commission_status) === 1 ? 1 : 0;
    total.settled += Number(order.commission_status) === 2 ? 1 : 0;
    return total;
  }, { expected: 0, actual: 0, pending: 0, processing: 0, settled: 0 });
  return '<section class="commission-summary"><div><span>本页应发</span><strong>' + money(amounts.expected) + '</strong></div><div><span>本页实发</span><strong>' + money(amounts.actual) + '</strong></div><div><span>待核算</span><strong>' + amounts.pending + '</strong></div><div><span>核算中</span><strong>' + amounts.processing + '</strong></div><div><span>已结算</span><strong>' + amounts.settled + '</strong></div></section>';
}

async function load(root) {
  root.innerHTML = '<div class="loading">正在加载佣金订单…</div>';
  const result = paged(await api('order/fetch', { method: 'POST', body: { current: state.current, pageSize: 20, is_commission: true } }));
  root.innerHTML = '<section class="page-heading"><div><h1>佣金运营</h1><p>只显示已有邀请人、完成订单且存在应发佣金的记录。自动结算仍由项目的既有计划任务执行。</p></div><button class="button secondary" data-refresh>刷新</button></section>' + summary(result.rows) + '<section class="panel">' + rows(result.rows) + '<footer class="pagination"><button class="button secondary" data-prev ' + (state.current <= 1 ? 'disabled' : '') + '>上一页</button><span>第 ' + state.current + ' 页</span><button class="button secondary" data-next ' + (result.rows.length < 20 ? 'disabled' : '') + '>下一页</button></footer></section>';
  root.querySelector('[data-refresh]').addEventListener('click', () => load(root).catch(showError));
  root.querySelector('[data-prev]').addEventListener('click', () => { state.current -= 1; load(root).catch(showError); });
  root.querySelector('[data-next]').addEventListener('click', () => { state.current += 1; load(root).catch(showError); });
  root.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => detail(Number(button.dataset.detail)).catch(showError)));
  root.querySelectorAll('[data-state]').forEach(button => button.addEventListener('click', () => changeState(root, button.dataset.state, Number(button.dataset.current))));
}

async function detail(id) {
  const order = await api('order/detail', { method: 'POST', body: { id } });
  const logs = Array.isArray(order.commission_log) && order.commission_log.length ? '<div class="commission-log">' + order.commission_log.map(log => '<div><strong>' + money(log.get_amount) + '</strong><small>' + date(log.created_at) + '</small><span>' + esc(log.invite_user?.email || log.user_id || '') + '</span></div>').join('') + '</div>' : '<p class="danger-note">暂时没有实际发放记录。自动结算完成后会由现有任务写入记录。</p>';
  const status = commissionStatus(order.commission_status);
  modal('佣金明细 #' + id, '<dl class="detail-list"><div><dt>订单金额</dt><dd>' + money(order.total_amount) + '</dd></div><div><dt>应发佣金</dt><dd>' + money(order.commission_balance) + '</dd></div><div><dt>实发佣金</dt><dd>' + money(order.actual_commission_balance) + '</dd></div><div><dt>佣金费率</dt><dd>' + Number(order.commission_rate || 0) + '%</dd></div><div><dt>购买用户</dt><dd>' + esc(order.user?.email || order.user_id || '') + '</dd></div><div><dt>邀请人</dt><dd>' + esc(order.invite_user?.email || order.invite_user_id || '') + '</dd></div><div><dt>当前状态</dt><dd>' + status[0] + '</dd></div></dl><h3 class="form-section">发放记录</h3>' + logs, '关闭', async () => {}, '该窗口只读，不会改变佣金金额或结算记录。');
}

function changeState(root, tradeNo, current) {
  const choices = [[0, '待核算'], [1, '核算中'], [3, '已拒绝']];
  modal('处理佣金状态', '<label>状态<select class="input" data-commission-state>' + choices.map(([value, label]) => '<option value="' + value + '" ' + (value === current ? 'selected' : '') + '>' + label + '</option>').join('') + '</select></label><p class="danger-note">“已结算”只能由既有结算任务在实际发放佣金后写入，不能手动伪造。</p>', '保存状态', async () => {
    const value = Number(document.querySelector('[data-commission-state]').value);
    await api('order/update', { method: 'POST', body: { trade_no: tradeNo, commission_status: value } });
    toast('佣金状态已更新');
    await load(root);
  }, '仅调整订单的佣金处理状态，不会修改订单金额。', current === 3);
}

function showError(error) { toast(error.message || '请求失败', true); }
export function renderCommissions(root) { load(root).catch(showError); }
