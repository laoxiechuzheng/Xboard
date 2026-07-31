import { api } from '../api.js';
import { esc, getForm, sanitizeHtml } from '../ui.js';

const periods = [['monthly','月付'],['quarterly','季付'],['half_yearly','半年付'],['yearly','年付'],['two_yearly','两年付'],['three_yearly','三年付'],['onetime','一次性'],['reset_traffic','重置流量']];

function toast(message, error) {
  const node = document.querySelector('#admin-toast');
  node.textContent = message;
  node.className = 'toast show' + (error ? ' error' : '');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.className = 'toast'; }, 4000);
}

function close() { document.querySelector('#admin-modal').replaceChildren(); }

function modal(title, content, submit, handler, description, danger) {
  const root = document.querySelector('#admin-modal');
  root.innerHTML = '<div class="modal-backdrop"><form class="modal-card" data-form><header><div><h2>' + esc(title) + '</h2><p>' + esc(description || '') + '</p></div><button class="icon-button" type="button" data-close>×</button></header><div class="modal-content">' + content + '</div><p class="form-error" data-error></p><footer><button class="button secondary" type="button" data-close>取消</button><button class="button ' + (danger ? 'danger' : 'primary') + '" type="submit">' + esc(submit) + '</button></footer></form></div>';
  root.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
  root.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault(); const error = root.querySelector('[data-error]'); const button = event.currentTarget.querySelector('[type=submit]'); error.textContent = ''; button.disabled = true;
    try { await handler(event.currentTarget); close(); } catch (reason) { error.textContent = reason.message || '操作失败'; button.disabled = false; }
  });
}

function priceInputs(prices) {
  return periods.map(item => '<label>' + item[1] + '（元）<input class="input" type="number" min="0" step="0.01" name="price_' + item[0] + '" value="' + esc(prices?.[item[0]] ?? '') + '"></label>').join('');
}

function preview(plan) {
  const firstPrice = periods.map(item => Number(plan.prices?.[item[0]]) || 0).find(value => value > 0) || 0;
  return '<section class="plan-preview"><div class="plan-preview-head"><div><strong>前台套餐卡实时 HTML 预览</strong><small>根据当前未保存的表单更新；危险标签、事件属性和 javascript: 链接会被移除。</small></div><div class="preview-actions"><span>访客视角</span><button class="button secondary" type="button" data-open-published-front>打开已发布前台</button></div></div><article class="public-plan-card"><div><small data-preview-tag>推荐套餐</small><h3 data-preview-name>' + esc(plan.name || '套餐名称') + '</h3><div class="html-preview-content" data-preview-content>' + sanitizeHtml(plan.content || '<p>套餐介绍会显示在这里。</p>') + '</div></div><div class="public-plan-data"><strong data-preview-traffic>' + Number(plan.transfer_enable || 0) + ' GB</strong><span>高速流量</span></div><div class="public-plan-price"><strong data-preview-price>¥' + firstPrice.toFixed(2) + '</strong><span data-preview-period>起</span></div><button type="button" class="button primary" disabled>立即订阅</button></article></section>';
}

function form(plan) {
  plan = plan || {};
  return '<div class="form-grid"><label>套餐名称<input class="input" name="name" required value="' + esc(plan.name || '') + '"></label><label>流量（GB）<input class="input" name="transfer_enable" type="number" min="1" required value="' + esc(plan.transfer_enable || '') + '"></label><label>节点分组 ID<input class="input" name="group_id" type="number" min="1" value="' + esc(plan.group_id || '') + '"></label><label>速度限制（Mbps，0 不限）<input class="input" name="speed_limit" type="number" min="0" value="' + esc(plan.speed_limit || 0) + '"></label><label>设备限制（0 不限）<input class="input" name="device_limit" type="number" min="0" value="' + esc(plan.device_limit || 0) + '"></label><label>容量限制（0 不限）<input class="input" name="capacity_limit" type="number" min="0" value="' + esc(plan.capacity_limit || 0) + '"></label><label class="full">套餐说明<textarea class="input" name="content">' + esc(plan.content || '') + '</textarea></label><label class="full">标签（逗号分隔）<input class="input" name="tags" value="' + esc(Array.isArray(plan.tags) ? plan.tags.join(', ') : '') + '"></label><div class="full"><h3 class="form-section">价格</h3><div class="form-grid">' + priceInputs(plan.prices) + '</div></div>' + (plan.id ? '<div class="full checks"><label class="check"><input type="checkbox" name="show" ' + (plan.show ? 'checked' : '') + '> 前台展示</label><label class="check"><input type="checkbox" name="sell" ' + (plan.sell ? 'checked' : '') + '> 允许购买</label><label class="check"><input type="checkbox" name="renew" ' + (plan.renew ? 'checked' : '') + '> 允许续费</label><label class="check danger-check"><input type="checkbox" name="force_update"> 同步流量/分组/限速/设备限制给全部现有用户</label></div>' : '') + '</div>' + preview(plan);
}

function bindPreview(formNode) {
  const name = formNode.elements.name;
  const content = formNode.elements.content;
  const traffic = formNode.elements.transfer_enable;
  const priceInputs = periods.map(item => formNode.elements['price_' + item[0]]).filter(Boolean);
  const refresh = () => {
    const prices = priceInputs.map(input => Number(input.value) || 0).filter(value => value > 0);
    const card = formNode.querySelector('.plan-preview');
    card.querySelector('[data-preview-name]').textContent = name.value.trim() || '套餐名称';
    card.querySelector('[data-preview-content]').innerHTML = sanitizeHtml(content.value.trim() || '<p>套餐介绍会显示在这里。</p>');
    card.querySelector('[data-preview-traffic]').textContent = (Number(traffic.value) || 0) + ' GB';
    card.querySelector('[data-preview-price]').textContent = '¥' + (prices[0] || 0).toFixed(2);
  };
  [name, content, traffic, ...priceInputs].forEach(input => input.addEventListener('input', refresh));
  formNode.querySelector('[data-open-published-front]').addEventListener('click', () => window.open('/', '_blank', 'noopener'));
}

function payload(formNode, id) {
  const data = getForm(formNode); const prices = {};
  periods.forEach(item => { const key = 'price_' + item[0]; if (data[key] !== '') prices[item[0]] = Number(data[key]); delete data[key]; });
  data.prices = prices; data.tags = data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
  ['transfer_enable','group_id','speed_limit','device_limit','capacity_limit'].forEach(key => { data[key] = data[key] === '' ? null : Number(data[key]); });
  if (id) data.id = id;
  return data;
}

function rows(plans) {
  if (!plans.length) return '<div class="empty">暂无套餐。</div>';
  return '<div class="table-wrap"><table><thead><tr><th>套餐</th><th>流量</th><th>限制</th><th>用户</th><th>售价</th><th>状态</th><th>操作</th></tr></thead><tbody>' + plans.map(plan => '<tr><td><strong>' + esc(plan.name) + '</strong><small>#' + plan.id + '</small></td><td>' + Number(plan.transfer_enable || 0) + ' GB</td><td>' + Number(plan.speed_limit || 0) + ' Mbps · ' + Number(plan.device_limit || 0) + ' 台</td><td>' + Number(plan.users_count || 0) + ' / 活跃 ' + Number(plan.active_users_count || 0) + '</td><td>' + periods.filter(item => Number(plan.prices?.[item[0]]) > 0).map(item => item[1] + ' ¥' + plan.prices[item[0]]).join(' · ') + '</td><td><span class="status ' + (plan.show ? 'good' : 'bad') + '">' + (plan.show ? '展示' : '隐藏') + '</span></td><td class="row-actions"><button class="link-button" data-edit="' + plan.id + '">编辑</button><button class="link-button" data-toggle="' + plan.id + '">展示</button><button class="link-button danger-text" data-delete="' + plan.id + '" data-name="' + esc(plan.name) + '">删除</button></td></tr>').join('') + '</tbody></table></div>';
}

async function load(root) {
  root.innerHTML = '<div class="loading">正在加载套餐…</div>';
  const response = await api('plan/fetch'); const plans = Array.isArray(response) ? response : [];
  root.innerHTML = '<section class="page-heading"><div><h1>套餐管理</h1><p>维护套餐、流量、价格、限速、购买和续费状态。</p></div><button class="button primary" data-create>新建套餐</button></section><section class="panel">' + rows(plans) + '</section>';
  root.querySelector('[data-create]').addEventListener('click', () => edit(root, null));
  root.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => edit(root, plans.find(plan => plan.id === Number(button.dataset.edit)))));
  root.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => {
    const plan = plans.find(item => item.id === Number(button.dataset.toggle));
    modal('更新套餐展示状态', '<p class="danger-note">这会立即影响用户前台能否看到此套餐。</p>', '确认更新', async () => { await api('plan/update', { method: 'POST', body: { id: plan.id, show: !plan.show, sell: plan.sell, renew: plan.renew } }); toast('套餐状态已更新'); await load(root); }, '请确认影响范围。', true);
  }));
  root.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => modal('删除套餐 ' + button.dataset.name, '<p class="danger-note">若此套餐已有订单或用户使用，后端会拒绝删除以保护数据。</p>', '永久删除', async () => { await api('plan/drop', { method: 'POST', body: { id: Number(button.dataset.delete) } }); toast('套餐已删除'); await load(root); }, '删除不可恢复。', true)));
}

function edit(root, plan) {
  const exists = Boolean(plan?.id);
  modal(exists ? '编辑套餐 #' + plan.id : '新建套餐', form(plan), exists ? '保存套餐' : '创建套餐', async formNode => {
    const data = payload(formNode, plan?.id); await api('plan/save', { method: 'POST', body: data });
    if (exists) { const flags = getForm(formNode); await api('plan/update', { method: 'POST', body: { id: plan.id, show: flags.show, sell: flags.sell, renew: flags.renew } }); }
    toast(exists ? '套餐已保存' : '套餐已创建'); await load(root);
  }, exists && plan.users_count ? '不勾选同步更新时，保存套餐不会修改已有用户。' : '空价格表示不提供这个购买周期。');
  bindPreview(document.querySelector('#admin-modal [data-form]'));
}

export function renderPlans(root) { load(root).catch(error => { root.innerHTML = '<div class="error-state">' + esc(error.message) + '</div>'; }); }
