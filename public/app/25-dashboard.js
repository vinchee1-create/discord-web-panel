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
  question: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  dollar: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="2" x2="12" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
  swords: `<svg class="dashboard-tag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"></path><path d="m13 19 6-6"></path><path d="m16 16 4 4"></path><path d="m19 21 2-2"></path><path d="M9.5 6.5 21 18v3h-3L6.5 9.5"></path><path d="m11 13 6-6"></path><path d="m16 8 4-4"></path><path d="m3 21 5-5"></path></svg>`
};

function tagMetric(svgHtml, count, title) {
  const n = Number(count) || 0;
  return `
    <div class="dashboard-tag-metric" title="${window.escapeHtml(title)}">
      <div class="dashboard-tag-metric-icon">${svgHtml}</div>
      <span class="dashboard-tag-metric-num">${n}</span>
    </div>`;
}

window.renderDashboard = function renderDashboard() {
  const d = window.dashboardData || { curatorsOnline: 0, playersOnline: 0, factions: [] };
  const cur = Number(d.curatorsOnline) || 0;
  const play = Number(d.playersOnline) || 0;
  const factions = Array.isArray(d.factions) ? d.factions : [];

  const rows = factions.map((f) => {
    const names = Array.isArray(f.curators) ? f.curators : [];
    const curLine = names.length
      ? names.map(n => window.escapeHtml(n)).join(', ')
      : '<span class="dashboard-faction-curators-empty">—</span>';
    const ot = f.openTags || {};
    return `
      <div class="dashboard-faction-row">
        <div class="dashboard-faction-left">
          <div class="dashboard-faction-name">${window.escapeHtml(f.label || f.scope || '')}</div>
          <div class="dashboard-faction-curators">${curLine}</div>
        </div>
        <div class="dashboard-faction-tags">
          ${tagMetric(DASHBOARD_SVG.question, ot.questionsAndLeader, 'Вопросы кураторам и Curator Leader')}
          ${tagMetric(DASHBOARD_SVG.dollar, ot.treasury, 'Казна')}
          ${tagMetric(DASHBOARD_SVG.swords, ot.playerRequests, 'Запросы от игроков')}
        </div>
      </div>`;
  }).join('');

  window.setPageContent(`
    <div class="dashboard-home">
      <div class="dashboard-top-cards">
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-label">Кураторов онлайн</div>
          <div class="dashboard-stat-value">${cur.toLocaleString('ru-RU')}</div>
          <div class="dashboard-stat-hint">С основной ролью на основном сервере</div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-label">Игроков онлайн</div>
          <div class="dashboard-stat-value">${play.toLocaleString('ru-RU')}</div>
          <div class="dashboard-stat-hint">Всего участников на фракционных серверах</div>
        </div>
      </div>
      <section class="dashboard-factions-panel">
        <h2 class="dashboard-factions-title">Фракционные дискорды</h2>
        <p class="dashboard-factions-sub">Список всех фракционных дискорд серверов</p>
        <div class="dashboard-faction-list">${rows}</div>
      </section>
    </div>`);
};
