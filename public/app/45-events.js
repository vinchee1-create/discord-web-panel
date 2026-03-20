// Events: persistence + calendar interactions + recurring events.

window.events = []; // stored events loaded from DB for current month range
window.eventsSuppressedSystem = []; // { date, key } — скрытые на дату автоматические ВЗЗ/ВЗМ
window.eventsSelectedDate = null; // YYYY-MM-DD
window.eventsEditingId = null; // dbId | null
window.eventsEditingSystemKey = null; // 'vzz' | 'vzm' | null — редактирование шаблонного мероприятия
window.eventsActiveCell = null; // currently selected day cell

const EVENT_FE_HIDE_DRAFT_STORAGE_KEY = 'eventDetailFeHideDraft';

function eventFeDraftRowHiddenRead() {
  try {
    return localStorage.getItem(EVENT_FE_HIDE_DRAFT_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function eventFeDraftRowHiddenWrite(hidden) {
  try {
    if (hidden) localStorage.setItem(EVENT_FE_HIDE_DRAFT_STORAGE_KEY, '1');
    else localStorage.removeItem(EVENT_FE_HIDE_DRAFT_STORAGE_KEY);
  } catch (_) { /* ignore */ }
}

function eventFeApplyDraftRowVisibility() {
  const wrap = document.getElementById('event-detail-fe-wrap');
  if (!wrap) return;
  wrap.classList.toggle('event-detail-fe-wrap--draft-hidden', eventFeDraftRowHiddenRead());
}

function eventFeUpdateDraftToggleButton() {
  const btn = document.getElementById('event-fe-toggle-draft');
  if (!btn) return;
  const hidden = eventFeDraftRowHiddenRead();
  const label = btn.querySelector('.event-fe-toggle-draft-label');
  if (label) label.textContent = hidden ? 'Показать ввод' : 'Скрыть ввод';
  btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
}

function eventFeBindDraftToggle() {
  const btn = document.getElementById('event-fe-toggle-draft');
  if (!btn) return;
  btn.onclick = () => {
    eventFeDraftRowHiddenWrite(!eventFeDraftRowHiddenRead());
    eventFeApplyDraftRowVisibility();
    eventFeUpdateDraftToggleButton();
  };
  eventFeUpdateDraftToggleButton();
}

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

/** Для страницы развёрнутого мероприятия: выделить «Тип - …» из описания */
function parseEventDescriptionForDetail(desc) {
  const raw = String(desc || '').trim();
  if (!raw) return { typeValue: '—', extra: '' };
  const lines = raw.split(/\r?\n/);
  const first = lines[0].trim();
  const m = first.match(/^Тип\s*-\s*(.+)$/i);
  if (m) {
    const typeValue = m[1].trim() || '—';
    const extra = lines.slice(1).join('\n').trim();
    return { typeValue, extra };
  }
  return { typeValue: '—', extra: raw };
}

window.EVENT_FE_COLOURS = [
  'red', 'white', 'blue', 'purple', 'green', 'brown', 'cyan', 'orange',
  'beige', 'gray', 'yellow', 'pink', 'black', 'rgb'
];

/** Лёгкая подложка под селект «Цвет» (неяркая, на тёмном фоне) */
window.EVENT_FE_COLOUR_TINT = {
  red: 'rgba(200, 72, 72, 0.18)',
  white: 'rgba(220, 220, 228, 0.12)',
  blue: 'rgba(72, 118, 220, 0.2)',
  purple: 'rgba(150, 96, 210, 0.2)',
  green: 'rgba(72, 168, 96, 0.18)',
  brown: 'rgba(168, 118, 72, 0.2)',
  cyan: 'rgba(64, 188, 206, 0.18)',
  orange: 'rgba(210, 132, 64, 0.2)',
  beige: 'rgba(200, 182, 148, 0.16)',
  gray: 'rgba(150, 150, 158, 0.18)',
  yellow: 'rgba(210, 190, 72, 0.18)',
  pink: 'rgba(210, 96, 148, 0.18)',
  black: 'rgba(90, 90, 98, 0.28)',
  rgb: 'rgba(110, 96, 200, 0.18)'
};

window.eventFeApplyColourSelectBg = function eventFeApplyColourSelectBg(selectEl) {
  if (!selectEl || selectEl.tagName !== 'SELECT') return;
  const key = String(selectEl.value || 'white').toLowerCase();
  const tint = window.EVENT_FE_COLOUR_TINT[key] || window.EVENT_FE_COLOUR_TINT.white;
  selectEl.style.backgroundColor = tint;
};

function feEscapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

function eventFeCommands(gameId, colour) {
  const gid = String(gameId || '').trim();
  if (!gid) return { temp: '—', on: '—', off: '—' };
  const c = String(colour || 'white').toLowerCase();
  return {
    temp: `/tempfamily ${gid}`,
    on: `/feventon ${gid} 20 ${c} 0 0`,
    off: `/feventoff ${gid}`
  };
}

/** opts.isSpacer — строка-разделитель «Пустая» (без номера и данных) */
function eventFeFamilyOptionsHtml(selectedDbId, opts = {}) {
  const isSpacer = Boolean(opts.isSpacer);
  const fams = window.families || [];
  const selEmpty = !isSpacer && (selectedDbId == null || selectedDbId === '');
  const selSpacer = isSpacer;
  const parts = [
    `<option value=""${selEmpty ? ' selected' : ''}>— не выбрано —</option>`,
    `<option value="__spacer__"${selSpacer ? ' selected' : ''}>Пустая</option>`,
    ...fams.map(f => {
      const sel = !isSpacer && Number(selectedDbId) === Number(f.dbId) ? ' selected' : '';
      return `<option value="${String(f.dbId)}"${sel}>${window.escapeHtml(f.name)}</option>`;
    })
  ];
  return parts.join('');
}

function eventFeColourOptionsHtml(selectedColour) {
  const cur = String(selectedColour || 'white').toLowerCase();
  return window.EVENT_FE_COLOURS.map(c => {
    const sel = cur === c ? ' selected' : '';
    return `<option value="${c}"${sel}>${c}</option>`;
  }).join('');
}

/** Правый край таблицы: удаление видно только при наведении на эту зону */
function eventFeDeleteActionCellHtml(rowId) {
  return `<td class="event-fe-actions-cell">
    <div class="event-fe-actions-hover" role="presentation">
      <button type="button" class="event-fe-del" data-row-id="${rowId}" title="Удалить строку" aria-label="Удалить строку">${trashIconSvg()}</button>
    </div>
  </td>`;
}

function eventFeDraftActionsCellHtml() {
  return '<td class="event-fe-actions-cell event-fe-actions-cell--draft"></td>';
}

function buildEventDetailFeSpacerRowHtml(row) {
  const rid = row.rowId;
  return `
      <tr class="event-fe-spacer-row" data-fe-row-id="${rid}" data-fe-spacer="1">
        <td colspan="11" class="event-fe-spacer-cell" aria-hidden="true"></td>
        ${eventFeDeleteActionCellHtml(rid)}
      </tr>`;
}

function buildEventDetailFePersistedRowHtml(row, displayNum) {
  const n = displayNum;
  const famOpts = eventFeFamilyOptionsHtml(row.familyRefId, { isSpacer: false });
  const colOpts = eventFeColourOptionsHtml(row.colour);
  const gameId = row.familyGameId || '';
  const cmds = eventFeCommands(gameId, row.colour);
  const rid = row.rowId;
  return `
      <tr data-fe-row-id="${rid}">
        <td class="event-fe-col-n"><span class="event-fe-num">${n}</span></td>
        <td>
          <select class="event-fe-family" data-row-id="${rid}" aria-label="Семья">${famOpts}</select>
        </td>
        <td>
          <select class="event-fe-colour" data-row-id="${rid}" aria-label="Цвет">${colOpts}</select>
        </td>
        <td class="event-fe-id-cell event-fe-td-center"><code>${window.escapeHtml(gameId) || '—'}</code></td>
        <td class="event-fe-cmd" title="${feEscapeAttr(cmds.temp)}"><div class="event-fe-cmd-inner"><code>${window.escapeHtml(cmds.temp)}</code></div></td>
        <td class="event-fe-cmd" title="${feEscapeAttr(cmds.on)}"><div class="event-fe-cmd-inner"><code>${window.escapeHtml(cmds.on)}</code></div></td>
        <td class="event-fe-cmd" title="${feEscapeAttr(cmds.off)}"><div class="event-fe-cmd-inner"><code>${window.escapeHtml(cmds.off)}</code></div></td>
        <td class="event-fe-check-cell">
          <label class="event-fe-check-label"><input type="checkbox" class="event-fe-flag" data-row-id="${rid}" data-field="died" ${row.died ? 'checked' : ''} /><span class="event-fe-check-ui" aria-hidden="true"></span></label>
        </td>
        <td><input type="text" class="event-fe-curator" data-row-id="${rid}" value="${feEscapeAttr(row.curatorName)}" placeholder="Имя" autocomplete="off" /></td>
        <td class="event-fe-check-cell">
          <label class="event-fe-check-label"><input type="checkbox" class="event-fe-flag" data-row-id="${rid}" data-field="lFlag" ${row.lFlag ? 'checked' : ''} /><span class="event-fe-check-ui" aria-hidden="true"></span></label>
        </td>
        <td class="event-fe-check-cell">
          <label class="event-fe-check-label"><input type="checkbox" class="event-fe-flag" data-row-id="${rid}" data-field="wFlag" ${row.wFlag ? 'checked' : ''} /><span class="event-fe-check-ui" aria-hidden="true"></span></label>
        </td>
        ${eventFeDeleteActionCellHtml(rid)}
      </tr>`;
}

/** Черновая строка: при заполнении уходит в БД, ниже появляется новая */
function buildEventDetailFeDraftRowHtml(draftNum) {
  const famOpts = eventFeFamilyOptionsHtml(null, { isSpacer: false });
  const colOpts = eventFeColourOptionsHtml('white');
  const cmds = eventFeCommands('', 'white');
  return `
      <tr data-fe-draft="1" class="event-fe-draft-row">
        <td class="event-fe-col-n"><span class="event-fe-num">${draftNum}</span></td>
        <td>
          <select class="event-fe-family event-fe-draft-control" aria-label="Семья">${famOpts}</select>
        </td>
        <td>
          <select class="event-fe-colour event-fe-draft-control" aria-label="Цвет">${colOpts}</select>
        </td>
        <td class="event-fe-id-cell event-fe-td-center"><code>—</code></td>
        <td class="event-fe-cmd" title="${feEscapeAttr(cmds.temp)}"><div class="event-fe-cmd-inner"><code>${window.escapeHtml(cmds.temp)}</code></div></td>
        <td class="event-fe-cmd" title="${feEscapeAttr(cmds.on)}"><div class="event-fe-cmd-inner"><code>${window.escapeHtml(cmds.on)}</code></div></td>
        <td class="event-fe-cmd" title="${feEscapeAttr(cmds.off)}"><div class="event-fe-cmd-inner"><code>${window.escapeHtml(cmds.off)}</code></div></td>
        <td class="event-fe-check-cell">
          <label class="event-fe-check-label"><input type="checkbox" class="event-fe-flag event-fe-draft-control" data-field="died" /><span class="event-fe-check-ui" aria-hidden="true"></span></label>
        </td>
        <td><input type="text" class="event-fe-curator event-fe-draft-control" value="" placeholder="Имя" autocomplete="off" /></td>
        <td class="event-fe-check-cell">
          <label class="event-fe-check-label"><input type="checkbox" class="event-fe-flag event-fe-draft-control" data-field="lFlag" /><span class="event-fe-check-ui" aria-hidden="true"></span></label>
        </td>
        <td class="event-fe-check-cell">
          <label class="event-fe-check-label"><input type="checkbox" class="event-fe-flag event-fe-draft-control" data-field="wFlag" /><span class="event-fe-check-ui" aria-hidden="true"></span></label>
        </td>
        ${eventFeDraftActionsCellHtml()}
      </tr>`;
}

function eventFeDraftRowIsMeaningful(tr) {
  if (!tr || !tr.matches('tr[data-fe-draft="1"]')) return false;
  const fam = tr.querySelector('.event-fe-family')?.value;
  const col = tr.querySelector('.event-fe-colour')?.value || 'white';
  const cur = tr.querySelector('.event-fe-curator')?.value.trim() || '';
  const died = tr.querySelector('.event-fe-flag[data-field="died"]')?.checked;
  const l = tr.querySelector('.event-fe-flag[data-field="lFlag"]')?.checked;
  const w = tr.querySelector('.event-fe-flag[data-field="wFlag"]')?.checked;
  return fam === '__spacer__' || (fam && fam !== '') || col !== 'white' || cur.length > 0 || died || l || w;
}

async function eventFePostDraftRow(tr, pageKey) {
  const fam = tr.querySelector('.event-fe-family');
  const col = tr.querySelector('.event-fe-colour');
  const cur = tr.querySelector('.event-fe-curator');
  const famVal = fam.value;
  if (famVal === '__spacer__') {
    const body = { pageKey, isSpacer: true };
    const res = await fetch('/api/event-detail-rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'error');
    return;
  }
  const body = {
    pageKey,
    isSpacer: false,
    familyRefId: famVal === '' ? null : Number(famVal),
    colour: col.value,
    curatorName: cur.value.trim(),
    died: Boolean(tr.querySelector('.event-fe-flag[data-field="died"]')?.checked),
    lFlag: Boolean(tr.querySelector('.event-fe-flag[data-field="lFlag"]')?.checked),
    wFlag: Boolean(tr.querySelector('.event-fe-flag[data-field="wFlag"]')?.checked)
  };
  const res = await fetch('/api/event-detail-rows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error((await res.json()).error || 'error');
}

window.buildEventDetailFeRowsHtml = function buildEventDetailFeRowsHtml(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let displayNum = 0;
  const persisted = list
    .map(row => {
      if (row.isSpacer) return buildEventDetailFeSpacerRowHtml(row);
      displayNum += 1;
      return buildEventDetailFePersistedRowHtml(row, displayNum);
    })
    .join('');
  const draftNum = list.length + 1;
  return persisted + buildEventDetailFeDraftRowHtml(draftNum);
};

window.refreshEventDetailFeTable = async function refreshEventDetailFeTable(pageKey) {
  const tbody = document.getElementById('event-detail-fe-tbody');
  if (!tbody || !pageKey) return;
  try {
    const res = await fetch(`/api/event-detail-rows?pageKey=${encodeURIComponent(pageKey)}`);
    const rows = res.ok ? await res.json() : [];
    if (typeof window.loadFamilies === 'function') await window.loadFamilies();
    tbody.innerHTML = window.buildEventDetailFeRowsHtml(Array.isArray(rows) ? rows : []);
    tbody.querySelectorAll('select.event-fe-colour').forEach(sel => window.eventFeApplyColourSelectBg(sel));
  } catch (e) {
    console.error(e);
    if (typeof window.loadFamilies === 'function') await window.loadFamilies();
    tbody.innerHTML = window.buildEventDetailFeRowsHtml([]);
    tbody.querySelectorAll('select.event-fe-colour').forEach(sel => window.eventFeApplyColourSelectBg(sel));
  }
  eventFeApplyDraftRowVisibility();
};

async function eventFePutRow(rowId, body) {
  const res = await fetch(`/api/event-detail-rows/${rowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error((await res.json()).error || 'error');
  return res.json();
}

async function eventFeDeleteRow(rowId) {
  const res = await fetch(`/api/event-detail-rows/${rowId}`, { method: 'DELETE' });
  if (res.ok || res.status === 204) return;
  let msg = 'error';
  try {
    const j = await res.json();
    if (j?.error) msg = j.error;
  } catch (_) { /* ignore */ }
  throw new Error(msg);
}

function attachEventDetailFeListeners(pageKey) {
  const wrap = document.getElementById('event-detail-fe-wrap');
  if (!wrap) return;
  if (wrap.dataset.feListeners === '1') return;
  wrap.dataset.feListeners = '1';
  wrap.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.classList?.contains('event-fe-colour')) {
      window.eventFeApplyColourSelectBg(t);
    }
    const draftTr = t.closest('tr[data-fe-draft="1"]');
    if (draftTr) {
      if (!eventFeDraftRowIsMeaningful(draftTr)) return;
      try {
        await eventFePostDraftRow(draftTr, pageKey);
        await window.refreshEventDetailFeTable(pageKey);
      } catch (err) {
        console.error(err);
        window.showToast('Не удалось сохранить строку.', 'error');
        await window.refreshEventDetailFeTable(pageKey);
      }
      return;
    }
    const rowId = t.getAttribute('data-row-id');
    if (!rowId) return;
    try {
      if (t.classList.contains('event-fe-family')) {
        const v = t.value;
        if (v === '__spacer__') {
          await eventFePutRow(rowId, { isSpacer: true });
        } else {
          await eventFePutRow(rowId, {
            isSpacer: false,
            familyRefId: v === '' ? null : Number(v)
          });
        }
      } else if (t.classList.contains('event-fe-colour')) {
        await eventFePutRow(rowId, { colour: t.value });
      } else if (t.classList.contains('event-fe-flag')) {
        const field = t.getAttribute('data-field');
        if (field === 'died') await eventFePutRow(rowId, { died: t.checked });
        else if (field === 'lFlag') await eventFePutRow(rowId, { lFlag: t.checked });
        else if (field === 'wFlag') await eventFePutRow(rowId, { wFlag: t.checked });
      }
      await window.refreshEventDetailFeTable(pageKey);
    } catch (err) {
      console.error(err);
      window.showToast('Не удалось сохранить.', 'error');
      await window.refreshEventDetailFeTable(pageKey);
    }
  });
  wrap.addEventListener('click', async (e) => {
    const btn = e.target.closest('.event-fe-del');
    if (!btn || !wrap.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const rowId = btn.getAttribute('data-row-id');
    if (!rowId) return;
    try {
      await eventFeDeleteRow(rowId);
      await window.refreshEventDetailFeTable(pageKey);
    } catch (err) {
      console.error(err);
    }
  });
  wrap.addEventListener('focusout', async (e) => {
    const t = e.target;
    if (!t.classList.contains('event-fe-curator')) return;
    const draftTr = t.closest('tr[data-fe-draft="1"]');
    if (draftTr) {
      if (!eventFeDraftRowIsMeaningful(draftTr)) return;
      try {
        await eventFePostDraftRow(draftTr, pageKey);
        await window.refreshEventDetailFeTable(pageKey);
      } catch (err) {
        console.error(err);
        window.showToast('Не удалось сохранить строку.', 'error');
        await window.refreshEventDetailFeTable(pageKey);
      }
      return;
    }
    const rowId = t.getAttribute('data-row-id');
    if (!rowId) return;
    try {
      await eventFePutRow(rowId, { curatorName: t.value.trim() });
      await window.refreshEventDetailFeTable(pageKey);
    } catch (err) {
      console.error(err);
      window.showToast('Не удалось сохранить следящего.', 'error');
      await window.refreshEventDetailFeTable(pageKey);
    }
  });
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

/** Заголовок на развёрнутой странице: ВЗЗ/ВЗМ → полные названия */
function eventDetailDisplayTitle(info, parsed) {
  const slug = parsed?.slug || '';
  const t = String(info?.title || '').trim().toUpperCase();
  if (slug === 'vzm' || t === 'ВЗМ') return 'Война за материалы';
  if (slug === 'vzz' || t === 'ВЗЗ') return 'Война за зону';
  const raw = String(info?.title || '').trim();
  return raw || 'Мероприятие';
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
  const title = window.escapeHtml(eventDetailDisplayTitle(info, parsed));
  const descRaw = info.description || '';
  const { typeValue, extra } = parseEventDescriptionForDetail(descRaw);
  const typeHtml = window.escapeHtml(typeValue);
  const dateLine = window.escapeHtml(formatDateWithWeekday(info.iso));
  const pathLabel = window.escapeHtml(`/${parsed.full}`);
  const extraBlock = extra
    ? `<div class="event-detail-extra">${window.escapeHtml(extra)}</div>`
    : '';
  const pageKey = `${info.iso}|${parsed.full}`;

  window.setPageContent(`
    <div class="event-detail-page">
      <div class="event-detail-toolbar">
        <button type="button" class="btn-ghost" id="event-detail-back">← К календарю</button>
        <span class="event-detail-path-inline">${pathLabel}</span>
      </div>
      <div class="event-detail-panel">
        <div class="event-detail-panel-inner">
          <h1 class="event-detail-hero-title">${title}</h1>
          <div class="event-detail-meta-row">
            <div class="event-detail-meta-col event-detail-meta-left">
              <span class="event-detail-meta-label">Тип</span>
              <span class="event-detail-meta-value">${typeHtml}</span>
            </div>
            <div class="event-detail-meta-col event-detail-meta-right">
              <span class="event-detail-meta-label">Дата</span>
              <span class="event-detail-meta-value">${dateLine}</span>
            </div>
          </div>
          ${extraBlock}
          <div class="event-detail-fe-section">
            <div class="event-detail-fe-toolbar">
              <h2 class="event-detail-fe-heading">Семьи и команды</h2>
              <button type="button" class="btn-ghost event-fe-toggle-draft" id="event-fe-toggle-draft" aria-pressed="false" title="Скрыть или показать нижнюю строку для ввода">
                <span class="event-fe-toggle-draft-label">Скрыть ввод</span>
              </button>
            </div>
            <div class="table-container event-detail-fe-wrap" id="event-detail-fe-wrap">
              <table class="data-table event-detail-fe-table">
                <thead>
                  <tr>
                    <th class="event-fe-th-n">N</th>
                    <th>Семья</th>
                    <th>Цвет</th>
                    <th class="event-fe-th-id">ID</th>
                    <th class="event-fe-th-cmd">/tempfamily</th>
                    <th class="event-fe-th-cmd">/feventon</th>
                    <th class="event-fe-th-cmd">/feventoff</th>
                    <th class="event-fe-th-check">Присутствовали</th>
                    <th>Следящий</th>
                    <th class="event-fe-th-check">L</th>
                    <th class="event-fe-th-check">W</th>
                    <th class="event-fe-th-actions" aria-label="Действия"></th>
                  </tr>
                </thead>
                <tbody id="event-detail-fe-tbody">
                  <tr><td colspan="12" class="event-fe-empty">Загрузка…</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
  const back = document.getElementById('event-detail-back');
  if (back) back.onclick = () => window.goBackToEventsCalendar();

  Promise.all([
    typeof window.loadFamilies === 'function' ? window.loadFamilies() : Promise.resolve(),
    fetch(`/api/event-detail-rows?pageKey=${encodeURIComponent(pageKey)}`)
      .then(r => (r.ok ? r.json() : []))
      .catch(() => [])
  ]).then(([, rows]) => {
    const tbody = document.getElementById('event-detail-fe-tbody');
    if (!tbody) return;
    tbody.innerHTML = window.buildEventDetailFeRowsHtml(Array.isArray(rows) ? rows : []);
    tbody.querySelectorAll('select.event-fe-colour').forEach(sel => window.eventFeApplyColourSelectBg(sel));
    attachEventDetailFeListeners(pageKey);
    eventFeApplyDraftRowVisibility();
    eventFeBindDraftToggle();
  });
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

