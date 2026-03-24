// Leaders section.

function isLeaderActive(L) {
  return Boolean(L.leader && L.staticId && L.term && L.time);
}
function getActiveLeadersCount() {
  return window.leaders.filter(isLeaderActive).length;
}
function getNearestRemoval() {
  const msPerDay = 1000 * 60 * 60 * 24;
  const now = new Date();
  let best = null;
  window.leaders.forEach(L => {
    if (!L.time) return;
    const d = new Date(L.time);
    if (isNaN(d.getTime())) return;
    const d30 = new Date(d);
    d30.setDate(d30.getDate() + 30);
    const days = Math.round((d30 - now) / msPerDay);
    if (best === null || days < best.days) {
      best = { days, faction: L.faction };
    }
  });
  return best;
}

function getTimeTooltip(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const d30 = new Date(d);
  d30.setDate(d30.getDate() + 30);
  const now = new Date();
  const diffDays = Math.round((d30 - now) / (1000 * 60 * 60 * 24));
  const fmt = (x) => x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return fmt(d30) + '\nОсталось: ' + diffDays + ' дн.';
}
function formatTimeDisplay(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

window.renderLeaders = function renderLeaders() {
  const flagSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
  const editSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  const activeCount = getActiveLeadersCount();
  const nearest = getNearestRemoval();
  const nearestText = nearest ? `через ${nearest.days} дн.` : 'нет данных';
  const nearestFaction = nearest ? nearest.faction : '—';
  const cardsHtml = `
        <div class="stat-card">
            <span class="stat-card-title">Активных лидеров</span>
            <div class="stat-card-value">${activeCount}</div>
            <div class="stat-card-label">из ${window.leaders.length}</div>
            <div class="stat-card-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
        </div>
        <div class="stat-card">
            <span class="stat-card-title">Ближайшее снятие</span>
            <div class="stat-card-value">${nearestText}</div>
            <div class="stat-card-label">${nearestFaction}</div>
            <div class="stat-card-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg></div>
        </div>`;
  const rowsHtml = window.leaders.map((L, i) => {
    const timeTitle = getTimeTooltip(L.time);
    const timeDisplay = formatTimeDisplay(L.time);
    const flagClass = L.flagged ? 'btn-icon btn-icon-flag is-flagged' : 'btn-icon btn-icon-flag';
    return `<tr>
            <td>${L.id}</td>
            <td>${window.escapeHtml(L.faction)}</td>
            <td>${window.escapeHtml(L.leader) || '—'}</td>
            <td>${window.escapeHtml(L.staticId) || '—'}</td>
            <td>${window.escapeHtml(L.term) || '—'}</td>
            <td class="time-cell" data-time="${window.escapeHtml(L.time)}" title="${window.escapeHtml(timeTitle)}">${timeDisplay}</td>
            <td class="cell-actions-leaders">
                <button type="button" class="${flagClass}" onclick="toggleLeaderFlag(${i})" title="Отметить">${flagSvg}</button>
                <button type="button" class="btn-icon" onclick="editLeader(${i})" title="Редактировать">${editSvg}</button>
            </td>
        </tr>`;
  }).join('');
  window.setPageContent(`
        <div class="workspace-panel">
            <div class="stat-cards">${cardsHtml}</div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Фракция</th>
                            <th>Лидер</th>
                            <th>Static ID</th>
                            <th>Срок</th>
                            <th>Время</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>`);
};

window.toggleLeaderFlag = async function toggleLeaderFlag(i) {
  const current = window.leaders[i];
  const updated = { ...current, flagged: !current.flagged };
  window.leaders[i] = updated;
  if (updated.dbId != null) {
    try {
      const res = await fetch(`/api/leaders/${updated.dbId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error('Failed to save flag');
      window.leaders[i] = await res.json();
    } catch (e) {
      console.error(e);
      alert('Не удалось сохранить флажок.');
    }
  }
  window.renderLeaders();
};

function openLeaderModal(index) {
  const L = window.leaders[index];
  document.getElementById('leader-edit-index').value = index;
  document.getElementById('leader-faction').value = L.faction;
  document.getElementById('leader-name').value = L.leader || '';
  document.getElementById('leader-static').value = L.staticId || '';
  document.getElementById('leader-term').value = L.term || '';
  document.getElementById('leader-time').value = L.time || '';
  window.leaderModal.classList.add('is-open');
}
function closeLeaderModal() {
  window.leaderModal.classList.remove('is-open');
}

window.leaderModal.addEventListener('click', function (e) {
  if (e.target === this) closeLeaderModal();
});

window.editLeader = function editLeader(i) {
  openLeaderModal(i);
};

window.leaderForm.onsubmit = async (e) => {
  e.preventDefault();
  const idx = parseInt(document.getElementById('leader-edit-index').value, 10);
  if (isNaN(idx)) { closeLeaderModal(); return; }
  const current = window.leaders[idx];
  const updated = {
    ...current,
    leader: document.getElementById('leader-name').value.trim(),
    staticId: document.getElementById('leader-static').value.trim(),
    term: document.getElementById('leader-term').value.trim(),
    time: document.getElementById('leader-time').value
  };
  window.leaders[idx] = updated;
  if (updated.dbId != null) {
    try {
      const res = await fetch(`/api/leaders/${updated.dbId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error('Failed to save leader');
      window.leaders[idx] = await res.json();
    } catch (err) {
      console.error(err);
      alert('Не удалось сохранить лидера.');
    }
  }
  closeLeaderModal();
  window.renderLeaders();
};

