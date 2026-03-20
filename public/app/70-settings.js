// Settings section.

const SETTINGS_SCOPES = [
  { scope: 'main', guildKey: 'main_guild_id', title: 'Основной сервер' },
  { scope: 'ballas', guildKey: 'ballas_guild_id', title: 'The Ballas Gang' },
  { scope: 'vagos', guildKey: 'vagos_guild_id', title: 'Los Santos Vagos' },
  { scope: 'families', guildKey: 'families_guild_id', title: 'The Families' },
  { scope: 'bloods', guildKey: 'bloods_guild_id', title: 'The Bloods Gang' },
  { scope: 'marabunta', guildKey: 'marabunta_guild_id', title: 'Marabunta Grande' }
];

window.renderSettings = async function renderSettings() {
  window.headerActions.style.display = 'none';
  const cardsHtml = SETTINGS_SCOPES.map(s => `
    <div class="settings-card" data-settings-scope="${s.scope}">
      <div class="settings-card-head">
        <h2 class="settings-title">${s.title}</h2>
        <button type="button" class="btn-icon settings-edit-btn" data-act="open-settings-modal" title="Редактировать сервер" aria-label="Редактировать сервер">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
        </button>
      </div>
      <div class="settings-server-row settings-server-row--${s.guildKey}">
        <div class="settings-server-main">
          <div class="settings-server-name" data-part="server-name">Загрузка...</div>
          <div class="settings-server-members" data-part="server-members">Участников: —</div>
        </div>
        <div class="settings-status" data-part="status">
          <span class="settings-status-dot"></span>
          <span class="settings-status-text">Проверка...</span>
        </div>
      </div>
    </div>
  `).join('');

  window.setPageContent(`
    <div class="settings-page">
      <div class="settings-grid">${cardsHtml}</div>
    </div>
    <div class="modal-overlay settings-guild-modal" id="settings-guild-modal">
      <div class="modal-card settings-guild-modal-card">
        <h3 class="settings-guild-modal-title">Настройка сервера</h3>
        <div class="settings-guild-picker-row">
          <select class="settings-guild-select" id="settings-guild-modal-select" aria-label="Выбор сервера"></select>
        </div>
        <div class="settings-modal-fields">
          <label>ID Fraction Curator</label>
          <input type="text" id="settings-modal-fraction-curator" inputmode="numeric" autocomplete="off" />
          <label>ID Fraction Role</label>
          <input type="text" id="settings-modal-fraction-role" inputmode="numeric" autocomplete="off" />
          <hr class="settings-modal-separator" />
          <label>ID Новости кураторов</label>
          <input type="text" id="settings-modal-curators-news" inputmode="numeric" autocomplete="off" />
          <label>ID Curator Leader</label>
          <input type="text" id="settings-modal-curator-leader" inputmode="numeric" autocomplete="off" />
          <label>ID Запросы от игроков</label>
          <input type="text" id="settings-modal-player-requests" inputmode="numeric" autocomplete="off" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" id="settings-guild-modal-cancel">Отмена</button>
          <button type="button" class="btn-pill" id="settings-guild-modal-save">Сохранить</button>
        </div>
      </div>
    </div>
  `);

  const cards = Array.from(document.querySelectorAll('.settings-card'));
  const modal = document.getElementById('settings-guild-modal');
  const modalSelect = document.getElementById('settings-guild-modal-select');
  const modalFractionCurator = document.getElementById('settings-modal-fraction-curator');
  const modalFractionRole = document.getElementById('settings-modal-fraction-role');
  const modalCuratorsNews = document.getElementById('settings-modal-curators-news');
  const modalCuratorLeader = document.getElementById('settings-modal-curator-leader');
  const modalPlayerRequests = document.getElementById('settings-modal-player-requests');
  const modalSaveBtn = document.getElementById('settings-guild-modal-save');
  const modalCancelBtn = document.getElementById('settings-guild-modal-cancel');

  let guilds = [];
  let scopeSettings = {};
  let botOnline = false;
  let currentScope = '';

  try {
    const res = await fetch('/api/settings/discord');
    const data = res.ok ? await res.json() : null;
    if (!data) throw new Error('load failed');
    botOnline = !!data.botOnline;
    scopeSettings = data.scopeSettings || {};
    guilds = Array.isArray(data.guilds) ? data.guilds : [];
  } catch (_) {
    // keep defaults
  }

  cards.forEach(card => {
    const scope = card.getAttribute('data-settings-scope') || '';
    const s = scopeSettings[scope] || {};
    const nameEl = card.querySelector('[data-part="server-name"]');
    const membersEl = card.querySelector('[data-part="server-members"]');
    const statusEl = card.querySelector('[data-part="status"]');
    const statusTextEl = statusEl?.querySelector('.settings-status-text');
    const editBtn = card.querySelector('[data-act="open-settings-modal"]');

    const selectedGuildId = String(s.guildId || guilds[0]?.id || '');
    const selectedGuild = guilds.find(g => String(g.id) === selectedGuildId) || guilds[0] || null;
    if (nameEl) nameEl.textContent = selectedGuild?.name || 'Сервер не выбран';
    if (membersEl) membersEl.textContent = `Участников: ${Number(selectedGuild?.memberCount || 0).toLocaleString('ru-RU')}`;
    if (statusEl && statusTextEl) {
      statusEl.classList.toggle('is-online', botOnline);
      statusEl.classList.toggle('is-offline', !botOnline);
      statusTextEl.textContent = botOnline ? 'Онлайн' : 'Оффлайн';
    }

    editBtn?.addEventListener('click', () => {
      currentScope = scope;
      const cur = scopeSettings[currentScope] || {};
      if (modalSelect) {
        modalSelect.innerHTML = guilds.length
          ? guilds.map(g => `<option value="${window.escapeHtml(String(g.id))}">${window.escapeHtml(g.name)} (${Number(g.memberCount || 0).toLocaleString('ru-RU')})</option>`).join('')
          : '<option value="">Серверы не найдены</option>';
        modalSelect.value = String(cur.guildId || guilds[0]?.id || '');
      }
      if (modalFractionCurator) modalFractionCurator.value = cur.fractionCuratorId || '';
      if (modalFractionRole) modalFractionRole.value = cur.fractionRoleId || '';
      if (modalCuratorsNews) modalCuratorsNews.value = cur.curatorsNewsId || '';
      if (modalCuratorLeader) modalCuratorLeader.value = cur.curatorLeaderId || '';
      if (modalPlayerRequests) modalPlayerRequests.value = cur.playerRequestsId || '';
      modal?.classList.add('is-open');
    });
  });

  const closeModal = () => modal?.classList.remove('is-open');
  modalCancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  modalSaveBtn?.addEventListener('click', async () => {
    if (!currentScope) return;
    try {
      const res = await fetch('/api/settings/discord', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: currentScope,
          guildId: String(modalSelect?.value || '').trim(),
          fractionCuratorId: String(modalFractionCurator?.value || '').trim(),
          fractionRoleId: String(modalFractionRole?.value || '').trim(),
          curatorsNewsId: String(modalCuratorsNews?.value || '').trim(),
          curatorLeaderId: String(modalCuratorLeader?.value || '').trim(),
          playerRequestsId: String(modalPlayerRequests?.value || '').trim()
        })
      });
      if (!res.ok) {
        let msg = 'Не удалось сохранить настройки';
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch (_) { /* ignore */ }
        throw new Error(msg);
      }
      closeModal();
      await window.renderSettings();
      if (typeof window.showToast === 'function') window.showToast('Настройки сервера сохранены.', 'success');
    } catch (err) {
      if (typeof window.showToast === 'function') window.showToast(err.message || 'Не удалось сохранить настройки.', 'error');
    }
  });
};
