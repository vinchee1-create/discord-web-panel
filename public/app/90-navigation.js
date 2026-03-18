// Navigation + initial page bootstrap + profile menu.

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
    window.pageTitle.textContent = title;
    if (title === 'Семьи') {
      window.headerActions.style.display = 'flex';
      const b = document.getElementById('btn-add-family');
      if (b) {
        b.onclick = window.openModal;
        b.querySelector('span:last-child').textContent = 'Добавить семью';
      }
      await window.loadFamilies();
      window.renderFamilies();
    } else if (title === 'Лидеры') {
      window.headerActions.style.display = 'none';
      await window.loadLeaders();
      window.renderLeaders();
    } else if (title === 'Мероприятия') {
      window.headerActions.style.display = 'none';
      window.renderEventsCalendar();
    } else if (title === 'Материалы семей') {
      window.headerActions.style.display = 'flex';
      const b = document.getElementById('btn-add-family');
      if (b) {
        b.onclick = window.openMaterialsModal;
        b.querySelector('span:last-child').textContent = 'Добавить';
      }
      await window.loadFamilies();
      await window.loadFamilyMaterials();
      window.renderFamilyMaterials();
    } else if (title === 'Материалы фракций') {
      window.headerActions.style.display = 'flex';
      const b = document.getElementById('btn-add-family');
      if (b) {
        b.onclick = window.openFactionMaterialsModal;
        b.querySelector('span:last-child').textContent = 'Добавить';
      }
      await window.loadLeaders();
      await window.loadFactionMaterials();
      window.renderFactionMaterials();
    } else if (title === 'Модерация') {
      window.headerActions.style.display = 'none';
      window.renderNicknames();
    } else if (title === 'Пользователи') {
      window.headerActions.style.display = 'none';
      await window.loadUsers();
      window.renderUsers();
    } else {
      window.headerActions.style.display = 'none';
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
    window.renderEventsCalendar();
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
  } else {
    // Для остальных страниц пока просто заголовок и плейсхолдер "в разработке"
    window.pageTitle.textContent = window.initialPage || 'Панель управления';
    if (window.initialPage !== 'Панель управления') {
      window.headerActions.style.display = 'none';
      window.setPageContent(`<p style="color:#444">Раздел "${window.initialPage}" находится в разработке.</p>`);
    }
  }

  // Бейдж "Материалы семей" (красные выдачи) — подгружаем в фоне для сайдбара
  try { await window.loadFamilyMaterials(); } catch (_) { }
  // Бейдж "Материалы фракций" — тоже подгружаем в фоне
  try { await window.loadFactionMaterials(); } catch (_) { }
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

// Default placeholder
window.setPageContent(`<p style="color:#444">Выберите раздел в меню слева.</p>`);

