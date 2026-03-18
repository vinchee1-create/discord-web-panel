// Events: persistence + calendar interactions + recurring events.

window.events = []; // stored events loaded from DB for current month range
window.eventsSelectedDate = null; // YYYY-MM-DD
window.eventsEditingId = null; // dbId | null

function pad2(n) { return String(n).padStart(2, '0'); }
function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonthISO(year, monthIndex) {
  return `${year}-${pad2(monthIndex + 1)}-01`;
}
function endOfMonthISO(year, monthIndex) {
  const d = new Date(year, monthIndex + 1, 0);
  return toISODateLocal(d);
}

function getSystemEventsForDate(isoDate) {
  // isoDate is YYYY-MM-DD, interpret as local calendar day
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m - 1), d);
  const day = dt.getDay(); // 0 Sun, 1 Mon, 2 Tue, 4 Thu
  const res = [];
  if (day === 1) res.push({ kind: 'system', title: 'ВЗЗ', description: '', date: isoDate });
  if (day === 2 || day === 4) res.push({ kind: 'system', title: 'ВЗМ', description: '', date: isoDate });
  return res;
}

function getEventsForDate(isoDate) {
  const dbEvents = (window.events || []).filter(e => e.date === isoDate).map(e => ({ ...e, kind: 'db' }));
  const sysEvents = getSystemEventsForDate(isoDate);
  return [...sysEvents, ...dbEvents];
}

window.loadEventsForMonth = async function loadEventsForMonth(year, monthIndex) {
  const from = startOfMonthISO(year, monthIndex);
  const to = endOfMonthISO(year, monthIndex);
  try {
    const res = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!res.ok) throw new Error((await res.json()).error || 'error');
    const data = await res.json();
    window.events = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('loadEventsForMonth:', e);
    window.events = [];
  }
};

function renderDayChips(isoDate) {
  const all = getEventsForDate(isoDate);
  if (!all.length) return '';
  const shown = all.slice(0, 2);
  const chips = shown.map(ev => {
    const cls = ev.kind === 'system' ? 'events-day-chip system' : 'events-day-chip';
    return `<div class="${cls}" title="${window.escapeHtml(ev.title)}">${window.escapeHtml(ev.title)}</div>`;
  }).join('');
  const more = all.length > 2 ? `<div class="events-day-chip" title="Ещё">${all.length - 2}+</div>` : '';
  return chips + more;
}

function updateCalendarCells() {
  const year = window.eventsMonth.year;
  const month = window.eventsMonth.month;
  document.querySelectorAll('.events-day[data-date]').forEach(cell => {
    const iso = cell.getAttribute('data-date');
    const body = cell.querySelector('.events-day-body');
    if (body && !cell.classList.contains('is-expanded')) body.innerHTML = renderDayChips(iso);
    // today marker
    const now = new Date();
    const todayIso = toISODateLocal(now);
    cell.classList.toggle('is-today', iso === todayIso);
  });
}

let expandedCell = null;
let expandedIso = null;

function fmtDateCenter(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

function editIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
}

function trashIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>`;
}

function renderExpanded(cell, isoDate) {
  const items = getEventsForDate(isoDate);
  const listHtml = items.length ? items.map(ev => {
    const isSystem = ev.kind === 'system';
    const title = window.escapeHtml(ev.title || '');
    const desc = window.escapeHtml(ev.description || '');
    const actions = isSystem ? '' : `
      <div class="events-expanded-actions">
        <button type="button" class="btn-icon" title="Редактировать" onclick="startEditEvent(${ev.dbId})">${editIconSvg()}</button>
        <button type="button" class="btn-icon btn-icon-delete" title="Удалить" onclick="deleteEvent(${ev.dbId})">${trashIconSvg()}</button>
      </div>
    `;
    return `
      <div class="events-expanded-item">
        <div style="min-width:0;">
          <div class="events-expanded-item-title">${title}</div>
          ${desc ? `<div class="events-expanded-item-desc">${desc}</div>` : ''}
        </div>
        ${actions}
      </div>
    `;
  }).join('') : `<div style="color:rgba(255,255,255,0.65); font-size:12px; padding:6px 2px;">На этот день пока нет мероприятий.</div>`;

  const body = cell.querySelector('.events-day-body');
  if (!body) return;

  body.innerHTML = `
    <div class="events-expanded">
      <div class="events-expanded-date">${fmtDateCenter(isoDate)}</div>
      <div class="events-expanded-list" id="events-expanded-list">${listHtml}</div>
      <form class="events-expanded-form" id="events-expanded-form">
        <div class="form-group">
          <label>Название *</label>
          <input type="text" id="events-expanded-title" maxlength="120" required />
        </div>
        <div class="form-group">
          <label>Описание</label>
          <input type="text" id="events-expanded-desc" maxlength="250" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" id="events-expanded-cancel" style="display:none;">Отмена</button>
          <button type="submit" class="btn-primary" id="events-expanded-submit">Добавить</button>
        </div>
      </form>
    </div>
  `;

  const form = body.querySelector('#events-expanded-form');
  const cancelBtn = body.querySelector('#events-expanded-cancel');
  const submitBtn = body.querySelector('#events-expanded-submit');

  function resetForm() {
    window.eventsEditingId = null;
    body.querySelector('#events-expanded-title').value = '';
    body.querySelector('#events-expanded-desc').value = '';
    cancelBtn.style.display = 'none';
    submitBtn.textContent = 'Добавить';
  }

  cancelBtn.addEventListener('click', () => resetForm());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = body.querySelector('#events-expanded-title').value.trim();
    const description = body.querySelector('#events-expanded-desc').value.trim();
    if (!title) return;
    try {
      if (window.eventsEditingId) {
        const res = await fetch(`/api/events/${window.eventsEditingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        const updated = await res.json();
        window.events = (window.events || []).map(ev => ev.dbId === updated.dbId ? updated : ev);
      } else {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: isoDate, title, description })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        const created = await res.json();
        window.events.push(created);
      }
      resetForm();
      renderExpanded(cell, isoDate);
      updateCalendarCells();
    } catch (err) {
      console.error(err);
      window.showToast('Не удалось сохранить мероприятие.', 'error');
    }
  });

  resetForm();
}

window.startEditEvent = function startEditEvent(dbId) {
  if (!expandedCell || !expandedIso) return;
  const ev = (window.events || []).find(x => x.dbId === dbId);
  if (!ev) return;
  const body = expandedCell.querySelector('.events-day-body');
  if (!body) return;
  window.eventsEditingId = dbId;
  body.querySelector('#events-expanded-title').value = ev.title || '';
  body.querySelector('#events-expanded-desc').value = ev.description || '';
  body.querySelector('#events-expanded-cancel').style.display = 'inline-flex';
  body.querySelector('#events-expanded-submit').textContent = 'Сохранить';
};

function closeExpanded() {
  if (!expandedCell) return;
  expandedCell.classList.remove('is-expanded');
  expandedCell.classList.remove('is-active');
  const body = expandedCell.querySelector('.events-day-body');
  if (body) body.innerHTML = renderDayChips(expandedIso);
  expandedCell = null;
  expandedIso = null;
  window.eventsSelectedDate = null;
  window.eventsEditingId = null;
}

function toggleExpanded(cell, isoDate) {
  if (expandedCell && expandedCell === cell) {
    closeExpanded();
    return;
  }
  closeExpanded();
  expandedCell = cell;
  expandedIso = isoDate;
  window.eventsSelectedDate = isoDate;
  cell.classList.add('is-active');
  cell.classList.add('is-expanded');
  renderExpanded(cell, isoDate);
}

window.deleteEvent = async function deleteEvent(dbId) {
  if (!confirm('Удалить мероприятие?')) return;
  try {
    const res = await fetch(`/api/events/${dbId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error((await res.json()).error || 'error');
    window.events = (window.events || []).filter(e => e.dbId !== dbId);
    if (expandedCell && expandedIso) renderExpanded(expandedCell, expandedIso);
    updateCalendarCells();
  } catch (e) {
    console.error(e);
    window.showToast('Не удалось удалить мероприятие.', 'error');
  }
};

// Hooks for calendar: called from renderEventsCalendar after DOM is created.
window.attachEventsCalendarInteractions = function attachEventsCalendarInteractions(year, monthIndex) {
  // click/hover
  closeExpanded();
  document.querySelectorAll('.events-day[data-date]').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      // hover styles are CSS-based, but keep ability to set active on click
    });
    cell.addEventListener('click', async () => {
      const iso = cell.getAttribute('data-date');
      toggleExpanded(cell, iso);
    });
  });
  updateCalendarCells();
};

