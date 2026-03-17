let families = [];
let familyMaterials = [];
let factionMaterials = [];
let editingMaterialIndex = -1;
let editingFactionMaterialIndex = -1;

const toastRoot = document.getElementById('toast-root');
function showToast(message, variant = 'error', timeout = 3000) {
    if (!toastRoot) return;
    const el = document.createElement('div');
    el.className = `toast toast-${variant}`;
    el.textContent = message;
    toastRoot.appendChild(el);
    // force reflow
    void el.offsetWidth;
    el.classList.add('toast-show');
    setTimeout(() => {
        el.classList.remove('toast-show');
        setTimeout(() => {
            el.remove();
        }, 200);
    }, timeout);
}

const familyMaterialsBadge = document.getElementById('nav-badge-family-materials');
const factionMaterialsBadge = document.getElementById('nav-badge-faction-materials');
function updateFamilyMaterialsBadge() {
    if (!familyMaterialsBadge) return;
    const pending = (familyMaterials || []).filter(x => !x.issued).length;
    if (pending > 0) {
        familyMaterialsBadge.textContent = String(pending);
        familyMaterialsBadge.style.display = 'inline-flex';
    } else {
        familyMaterialsBadge.style.display = 'none';
    }
}

function updateFactionMaterialsBadge() {
    if (!factionMaterialsBadge) return;
    const pending = (factionMaterials || []).filter(x => !x.issued).length;
    if (pending > 0) {
        factionMaterialsBadge.textContent = String(pending);
        factionMaterialsBadge.style.display = 'inline-flex';
    } else {
        factionMaterialsBadge.style.display = 'none';
    }
}

const pageContent = document.getElementById('page-content');
const pageTitle = document.getElementById('current-title');
const headerActions = document.getElementById('header-actions');
const leaderModal = document.getElementById('leader-modal-overlay');
const leaderForm = document.getElementById('leader-form');

async function loadFamilies() {
    try {
        const res = await fetch('/api/families');
        const data = await res.json();
        families = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Ошибка загрузки семей:', e);
        families = [];
    }
}

// Раздел "Аккаунты" отключён (кнопка убрана), API оставлено на будущее
let accounts = [];
async function loadAccounts() { accounts = []; }

async function loadFamilyMaterials() {
    try {
        const res = await fetch('/api/family-materials');
        const data = await res.json();
        familyMaterials = Array.isArray(data) ? data : [];
        updateFamilyMaterialsBadge();
    } catch (e) {
        console.error('Ошибка загрузки материалов семей:', e);
        familyMaterials = [];
        updateFamilyMaterialsBadge();
    }
}

async function loadFactionMaterials() {
    try {
        const res = await fetch('/api/faction-materials');
        const data = await res.json();
        factionMaterials = Array.isArray(data) ? data : [];
        updateFactionMaterialsBadge();
    } catch (e) {
        console.error('Ошибка загрузки материалов фракций:', e);
        factionMaterials = [];
        updateFactionMaterialsBadge();
    }
}

let usersList = [];
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('forbidden');
        const data = await res.json();
        usersList = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Ошибка загрузки пользователей:', e);
        usersList = [];
    }
}

function renderUsers() {
    const editSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
    const trashSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"></path><line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\"></line><line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\"></line></svg>';
    const rows = usersList.map(u => `
        <tr>
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.roleName)}</td>
            <td>${u.roleLevel}</td>
            <td class="cell-actions-users">
                <button type="button" class="btn-icon" onclick="openUserEditModal(${u.dbId})" title="Редактировать">${editSvg}</button>
                <button type="button" class="btn-icon btn-icon-delete" onclick="deleteUser(${u.dbId})" title="Удалить">${trashSvg}</button>
            </td>
        </tr>
    `).join('');
    setPageContent(`
        <div class="nick-page-header">
            <div class="nick-title">Пользователи</div>
            <button type="button" class="btn-month" onclick="openUserModal()">
                <span class="btn-month-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
                </span>
                <span>Добавить пользователя</span>
            </button>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Логин</th>
                        <th>Роль</th>
                        <th>Уровень</th>
                        <th style="text-align:right">Действие</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `);
}

const userModal = document.getElementById('user-modal-overlay');
const userForm = document.getElementById('user-form');
const userEditModal = document.getElementById('user-edit-modal-overlay');
const userEditForm = document.getElementById('user-edit-form');

function openUserModal() {
    document.getElementById('user-username').value = '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value = 'Curator';
    userModal.classList.add('is-open');
}
function closeUserModal() {
    userModal.classList.remove('is-open');
}
userModal.addEventListener('click', function(e) {
    if (e.target === this) closeUserModal();
});
userForm.onsubmit = async (e) => {
    e.preventDefault();
    try {
        const username = document.getElementById('user-username').value.trim();
        const password = document.getElementById('user-password').value;
        const roleName = document.getElementById('user-role').value;
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, roleName })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        closeUserModal();
        await loadUsers();
        renderUsers();
    } catch (err) {
        console.error(err);
        alert('Не удалось создать пользователя');
    }
};

function openUserEditModal(dbId) {
    const u = usersList.find(x => x.dbId === dbId);
    if (!u) return;
    document.getElementById('user-edit-id').value = String(dbId);
    document.getElementById('user-edit-username').value = u.username;
    document.getElementById('user-edit-role').value = '';
    document.getElementById('user-edit-password').value = '';
    userEditModal.classList.add('is-open');
}
function closeUserEditModal() {
    userEditModal.classList.remove('is-open');
}
userEditModal.addEventListener('click', function(e) {
    if (e.target === this) closeUserEditModal();
});
userEditForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('user-edit-id').value;
    const roleName = document.getElementById('user-edit-role').value;
    const password = document.getElementById('user-edit-password').value;
    try {
        const payload = {};
        if (roleName) payload.roleName = roleName;
        if (password) payload.password = password;
        const res = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        closeUserEditModal();
        await loadUsers();
        renderUsers();
    } catch (err) {
        console.error(err);
        alert('Не удалось сохранить пользователя');
    }
};

async function deleteUser(dbId) {
    if (!confirm('Удалить пользователя? Доступ будет отозван.')) return;
    try {
        const res = await fetch(`/api/users/${dbId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        await loadUsers();
        renderUsers();
    } catch (err) {
        console.error(err);
        alert('Не удалось удалить пользователя');
    }
}

function renderAccounts() {
    setPageContent(`<p style="color:#444">Раздел "Аккаунты" отключён.</p>`);
}

async function openAddAccount() {}

function setPageContent(html) {
    pageContent.innerHTML = html;
    pageContent.classList.remove('page-fade');
    // force reflow to restart animation
    void pageContent.offsetWidth;
    pageContent.classList.add('page-fade');
}

function renderFamilies() {
    const list = families.map((f, i) => {
        const dbId = f.dbId != null ? f.dbId : '';
        return `
        <tr>
            <td>${escapeHtml(f.name)}</td>
            <td><span class="id-tag">#${escapeHtml(f.id)}</span></td>
            <td>${escapeHtml(f.leader || '—')}</td>
            <td>${escapeHtml(f.discord || '—')}</td>
            <td class="cell-actions">
                <button type="button" class="btn-icon" onclick="editFamily(${i})" title="Редактировать"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg></button>
                <button type="button" class="btn-icon btn-icon-delete" onclick="deleteFamily(${i})" title="Удалить"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg></button>
            </td>
        </tr>`;
    }).join('');
    setPageContent(`
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
        </div>`);
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

let leaders = [];

function clearTextSelection() {
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) {
        sel.removeAllRanges();
    } else if (document.selection && document.selection.empty) {
        document.selection.empty();
    }
}

async function loadLeaders() {
    try {
        const res = await fetch('/api/leaders');
        const data = await res.json();
        leaders = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Ошибка загрузки лидеров:', e);
        leaders = [];
    }
}

let nickMonth = { 
    year: new Date().getFullYear(), 
    month: new Date().getMonth() 
};
let eventsMonth = { 
    year: new Date().getFullYear(), 
    month: new Date().getMonth() 
};

function isLeaderActive(L) {
    return Boolean(L.leader && L.staticId && L.term && L.time);
}

function getActiveLeadersCount() {
    return leaders.filter(isLeaderActive).length;
}

function getNearestRemoval() {
    const msPerDay = 1000 * 60 * 60 * 24;
    const now = new Date();
    let best = null;
    leaders.forEach(L => {
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

function getNickDatesForMonth(year, monthIndex, allowedDays) {
    const dates = [];
    const d = new Date(year, monthIndex, 1);
    while (d.getMonth() === monthIndex) {
        const day = d.getDay(); // 0 - вс, 1 - пн, ...
        if (allowedDays.includes(day)) {
            dates.push(new Date(d));
        }
        d.setDate(d.getDate() + 1);
    }
    return dates;
}

function renderEventsCalendar() {
    const { year, month } = eventsMonth;
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const monthLabel = `${monthNames[month]} ${year}`;

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // последний день месяца
    const daysInMonth = end.getDate();

    // Определяем, с какого дня недели начинается (делаем понедельник первым столбцом)
    const startWeekday = (start.getDay() + 6) % 7; // 0 = Пн, ..., 6 = Вс
    const cells = [];
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
        const dayNum = i - startWeekday + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
            cells.push('<div class="events-day events-day-empty"></div>');
        } else {
            cells.push(`
                <div class="events-day">
                    <div class="events-day-number">${dayNum}</div>
                    <div class="events-day-body"></div>
                </div>
            `);
        }
    }

    setPageContent(`
        <div class="events-page">
            <div class="nick-page-header">
                <div>
                    <div class="nick-title">Мероприятия</div>
                </div>
                <div class="nick-month-control">
                    <button type="button" class="btn-month" id="events-month-button">
                        <span class="btn-month-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </span>
                        <span>${monthLabel}</span>
                    </button>
                    <div class="nick-month-dropdown" id="events-month-dropdown"></div>
                </div>
            </div>
            <div class="events-calendar">
                <div class="events-weekdays">
                    <div>Пн</div>
                    <div>Вт</div>
                    <div>Ср</div>
                    <div>Чт</div>
                    <div>Пт</div>
                    <div>Сб</div>
                    <div>Вс</div>
                </div>
                <div class="events-grid">
                    ${cells.join('')}
                </div>
            </div>
        </div>
    `);

    // Инициализация выпадающего списка месяцев
    const dropdown = document.getElementById('events-month-dropdown');
    const button = document.getElementById('events-month-button');
    if (dropdown && button) {
        dropdown.innerHTML = monthNames.map((name, idx) => {
            return `<button type="button" data-month="${idx}">${name} ${year}</button>`;
        }).join('');

        button.onclick = () => {
            dropdown.classList.toggle('open');
        };
        dropdown.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const m = Number(e.currentTarget.getAttribute('data-month'));
                if (!isNaN(m)) {
                    eventsMonth.month = m;
                    dropdown.classList.remove('open');
                    renderEventsCalendar();
                }
            });
        });
    }
}

function renderNicknames() {
    const { year, month } = nickMonth;
    const datesTueThu = getNickDatesForMonth(year, month, [2, 4]); // вт, чт
    const datesMon = getNickDatesForMonth(year, month, [1]); // пн
    const allDates = [...datesTueThu, ...datesMon]
        .sort((a, b) => a - b)
        .filter((d, i, arr) => i === 0 || d.getTime() !== arr[i - 1].getTime());
    const factions = [
        'The Ballas Gang',
        'Los Santos Vagos',
        'The Families',
        'The Bloods Gang',
        'Marabunta Grande'
    ];
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const monthLabel = `${monthNames[month]} ${year}`;
    const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const topSet = new Set(datesTueThu.map(dateKey));
    const bottomSet = new Set(datesMon.map(dateKey));

    const headerCellsTop = allDates.map(d => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `<th>${dd}.${mm}</th>`;
    }).join('');
    const headerCellsBottom = allDates.map(d => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `<th>${dd}.${mm}</th>`;
    }).join('');

    const bodyRowsTop = factions.map(name => {
        const cells = allDates.map(d => {
            return topSet.has(dateKey(d)) ? `<td>—</td>` : `<td></td>`;
        }).join('');
        return `<tr><td>${escapeHtml(name)}</td>${cells}</tr>`;
    }).join('');

    const bodyRowsBottom = factions.map(name => {
        const cells = allDates.map(d => {
            return bottomSet.has(dateKey(d)) ? `<td>—</td>` : `<td></td>`;
        }).join('');
        return `<tr><td>${escapeHtml(name)}</td>${cells}</tr>`;
    }).join('');

    setPageContent(`
            <div class="nick-page">
            <div class="nick-page-header">
                <div>
                    <div class="nick-title">Проверка никнеймов</div>
                </div>
                <div class="nick-month-control">
                    <button type="button" class="btn-month" id="nick-month-button">
                        <span class="btn-month-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </span>
                        <span>${monthLabel}</span>
                    </button>
                    <div class="nick-month-dropdown" id="nick-month-dropdown"></div>
                </div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Фракции</th>
                            ${headerCellsTop}
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRowsTop}
                    </tbody>
                </table>
            </div>

            <div class="nick-section-title">Собрания</div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Фракции</th>
                            ${headerCellsBottom}
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRowsBottom}
                    </tbody>
                </table>
            </div>
        </div>
    `);

    const dropdown = document.getElementById('nick-month-dropdown');
    const button = document.getElementById('nick-month-button');
    if (dropdown && button) {
        dropdown.innerHTML = monthNames.map((name, idx) => {
            return `<button type="button" data-month="${idx}">${name}</button>`;
        }).join('');

        button.onclick = () => {
            dropdown.classList.toggle('open');
        };
        dropdown.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const m = Number(e.currentTarget.getAttribute('data-month'));
                if (!isNaN(m)) {
                    nickMonth.month = m;
                    dropdown.classList.remove('open');
                    renderNicknames();
                }
            });
        });
    }
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

function renderLeaders() {
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
            <div class="stat-card-label">из ${leaders.length}</div>
            <div class="stat-card-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
        </div>
        <div class="stat-card">
            <span class="stat-card-title">Ближайшее снятие</span>
            <div class="stat-card-value">${nearestText}</div>
            <div class="stat-card-label">${nearestFaction}</div>
            <div class="stat-card-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg></div>
        </div>`;
    const rowsHtml = leaders.map((L, i) => {
        const timeTitle = getTimeTooltip(L.time);
        const timeDisplay = formatTimeDisplay(L.time);
        const flagClass = L.flagged ? 'btn-icon btn-icon-flag is-flagged' : 'btn-icon btn-icon-flag';
        return `<tr>
            <td>${L.id}</td>
            <td>${escapeHtml(L.faction)}</td>
            <td>${escapeHtml(L.leader) || '—'}</td>
            <td>${escapeHtml(L.staticId) || '—'}</td>
            <td>${escapeHtml(L.term) || '—'}</td>
            <td class="time-cell" data-time="${escapeHtml(L.time)}" title="${escapeHtml(timeTitle)}">${timeDisplay}</td>
            <td class="cell-actions-leaders">
                <button type="button" class="${flagClass}" onclick="toggleLeaderFlag(${i})" title="Отметить">${flagSvg}</button>
                <button type="button" class="btn-icon" onclick="editLeader(${i})" title="Редактировать">${editSvg}</button>
            </td>
        </tr>`;
    }).join('');
    setPageContent(`
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
        </div>`);
}

async function toggleLeaderFlag(i) {
    const current = leaders[i];
    const updated = { ...current, flagged: !current.flagged };
    leaders[i] = updated;
    if (updated.dbId != null) {
        try {
            const res = await fetch(`/api/leaders/${updated.dbId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
            if (!res.ok) throw new Error('Failed to save flag');
            leaders[i] = await res.json();
        } catch (e) {
            console.error(e);
            alert('Не удалось сохранить флажок.');
        }
    }
    renderLeaders();
}

function openLeaderModal(index) {
    const L = leaders[index];
    document.getElementById('leader-edit-index').value = index;
    document.getElementById('leader-faction').value = L.faction;
    document.getElementById('leader-name').value = L.leader || '';
    document.getElementById('leader-static').value = L.staticId || '';
    document.getElementById('leader-term').value = L.term || '';
    document.getElementById('leader-time').value = L.time || '';
    leaderModal.classList.add('is-open');
}

function closeLeaderModal() {
    leaderModal.classList.remove('is-open');
}

leaderModal.addEventListener('click', function(e) {
    if (e.target === this) closeLeaderModal();
});

function editLeader(i) {
    openLeaderModal(i);
}

const initialPage = window.__INITIAL_PAGE__ || 'Панель управления';

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const href = btn.getAttribute('href');
        if (href && href !== window.location.pathname) {
            window.history.pushState({}, '', href);
        }
        document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        const title = btn.getAttribute('data-title');
        pageTitle.textContent = title;
        if (title === 'Семьи') {
            headerActions.style.display = 'flex';
            const addBtn = document.getElementById('btn-add-family');
            if (addBtn) {
                addBtn.onclick = openModal;
                addBtn.querySelector('span:last-child').textContent = 'Добавить семью';
            }
            await loadFamilies();
            renderFamilies();
        } else if (title === 'Лидеры') {
            headerActions.style.display = 'none';
            await loadLeaders();
            renderLeaders();
        } else if (title === 'Мероприятия') {
            headerActions.style.display = 'none';
            renderEventsCalendar();
        } else if (title === 'Материалы семей') {
            headerActions.style.display = 'flex';
            const addBtn = document.getElementById('btn-add-family');
            if (addBtn) {
                addBtn.onclick = openMaterialsModal;
                addBtn.querySelector('span:last-child').textContent = 'Добавить';
            }
            await loadFamilies();
            await loadFamilyMaterials();
            renderFamilyMaterials();
        } else if (title === 'Материалы фракций') {
            headerActions.style.display = 'flex';
            const addBtn = document.getElementById('btn-add-family');
            if (addBtn) {
                addBtn.onclick = openFactionMaterialsModal;
                addBtn.querySelector('span:last-child').textContent = 'Добавить';
            }
            await loadLeaders();
            await loadFactionMaterials();
            renderFactionMaterials();
        } else if (title === 'Модерация') {
            headerActions.style.display = 'none';
            renderNicknames();
        } else if (title === 'Пользователи') {
            headerActions.style.display = 'none';
            await loadUsers();
            renderUsers();
        } else {
            headerActions.style.display = 'none';
            setPageContent(`<p style="color:#444">Раздел "${title}" находится в разработке.</p>`);
        }
    });
});

// Инициализация контента при первой загрузке страницы
(async () => {
    // Сбрасываем active у всех пунктов и выставляем для текущего URL
    const currentPath = window.location.pathname || '/';
    const currentNav = Array.from(document.querySelectorAll('.nav-item'))
        .find(a => a.getAttribute('href') === currentPath);
    if (currentNav) {
        document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
        currentNav.classList.add('active');
    }

    if (initialPage === 'Семьи') {
        pageTitle.textContent = 'Семьи';
        headerActions.style.display = 'flex';
        const addBtn = document.getElementById('btn-add-family');
        if (addBtn) {
            addBtn.onclick = openModal;
            addBtn.querySelector('span:last-child').textContent = 'Добавить семью';
        }
        await loadFamilies();
        renderFamilies();
    } else if (initialPage === 'Лидеры') {
        pageTitle.textContent = 'Лидеры';
        headerActions.style.display = 'none';
        await loadLeaders();
        renderLeaders();
    } else if (initialPage === 'Мероприятия') {
        pageTitle.textContent = 'Мероприятия';
        headerActions.style.display = 'none';
        renderEventsCalendar();
    } else if (initialPage === 'Материалы семей') {
        pageTitle.textContent = 'Материалы семей';
        headerActions.style.display = 'flex';
        const addBtn = document.getElementById('btn-add-family');
        if (addBtn) {
            addBtn.onclick = openMaterialsModal;
            addBtn.querySelector('span:last-child').textContent = 'Добавить';
        }
        await loadFamilies();
        await loadFamilyMaterials();
        renderFamilyMaterials();
    } else if (initialPage === 'Материалы фракций') {
        pageTitle.textContent = 'Материалы фракций';
        headerActions.style.display = 'flex';
        const addBtn = document.getElementById('btn-add-family');
        if (addBtn) {
            addBtn.onclick = openFactionMaterialsModal;
            addBtn.querySelector('span:last-child').textContent = 'Добавить';
        }
        await loadLeaders();
        await loadFactionMaterials();
        renderFactionMaterials();
    } else if (initialPage === 'Модерация') {
        pageTitle.textContent = 'Модерация';
        headerActions.style.display = 'none';
        renderNicknames();
    } else if (initialPage === 'Пользователи') {
        pageTitle.textContent = 'Пользователи';
        headerActions.style.display = 'none';
        await loadUsers();
        renderUsers();
    } else {
        // Для остальных страниц пока просто заголовок и плейсхолдер "в разработке"
        pageTitle.textContent = initialPage || 'Панель управления';
        if (initialPage !== 'Панель управления') {
            headerActions.style.display = 'none';
            setPageContent(`<p style="color:#444">Раздел "${initialPage}" находится в разработке.</p>`);
        }
    }

    // Бейдж "Материалы семей" (красные выдачи) — подгружаем в фоне для сайдбара
    try {
        await loadFamilyMaterials();
    } catch (_) {}

    // Бейдж "Материалы фракций" — тоже подгружаем в фоне
    try {
        await loadFactionMaterials();
    } catch (_) {}
})();

const profileButton = document.getElementById('profile-button');
const profileMenu = document.getElementById('profile-menu');
function closeProfileMenu() { profileMenu?.classList.remove('open'); }
profileButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('open');
});
document.addEventListener('click', (e) => {
    if (!profileMenu) return;
    if (profileMenu.classList.contains('open')) {
        closeProfileMenu();
    }
});
profileMenu?.addEventListener('click', (e) => e.stopPropagation());

function openModal() {
    document.getElementById('family-form').reset();
    document.getElementById('edit-index').value = "";
    document.getElementById('modal-title').textContent = "Добавить семью";
    document.getElementById('modal-overlay').classList.add('is-open');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('is-open'); }

document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});
        
function editFamily(i) {
    const f = families[i];
    document.getElementById('fam-name').value = f.name;
    document.getElementById('fam-id').value = f.id;
    document.getElementById('fam-leader').value = f.leader || '';
    document.getElementById('fam-discord').value = f.discord || '';
    document.getElementById('edit-index').value = i;
    document.getElementById('modal-title').textContent = "Редактировать семью";
    document.getElementById('modal-overlay').classList.add('is-open');
}

const confirmModal = document.getElementById('confirm-modal-overlay');
const confirmTitleEl = document.getElementById('confirm-title');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');
let confirmCallback = null;

function openConfirm(options) {
    const { title, message, onConfirm } = options || {};
    confirmTitleEl.textContent = title || 'Подтверждение';
    confirmMessageEl.textContent = message || 'Вы уверены, что хотите выполнить это действие?';
    confirmCallback = typeof onConfirm === 'function' ? onConfirm : null;
    confirmModal.classList.add('is-open');
}
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

// мат. выдачи семей (остальной код уже выше) завершён

