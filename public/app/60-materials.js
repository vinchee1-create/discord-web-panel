// Materials (family + faction) section.

const materialsModal = document.getElementById('materials-modal-overlay');
const materialsForm = document.getElementById('materials-form');
const matDeleteBtn = document.getElementById('mat-delete-btn');
const matIssuedBtn = document.getElementById('mat-issued-btn');
const matPairsRoot = document.getElementById('mat-pairs');
const materialsViewModal = document.getElementById('materials-view-overlay');
const materialsViewTitle = document.getElementById('materials-view-title');
const materialsViewBody = document.getElementById('materials-view-body');

const factionMaterialsModal = document.getElementById('faction-materials-modal-overlay');
const factionMaterialsForm = document.getElementById('faction-materials-form');
const fmatDeleteBtn = document.getElementById('fmat-delete-btn');
const fmatIssuedBtn = document.getElementById('fmat-issued-btn');
const fmatPairsRoot = document.getElementById('fmat-pairs');
const fmatFactionList = document.getElementById('fmat-faction-list');
const factionMaterialsViewModal = document.getElementById('faction-materials-view-overlay');
const factionMaterialsViewTitle = document.getElementById('faction-materials-view-title');
const factionMaterialsViewBody = document.getElementById('faction-materials-view-body');

function renderMatPairs(pairs) {
  if (!matPairsRoot) return;

  const safe = Array.isArray(pairs) ? pairs : [];
  const initialRows = safe.length ? safe : [{ family: '', resources: '' }];

  matPairsRoot.innerHTML = '';

  const createRow = (familyValue = '', resourcesValue = '') => {
    const rowEl = document.createElement('div');
    rowEl.className = 'form-row-2-inputs mat-pair-row';
    rowEl.innerHTML = `
            <div class="form-row-item">
                <input list="mat-family-list" class="row-input mat-family-input" placeholder="Выберите семью или введите свою" />
            </div>
            <div class="form-row-item">
                <input type="text" class="row-input mat-resources-input" placeholder="Например: 3 аптечки, броня" />
            </div>
        `;
    const famEl = rowEl.querySelector('.mat-family-input');
    const resEl = rowEl.querySelector('.mat-resources-input');
    if (famEl) famEl.value = familyValue || '';
    if (resEl) resEl.value = resourcesValue || '';

    const ensureEmptyRow = () => {
      const rows = Array.from(matPairsRoot.querySelectorAll('.mat-pair-row'));
      const last = rows[rows.length - 1];
      if (!last) return;
      const lf = last.querySelector('.mat-family-input')?.value.trim() || '';
      const lr = last.querySelector('.mat-resources-input')?.value.trim() || '';
      if (lf || lr) {
        matPairsRoot.appendChild(createRow('', ''));
      }
    };

    const onInput = () => ensureEmptyRow();
    famEl?.addEventListener('input', onInput);
    resEl?.addEventListener('input', onInput);

    return rowEl;
  };

  initialRows.forEach(r => {
    matPairsRoot.appendChild(createRow(r?.family || '', r?.resources || ''));
  });
  // пустая строка внизу
  matPairsRoot.appendChild(createRow('', ''));
}

function renderFmatPairs(pairs) {
  if (!fmatPairsRoot) return;

  const safe = Array.isArray(pairs) ? pairs : [];
  const initialRows = safe.length ? safe : [{ faction: '', resources: '' }];

  fmatPairsRoot.innerHTML = '';

  const createRow = (factionValue = '', resourcesValue = '') => {
    const rowEl = document.createElement('div');
    rowEl.className = 'form-row-2-inputs mat-pair-row';
    rowEl.innerHTML = `
            <div class="form-row-item">
                <input list="fmat-faction-list" class="row-input fmat-faction-input" placeholder="Выберите фракцию или введите свою" />
            </div>
            <div class="form-row-item">
                <input type="text" class="row-input fmat-resources-input" placeholder="Например: 10000 технических материалов" />
            </div>
        `;
    const facEl = rowEl.querySelector('.fmat-faction-input');
    const resEl = rowEl.querySelector('.fmat-resources-input');
    if (facEl) facEl.value = factionValue || '';
    if (resEl) resEl.value = resourcesValue || '';

    const ensureEmptyRow = () => {
      const rows = Array.from(fmatPairsRoot.querySelectorAll('.mat-pair-row'));
      const last = rows[rows.length - 1];
      if (!last) return;
      const lf = last.querySelector('.fmat-faction-input')?.value.trim() || '';
      const lr = last.querySelector('.fmat-resources-input')?.value.trim() || '';
      if (lf || lr) {
        fmatPairsRoot.appendChild(createRow('', ''));
      }
    };

    const onInput = () => ensureEmptyRow();
    facEl?.addEventListener('input', onInput);
    resEl?.addEventListener('input', onInput);

    return rowEl;
  };

  initialRows.forEach(r => {
    fmatPairsRoot.appendChild(createRow(r?.faction || '', r?.resources || ''));
  });
  fmatPairsRoot.appendChild(createRow('', ''));
}

window.openMaterialsModal = function openMaterialsModal(index = -1) {
  window.editingMaterialIndex = typeof index === 'number' ? index : -1;
  const titleEl = document.getElementById('mat-title');
  const familyList = document.getElementById('mat-family-list');
  const heading = materialsModal.querySelector('h2');

  // заполнение списка семей для выбора
  if (familyList) {
    familyList.innerHTML = window.families.map(f => {
      return `<option value="${window.escapeHtml(f.name)}"></option>`;
    }).join('');
  }

  if (window.editingMaterialIndex >= 0 && window.familyMaterials[window.editingMaterialIndex]) {
    const item = window.familyMaterials[window.editingMaterialIndex];
    titleEl.value = item.title || '';
    let pairs = item.pairs;
    if (!pairs) {
      try {
        const parsed = JSON.parse(item.resources || '[]');
        pairs = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        pairs = [];
      }
    }
    renderMatPairs(pairs);
    heading.textContent = 'Редактировать выдачу';
    if (matDeleteBtn) matDeleteBtn.style.display = 'inline-flex';
    if (matIssuedBtn) matIssuedBtn.style.display = 'inline-flex';
  } else {
    titleEl.value = '';
    renderMatPairs([]);
    heading.textContent = 'Добавить выдачу';
    if (matDeleteBtn) matDeleteBtn.style.display = 'none';
    if (matIssuedBtn) matIssuedBtn.style.display = 'none';
  }
  materialsModal.classList.add('is-open');
};

window.openFactionMaterialsModal = function openFactionMaterialsModal(index = -1) {
  window.editingFactionMaterialIndex = typeof index === 'number' ? index : -1;
  const titleEl = document.getElementById('fmat-title');
  const heading = factionMaterialsModal.querySelector('h2');

  // список фракций из лидеров
  if (fmatFactionList) {
    fmatFactionList.innerHTML = window.leaders.map(L => `<option value="${window.escapeHtml(L.faction)}"></option>`).join('');
  }

  if (window.editingFactionMaterialIndex >= 0 && window.factionMaterials[window.editingFactionMaterialIndex]) {
    const item = window.factionMaterials[window.editingFactionMaterialIndex];
    titleEl.value = item.title || '';
    let pairs = item.pairs;
    if (!pairs) {
      try {
        const parsed = JSON.parse(item.resources || '[]');
        pairs = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        pairs = [];
      }
    }
    // нормализуем к { faction, resources }
    const norm = (pairs || []).map(p => ({
      faction: p.faction || p.family || '',
      resources: p.resources || ''
    }));
    renderFmatPairs(norm);
    heading.textContent = 'Редактировать выдачу';
    if (fmatDeleteBtn) fmatDeleteBtn.style.display = 'inline-flex';
    if (fmatIssuedBtn) fmatIssuedBtn.style.display = 'inline-flex';
  } else {
    titleEl.value = '';
    renderFmatPairs([]);
    heading.textContent = 'Добавить выдачу';
    if (fmatDeleteBtn) fmatDeleteBtn.style.display = 'none';
    if (fmatIssuedBtn) fmatIssuedBtn.style.display = 'none';
  }
  factionMaterialsModal.classList.add('is-open');
};

window.closeFactionMaterialsModal = function closeFactionMaterialsModal() {
  factionMaterialsModal.classList.remove('is-open');
  window.editingFactionMaterialIndex = -1;
};

function closeMaterialsModal() {
  materialsModal.classList.remove('is-open');
  window.editingMaterialIndex = -1;
}

materialsModal.addEventListener('click', (e) => {
  if (e.target === materialsModal) closeMaterialsModal();
});
materialsViewModal.addEventListener('click', (e) => {
  if (e.target === materialsViewModal) {
    materialsViewModal.classList.remove('is-open');
  }
});
factionMaterialsModal.addEventListener('click', (e) => {
  if (e.target === factionMaterialsModal) window.closeFactionMaterialsModal();
});
factionMaterialsViewModal.addEventListener('click', (e) => {
  if (e.target === factionMaterialsViewModal) {
    factionMaterialsViewModal.classList.remove('is-open');
  }
});

materialsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('mat-title').value.trim();
  if (!title) {
    window.showToast('Заполните заголовок или данные по семье/ресурсам.', 'error');
    return;
  }
  const pairs = [];
  document.querySelectorAll('.mat-pair-row').forEach(row => {
    const fam = row.querySelector('.mat-family-input')?.value.trim() || '';
    const res = row.querySelector('.mat-resources-input')?.value.trim() || '';
    if (fam || res) {
      pairs.push({ family: fam, resources: res });
    }
  });
  if (!pairs.length) {
    window.showToast('Заполните хотя бы одну строку "Семья / Ресурсы".', 'error');
    return;
  }
  (async () => {
    try {
      if (window.editingMaterialIndex >= 0 && window.familyMaterials[window.editingMaterialIndex]) {
        const item = window.familyMaterials[window.editingMaterialIndex];
        if (item.dbId != null) {
          const res = await fetch(`/api/family-materials/${item.dbId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              content: '',
              issued: !!item.issued,
              familyName: pairs[0]?.family || '',
              resources: JSON.stringify(pairs)
            })
          });
          if (!res.ok) throw new Error((await res.json()).error || 'error');
          const updated = await res.json();
          window.familyMaterials[window.editingMaterialIndex] = {
            ...updated,
            pairs
          };
        } else {
          window.familyMaterials[window.editingMaterialIndex] = {
            ...item,
            title,
            content: '',
            familyName: pairs[0]?.family || '',
            resources: JSON.stringify(pairs),
            pairs
          };
        }
      } else {
        const res = await fetch('/api/family-materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content: '',
            familyName: pairs[0]?.family || '',
            resources: JSON.stringify(pairs)
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        const created = await res.json();
        window.familyMaterials.push({ ...created, pairs });
      }
      closeMaterialsModal();
      window.renderFamilyMaterials();
    } catch (err) {
      console.error(err);
      window.showToast('Не удалось сохранить материал.', 'error');
    }
  })();
});

factionMaterialsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('fmat-title').value.trim();
  if (!title) {
    window.showToast('Заполните заголовок.', 'error');
    return;
  }
  const pairs = [];
  document.querySelectorAll('#fmat-pairs .mat-pair-row').forEach(row => {
    const fac = row.querySelector('.fmat-faction-input')?.value.trim() || '';
    const res = row.querySelector('.fmat-resources-input')?.value.trim() || '';
    if (fac || res) pairs.push({ faction: fac, resources: res });
  });
  if (!pairs.length) {
    window.showToast('Заполните хотя бы одну строку "Фракция / Ресурсы".', 'error');
    return;
  }
  (async () => {
    try {
      if (window.editingFactionMaterialIndex >= 0 && window.factionMaterials[window.editingFactionMaterialIndex]) {
        const item = window.factionMaterials[window.editingFactionMaterialIndex];
        if (item.dbId != null) {
          const res = await fetch(`/api/faction-materials/${item.dbId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              content: '',
              issued: !!item.issued,
              factionName: pairs[0]?.faction || '',
              resources: JSON.stringify(pairs)
            })
          });
          if (!res.ok) throw new Error((await res.json()).error || 'error');
          const updated = await res.json();
          window.factionMaterials[window.editingFactionMaterialIndex] = { ...updated, pairs };
        } else {
          window.factionMaterials[window.editingFactionMaterialIndex] = {
            ...item,
            title,
            content: '',
            factionName: pairs[0]?.faction || '',
            resources: JSON.stringify(pairs),
            pairs
          };
        }
      } else {
        const res = await fetch('/api/faction-materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content: '',
            factionName: pairs[0]?.faction || '',
            resources: JSON.stringify(pairs)
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        const created = await res.json();
        window.factionMaterials.push({ ...created, pairs });
      }
      window.closeFactionMaterialsModal();
      window.renderFactionMaterials();
    } catch (err) {
      console.error(err);
      window.showToast('Не удалось сохранить выдачу.', 'error');
    }
  })();
});

window.renderFamilyMaterials = function renderFamilyMaterials() {
  const sorted = window.familyMaterials
    .map((item, idx) => ({ ...item, _idx: idx }))
    .sort((a, b) => {
      // невыполненные (pending) всегда выше выданных (issued)
      if (a.issued === b.issued) return a._idx - b._idx;
      return a.issued ? 1 : -1;
    });

  const cards = sorted.map((item) => {
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }
    const created = new Date(item.createdAt);
    const timeLabel = isNaN(created.getTime())
      ? ''
      : created.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    const safeTitle = window.escapeHtml(item.title || 'Без названия');
    let pairs = item.pairs;
    if (!pairs) {
      try {
        const parsed = JSON.parse(item.resources || '[]');
        if (Array.isArray(parsed)) {
          pairs = parsed;
        }
      } catch (_) {
        pairs = [];
      }
    }
    if (!Array.isArray(pairs)) pairs = [];
    const pairsHtml = pairs.map(p => {
      const fam = window.escapeHtml(p.family || '');
      const res = window.escapeHtml(p.resources || '');
      if (fam && res) return `<div class="materials-card-meta-line">${fam} - ${res}</div>`;
      if (fam) return `<div class="materials-card-meta-line">${fam}</div>`;
      if (res) return `<div class="materials-card-meta-line">${res}</div>`;
      return '';
    }).join('');
    return `
        <div class="materials-card ${item.issued ? 'issued' : 'pending'}" onclick="openMaterialsView(${item._idx})">
            <div class="materials-card-header">
                <div class="materials-card-header-main">
                    <div class="materials-card-title">${safeTitle}</div>
                </div>
                <div class="materials-card-time">${timeLabel}</div>
            </div>
            ${pairsHtml ? `<div class="materials-card-meta" style="margin-top:6px;font-size:12px;color:rgba(255,255,255,0.8);">${pairsHtml}</div>` : ''}
            <div style="margin-top:8px; display:flex; justify-content:flex-end;">
                <button type="button" class="materials-edit-btn" onclick="event.stopPropagation(); openMaterialsModal(${item._idx});" title="Редактировать выдачу">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
                </button>
            </div>
        </div>`;
  }).join('');
  window.setPageContent(`
        <div class="materials-page">
            <div class="materials-grid">
                ${cards || '<div style="color:rgba(255,255,255,0.5);font-size:13px;">Пока нет материалов.</div>'}
            </div>
        </div>
    `);
  window.updateFamilyMaterialsBadge();
};

window.renderFactionMaterials = function renderFactionMaterials() {
  const sorted = window.factionMaterials
    .map((item, idx) => ({ ...item, _idx: idx }))
    .sort((a, b) => {
      if (a.issued === b.issued) return a._idx - b._idx;
      return a.issued ? 1 : -1;
    });

  const cards = sorted.map((item) => {
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    const created = new Date(item.createdAt);
    const timeLabel = isNaN(created.getTime())
      ? ''
      : created.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    const safeTitle = window.escapeHtml(item.title || 'Без названия');

    let pairs = item.pairs;
    if (!pairs) {
      try {
        const parsed = JSON.parse(item.resources || '[]');
        pairs = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        pairs = [];
      }
    }
    if (!Array.isArray(pairs)) pairs = [];
    const pairsHtml = pairs.map(p => {
      const fac = window.escapeHtml((p.faction || p.family || '').trim());
      const res = window.escapeHtml((p.resources || '').trim());
      if (fac && res) return `<div class="materials-card-meta-line">${fac} - ${res}</div>`;
      if (fac) return `<div class="materials-card-meta-line">${fac}</div>`;
      if (res) return `<div class="materials-card-meta-line">${res}</div>`;
      return '';
    }).join('');

    return `
        <div class="materials-card ${item.issued ? 'issued' : 'pending'}" onclick="openFactionMaterialsView(${item._idx})">
            <div class="materials-card-header">
                <div class="materials-card-header-main">
                    <div class="materials-card-title">${safeTitle}</div>
                </div>
                <div class="materials-card-time">${timeLabel}</div>
            </div>
            ${pairsHtml ? `<div class="materials-card-meta" style="margin-top:6px;font-size:12px;color:rgba(255,255,255,0.8);">${pairsHtml}</div>` : ''}
            <div style="margin-top:8px; display:flex; justify-content:flex-end;">
                <button type="button" class="materials-edit-btn" onclick="event.stopPropagation(); openFactionMaterialsModal(${item._idx});" title="Редактировать выдачу">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
                </button>
            </div>
        </div>`;
  }).join('');

  window.setPageContent(`
        <div class="materials-page">
            <div class="materials-grid">
                ${cards || '<div style="color:rgba(255,255,255,0.5);font-size:13px;">Пока нет материалов.</div>'}
            </div>
        </div>
    `);
  window.updateFactionMaterialsBadge();
};

window.openMaterialsView = function openMaterialsView(index) {
  const item = window.familyMaterials[index];
  if (!item || !materialsViewModal) return;
  const title = item.title || 'Выдача';
  let pairs = item.pairs;
  if (!pairs) {
    try {
      const parsed = JSON.parse(item.resources || '[]');
      pairs = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      pairs = [];
    }
  }
  if (!Array.isArray(pairs)) pairs = [];
  materialsViewTitle.textContent = title;
  const rowsHtml = pairs
    .map(p => {
      const fam = (p.family || '').trim();
      const res = (p.resources || '').trim();
      if (!fam && !res) return '';

      // ищем id семьи по названию
      let famId = '?';
      const lowerFam = fam.toLowerCase();
      const found = window.families.find(f => (f.name || '').toLowerCase() === lowerFam);
      if (found && found.id) famId = found.id;

      // определяем цвет по типу ресурса
      const lowerRes = res.toLowerCase();
      let color = 'green';
      if (lowerRes.includes('тех')) color = 'blue';
      else if (lowerRes.includes('мед')) color = 'red';
      else if (lowerRes.includes('оруж')) color = 'green';

      // число из строки ресурсов
      const m = lowerRes.match(/\d+/);
      const amount = m ? m[0] : '0';

      const textPart = fam && res ? `${fam} - ${res}` : (fam || res);

      let cmdHtml = '';
      if (lowerRes.includes('материал')) {
        const cmd = `/setfammaterials ${famId} ${color} ${amount}`;
        cmdHtml = `<div class="materials-view-cmd">${window.escapeHtml(cmd)}</div>`;
      }

      return `<div class="materials-view-row">
                <div class="materials-view-text">${window.escapeHtml(textPart)}</div>
                ${cmdHtml}
            </div>`;
    })
    .filter(Boolean)
    .join('');

  materialsViewBody.innerHTML = rowsHtml || '<div class="materials-view-text" style="opacity:0.7;">Нет данных для отображения.</div>';
  materialsViewModal.classList.add('is-open');
};

window.openFactionMaterialsView = async function openFactionMaterialsView(index) {
  const item = window.factionMaterials[index];
  if (!item || !factionMaterialsViewModal) return;
  if (!window.leaders || !window.leaders.length) {
    try { await window.loadLeaders(); } catch (_) {}
  }
  const title = item.title || 'Выдача';
  let pairs = item.pairs;
  if (!pairs) {
    try {
      const parsed = JSON.parse(item.resources || '[]');
      pairs = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      pairs = [];
    }
  }
  if (!Array.isArray(pairs)) pairs = [];
  factionMaterialsViewTitle.textContent = title;

  const rowsHtml = pairs
    .map(p => {
      const fac = (p.faction || p.family || '').trim();
      const res = (p.resources || '').trim();
      if (!fac && !res) return '';

      // idfrac берём из лидеров по названию фракции (display id)
      let fracId = '?';
      const lowerFac = fac.toLowerCase();
      const found = window.leaders.find(L => (L.faction || '').toLowerCase() === lowerFac);
      if (found && found.id != null) fracId = String(found.id);

      const lowerRes = res.toLowerCase();
      let color = 'green';
      if (lowerRes.includes('тех')) color = 'blue';
      else if (lowerRes.includes('мед')) color = 'red';
      else if (lowerRes.includes('оруж')) color = 'green';

      const m = lowerRes.match(/\d+/);
      const amount = m ? m[0] : '0';

      const textPart = fac && res ? `${fac} - ${res}` : (fac || res);

      let cmdHtml = '';
      if (lowerRes.includes('материал')) {
        const cmd = `/setmaterials ${fracId} ${color} ${amount}`;
        cmdHtml = `<div class="materials-view-cmd">${window.escapeHtml(cmd)}</div>`;
      }

      return `<div class="materials-view-row">
                <div class="materials-view-text">${window.escapeHtml(textPart)}</div>
                ${cmdHtml}
            </div>`;
    })
    .filter(Boolean)
    .join('');

  factionMaterialsViewBody.innerHTML = rowsHtml || '<div class="materials-view-text" style="opacity:0.7;">Нет данных для отображения.</div>';
  factionMaterialsViewModal.classList.add('is-open');
};

window.deleteCurrentMaterial = function deleteCurrentMaterial() {
  if (window.editingMaterialIndex < 0 || !window.familyMaterials[window.editingMaterialIndex]) return;
  const idx = window.editingMaterialIndex;
  (async () => {
    const item = window.familyMaterials[idx];
    try {
      if (item && item.dbId != null) {
        const res = await fetch(`/api/family-materials/${item.dbId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
      }
      closeMaterialsModal();
      window.familyMaterials.splice(idx, 1);
      window.renderFamilyMaterials();
    } catch (e) {
      console.error(e);
      window.showToast('Не удалось удалить материал.', 'error');
    }
  })();
};

window.deleteCurrentFactionMaterial = function deleteCurrentFactionMaterial() {
  if (window.editingFactionMaterialIndex < 0 || !window.factionMaterials[window.editingFactionMaterialIndex]) return;
  const idx = window.editingFactionMaterialIndex;
  (async () => {
    const item = window.factionMaterials[idx];
    try {
      if (item && item.dbId != null) {
        const res = await fetch(`/api/faction-materials/${item.dbId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
      }
      window.closeFactionMaterialsModal();
      window.factionMaterials.splice(idx, 1);
      window.renderFactionMaterials();
    } catch (e) {
      console.error(e);
      window.showToast('Не удалось удалить материал.', 'error');
    }
  })();
};

window.markFactionMaterialIssued = function markFactionMaterialIssued() {
  if (window.editingFactionMaterialIndex < 0 || !window.factionMaterials[window.editingFactionMaterialIndex]) return;
  (async () => {
    const item = window.factionMaterials[window.editingFactionMaterialIndex];
    const newIssued = !item.issued;
    try {
      if (item.dbId != null) {
        const res = await fetch(`/api/faction-materials/${item.dbId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            content: '',
            issued: newIssued,
            factionName: item.factionName || '',
            resources: item.resources || ''
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        const updated = await res.json();
        window.factionMaterials[window.editingFactionMaterialIndex] = updated;
      } else {
        window.factionMaterials[window.editingFactionMaterialIndex].issued = newIssued;
      }
      window.closeFactionMaterialsModal();
      window.renderFactionMaterials();
    } catch (e) {
      console.error(e);
      window.showToast('Не удалось изменить статус выдачи.', 'error');
    }
  })();
};

window.markMaterialIssued = function markMaterialIssued() {
  if (window.editingMaterialIndex < 0 || !window.familyMaterials[window.editingMaterialIndex]) return;
  (async () => {
    const item = window.familyMaterials[window.editingMaterialIndex];
    const newIssued = !item.issued;
    try {
      if (item.dbId != null) {
        const res = await fetch(`/api/family-materials/${item.dbId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            content: '',
            issued: newIssued,
            familyName: item.familyName,
            resources: item.resources
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        const updated = await res.json();
        window.familyMaterials[window.editingMaterialIndex] = updated;
      } else {
        window.familyMaterials[window.editingMaterialIndex].issued = newIssued;
      }
      closeMaterialsModal();
      window.renderFamilyMaterials();
    } catch (e) {
      console.error(e);
      window.showToast('Не удалось изменить статус выдачи.', 'error');
    }
  })();
};

if (matDeleteBtn) {
  matDeleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.deleteCurrentMaterial();
  });
}
if (matIssuedBtn) {
  matIssuedBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.markMaterialIssued();
  });
}

if (fmatDeleteBtn) {
  fmatDeleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.deleteCurrentFactionMaterial();
  });
}
if (fmatIssuedBtn) {
  fmatIssuedBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.markFactionMaterialIssued();
  });
}

