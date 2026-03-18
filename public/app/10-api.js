// Data loading functions.

window.loadFamilies = async function loadFamilies() {
  try {
    const res = await fetch('/api/families');
    const data = await res.json();
    window.families = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Ошибка загрузки семей:', e);
    window.families = [];
  }
};

// Раздел "Аккаунты" отключён (кнопка убрана), API оставлено на будущее
window.loadAccounts = async function loadAccounts() {
  window.accounts = [];
};

window.loadFamilyMaterials = async function loadFamilyMaterials() {
  try {
    const res = await fetch('/api/family-materials');
    const data = await res.json();
    window.familyMaterials = Array.isArray(data) ? data : [];
    window.updateFamilyMaterialsBadge();
  } catch (e) {
    console.error('Ошибка загрузки материалов семей:', e);
    window.familyMaterials = [];
    window.updateFamilyMaterialsBadge();
  }
};

window.loadFactionMaterials = async function loadFactionMaterials() {
  try {
    const res = await fetch('/api/faction-materials');
    const data = await res.json();
    window.factionMaterials = Array.isArray(data) ? data : [];
    window.updateFactionMaterialsBadge();
  } catch (e) {
    console.error('Ошибка загрузки материалов фракций:', e);
    window.factionMaterials = [];
    window.updateFactionMaterialsBadge();
  }
};

window.loadUsers = async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('forbidden');
    const data = await res.json();
    window.usersList = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Ошибка загрузки пользователей:', e);
    window.usersList = [];
  }
};

window.loadLeaders = async function loadLeaders() {
  try {
    const res = await fetch('/api/leaders');
    const data = await res.json();
    window.leaders = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Ошибка загрузки лидеров:', e);
    window.leaders = [];
  }
};

