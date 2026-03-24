// Navigation + initial page bootstrap + profile menu.
// Helps prevent "old page" flashes when users switch tabs quickly.
window.__navRequestId = window.__navRequestId ?? 0;

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const navReqId = ++window.__navRequestId;
    const href = btn.getAttribute('href');
    if (href && href !== window.location.pathname) {
      window.history.pushState({}, '', href);
    }
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    const title = btn.getAttribute('data-title');
    window.pageTitle.textContent = title;
    // Clear content immediately to avoid showing the previous page during async loads.
    window.setPageContent(`<p style="color:rgba(255,255,255,0.55)">Загрузка...</p>`);
    if (title === 'Семьи') {
      window.headerActions.style.display = 'flex';
      const b = document.getElementById('btn-add-family');
      if (b) {
        b.onclick = window.openModal;
        b.querySelector('span:last-child').textContent = 'Добавить семью';
      }
      await window.loadFamilies();
      if (window.__navRequestId !== navReqId) return;
      window.renderFamilies();
    } else if (title === 'Лидеры') {
      window.headerActions.style.display = 'none';
      await window.loadLeaders();
      if (window.__navRequestId !== navReqId) return;
      window.renderLeaders();
    } else if (title === 'Мероприятия') {
      window.headerActions.style.display = 'none';
      if (window.__navRequestId !== navReqId) return;
      window.renderEventsCalendar();
    } else if (title === 'Материалы семей') {
      window.headerActions.style.display = 'flex';
      const b = document.getElementById('btn-add-family');
      if (b) {
        b.onclick = window.openMaterialsModal;
        b.querySelector('span:last-child').textContent = 'Добавить';
      }
      await window.loadFamilies();
      if (window.__navRequestId !== navReqId) return;
      await window.loadFamilyMaterials();
      if (window.__navRequestId !== navReqId) return;
      window.renderFamilyMaterials();
    } else if (title === 'Материалы фракций') {
      window.headerActions.style.display = 'flex';
      const b = document.getElementById('btn-add-family');
      if (b) {
        b.onclick = window.openFactionMaterialsModal;
        b.querySelector('span:last-child').textContent = 'Добавить';
      }
      await window.loadLeaders();
      if (window.__navRequestId !== navReqId) return;
      await window.loadFactionMaterials();
      if (window.__navRequestId !== navReqId) return;
      window.renderFactionMaterials();
    } else if (title === 'Модерация') {
      window.headerActions.style.display = 'none';
      if (window.__navRequestId !== navReqId) return;
      window.renderNicknames();
    } else if (title === 'Пользователи') {
      window.headerActions.style.display = 'none';
      await window.loadUsers();
      if (window.__navRequestId !== navReqId) return;
      window.renderUsers();
    } else if (title === 'Настройки') {
      window.headerActions.style.display = 'none';
      if (window.__navRequestId !== navReqId) return;
      await window.renderSettings();
    } else if (title === 'Кураторы') {
      window.headerActions.style.display = 'none';
      await window.loadCurators();
      if (window.__navRequestId !== navReqId) return;
      window.renderCurators();
    } else if (title === 'Главная') {
      window.headerActions.style.display = 'none';
      await window.loadDashboard();
      if (window.__navRequestId !== navReqId) return;
      window.renderDashboard();
    } else if (title === 'Задачи') {
      window.headerActions.style.display = 'flex';
      const b = document.getElementById('btn-add-family');
      if (b) {
        b.onclick = window.openTaskModal;
        b.querySelector('span:last-child').textContent = 'Добавить';
      }
      await window.loadTasks();
      if (window.__navRequestId !== navReqId) return;
      window.renderTasks();
    } else {
      window.headerActions.style.display = 'none';
      if (window.__navRequestId !== navReqId) return;
      window.setPageContent(`<p style="color:#444">Раздел "${title}" находится в разработке.</p>`);
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

  if (window.initialPage === 'Семьи') {
    window.pageTitle.textContent = 'Семьи';
    window.headerActions.style.display = 'flex';
    const b = document.getElementById('btn-add-family');
    if (b) {
      b.onclick = window.openModal;
      b.querySelector('span:last-child').textContent = 'Добавить семью';
    }
    await window.loadFamilies();
    window.renderFamilies();
  } else if (window.initialPage === 'Лидеры') {
    window.pageTitle.textContent = 'Лидеры';
    window.headerActions.style.display = 'none';
    await window.loadLeaders();
    window.renderLeaders();
  } else if (window.initialPage === 'Мероприятия') {
    window.pageTitle.textContent = 'Мероприятия';
    window.headerActions.style.display = 'none';
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    const evNav = document.querySelector('.nav-item[href="/events"]');
    if (evNav) evNav.classList.add('active');
    if (window.eventDetailPath && typeof window.prepareEventDetailPage === 'function') {
      await window.prepareEventDetailPage(window.eventDetailPath);
    }
    if (window.eventDetailPath && typeof window.renderEventDetailPage === 'function') {
      window.renderEventDetailPage(window.eventDetailPath);
    } else {
      window.renderEventsCalendar();
    }
  } else if (window.initialPage === 'Материалы семей') {
    window.pageTitle.textContent = 'Материалы семей';
    window.headerActions.style.display = 'flex';
    const b = document.getElementById('btn-add-family');
    if (b) {
      b.onclick = window.openMaterialsModal;
      b.querySelector('span:last-child').textContent = 'Добавить';
    }
    await window.loadFamilies();
    await window.loadFamilyMaterials();
    window.renderFamilyMaterials();
  } else if (window.initialPage === 'Материалы фракций') {
    window.pageTitle.textContent = 'Материалы фракций';
    window.headerActions.style.display = 'flex';
    const b = document.getElementById('btn-add-family');
    if (b) {
      b.onclick = window.openFactionMaterialsModal;
      b.querySelector('span:last-child').textContent = 'Добавить';
    }
    await window.loadLeaders();
    await window.loadFactionMaterials();
    window.renderFactionMaterials();
  } else if (window.initialPage === 'Модерация') {
    window.pageTitle.textContent = 'Модерация';
    window.headerActions.style.display = 'none';
    window.renderNicknames();
  } else if (window.initialPage === 'Пользователи') {
    window.pageTitle.textContent = 'Пользователи';
    window.headerActions.style.display = 'none';
    await window.loadUsers();
    window.renderUsers();
  } else if (window.initialPage === 'Настройки') {
    window.pageTitle.textContent = 'Настройки';
    window.headerActions.style.display = 'none';
    await window.renderSettings();
  } else if (window.initialPage === 'Кураторы') {
    window.pageTitle.textContent = 'Кураторы';
    window.headerActions.style.display = 'none';
    await window.loadCurators();
    window.renderCurators();
  } else if (window.initialPage === 'Задачи') {
    window.pageTitle.textContent = 'Задачи';
    window.headerActions.style.display = 'flex';
    const b = document.getElementById('btn-add-family');
    if (b) {
      b.onclick = window.openTaskModal;
      b.querySelector('span:last-child').textContent = 'Добавить';
    }
    await window.loadTasks();
    window.renderTasks();
  } else if (window.initialPage === 'Главная') {
    window.pageTitle.textContent = 'Главная';
    window.headerActions.style.display = 'none';
    await window.loadDashboard();
    window.renderDashboard();
  } else {
    window.pageTitle.textContent = window.initialPage || 'Главная';
    window.headerActions.style.display = 'none';
    window.setPageContent(`<p style="color:#444">Раздел "${window.initialPage}" находится в разработке.</p>`);
  }

  // Бейдж "Материалы семей" (красные выдачи) — подгружаем в фоне для сайдбара
  try { await window.loadFamilyMaterials(); } catch (_) { }
  // Бейдж "Материалы фракций" — тоже подгружаем в фоне
  try { await window.loadFactionMaterials(); } catch (_) { }

})();

/* Логотип B — на главную без перезагрузки */
document.querySelector('aside.sidebar a.sidebar-brand')?.addEventListener('click', (e) => {
  const home = document.querySelector('.nav-item[href="/"]');
  if (home) {
    e.preventDefault();
    home.click();
  }
});

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
