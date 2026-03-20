// Settings section.

window.renderSettings = async function renderSettings() {
  window.headerActions.style.display = 'none';
  window.setPageContent(`
    <div class="settings-page">
      <div class="settings-card">
        <div class="settings-card-head">
          <h2 class="settings-title">Основной Discord сервер</h2>
          <a class="btn-pill settings-add-bot-btn" id="settings-add-bot-btn" href="#" target="_blank" rel="noopener noreferrer">Добавить бота</a>
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
  const addBotBtn = document.getElementById('settings-add-bot-btn');

  try {
    const res = await fetch('/api/settings/discord');
    const data = res.ok ? await res.json() : null;
    if (!data) throw new Error('load failed');
    if (nameEl) nameEl.textContent = data.serverName || 'Основной Discord сервер';
    if (membersEl) membersEl.textContent = `Участников: ${Number(data.memberCount || 0).toLocaleString('ru-RU')}`;
    if (roleInput) roleInput.value = data.mainRoleId || '';
    if (addBotBtn) {
      if (data.addBotUrl) {
        addBotBtn.href = data.addBotUrl;
        addBotBtn.style.display = 'inline-flex';
      } else {
        addBotBtn.style.display = 'none';
      }
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
};
