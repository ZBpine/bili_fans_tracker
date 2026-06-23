const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

['docs/up', 'data'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const upData = [];
for (const up of config.up主) {
  const filePath = `data/${up.uid}.json`;
  let records = [];
  if (fs.existsSync(filePath)) {
    records = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  upData.push({ ...up, records });
}

const now = new Date();
const updateTimeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

const summary = {
  updated: now.toISOString(),
  up主: upData.map(u => ({
    uid: u.uid,
    name: u.name,
    latest_fans: u.records.length > 0 ? u.records[u.records.length - 1].fans : null,
    prev_fans: u.records.length > 1 ? u.records[u.records.length - 2].fans : null,
    data_count: u.records.length,
    first_time: u.records.length > 0 ? u.records[0].time : null
  }))
};
fs.writeFileSync('data/summary.json', JSON.stringify(summary, null, 2));

generateIndex();
upData.forEach(u => generateDetailPage(u));

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateIndex() {
  const cards = upData.map(u => {
    const last = u.records[u.records.length - 1];
    const fans = last ? last.fans.toLocaleString() : '--';
    return `
    <a href="up/${u.uid}.html" class="card">
      <h3>${escapeHtml(u.name)}</h3>
      <div class="fans-count">${fans}</div>
      <div class="fans-label">粉丝</div>
    </a>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B站粉丝追踪</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh}
    .container{max-width:960px;margin:0 auto;padding:32px 16px}
    header{margin-bottom:32px}
    header h1{font-size:24px;color:#f0f6fc;margin-bottom:8px}
    header p{color:#8b949e;font-size:14px}
    .card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:32px}
    .card{display:block;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:24px;text-decoration:none;color:inherit;transition:border-color .2s}
    .card:hover{border-color:#58a6ff}
    .card h3{font-size:16px;color:#f0f6fc;margin-bottom:12px}
    .fans-count{font-size:32px;font-weight:700;color:#58a6ff}
    .fans-label{font-size:13px;color:#8b949e;margin-top:4px}
    .overview-chart{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:24px;margin-bottom:32px}
    .overview-chart h2{font-size:16px;color:#f0f6fc;margin-bottom:16px}
    .chart-wrap{position:relative;height:350px}
    .data-table{background:#161b22;border:1px solid #30363d;border-radius:8px;overflow-x:auto}
    .data-table table{width:100%;border-collapse:collapse}
    .data-table th,.data-table td{padding:12px 16px;text-align:left;border-bottom:1px solid #30363d;font-size:14px}
    .data-table th{color:#8b949e;font-weight:500}
    .data-table td{color:#c9d1d9}
    .data-table tr:last-child td{border-bottom:none}
    .data-table a{color:#58a6ff;text-decoration:none}
    .data-table a:hover{text-decoration:underline}
    @media(max-width:600px){.card-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>B站粉丝追踪</h1>
      <p>最后更新: ${escapeHtml(updateTimeStr)}</p>
    </header>
    <div class="card-grid">${cards}</div>
    <div class="overview-chart">
      <h2>粉丝数趋势（全部UP主）</h2>
      <div class="chart-wrap"><canvas id="overviewChart"></canvas></div>
    </div>
    <div class="data-table">
      <table>
        <thead><tr><th>UP主</th><th>UID</th><th>当前粉丝</th><th>数据点数</th><th>最早记录</th></tr></thead>
        <tbody>${upData.map(u => {
          const last = u.records[u.records.length - 1];
          const first = u.records[0];
          return `<tr><td><a href="up/${u.uid}.html">${escapeHtml(u.name)}</a></td><td style="color:#8b949e">${u.uid}</td><td>${last ? last.fans.toLocaleString() : '--'}</td><td>${u.records.length}</td><td>${first ? new Date(first.time).toLocaleString('zh-CN') : '--'}</td></tr>`;
        }).join('\n')}</tbody>
      </table>
    </div>
  </div>
  <script>
    const COLORS = ['#58a6ff','#3fb950','#f0883e','#da3633','#a371f7','#f2cc60'];
    const ALL_DATA = ${JSON.stringify(upData.map(u => ({ name: u.name, uid: u.uid, records: u.records })))};
    new Chart(document.getElementById('overviewChart'), {
      type: 'line',
      data: {
        datasets: ALL_DATA.map((u,i) => ({
          label: u.name,
          data: u.records.map(r => ({ x: new Date(r.time), y: r.fans })),
          borderColor: COLORS[i % COLORS.length],
          backgroundColor: COLORS[i % COLORS.length] + '20',
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'nearest', axis: 'x' },
        plugins: { legend: { labels: { color: '#8b949e', boxWidth: 12, padding: 16 } } },
        scales: {
          x: { type: 'time', time: { tooltipFormat: 'yyyy-MM-dd HH:mm' }, ticks: { color: '#8b949e', maxTicksLimit: 10 }, grid: { color: '#21262d' } },
          y: { ticks: { color: '#8b949e', callback: v => v.toLocaleString() }, grid: { color: '#21262d' } }
        }
      }
    });
  </script>
</body>
</html>`;

  fs.writeFileSync('docs/index.html', html);
  console.log('✓ 首页已生成');
}

function generateDetailPage(up) {
  const last = up.records[up.records.length - 1];
  const current = last ? last.fans : null;
  const fans = up.records.map(r => r.fans);
  const maxFans = fans.length > 0 ? Math.max(...fans) : null;
  const minFans = fans.length > 0 ? Math.min(...fans) : null;
  const avgFans = fans.length > 0 ? Math.round(fans.reduce((a, b) => a + b, 0) / fans.length) : null;

  const daysSince24h = 0;
  let change = null;
  if (up.records.length > 1) {
    const dayAgo = new Date().getTime() - 24 * 60 * 60 * 1000;
    const prevRecords = up.records.filter(r => new Date(r.time).getTime() <= dayAgo);
    if (prevRecords.length > 0) {
      const prevFans = prevRecords[prevRecords.length - 1].fans;
      change = current - prevFans;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(up.name)} - 粉丝趋势 | B站粉丝追踪</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh}
    .container{max-width:960px;margin:0 auto;padding:32px 16px}
    header{margin-bottom:32px;display:flex;align-items:baseline;gap:16px;flex-wrap:wrap}
    .back-link{color:#8b949e;text-decoration:none;font-size:14px;padding:4px 12px;border:1px solid #30363d;border-radius:6px;transition:color .2s,border-color .2s}
    .back-link:hover{color:#58a6ff;border-color:#58a6ff}
    header h1{font-size:24px;color:#f0f6fc}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}
    .stat-box{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;text-align:center}
    .stat-box .value{font-size:22px;font-weight:700;color:#f0f6fc}
    .stat-box .value.green{color:#3fb950}
    .stat-box .value.red{color:#f85149}
    .stat-box .label{font-size:12px;color:#8b949e;margin-top:4px}
    .chart-container{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:24px}
    .chart-wrap{position:relative;height:400px}
    .time-range{display:flex;gap:8px;margin-bottom:16px}
    .time-range button{padding:6px 16px;border:1px solid #30363d;border-radius:6px;background:transparent;color:#8b949e;cursor:pointer;font-size:13px;transition:all .2s}
    .time-range button:hover{border-color:#58a6ff;color:#58a6ff}
    .time-range button.active{background:#58a6ff;color:#fff;border-color:#58a6ff}
    .empty-state{text-align:center;padding:80px 20px;color:#8b949e}
    .empty-state h2{font-size:20px;margin-bottom:8px;color:#f0f6fc}
    @media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <a href="../index.html" class="back-link">&larr; 返回列表</a>
      <h1>${escapeHtml(up.name)}</h1>
    </header>
    ${up.records.length === 0 ? `
    <div class="empty-state">
      <h2>暂无数据</h2>
      <p>等待首次数据采集...</p>
    </div>` : `
    <div class="stats">
      <div class="stat-box"><div class="value">${current.toLocaleString()}</div><div class="label">当前粉丝</div></div>
      <div class="stat-box"><div class="value">${maxFans.toLocaleString()}</div><div class="label">最高</div></div>
      <div class="stat-box"><div class="value">${minFans.toLocaleString()}</div><div class="label">最低</div></div>
      <div class="stat-box"><div class="value">${avgFans.toLocaleString()}</div><div class="label">平均</div></div>
      ${change !== null ? `<div class="stat-box"><div class="value ${change >= 0 ? 'green' : 'red'}">${change >= 0 ? '+' : ''}${change.toLocaleString()}</div><div class="label">24h变化</div></div>` : ''}
      <div class="stat-box"><div class="value">${up.records.length}</div><div class="label">数据点数</div></div>
    </div>
    <div class="chart-container">
      <div class="time-range" id="timeRange">
        <button class="active" data-days="7">7天</button>
        <button data-days="30">30天</button>
        <button data-days="90">90天</button>
        <button data-days="0">全部</button>
      </div>
      <div class="chart-wrap"><canvas id="fansChart"></canvas></div>
    </div>`}
  </div>
  ${up.records.length > 0 ? `
  <script>
    const ALL_DATA = ${JSON.stringify(up.records)};
    let chart = null;

    function filterData(days) {
      if (days === 0) return ALL_DATA;
      const cutoff = Date.now() - days * 86400000;
      return ALL_DATA.filter(d => new Date(d.time).getTime() >= cutoff);
    }

    function renderChart(days) {
      const data = filterData(days);
      const ctx = document.getElementById('fansChart').getContext('2d');
      if (chart) chart.destroy();
      const fmt = dateFns && dateFns.format ? d => dateFns.format(d, 'MM/dd HH:mm') : d => d.toLocaleString();
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            label: '粉丝数',
            data: data.map(r => ({ x: new Date(r.time), y: r.fans })),
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88,166,255,0.08)',
            fill: true, tension: 0.3,
            pointRadius: data.length > 200 ? 0 : 2,
            pointHitRadius: 10,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: items => new Date(items[0].parsed.x).toLocaleString('zh-CN'),
                label: item => '粉丝: ' + item.parsed.y.toLocaleString()
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: { tooltipFormat: 'yyyy-MM-dd HH:mm', displayFormats: { hour: 'MM/dd HH:mm', day: 'MM/dd', week: 'MM/dd', month: 'yyyy/MM' } },
              ticks: { color: '#8b949e', maxTicksLimit: 10 },
              grid: { color: '#21262d' }
            },
            y: {
              ticks: { color: '#8b949e', callback: v => v.toLocaleString() },
              grid: { color: '#21262d' }
            }
          }
        }
      });
    }

    document.querySelectorAll('#timeRange button').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#timeRange button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        renderChart(parseInt(this.dataset.days));
      });
    });

    renderChart(7);
  </script>` : ''}
</body>
</html>`;

  fs.writeFileSync(`docs/up/${up.uid}.html`, html);
  console.log(`✓ ${up.name} 详情页已生成`);
}
