// Events: persistence + calendar interactions + recurring events.

window.events = []; // stored events loaded from DB for current month range
window.eventsSelectedDate = null; // YYYY-MM-DD

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
  if (day === 1) res.push({ kind: 'system', title: 'ВЗЗ (Война за зону)', description: '', date: isoDate });
  if (day === 2 || day === 4) res.push({ kind: 'system', title: 'ВЗМ (Война за материалы)', description: '', date: isoDate });
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
    if (body) body.innerHTML = renderDayChips(iso);
    // today marker
    const now = new Date();
    const todayIso = toISODateLocal(now);
    cell.classList.toggle('is-today', iso === todayIso);
  });
}

const eventsDayModal = document.getElementById('events-day-modal-overlay');
const eventsDayTitle = document.getElementById('events-day-title');
const eventsDayList = document.getElementById('events-day-list');
const eventsDayForm = document.getElementById('events-day-form');

function renderEventsDayList(isoDate) {
  const items = getEventsForDate(isoDate);
  if (!items.length) {
    eventsDayList.className = 'events-day-list';
    eventsDayList.innerHTML = `<div style="color:rgba(255,255,255,0.65); font-size:13px;">На этот день пока нет мероприятий.</div>`;
    return;
  }

  const html = items.map(ev => {
    const isSystem = ev.kind === 'system';
    const title = window.escapeHtml(ev.title || '');
    const desc = window.escapeHtml(ev.description || '');
    const deleteBtn = isSystem
      ? ''
      : `<button type="button" class="btn-icon btn-icon-delete" onclick="deleteEvent(${ev.dbId})" title="Удалить">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>
        </button>`;

    return `
      <div class="events-day-item">
        <div>
          <div class="events-day-item-title">${title}${isSystem ? ' <span style="opacity:0.65;font-weight:500">(авто)</span>' : ''}</div>
          ${desc ? `<div class="events-day-item-desc">${desc}</div>` : ''}
        </div>
        <div class="events-day-item-actions">
          ${deleteBtn}
        </div>
      </div>
    `;
  }).join('');

  eventsDayList.className = 'events-day-list';
  eventsDayList.innerHTML = html;
}

window.openEventsDayModal = function openEventsDayModal(isoDate) {
  window.eventsSelectedDate = isoDate;
  document.getElementById('events-day-date').value = isoDate;
  const [y, m, d] = isoDate.split('-');
  eventsDayTitle.textContent = `Мероприятия на ${d}.${m}.${y}`;
  document.getElementById('events-day-input-title').value = '';
  document.getElementById('events-day-input-desc').value = '';
  renderEventsDayList(isoDate);
  eventsDayModal.classList.add('is-open');
};

window.closeEventsDayModal = function closeEventsDayModal() {
  eventsDayModal.classList.remove('is-open');
  window.eventsSelectedDate = null;
};

eventsDayModal.addEventListener('click', function (e) {
  if (e.target === this) window.closeEventsDayModal();
});

window.deleteEvent = async function deleteEvent(dbId) {
  if (!confirm('Удалить мероприятие?')) return;
  try {
    const res = await fetch(`/api/events/${dbId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error((await res.json()).error || 'error');
    window.events = (window.events || []).filter(e => e.dbId !== dbId);
    if (window.eventsSelectedDate) {
      renderEventsDayList(window.eventsSelectedDate);
    }
    updateCalendarCells();
  } catch (e) {
    console.error(e);
    window.showToast('Не удалось удалить мероприятие.', 'error');
  }
};

eventsDayForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('events-day-date').value;
  const title = document.getElementById('events-day-input-title').value.trim();
  const description = document.getElementById('events-day-input-desc').value.trim();
  if (!date || !title) return;
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, title, description })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'error');
    const created = await res.json();
    window.events.push(created);
    renderEventsDayList(date);
    updateCalendarCells();
  } catch (err) {
    console.error(err);
    window.showToast('Не удалось добавить мероприятие.', 'error');
  }
});

// Hooks for calendar: called from renderEventsCalendar after DOM is created.
window.attachEventsCalendarInteractions = function attachEventsCalendarInteractions(year, monthIndex) {
  // click/hover
  let activeCell = null;
  document.querySelectorAll('.events-day[data-date]').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      // hover styles are CSS-based, but keep ability to set active on click
    });
    cell.addEventListener('click', async () => {
      activeCell?.classList.remove('is-active');
      activeCell = cell;
      cell.classList.add('is-active');
      const iso = cell.getAttribute('data-date');
      window.openEventsDayModal(iso);
    });
  });
  updateCalendarCells();

  // when modal closes, remove active highlight
  const originalClose = window.closeEventsDayModal;
  window.closeEventsDayModal = function () {
    originalClose();
    activeCell?.classList.remove('is-active');
    activeCell = null;
  };
};

