import { api } from '../api.js';
import { bytes, esc } from '../ui.js';

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return '¥' + new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number(value) / 100);
}

function percent(value) {
  const amount = number(value);
  return (amount > 0 ? '+' : '') + amount.toFixed(1) + '%';
}

function trend(value) {
  return 'metric-trend ' + (number(value) < 0 ? 'down' : 'up');
}

function metric(label, value, note, change) {
  return '<article class="metric-card"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(note) + (change === undefined ? '' : ' <b class="' + trend(change) + '">' + esc(percent(change)) + '</b>') + '</small></article>';
}

function rank(title, rows) {
  if (!rows.length) return '<section class="panel dashboard-panel"><h2>' + esc(title) + '</h2><div class="empty compact">暂无统计记录</div></section>';
  const max = Math.max(...rows.map(row => number(row.value)), 1);
  return '<section class="panel dashboard-panel"><h2>' + esc(title) + '</h2><div class="rank-list">' + rows.map((row, index) => '<div class="rank-row"><span class="rank-index">' + (index + 1) + '</span><div><strong>' + esc(row.name || ('#' + row.id)) + '</strong><div class="rank-bar"><span style="width:' + Math.max(number(row.value) / max * 100, 2).toFixed(2) + '%"></span></div></div><div><strong>' + bytes(row.value) + '</strong><small class="' + trend(row.change) + '">' + esc(percent(row.change)) + '</small></div></div>').join('') + '</div></section>';
}

function render(root, stats, nodeRank, userRank) {
  const todayTraffic = stats.todayTraffic || {};
  const monthTraffic = stats.monthTraffic || {};
  const totalTraffic = stats.totalTraffic || {};
  root.innerHTML = '<section class="page-heading dashboard-heading"><div><h1>运营仪表盘</h1><p>收入以已完成订单统计；佣金以已发放记录统计。所有数字直接来自现有管理员统计接口。</p></div><button class="button secondary" data-refresh>刷新数据</button></section>' +
    '<section class="metric-grid">' +
    metric('今日实收', money(stats.todayIncome), '与昨日相比', stats.dayIncomeGrowth) +
    metric('本月实收', money(stats.currentMonthIncome), '与上月相比', stats.monthIncomeGrowth) +
    metric('本月佣金已发', money(stats.currentMonthCommissionPayout), '上月 ' + money(stats.lastMonthCommissionPayout), stats.commissionGrowth) +
    metric('本月新增用户', String(number(stats.currentMonthNewUsers)), '总用户 ' + number(stats.totalUsers), stats.userGrowth) +
    '</section>' +
    '<section class="dashboard-split"><section class="panel dashboard-panel"><h2>运行与待办</h2><div class="health-grid"><div><span>有效订阅用户</span><strong>' + number(stats.activeUsers) + '</strong><small>在线用户 ' + number(stats.onlineUsers) + ' · 在线设备 ' + number(stats.onlineDevices) + '</small></div><div><span>在线节点</span><strong>' + number(stats.onlineNodes) + '</strong><small>节点在线状态以服务端上报为准</small></div><div><span>待处理工单</span><strong>' + number(stats.ticketPendingTotal) + '</strong><small>请在工单管理中回复或关闭</small></div><div><span>待结算佣金订单</span><strong>' + number(stats.commissionPendingTotal) + '</strong><small>由现有佣金结算任务处理</small></div></div></section><section class="panel dashboard-panel"><h2>流量概览</h2><dl class="traffic-overview"><div><dt>今日</dt><dd>' + bytes(todayTraffic.total) + '</dd><small>上行 ' + bytes(todayTraffic.upload) + ' · 下行 ' + bytes(todayTraffic.download) + '</small></div><div><dt>本月</dt><dd>' + bytes(monthTraffic.total) + '</dd><small>上行 ' + bytes(monthTraffic.upload) + ' · 下行 ' + bytes(monthTraffic.download) + '</small></div><div><dt>累计</dt><dd>' + bytes(totalTraffic.total) + '</dd><small>上行 ' + bytes(totalTraffic.upload) + ' · 下行 ' + bytes(totalTraffic.download) + '</small></div></dl></section></section>' +
    '<section class="dashboard-split">' + rank('近 7 日节点流量排行', nodeRank) + rank('近 7 日用户流量排行', userRank) + '</section>';
  root.querySelector('[data-refresh]').addEventListener('click', () => load(root));
}

export async function loadDashboard(root) {
  root.innerHTML = '<div class="loading">正在加载运营数据…</div>';
  const results = await Promise.allSettled([
    api('stat/getStats'),
    api('stat/getTrafficRank?type=node'),
    api('stat/getTrafficRank?type=user'),
  ]);
  const stats = results[0].status === 'fulfilled' ? results[0].value : null;
  if (!stats) throw results[0].reason;
  const nodeRank = results[1].status === 'fulfilled' ? (Array.isArray(results[1].value) ? results[1].value : (Array.isArray(results[1].value?.data) ? results[1].value.data : [])) : [];
  const userRank = results[2].status === 'fulfilled' ? (Array.isArray(results[2].value) ? results[2].value : (Array.isArray(results[2].value?.data) ? results[2].value.data : [])) : [];
  render(root, stats, nodeRank, userRank);
}

function load(root) {
  loadDashboard(root).catch(error => { root.innerHTML = '<div class="error-state">' + esc(error.message || '无法加载仪表盘') + '</div>'; });
}

export function renderDashboard(root) { load(root); }
