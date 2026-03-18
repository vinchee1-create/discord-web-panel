// Events: persistence + calendar interactions + recurring events.

window.events = []; // stored events loaded from DB for current month range
window.eventsSelectedDate = null; // YYYY-MM-DD
window.eventsEditingId = null; // dbId | null
window.eventsActiveCell = null; // currently selected day cell

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

function formatDateWithWeekday(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const weekdayNames = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const dd = d;
  return `${dd} ${monthNames[dt.getMonth()]} ${dt.getFullYear()}, ${weekdayNames[dt.getDay()]}`;
}

function renderDayPills(isoDate) {
  const all = getEventsForDate(isoDate);
  if (!all.length) return '';

  const shown = all.slice(0, 3);
  const pills = shown.map(ev => {
    const cls = ev.kind === 'system' ? 'events-day-pill system' : 'events-day-pill';
    const title = window.escapeHtml(ev.title || '');
    return `
      <div class="${cls}" title="${title}">
        <div class="events-day-pill-title">${title}</div>
      </div>
    `;
  }).join('');
  const more = all.length > 3 ? `
    <div class="events-day-pill more" title="Ещё">
      <div class="events-day-pill-title">+${all.length - 3}</div>
    </div>
  ` : '';
  return pills + more;
}

function updateCalendarCells() {
  const year = window.eventsMonth.year;
  const month = window.eventsMonth.month;
  document.querySelectorAll('.events-day[data-date]').forEach(cell => {
    const iso = cell.getAttribute('data-date');
    const body = cell.querySelector('.events-day-body');
    if (body) body.innerHTML = renderDayPills(iso);
    // today marker
    const now = new Date();
    const todayIso = toISODateLocal(now);
    cell.classList.toggle('is-today', iso === todayIso);
  });
}

function fmtDateCenter(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

function toTodayISO() {
  const now = new Date();
  return toISODateLocal(now);
}

function editIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
}

function trashIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>`;
}

const eventsDayModal = document.getElementById('events-day-modal-overlay');
const eventsDayTitle = document.getElementById('events-day-title');
const eventsDayList = document.getElementById('events-day-list');
const eventsDayForm = document.getElementById('events-day-form');
const eventsDayCloseBtn = document.getElementById('events-day-close-btn');
const eventsDayNewBtn = document.getElementById('events-day-new-btn');
const eventsDayCancelBtn = document.getElementById('events-day-cancel-btn');
const eventsDaySubmitBtn = document.getElementById('events-day-submit-btn');

function renderEventsDayList(isoDate) {
  const items = getEventsForDate(isoDate);
  if (!items.length) {
    eventsDayList.innerHTML = `<div style="color:rgba(255,255,255,0.65); font-size:13px; text-align:center; padding:8px 0;">На этот день пока нет мероприятий.</div>`;
    return;
  }

  const html = items.map(ev => {
    const isSystem = ev.kind === 'system';
    const title = window.escapeHtml(ev.title || '');
    const desc = window.escapeHtml(ev.description || '');
    const dateRu = fmtDateCenter(isoDate);
    const actions = isSystem ? '' : `
      <div class="events-day-item-actions">
        <button type="button" class="btn-icon" title="Редактировать" onclick="startEditEvent(${ev.dbId})">${editIconSvg()}</button>
        <button type="button" class="btn-icon btn-icon-delete" title="Удалить" onclick="deleteEvent(${ev.dbId})">${trashIconSvg()}</button>
      </div>
    `;
    return `
      <div class="events-day-item">
        <div style="min-width:0; flex:1;">
          <div class="events-day-item-title-wrap">
            <div class="events-day-item-title">${title}</div>
          </div>
          ${desc ? `<div class="events-day-item-desc">${desc}</div>` : ''}
        </div>
        ${actions}
      </div>
    `;
  }).join('');

  eventsDayList.innerHTML = html;
}

function hideEventsForm() {
  window.eventsEditingId = null;
  eventsDayForm.style.display = 'none';
  if (eventsDayNewBtn) eventsDayNewBtn.style.display = '';
  document.getElementById('events-day-input-title').value = '';
  document.getElementById('events-day-input-desc').value = '';
  eventsDaySubmitBtn.textContent = 'Добавить';
}

function showEventsForm() {
  eventsDayForm.style.display = '';
  if (eventsDayNewBtn) eventsDayNewBtn.style.display = 'none';
  setTimeout(() => document.getElementById('events-day-input-title')?.focus(), 0);
}

window.openEventsDayModal = function openEventsDayModal(isoDate) {
  window.eventsSelectedDate = isoDate;
  document.getElementById('events-day-date').value = isoDate;
  eventsDayTitle.textContent = formatDateWithWeekday(isoDate);
  renderEventsDayList(isoDate);
  hideEventsForm();
  eventsDayModal.classList.add('is-open');
};

window.closeEventsDayModal = function closeEventsDayModal() {
  eventsDayModal.classList.remove('is-open');
  window.eventsSelectedDate = null;
  hideEventsForm();
  if (window.eventsActiveCell) window.eventsActiveCell.classList.remove('is-active');
  window.eventsActiveCell = null;
};

eventsDayModal.addEventListener('click', function (e) {
  if (e.target === this) window.closeEventsDayModal();
});

eventsDayCloseBtn?.addEventListener('click', () => window.closeEventsDayModal());

eventsDayNewBtn?.addEventListener('click', () => {
  window.eventsEditingId = null;
  eventsDaySubmitBtn.textContent = 'Добавить';
  document.getElementById('events-day-input-title').value = '';
  document.getElementById('events-day-input-desc').value = '';
  showEventsForm();
});

eventsDayCancelBtn?.addEventListener('click', () => {
  hideEventsForm();
});

// Right panel (sticky "Сегодня")
function getEventsRightDom() {
  return {
    subtitle: document.getElementById('events-right-subtitle'),
    list: document.getElementById('events-right-list'),
    newBtn: document.getElementById('events-right-new-btn')
  };
}

function renderEventsRightPanel() {
  const { subtitle, list } = getEventsRightDom();
  if (!list) return;
  const todayIso = toTodayISO();
  // Subtitle can be empty; keep similar spacing to reference.
  if (subtitle) {
    const [y, m, d] = todayIso.split('-');
    // Example: "13 марта 2026"
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const weekdayNames = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const monthCap = monthNames[dt.getMonth()].replace(/^\w/, c => c.toUpperCase());
    const weekdayCap = weekdayNames[dt.getDay()].replace(/^\w/, c => c.toUpperCase());
    // Short, one-line header to fit the reference panel.
    subtitle.textContent = `${weekdayCap}, ${d} ${monthCap}`;
  }

  const items = getEventsForDate(todayIso);
  if (!items.length) {
    list.innerHTML = '';
    return;
  }

  const html = items.map(ev => {
    const isSystem = ev.kind === 'system';
    const title = window.escapeHtml(ev.title || '');
    const dateRu = fmtDateCenter(todayIso);
    return `
      <div class="events-right-card">
        <div class="events-right-card-title">${title}</div>
        <div class="events-right-card-date">${window.escapeHtml(dateRu)}</div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
}

window.startEditEvent = function startEditEvent(dbId) {
  const ev = (window.events || []).find(x => x.dbId === dbId);
  if (!ev) return;
  window.eventsEditingId = dbId;
  document.getElementById('events-day-input-title').value = ev.title || '';
  document.getElementById('events-day-input-desc').value = ev.description || '';
  eventsDaySubmitBtn.textContent = 'Сохранить';
  showEventsForm();
};

window.deleteEvent = async function deleteEvent(dbId) {
  if (!confirm('Удалить мероприятие?')) return;
  try {
    const res = await fetch(`/api/events/${dbId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error((await res.json()).error || 'error');
    window.events = (window.events || []).filter(e => e.dbId !== dbId);
    if (window.eventsSelectedDate) renderEventsDayList(window.eventsSelectedDate);
    updateCalendarCells();
    renderEventsRightPanel();
  } catch (e) {
    console.error(e);
    window.showToast('Не удалось удалить мероприятие.', 'error');
  }
};

eventsDayForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('events-day-date').value;
  const title = document.getElementById('events-day-input-title').value.trim();
  const description = document.getElementById('events-day-input-desc').value.trim();
  if (!date || !title) return;
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
        body: JSON.stringify({ date, title, description })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'error');
      const created = await res.json();
      window.events.push(created);
    }
    hideEventsForm();
    renderEventsDayList(date);
    updateCalendarCells();
    renderEventsRightPanel();
  } catch (err) {
    console.error(err);
    window.showToast('Не удалось сохранить мероприятие.', 'error');
  }
});

// Hooks for calendar: called from renderEventsCalendar after DOM is created.
window.attachEventsCalendarInteractions = function attachEventsCalendarInteractions(year, monthIndex) {
  // click/hover
  document.querySelectorAll('.events-day[data-date]').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      // hover styles are CSS-based, but keep ability to set active on click
    });
    cell.addEventListener('click', async () => {
      const iso = cell.getAttribute('data-date');
      document.querySelectorAll('.events-day').forEach(x => x.classList.remove('is-active'));
      cell.classList.add('is-active');
      window.eventsActiveCell = cell;
      window.openEventsDayModal(iso);
    });
  });
  updateCalendarCells();
  renderEventsRightPanel();

  const { newBtn } = getEventsRightDom();
  if (newBtn) {
    // Prevent multiple bindings across re-render.
    if (window.__eventsRightNewBoundEl !== newBtn) {
      window.__eventsRightNewBoundEl = newBtn;
      newBtn.onclick = () => window.openEventsDayModal(toTodayISO());
    }
  }
};

