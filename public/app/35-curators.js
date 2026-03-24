// Curators: участники с основной ролью на основном сервере (настройки Discord).

function renderCurateCell(c) {
  const factions = Array.isArray(c.factions) ? c.factions : [];
  const pills = factions.map((f) => {
    const key = String(f.key || '').replace(/[^a-z]/g, '') || 'unknown';
    return `<span class="curator-faction-pill curator-faction-pill--${key}">${window.escapeHtml(f.label || '')}</span>`;
  }).join('');
  const note = String(c.curate || '').trim();
  const noteHtml = note
    ? `<span class="curator-curate-note">${window.escapeHtml(note)}</span>`
    : '';
  if (!pills && !note) return '—';
  const gap = pills && note ? ' ' : '';
  return `<div class="curator-curate-cell">${pills}${gap}${noteHtml}</div>`;
}

window.renderCurators = function renderCurators() {
  const warn = window.curatorsWarning;
  const rows = window.curatorsList || [];
  const list = rows.map((c, i) => `
        <tr>
            <td>${window.escapeHtml(c.nickname || '—')}</td>
            <td>${window.escapeHtml(c.lvl || '—')}</td>
            <td><span class="id-tag">#${window.escapeHtml(c.discordId)}</span></td>
            <td>${renderCurateCell(c)}</td>
            <td class="cell-actions">
                <button type="button" class="btn-icon" onclick="editCurator(${i})" title="Редактировать"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg></button>
                <button type="button" class="btn-icon btn-icon-delete" onclick="deleteCurator(${i})" title="Удалить"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg></button>
            </td>
        </tr>`).join('');

  const warnBlock = warn
    ? `<div class="curators-page-warning">${window.escapeHtml(warn)}</div>`
    : '';

  window.setPageContent(`
        <div class="curators-panel">
            ${warnBlock}
            <div class="table-container table-families">
                <table class="data-table data-table-families">
                    <thead>
                        <tr>
                            <th>Nickname</th>
                            <th>LVL</th>
                            <th>Discord ID</th>
                            <th>Curate</th>
                            <th style="text-align:right">Действие</th>
                        </tr>
                    </thead>
                    <tbody>${list || '<tr><td colspan="5" style="opacity:0.6">Нет участников с основной ролью.</td></tr>'}</tbody>
                </table>
            </div>
        </div>`);
};

function closeCuratorModal() {
  document.getElementById('curator-modal-overlay')?.classList.remove('is-open');
}

window.editCurator = function editCurator(i) {
  const c = (window.curatorsList || [])[i];
  if (!c) return;
  document.getElementById('curator-discord-id').value = c.discordId;
  const idDisp = document.getElementById('curator-discord-id-display');
  if (idDisp) idDisp.value = c.discordId;
  document.getElementById('curator-nickname').value = c.nickname || '';
  document.getElementById('curator-lvl').value = c.lvl || '';
  const facWrap = document.getElementById('curator-factions-wrap');
  const facEl = document.getElementById('curator-factions-readonly');
  const factions = Array.isArray(c.factions) ? c.factions : [];
  if (facWrap && facEl) {
    if (factions.length) {
      facEl.innerHTML = factions.map((f) => {
        const key = String(f.key || '').replace(/[^a-z]/g, '') || 'unknown';
        return `<span class="curator-faction-pill curator-faction-pill--${key}">${window.escapeHtml(f.label || '')}</span>`;
      }).join(' ');
      facWrap.style.display = 'block';
    } else {
      facEl.innerHTML = '';
      facWrap.style.display = 'none';
    }
  }
  document.getElementById('curator-modal-title').textContent = 'Редактировать куратора';
  document.getElementById('curator-modal-overlay')?.classList.add('is-open');
};

window.deleteCurator = function deleteCurator(i) {
  const c = (window.curatorsList || [])[i];
  if (!c) return;
  const name = c.nickname || c.discordId;
  window.openConfirm({
    title: 'Удалить куратора',
    message: `Снять основную роль с «${name}» и удалить сохранённые поля (LVL)?`,
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/curators/${encodeURIComponent(c.discordId)}`, { method: 'DELETE' });
        if (!res.ok) {
          let msg = 'Не удалось удалить';
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch (_) { /* ignore */ }
          throw new Error(msg);
        }
        if (typeof window.showToast === 'function') window.showToast('Куратор удалён (роль снята).', 'success');
        await window.loadCurators();
        window.renderCurators();
      } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message || 'Ошибка', 'error');
        else alert(err.message || 'Ошибка');
      }
    }
  });
};

const curatorModalOverlay = document.getElementById('curator-modal-overlay');
curatorModalOverlay?.addEventListener('click', (e) => {
  if (e.target === curatorModalOverlay) closeCuratorModal();
});

document.getElementById('curator-modal-cancel')?.addEventListener('click', closeCuratorModal);

document.getElementById('curator-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const discordId = String(document.getElementById('curator-discord-id')?.value || '').trim();
  const nickname = String(document.getElementById('curator-nickname')?.value || '').trim();
  const lvl = String(document.getElementById('curator-lvl')?.value || '').trim();
  if (!discordId) return;
  try {
    const res = await fetch(`/api/curators/${encodeURIComponent(discordId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, lvl })
    });
    if (!res.ok) {
      let msg = 'Не удалось сохранить';
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch (_) { /* ignore */ }
      throw new Error(msg);
    }
    closeCuratorModal();
    await window.loadCurators();
    window.renderCurators();
    if (typeof window.showToast === 'function') window.showToast('Сохранено.', 'success');
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast(err.message || 'Ошибка', 'error');
    else alert(err.message || 'Ошибка');
  }
});
