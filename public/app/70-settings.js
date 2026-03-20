// Settings section.

window.renderSettings = async function renderSettings() {
  window.headerActions.style.display = 'none';
  window.setPageContent(`
    <div class="settings-page">
      <div class="settings-card">
        <div class="settings-card-head">
          <h2 class="settings-title">Основной Дискорд сервер</h2>
          <button type="button" class="btn-icon settings-edit-btn" id="settings-edit-guild-btn" title="Редактировать сервер" aria-label="Редактировать сервер">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
        </div>
        <div class="settings-guild-picker" id="settings-guild-picker" hidden>
          <div class="settings-guild-picker-row">
            <select id="settings-main-guild-id" class="settings-guild-select" aria-label="Выбор сервера"></select>
            <button type="button" class="btn-pill" id="settings-save-guild-btn">Сохранить сервер</button>
          </div>
        </div>
        <div class="settings-server-row">
          <div class="settings-server-main">
            <div class="settings-server-name" id="settings-server-name">Загрузка...</div>
            <div class="settings-server-members" id="settings-server-members">Участников: —</div>
          </div>
          <div class="settings-status" id="settings-status">
            <span class="settings-status-dot"></span>
            <span class="settings-status-text">Проверка...</span>
          </div>
        </div>
        <form id="settings-role-form" class="settings-form">
          <label for="settings-main-role-id">ID основной роли</label>
          <div class="settings-form-row">
            <input id="settings-main-role-id" type="text" inputmode="numeric" autocomplete="off" placeholder="Например: 123456789012345678" />
            <button type="submit" class="btn-pill">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  `);

  const nameEl = document.getElementById('settings-server-name');
  const membersEl = document.getElementById('settings-server-members');
  const statusEl = document.getElementById('settings-status');
  const statusTextEl = statusEl?.querySelector('.settings-status-text');
  const roleInput = document.getElementById('settings-main-role-id');
  const roleForm = document.getElementById('settings-role-form');
  const editGuildBtn = document.getElementById('settings-edit-guild-btn');
  const guildPicker = document.getElementById('settings-guild-picker');
  const guildSelect = document.getElementById('settings-main-guild-id');
  const saveGuildBtn = document.getElementById('settings-save-guild-btn');
  let currentMainGuildId = '';

  try {
    const res = await fetch('/api/settings/discord');
    const data = res.ok ? await res.json() : null;
    if (!data) throw new Error('load failed');
    if (nameEl) nameEl.textContent = data.serverName || 'Основной Дискорд сервер';
    if (membersEl) membersEl.textContent = `Участников: ${Number(data.memberCount || 0).toLocaleString('ru-RU')}`;
    if (roleInput) roleInput.value = data.mainRoleId || '';
    if (guildSelect) {
      const guilds = Array.isArray(data.guilds) ? data.guilds : [];
      guildSelect.innerHTML = guilds.length
        ? guilds.map(g => `<option value="${window.escapeHtml(String(g.id))}">${window.escapeHtml(g.name)} (${Number(g.memberCount || 0).toLocaleString('ru-RU')})</option>`).join('')
        : '<option value="">Серверы не найдены</option>';
      if (data.mainGuildId) {
        guildSelect.value = String(data.mainGuildId);
      }
      currentMainGuildId = String(data.mainGuildId || guildSelect.value || '');
    }
    if (statusEl && statusTextEl) {
      statusEl.classList.toggle('is-online', !!data.botOnline);
      statusEl.classList.toggle('is-offline', !data.botOnline);
      statusTextEl.textContent = data.botOnline ? 'Онлайн' : 'Оффлайн';
    }
  } catch (_) {
    if (statusEl && statusTextEl) {
      statusEl.classList.add('is-offline');
      statusTextEl.textContent = 'Оффлайн';
    }
  }

  roleForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mainRoleId = String(roleInput?.value || '').trim();
    try {
      const res = await fetch('/api/settings/discord', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainRoleId })
      });
      if (!res.ok) {
        let msg = 'Не удалось сохранить';
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch (_) { /* ignore */ }
        throw new Error(msg);
      }
      if (typeof window.showToast === 'function') window.showToast('ID роли сохранен.', 'success');
    } catch (err) {
      if (typeof window.showToast === 'function') window.showToast(err.message || 'Не удалось сохранить ID роли.', 'error');
    }
  });

  editGuildBtn?.addEventListener('click', () => {
    if (!guildPicker) return;
    guildPicker.hidden = !guildPicker.hidden;
  });

  saveGuildBtn?.addEventListener('click', async () => {
    const mainGuildId = String(guildSelect?.value || '').trim();
    const mainRoleId = String(roleInput?.value || '').trim();
    try {
      const res = await fetch('/api/settings/discord', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainGuildId, mainRoleId })
      });
      if (!res.ok) {
        let msg = 'Не удалось сохранить сервер';
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch (_) { /* ignore */ }
        throw new Error(msg);
      }
      if (mainGuildId !== currentMainGuildId) {
        await window.renderSettings();
      } else if (guildPicker) {
        guildPicker.hidden = true;
      }
      if (typeof window.showToast === 'function') window.showToast('Основной сервер обновлен.', 'success');
    } catch (err) {
      if (typeof window.showToast === 'function') window.showToast(err.message || 'Не удалось сохранить сервер.', 'error');
    }
  });
};
