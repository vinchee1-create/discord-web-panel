// Главная страница (дашборд).

window.dashboardData = null;

window.loadDashboard = async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard/home');
    const data = res.ok ? await res.json() : null;
    window.dashboardData = data && typeof data === 'object'
      ? data
      : { curatorsOnline: 0, playersOnline: 0, factions: [] };
  } catch (e) {
    console.error('loadDashboard:', e);
    window.dashboardData = { curatorsOnline: 0, playersOnline: 0, factions: [], error: true };
  }
};

/* Единый стиль: тонкий штрих 1.5, скругления — как панель / Lucide */
const DASHBOARD_SVG = {
  /* Вопросы кураторам — сообщение с строками текста */
  question: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M8 10h8"></path><path d="M8 14h5"></path></svg>`,
  /* Казна — кошелёк */
  treasury: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1"></path></svg>`,
  /* Запросы от игроков — входящие */
  requests: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`
};

/* Иконки в шапке верхних карточек (как «сервер» на референсе) */
const DASHBOARD_STAT_HEADER_SVG = {
  server: `<svg class="dashboard-stat-header-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"></rect><rect width="20" height="8" x="2" y="14" rx="2" ry="2"></rect><line x1="6" x2="6.01" y1="6" y2="6"></line><line x1="6" x2="6.01" y1="18" y2="18"></line></svg>`,
  layers: `<svg class="dashboard-stat-header-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`
};

function tagMetric(svgHtml, count, title) {
  const n = Number(count) || 0;
  return `
    <div class="dashboard-tag-metric" title="${window.escapeHtml(title)}">
      <div class="dashboard-tag-metric-icon">${svgHtml}</div>
      <span class="dashboard-tag-metric-num">${n}</span>
    </div>`;
}

/** Кураторы: { name, online } или строка (совместимость). Онлайн — цвет фракции. */
function renderFactionCurators(curators, scopeSlug) {
  if (!Array.isArray(curators) || curators.length === 0) {
    return '<span class="dashboard-faction-curators-empty">—</span>';
  }
  const parts = curators.map((entry) => {
    const isObj = entry && typeof entry === 'object' && 'name' in entry;
    const name = isObj ? entry.name : entry;
    const online = isObj ? !!entry.online : false;
    const esc = window.escapeHtml(String(name || ''));
    if (online) {
      return `<span class="dashboard-faction-curator-name dashboard-faction-curator--online dashboard-faction-accent--${scopeSlug}">${esc}</span>`;
    }
    return `<span class="dashboard-faction-curator-name dashboard-faction-curator--offline">${esc}</span>`;
  });
  return parts.join('<span class="dashboard-faction-curator-sep">, </span>');
}

window.renderDashboard = function renderDashboard() {
  const d = window.dashboardData || { curatorsOnline: 0, playersOnline: 0, factions: [] };
  const cur = Number(d.curatorsOnline) || 0;
  const play = Number(d.playersOnline) || 0;
  const factions = Array.isArray(d.factions) ? d.factions : [];

  const rows = factions.map((f) => {
    const curLine = renderFactionCurators(f.curators, String(f.scope || '').replace(/[^a-z0-9_-]/gi, '') || 'unknown');
    const ot = f.openTags || {};
    const scopeSlug = String(f.scope || '').replace(/[^a-z0-9_-]/gi, '') || 'unknown';
    const tagsCell = `
            <div class="dashboard-faction-tags">
              ${tagMetric(DASHBOARD_SVG.question, ot.questionsAndLeader, 'Вопросы кураторам и Curator Leader')}
              ${tagMetric(DASHBOARD_SVG.treasury, ot.treasury, 'Казна')}
              ${tagMetric(DASHBOARD_SVG.requests, ot.playerRequests, 'Запросы от игроков')}
            </div>`;
    return `
        <tr>
          <td>
            <div class="dashboard-faction-name-row">
              <div class="dashboard-faction-title-line">
                <span class="dashboard-faction-color-dot dashboard-faction-dot--${scopeSlug}" aria-hidden="true"></span>
                <div class="dashboard-faction-cell-name">${window.escapeHtml(f.label || f.scope || '')}</div>
              </div>
              <div class="dashboard-faction-cell-curators">${curLine}</div>
            </div>
          </td>
          <td class="dashboard-faction-tags-cell">${tagsCell}</td>
        </tr>`;
  }).join('');

  window.setPageContent(`
    <div class="dashboard-home">
      <div class="dashboard-top-cards">
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-card-header">
            <span class="dashboard-stat-kicker">Основной дискорд</span>
            <span class="dashboard-stat-header-icon" aria-hidden="true">${DASHBOARD_STAT_HEADER_SVG.server}</span>
          </div>
          <div class="dashboard-stat-card-body">
            <div class="dashboard-stat-value">${cur.toLocaleString('ru-RU')}</div>
            <div class="dashboard-stat-footer">Кураторов онлайн</div>
          </div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-card-header">
            <span class="dashboard-stat-kicker">Фракционные дискорды</span>
            <span class="dashboard-stat-header-icon" aria-hidden="true">${DASHBOARD_STAT_HEADER_SVG.layers}</span>
          </div>
          <div class="dashboard-stat-card-body">
            <div class="dashboard-stat-value">${play.toLocaleString('ru-RU')}</div>
            <div class="dashboard-stat-footer">Игроков онлайн</div>
          </div>
        </div>
      </div>
      <div class="dashboard-factions-outer">
        <section class="dashboard-factions-panel">
          <header class="dashboard-factions-head">
            <h2 class="dashboard-factions-title">Фракционные дискорды</h2>
            <p class="dashboard-factions-sub">Список всех фракционных дискорд серверов</p>
          </header>
          <div class="table-container table-families dashboard-factions-table">
            <table class="data-table data-table-families data-table-dashboard-factions">
              <thead>
                <tr>
                  <th>Фракция</th>
                  <th class="dashboard-factions-th-tags">Теги</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>`);
};
