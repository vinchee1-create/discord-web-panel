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

const DASHBOARD_SVG = {
  /* Вопросы кураторам — круг с «?» */
  question: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>`,
  /* Казна — доллар в круге */
  dollar: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
  /* Запросы от игроков — пистолет (силуэт) */
  pistol: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h6l1-2h6a1 1 0 0 1 1 1v1h3"></path><path d="M5 12v2h8"></path><path d="M7 14v4H5"></path><path d="M15 12h4"></path></svg>`
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
              ${tagMetric(DASHBOARD_SVG.dollar, ot.treasury, 'Казна')}
              ${tagMetric(DASHBOARD_SVG.pistol, ot.playerRequests, 'Запросы от игроков')}
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
          </div>
          <div class="dashboard-stat-value-wrap">
            <div class="dashboard-stat-value">${cur.toLocaleString('ru-RU')}</div>
          </div>
          <div class="dashboard-stat-footer">Кураторов онлайн</div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-card-header">
            <span class="dashboard-stat-kicker">Фракционные дискорды</span>
          </div>
          <div class="dashboard-stat-value-wrap">
            <div class="dashboard-stat-value">${play.toLocaleString('ru-RU')}</div>
          </div>
          <div class="dashboard-stat-footer">Игроков онлайн</div>
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
