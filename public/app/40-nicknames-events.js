// Events calendar + nicknames moderation section.

window.nickMonth = {
  year: new Date().getFullYear(),
  month: new Date().getMonth()
};
window.eventsMonth = {
  year: new Date().getFullYear(),
  month: new Date().getMonth()
};

window.getNickDatesForMonth = function getNickDatesForMonth(year, monthIndex, allowedDays) {
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
};

window.renderEventsCalendar = function renderEventsCalendar() {
  const { year, month } = window.eventsMonth;
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
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
      const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push(`
                <div class="events-day" data-date="${isoDate}">
                    <div class="events-day-number">${dayNum}</div>
                    <div class="events-day-body"></div>
                </div>
            `);
    }
  }

  window.setPageContent(`
        <div class="events-page">
            <div class="nick-page-header">
                <div>
                    <div class="nick-title">Мероприятия</div>
                </div>
                <div class="events-month-control">
                    <button type="button" class="events-month-nav" id="events-month-prev-btn" aria-label="Предыдущий месяц">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M15 18l-6-6 6-6"></path>
                        </svg>
                    </button>
                    <div class="events-month-label" id="events-month-label">${monthLabel}</div>
                    <button type="button" class="events-month-nav" id="events-month-next-btn" aria-label="Следующий месяц">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 18l6-6-6-6"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="events-calendar-layout">
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

                <aside class="events-right-panel" id="events-right-panel">
                    <div class="events-right-title">Сегодня</div>
                    <div class="events-right-subtitle" id="events-right-subtitle"></div>
                    <div class="events-right-list" id="events-right-list"></div>
                    <button type="button" class="events-new-btn events-right-new-btn" id="events-right-new-btn">
                        <span class="events-new-btn-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 8v8"></path>
                                <path d="M8 12h8"></path>
                            </svg>
                        </span>
                        Новое мероприятие
                    </button>
                </aside>
            </div>
        </div>
    `);

  // load & bind events for this month
  if (typeof window.loadEventsForMonth === 'function') {
    window.loadEventsForMonth(year, month).then(() => {
      if (typeof window.attachEventsCalendarInteractions === 'function') {
        window.attachEventsCalendarInteractions(year, month);
      }
    });
  } else if (typeof window.attachEventsCalendarInteractions === 'function') {
    window.attachEventsCalendarInteractions(year, month);
  }

  // Переключение месяцев: prev/next
  const prevBtn = document.getElementById('events-month-prev-btn');
  const nextBtn = document.getElementById('events-month-next-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      window.eventsMonth.month -= 1;
      if (window.eventsMonth.month < 0) {
        window.eventsMonth.month = 11;
        window.eventsMonth.year -= 1;
      }
      window.renderEventsCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      window.eventsMonth.month += 1;
      if (window.eventsMonth.month > 11) {
        window.eventsMonth.month = 0;
        window.eventsMonth.year += 1;
      }
      window.renderEventsCalendar();
    });
  }
};

window.renderNicknames = function renderNicknames() {
  const { year, month } = window.nickMonth;
  const datesTueThu = window.getNickDatesForMonth(year, month, [2, 4]); // вт, чт
  const datesMon = window.getNickDatesForMonth(year, month, [1]); // пн
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
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
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
    return `<tr><td>${window.escapeHtml(name)}</td>${cells}</tr>`;
  }).join('');

  const bodyRowsBottom = factions.map(name => {
    const cells = allDates.map(d => {
      return bottomSet.has(dateKey(d)) ? `<td>—</td>` : `<td></td>`;
    }).join('');
    return `<tr><td>${window.escapeHtml(name)}</td>${cells}</tr>`;
  }).join('');

  window.setPageContent(`
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
          window.nickMonth.month = m;
          dropdown.classList.remove('open');
          window.renderNicknames();
        }
      });
    });
  }
};

