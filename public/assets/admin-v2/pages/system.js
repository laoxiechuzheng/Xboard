import { api, paged } from '../api.js';
import { date, esc } from '../ui.js';

const state = { auditCurrent: 1, failedCurrent: 1 };
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function toast(message, error) { const node = document.querySelector('#admin-toast'); node.textContent = message; node.className = 'toast show' + (error ? ' error' : ''); clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.className = 'toast'; }, 4000); }
function badge(value, yes, no) { return '<span class="status ' + (value ? 'good' : 'bad') + '">' + (value ? yes : no) + '</span>'; }
function workload(rows) { if (!rows.length) return '<div class="empty compact">队列没有待处理任务。</div>'; return '<div class="queue-list">' + rows.map(item => '<div><strong>' + esc(item.name || item.queue || 'default') + '</strong><span>待处理 ' + number(item.length ?? item.jobs) + '</span><small>等待 ' + number(item.wait ?? item.waiting) + ' 秒</small></div>').join('') + '</div>'; }
function auditRows(rows) { if (!rows.length) return '<div class="empty compact">暂无审计记录。</div>'; return '<div class="table-wrap"><table class="audit-table"><thead><tr><th>时间</th><th>管理员</th><th>动作</th><th>请求地址</th></tr></thead><tbody>' + rows.map(item => '<tr><td>' + date(item.created_at) + '</td><td>' + esc(item.admin?.email || item.admin_id || '系统') + '</td><td>' + esc(item.action || '') + '</td><td><small>' + esc(item.uri || '') + '</small></td></tr>').join('') + '</tbody></table></div>'; }
function failedRows(rows) { if (!rows.length) return '<div class="empty compact">暂无失败任务。</div>'; return '<div class="failed-list">' + rows.map(item => '<details><summary><strong>' + esc(item.name || item.id || '任务') + '</strong><span>' + date(item.failed_at) + '</span></summary><pre>' + esc(item.exception || item.payload || '无详情') + '</pre></details>').join('') + '</div>'; }
async function load(root) {
  root.innerHTML = '<div class="loading">正在读取系统运行状态…</div>';
  const results = await Promise.allSettled([
    api('system/getSystemStatus'), api('system/getQueueStats'), api('system/getQueueWorkload'),
    api('system/getAuditLog?current=' + state.auditCurrent + '&page_size=10'),
    api('system/getHorizonFailedJobs?current=' + state.failedCurrent + '&page_size=10'),
  ]);
  const required = results.slice(0, 3);
  if (required.some(result => result.status === 'rejected')) throw required.find(result => result.status === 'rejected').reason;
  const status = results[0].value || {}; const queue = results[1].value || {}; const queues = Array.isArray(results[2].value) ? results[2].value : [];
  const audit = results[3].status === 'fulfilled' ? paged(results[3].value) : { rows: [], total: 0 };
  const failed = results[4].status === 'fulfilled' ? paged(results[4].value) : { rows: [], total: 0 };
  root.innerHTML = '<section class="page-heading"><div><h1>系统与队列</h1><p>只读运行监控：定时器、Horizon 队列、失败任务及管理员审计日志。</p></div><button class="button secondary" data-refresh>刷新</button></section>' +
    '<section class="system-cards"><article><span>定时任务</span><strong>' + badge(status.schedule, '运行中', '异常') + '</strong><small>最近检查：' + date(status.schedule_last_runtime) + '</small></article><article><span>Horizon</span><strong>' + badge(status.horizon, '运行中', '不可用') + '</strong><small>暂停主进程 ' + number(queue.pausedMasters) + ' · 进程 ' + number(queue.processes) + '</small></article><article><span>队列吞吐</span><strong>' + number(queue.jobsPerMinute) + '/分钟</strong><small>最近任务 ' + number(queue.recentJobs) + ' · 等待 ' + number(queue.wait?.[0]?.wait ?? queue.wait?.wait) + ' 秒</small></article><article><span>失败任务</span><strong>' + number(queue.failedJobs) + '</strong><small>最近保留周期 ' + number(queue.periods?.failedJobs) + ' 小时</small></article></section>' +
    '<section class="dashboard-split"><section class="panel dashboard-panel"><h2>队列积压</h2>' + workload(queues) + '</section><section class="panel dashboard-panel"><h2>失败任务</h2>' + failedRows(failed.rows) + '<footer class="pagination"><button class="button secondary" data-failed-prev ' + (state.failedCurrent <= 1 ? 'disabled' : '') + '>上一页</button><span>' + failed.total + ' 条</span><button class="button secondary" data-failed-next ' + (failed.rows.length < 10 ? 'disabled' : '') + '>下一页</button></footer></section></section>' +
    '<section class="panel dashboard-panel system-audit"><h2>管理员审计日志</h2>' + auditRows(audit.rows) + '<footer class="pagination"><button class="button secondary" data-audit-prev ' + (state.auditCurrent <= 1 ? 'disabled' : '') + '>上一页</button><span>' + audit.total + ' 条</span><button class="button secondary" data-audit-next ' + (audit.rows.length < 10 ? 'disabled' : '') + '>下一页</button></footer></section>';
  root.querySelector('[data-refresh]').addEventListener('click', () => load(root).catch(showError));
  root.querySelector('[data-audit-prev]').addEventListener('click', () => { state.auditCurrent -= 1; load(root).catch(showError); });
  root.querySelector('[data-audit-next]').addEventListener('click', () => { state.auditCurrent += 1; load(root).catch(showError); });
  root.querySelector('[data-failed-prev]').addEventListener('click', () => { state.failedCurrent -= 1; load(root).catch(showError); });
  root.querySelector('[data-failed-next]').addEventListener('click', () => { state.failedCurrent += 1; load(root).catch(showError); });
}
function showError(error) { toast(error.message || '无法读取系统状态', true); }
export function renderSystem(root) { load(root).catch(showError); }
