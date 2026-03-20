// Events: persistence + calendar interactions + recurring events.

window.events = []; // stored events loaded from DB for current month range
window.eventsSuppressedSystem = []; // { date, key } — скрытые на дату автоматические ВЗЗ/ВЗМ
window.eventsSelectedDate = null; // YYYY-MM-DD
window.eventsEditingId = null; // dbId | null
window.eventsEditingSystemKey = null; // 'vzz' | 'vzm' | null — редактирование шаблонного мероприятия
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
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m - 1), d);
  const day = dt.getDay(); // 0 Вс, 1 Пн, 2 Вт, 4 Чт
  const res = [];
  if (day === 1) {
    res.push({
      kind: 'system',
      title: 'ВЗЗ',
      description: 'Тип - Семейный',
      date: isoDate,
      systemKey: 'vzz'
    });
  }
  if (day === 2) {
    res.push({
      kind: 'system',
      title: 'ВЗМ',
      description: 'Тип - Фракционный',
      date: isoDate,
      systemKey: 'vzm'
    });
  }
  if (day === 4) {
    res.push({
      kind: 'system',
      title: 'ВЗМ',
      description: 'Тип - Семейный',
      date: isoDate,
      systemKey: 'vzm'
    });
  }
  const suppressed = new Set(
    (window.eventsSuppressedSystem || [])
      .filter(x => x.date === isoDate)
      .map(x => x.key)
  );
  return res.filter(ev => {
    const key = ev.systemKey;
    if (suppressed.has(key)) return false;
    const override = (window.events || []).find(
      e => e.date === isoDate && e.sourceSystemKey === key
    );
    if (override) return false;
    return true;
  });
}

function getEventsForDate(isoDate) {
  const sysEvents = getSystemEventsForDate(isoDate);
  const dbEvents = (window.events || []).filter(e => e.date === isoDate).map(e => ({ ...e, kind: 'db' }));
  return [...sysEvents, ...dbEvents];
}

window.loadEventsForMonth = async function loadEventsForMonth(year, monthIndex) {
  const from = startOfMonthISO(year, monthIndex);
  const to = endOfMonthISO(year, monthIndex);
  try {
    const res = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!res.ok) throw new Error((await res.json()).error || 'error');
    const data = await res.json();
    if (Array.isArray(data)) {
      window.events = data;
      window.eventsSuppressedSystem = [];
    } else {
      window.events = Array.isArray(data.events) ? data.events : [];
      window.eventsSuppressedSystem = Array.isArray(data.suppressedSystem) ? data.suppressedSystem : [];
    }
  } catch (e) {
    console.error('loadEventsForMonth:', e);
    window.events = [];
    window.eventsSuppressedSystem = [];
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

/** Иконка «развернуть» (отдельная страница по URL /<slug><DDMM>) */
function expandIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>`;
}

const CYR_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

/** Короткий латинский slug для URL: ВЗЗ→vzz, ВЗМ→vzm; остальное — транслит + [a-z0-9] */
function slugifyEventName(title) {
  const t = String(title || '').trim();
  const up = t.toUpperCase();
  if (up === 'ВЗЗ') return 'vzz';
  if (up === 'ВЗМ') return 'vzm';
  let out = '';
  for (const ch of t.toLowerCase()) {
    if (CYR_TO_LAT[ch]) out += CYR_TO_LAT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
  }
  out = out.replace(/[^a-z0-9]+/g, '').slice(0, 48);
  return out || 'event';
}

/** Дата в URL: день+месяц без разделителей, DDMM (15 марта → 1503) */
function isoToDdmm(isoDate) {
  const [, m, d] = isoDate.split('-');
  return `${d}${m}`;
}

function parseEventDetailSegment(segment) {
  const s = String(segment || '').replace(/^\//, '');
  const m = s.match(/^([a-z][a-z0-9]*)(\d{2})(\d{2})$/);
  if (!m) return null;
  return { slug: m[1], dd: m[2], mm: m[3], full: s };
}

function eventDetailStorageKey(segment) {
  const s = String(segment || '').replace(/^\//, '');
  return `eventDetail:${s}`;
}

function readEventDetailMeta(segment) {
  try {
    const raw = sessionStorage.getItem(eventDetailStorageKey(segment));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return o;
  } catch (_) {
    return null;
  }
}

function syncEventsNavActive() {
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  const evNav = document.querySelector('.nav-item[href="/events"]');
  if (evNav) evNav.classList.add('active');
}

function resolveEventForSegment(segment) {
  const parsed = parseEventDetailSegment(segment);
  if (!parsed) return null;
  const meta = readEventDetailMeta(segment);
  let year = window.eventsMonth?.year ?? new Date().getFullYear();
  if (meta?.iso) {
    year = Number(meta.iso.slice(0, 4));
  }
  const iso = meta?.iso || `${year}-${parsed.mm}-${parsed.dd}`;
  const items = getEventsForDate(iso);
  const match = items.find(ev => slugifyEventName(ev.title) === parsed.slug);
  if (match) {
    return {
      iso,
      title: match.title || '',
      description: match.description || '',
      kind: match.kind,
      dbId: match.dbId ?? null
    };
  }
  if (meta && meta.title) {
    return {
      iso: meta.iso || iso,
      title: meta.title,
      description: meta.description || '',
      kind: meta.kind || 'db',
      dbId: meta.dbId ?? null
    };
  }
  return {
    iso,
    title: 'Мероприятие',
    description: 'Не удалось найти мероприятие по ссылке. Год в адресе не указан — откройте из календаря или выберите нужный год в календаре.',
    kind: 'unknown',
    dbId: null
  };
}

/** Подгрузка месяца для детальной страницы (по дате из ссылки или sessionStorage) */
window.prepareEventDetailPage = async function prepareEventDetailPage(segment) {
  const parsed = parseEventDetailSegment(segment);
  if (!parsed) return;
  const meta = readEventDetailMeta(segment);
  let year = new Date().getFullYear();
  let monthIndex = parseInt(parsed.mm, 10) - 1;
  if (meta?.iso) {
    const [y, m] = meta.iso.split('-');
    year = Number(y);
    monthIndex = Number(m) - 1;
  }
  window.eventsMonth = { year, month: monthIndex };
  if (typeof window.loadEventsForMonth === 'function') {
    await window.loadEventsForMonth(year, monthIndex);
  }
};

window.renderEventDetailPage = function renderEventDetailPage(segment) {
  const parsed = parseEventDetailSegment(segment);
  if (!parsed) {
    window.setPageContent(`<p style="color:rgba(255,255,255,0.55)">Некорректная ссылка на мероприятие.</p>`);
    return;
  }
  const info = resolveEventForSegment(segment);
  const title = window.escapeHtml(info.title || '');
  const descRaw = info.description || '';
  const desc = descRaw
    ? `<div class="event-detail-desc">${window.escapeHtml(descRaw)}</div>`
    : '<div class="event-detail-desc muted">Без описания</div>';
  const dateLine = window.escapeHtml(formatDateWithWeekday(info.iso));
  const pathLabel = window.escapeHtml(`/${parsed.full}`);

  window.setPageContent(`
    <div class="event-detail-page">
      <div class="event-detail-toolbar">
        <button type="button" class="btn-ghost" id="event-detail-back">← К календарю</button>
      </div>
      <div class="event-detail-card">
        <div class="event-detail-path">${pathLabel}</div>
        <h1 class="event-detail-title">${title}</h1>
        <div class="event-detail-date">${dateLine}</div>
        ${desc}
      </div>
    </div>
  `);
  const back = document.getElementById('event-detail-back');
  if (back) back.onclick = () => window.goBackToEventsCalendar();
};

window.expandEventToPage = function expandEventToPage(iso, title, dbId, prefilledDescription) {
  const slug = slugifyEventName(title);
  const segment = `${slug}${isoToDdmm(iso)}`;
  let description = '';
  let kind = 'system';
  if (dbId != null && dbId !== '') {
    const ev = (window.events || []).find(x => x.dbId === dbId);
    if (ev) {
      description = ev.description || '';
      kind = 'db';
    }
  } else {
    description = prefilledDescription != null ? String(prefilledDescription) : '';
  }
  try {
    sessionStorage.setItem(eventDetailStorageKey(segment), JSON.stringify({
      iso,
      title: title || '',
      description,
      kind,
      dbId: dbId != null ? dbId : null
    }));
  } catch (_) { /* ignore */ }
  window.history.pushState({ page: 'event-detail', segment }, '', `/${segment}`);
  window.closeEventsDayModal();
  window.pageTitle.textContent = 'Мероприятия';
  window.headerActions.style.display = 'none';
  syncEventsNavActive();
  window.renderEventDetailPage(segment);
};

window.goBackToEventsCalendar = function goBackToEventsCalendar() {
  window.history.pushState({ page: 'events' }, '', '/events');
  window.pageTitle.textContent = 'Мероприятия';
  window.headerActions.style.display = 'none';
  syncEventsNavActive();
  window.renderEventsCalendar();
};

window.addEventListener('popstate', () => {
  const path = window.location.pathname || '/';
  if (path === '/events') {
    window.pageTitle.textContent = 'Мероприятия';
    window.headerActions.style.display = 'none';
    syncEventsNavActive();
    window.renderEventsCalendar();
    return;
  }
  const seg = path.startsWith('/') ? path.slice(1) : path;
  if (/^[a-z][a-z0-9]*\d{4}$/.test(seg)) {
    window.pageTitle.textContent = 'Мероприятия';
    window.headerActions.style.display = 'none';
    syncEventsNavActive();
    if (typeof window.prepareEventDetailPage === 'function') {
      window.prepareEventDetailPage(seg).then(() => window.renderEventDetailPage(seg));
    } else {
      window.renderEventDetailPage(seg);
    }
  }
});

const eventsDayModal = document.getElementById('events-day-modal-overlay');
const eventsDayTitle = document.getElementById('events-day-title');
const eventsDayList = document.getElementById('events-day-list');
const eventsDayForm = document.getElementById('events-day-form');
const eventsDayCloseBtn = document.getElementById('events-day-close-btn');
const eventsDayNewBtn = document.getElementById('events-day-new-btn');
const eventsDayCancelBtn = document.getElementById('events-day-cancel-btn');
const eventsDaySubmitBtn = document.getElementById('events-day-submit-btn');

/** Безопасная подстановка в HTML-атрибуты (data-*) */
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

/* Inline onclick с JSON.stringify ломал атрибут (вложенные "). Делегирование по data-ev-act. */
if (eventsDayList && !window.__eventsDayListDelegationBound) {
  window.__eventsDayListDelegationBound = true;
  eventsDayList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-ev-act]');
    if (!btn || !eventsDayList.contains(btn)) return;
    const act = btn.getAttribute('data-ev-act');
    const iso = btn.getAttribute('data-ev-iso') || '';
    if (act === 'expand') {
      const dbidStr = btn.getAttribute('data-ev-dbid');
      const dbId = dbidStr === '' || dbidStr == null ? null : Number(dbidStr);
      const title = btn.getAttribute('data-ev-title') || '';
      const desc = btn.getAttribute('data-ev-desc') || '';
      window.expandEventToPage(
        iso,
        title,
        dbId != null && !Number.isNaN(dbId) ? dbId : null,
        desc
      );
      return;
    }
    if (act === 'edit-sys') {
      const sk = btn.getAttribute('data-ev-sk');
      window.startEditSystemEvent(iso, sk);
      return;
    }
    if (act === 'del-sys') {
      const sk = btn.getAttribute('data-ev-sk');
      window.deleteSystemEvent(iso, sk);
      return;
    }
    if (act === 'edit-db') {
      const id = Number(btn.getAttribute('data-ev-dbid'));
      if (!Number.isNaN(id)) window.startEditEvent(id);
      return;
    }
    if (act === 'del-db') {
      const id = Number(btn.getAttribute('data-ev-dbid'));
      if (!Number.isNaN(id)) window.deleteEvent(id);
    }
  });
}

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
    const rawTitle = ev.title || '';
    const rawDesc = ev.description != null ? ev.description : '';
    const expandBtn = `
      <button type="button" class="btn-icon btn-icon-expand" title="Развернуть на отдельной странице" aria-label="Развернуть"
        data-ev-act="expand"
        data-ev-iso="${escapeAttr(isoDate)}"
        data-ev-title="${escapeAttr(rawTitle)}"
        data-ev-dbid="${isSystem ? '' : String(ev.dbId)}"
        data-ev-desc="${escapeAttr(rawDesc)}">${expandIconSvg()}</button>
    `;
    const editDelete = isSystem
      ? `
        <button type="button" class="btn-icon" title="Редактировать" data-ev-act="edit-sys" data-ev-iso="${escapeAttr(isoDate)}" data-ev-sk="${escapeAttr(ev.systemKey)}">${editIconSvg()}</button>
        <button type="button" class="btn-icon btn-icon-delete" title="Удалить" data-ev-act="del-sys" data-ev-iso="${escapeAttr(isoDate)}" data-ev-sk="${escapeAttr(ev.systemKey)}">${trashIconSvg()}</button>
      `
      : `
        <button type="button" class="btn-icon" title="Редактировать" data-ev-act="edit-db" data-ev-dbid="${escapeAttr(String(ev.dbId))}">${editIconSvg()}</button>
        <button type="button" class="btn-icon btn-icon-delete" title="Удалить" data-ev-act="del-db" data-ev-dbid="${escapeAttr(String(ev.dbId))}">${trashIconSvg()}</button>
      `;
    const actions = `
      <div class="events-day-item-actions">
        ${expandBtn}
        ${editDelete}
      </div>
    `;
    return `
      <div class="events-day-item">
        <div style="min-width:0; flex:1;">
          <div class="events-day-item-title">${title}</div>
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
  window.eventsEditingSystemKey = null;
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
  window.eventsEditingSystemKey = null;
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
  window.eventsEditingSystemKey = null;
  window.eventsEditingId = dbId;
  document.getElementById('events-day-input-title').value = ev.title || '';
  document.getElementById('events-day-input-desc').value = ev.description || '';
  eventsDaySubmitBtn.textContent = 'Сохранить';
  showEventsForm();
};

const SYSTEM_KEY_DEFAULT_TITLE = { vzz: 'ВЗЗ', vzm: 'ВЗМ' };

window.startEditSystemEvent = function startEditSystemEvent(isoDate, systemKey) {
  if (systemKey !== 'vzz' && systemKey !== 'vzm') return;
  const existing = (window.events || []).find(
    e => e.date === isoDate && e.sourceSystemKey === systemKey
  );
  if (existing) {
    window.startEditEvent(existing.dbId);
    return;
  }
  window.eventsEditingId = null;
  window.eventsEditingSystemKey = systemKey;
  document.getElementById('events-day-date').value = isoDate;
  document.getElementById('events-day-input-title').value = SYSTEM_KEY_DEFAULT_TITLE[systemKey] || '';
  const virtual = getEventsForDate(isoDate).find(
    e => e.kind === 'system' && e.systemKey === systemKey
  );
  document.getElementById('events-day-input-desc').value = virtual?.description || '';
  eventsDaySubmitBtn.textContent = 'Сохранить';
  showEventsForm();
};

window.deleteSystemEvent = async function deleteSystemEvent(isoDate, systemKey) {
  if (systemKey !== 'vzz' && systemKey !== 'vzm') return;
  try {
    const res = await fetch('/api/events/system-suppress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: isoDate, key: systemKey })
    });
    if (!res.ok && res.status !== 204) throw new Error((await res.json()).error || 'error');
    window.eventsSuppressedSystem = window.eventsSuppressedSystem || [];
    if (!window.eventsSuppressedSystem.some(x => x.date === isoDate && x.key === systemKey)) {
      window.eventsSuppressedSystem.push({ date: isoDate, key: systemKey });
    }
    if (window.eventsSelectedDate) renderEventsDayList(window.eventsSelectedDate);
    updateCalendarCells();
    renderEventsRightPanel();
  } catch (e) {
    console.error(e);
    window.showToast('Не удалось удалить мероприятие.', 'error');
  }
};

window.deleteEvent = async function deleteEvent(dbId) {
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
    } else if (window.eventsEditingSystemKey === 'vzz' || window.eventsEditingSystemKey === 'vzm') {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          title,
          description,
          sourceSystemKey: window.eventsEditingSystemKey
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'error');
      const saved = await res.json();
      const sk = window.eventsEditingSystemKey;
      window.events = (window.events || []).filter(
        e => !(e.date === date && e.sourceSystemKey === sk)
      );
      window.events.push(saved);
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

