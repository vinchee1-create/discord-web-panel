// Settings section.

const SETTINGS_SCOPES = [
  { key: 'main_curator_role_id', guildKey: 'main_guild_id', title: 'Основной сервер' },
  { key: 'ballas_curator_role_id', guildKey: 'ballas_guild_id', title: 'The Ballas Gang' },
  { key: 'families_curator_role_id', guildKey: 'families_guild_id', title: 'The Families' },
  { key: 'vagos_curator_role_id', guildKey: 'vagos_guild_id', title: 'Los Santos Vagos' },
  { key: 'bloods_curator_role_id', guildKey: 'bloods_guild_id', title: 'The Bloods Gang' },
  { key: 'marabunta_curator_role_id', guildKey: 'marabunta_guild_id', title: 'Marabunta Grande' }
];

window.renderSettings = async function renderSettings() {
  window.headerActions.style.display = 'none';
  const cardsHtml = SETTINGS_SCOPES.map(s => `
    <div class="settings-card" data-settings-scope="${s.key}">
      <div class="settings-card-head">
        <h2 class="settings-title">${s.title}</h2>
        <button type="button" class="btn-icon settings-edit-btn" data-act="toggle-guild-picker" title="Редактировать сервер" aria-label="Редактировать сервер">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
        </button>
      </div>
      <div class="settings-guild-picker" data-part="guild-picker" hidden>
        <div class="settings-guild-picker-row">
          <select class="settings-guild-select" data-part="guild-select" aria-label="Выбор сервера"></select>
          <button type="button" class="btn-pill" data-act="save-guild">Сохранить сервер</button>
        </div>
      </div>
      <div class="settings-server-row">
        <div class="settings-server-main">
          <div class="settings-server-name" data-part="server-name">Загрузка...</div>
          <div class="settings-server-members" data-part="server-members">Участников: —</div>
        </div>
        <div class="settings-status" data-part="status">
          <span class="settings-status-dot"></span>
          <span class="settings-status-text">Проверка...</span>
        </div>
      </div>
      <form class="settings-form" data-part="role-form">
        <label>ID Кураторской роли</label>
        <div class="settings-form-row">
          <input type="text" inputmode="numeric" autocomplete="off" placeholder="Например: 123456789012345678" data-part="role-input" />
          <button type="submit" class="btn-pill">Сохранить</button>
        </div>
      </form>
    </div>
  `).join('');

  window.setPageContent(`
    <div class="settings-page">
      <div class="settings-grid">${cardsHtml}</div>
    </div>
  `);
  const cards = Array.from(document.querySelectorAll('.settings-card'));
  let guilds = [];
  let roleIds = {};
  let guildIds = {};
  let botOnline = false;

  try {
    const res = await fetch('/api/settings/discord');
    const data = res.ok ? await res.json() : null;
    if (!data) throw new Error('load failed');
    botOnline = !!data.botOnline;
    roleIds = data.roleIds || {};
    guildIds = data.guildIds || {};
    guilds = Array.isArray(data.guilds) ? data.guilds : [];
  } catch (_) {
    // keep defaults
  }

  cards.forEach(card => {
    const scope = card.getAttribute('data-settings-scope') || '';
    const scopeMeta = SETTINGS_SCOPES.find(x => x.key === scope);
    const guildScope = scopeMeta?.guildKey || 'main_guild_id';
    const nameEl = card.querySelector('[data-part="server-name"]');
    const membersEl = card.querySelector('[data-part="server-members"]');
    const statusEl = card.querySelector('[data-part="status"]');
    const statusTextEl = statusEl?.querySelector('.settings-status-text');
    const roleInput = card.querySelector('[data-part="role-input"]');
    const roleForm = card.querySelector('[data-part="role-form"]');
    const guildPicker = card.querySelector('[data-part="guild-picker"]');
    const guildSelect = card.querySelector('[data-part="guild-select"]');
    const editGuildBtn = card.querySelector('[data-act="toggle-guild-picker"]');
    const saveGuildBtn = card.querySelector('[data-act="save-guild"]');

    const selectedGuildId = String(guildIds[guildScope] || guilds[0]?.id || '');
    const selectedGuild = guilds.find(g => String(g.id) === selectedGuildId) || guilds[0] || null;
    if (nameEl) nameEl.textContent = selectedGuild?.name || 'Сервер не выбран';
    if (membersEl) membersEl.textContent = `Участников: ${Number(selectedGuild?.memberCount || 0).toLocaleString('ru-RU')}`;
    if (statusEl && statusTextEl) {
      statusEl.classList.toggle('is-online', botOnline);
      statusEl.classList.toggle('is-offline', !botOnline);
      statusTextEl.textContent = botOnline ? 'Онлайн' : 'Оффлайн';
    }
    if (roleInput) roleInput.value = roleIds[scope] || '';
    if (guildSelect) {
      guildSelect.innerHTML = guilds.length
        ? guilds.map(g => `<option value="${window.escapeHtml(String(g.id))}">${window.escapeHtml(g.name)} (${Number(g.memberCount || 0).toLocaleString('ru-RU')})</option>`).join('')
        : '<option value="">Серверы не найдены</option>';
      if (selectedGuildId) guildSelect.value = selectedGuildId;
    }

    roleForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const roleId = String(roleInput?.value || '').trim();
      try {
        const res = await fetch('/api/settings/discord', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleScope: scope, roleId })
        });
        if (!res.ok) {
          let msg = 'Не удалось сохранить';
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch (_) { /* ignore */ }
          throw new Error(msg);
        }
        if (typeof window.showToast === 'function') window.showToast('ID кураторской роли сохранен.', 'success');
      } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message || 'Не удалось сохранить ID роли.', 'error');
      }
    });

    editGuildBtn?.addEventListener('click', () => {
      if (!guildPicker) return;
      guildPicker.hidden = !guildPicker.hidden;
    });

    saveGuildBtn?.addEventListener('click', async () => {
      const guildId = String(guildSelect?.value || '').trim();
      try {
        const res = await fetch('/api/settings/discord', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildScope, guildId })
        });
        if (!res.ok) {
          let msg = 'Не удалось сохранить сервер';
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch (_) { /* ignore */ }
          throw new Error(msg);
        }
        await window.renderSettings();
        if (typeof window.showToast === 'function') window.showToast('Основной сервер обновлен.', 'success');
      } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message || 'Не удалось сохранить сервер.', 'error');
      }
    });
  });
};
