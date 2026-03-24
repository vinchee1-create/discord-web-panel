// Families section + confirm modal.

window.renderFamilies = function renderFamilies() {
  const list = window.families.map((f, i) => {
    const dbId = f.dbId != null ? f.dbId : '';
    return `
        <tr>
            <td>${window.escapeHtml(f.name)}</td>
            <td><span class="id-tag">#${window.escapeHtml(f.id)}</span></td>
            <td>${window.escapeHtml(f.leader || '—')}</td>
            <td>${window.escapeHtml(f.discord || '—')}</td>
            <td class="cell-actions">
                <button type="button" class="btn-icon" onclick="editFamily(${i})" title="Редактировать"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg></button>
                <button type="button" class="btn-icon btn-icon-delete" onclick="deleteFamily(${i})" title="Удалить"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg></button>
            </td>
        </tr>`;
  }).join('');
  window.setPageContent(`
        <div class="workspace-panel workspace-panel--flush">
            <div class="table-container table-families">
                <table class="data-table data-table-families">
                    <thead>
                        <tr>
                            <th>Семья</th>
                            <th>ID</th>
                            <th>Лидер</th>
                            <th>Discord ID</th>
                            <th style="text-align:right">Действие</th>
                        </tr>
                    </thead>
                    <tbody>${list}</tbody>
                </table>
            </div>
        </div>`);
};

// Family modal
window.openModal = function openModal() {
  document.getElementById('family-form').reset();
  document.getElementById('edit-index').value = "";
  document.getElementById('modal-title').textContent = "Добавить семью";
  document.getElementById('modal-overlay').classList.add('is-open');
};
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('is-open');
}
document.getElementById('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

window.editFamily = function editFamily(i) {
  const f = window.families[i];
  document.getElementById('fam-name').value = f.name;
  document.getElementById('fam-id').value = f.id;
  document.getElementById('fam-leader').value = f.leader || '';
  document.getElementById('fam-discord').value = f.discord || '';
  document.getElementById('edit-index').value = i;
  document.getElementById('modal-title').textContent = "Редактировать семью";
  document.getElementById('modal-overlay').classList.add('is-open');
};

// Confirm modal
const confirmModal = document.getElementById('confirm-modal-overlay');
const confirmTitleEl = document.getElementById('confirm-title');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');
let confirmCallback = null;

window.openConfirm = function openConfirm(options) {
  const { title, message, onConfirm } = options || {};
  confirmTitleEl.textContent = title || 'Подтверждение';
  confirmMessageEl.textContent = message || 'Вы уверены, что хотите выполнить это действие?';
  confirmCallback = typeof onConfirm === 'function' ? onConfirm : null;
  confirmModal.classList.add('is-open');
};
function closeConfirm() {
  confirmModal.classList.remove('is-open');
  confirmCallback = null;
}
confirmCancelBtn.addEventListener('click', closeConfirm);
confirmOkBtn.addEventListener('click', () => {
  const cb = confirmCallback;
  closeConfirm();
  if (cb) cb();
});
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) closeConfirm();
});

window.deleteFamily = async function deleteFamily(i) {
  const doDelete = async () => {
    const f = window.families[i];
    if (!f) return;
    if (f.dbId != null) {
      try {
        const res = await fetch(`/api/families/${f.dbId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
      } catch (e) {
        console.error(e);
        alert('Не удалось удалить запись.');
        return;
      }
    }
    window.families.splice(i, 1);
    window.renderFamilies();
  };
  window.openConfirm({
    title: 'Удалить семью',
    message: 'Вы уверены, что хотите удалить эту семью?',
    onConfirm: doDelete
  });
};

document.getElementById('family-form').onsubmit = async (e) => {
  e.preventDefault();
  const editIndex = document.getElementById('edit-index').value;
  const data = {
    name: document.getElementById('fam-name').value.trim(),
    id: document.getElementById('fam-id').value.trim(),
    leader: document.getElementById('fam-leader').value.trim(),
    discord: document.getElementById('fam-discord').value.trim()
  };
  if (data.name === '' || data.id === '') {
    window.showToast('Заполните название и ID семьи.', 'error');
    return;
  }
  const lowerName = data.name.toLowerCase();
  const lowerId = data.id.toLowerCase();
  const editIdxNum = editIndex === '' ? -1 : parseInt(editIndex, 10);
  let nameExists = false;
  let idExists = false;
  window.families.forEach((f, idx) => {
    if (idx === editIdxNum) return false;
    if (f.name && f.name.toLowerCase() === lowerName) nameExists = true;
    if (f.id && String(f.id).toLowerCase() === lowerId) idExists = true;
  });
  if (nameExists || idExists) {
    if (nameExists) window.showToast('Семья с таким названием уже существует.', 'error');
    if (idExists) window.showToast('Семья с таким ID уже существует.', 'error');
    return;
  }
  if (editIndex === '') {
    try {
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      const created = await res.json();
      window.families.push(created);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить семью: ' + err.message);
      return;
    }
  } else {
    const idx = parseInt(editIndex, 10);
    const f = window.families[idx];
    if (f.dbId == null) {
      window.families[idx] = { ...f, ...data };
    } else {
      try {
        const res = await fetch(`/api/families/${f.dbId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).error || res.statusText);
        const updated = await res.json();
        window.families[idx] = updated;
      } catch (err) {
        console.error(err);
        alert('Не удалось сохранить изменения: ' + err.message);
        return;
      }
    }
  }
  closeModal();
  window.renderFamilies();
};

