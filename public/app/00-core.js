// Shared state, DOM refs, and utilities.

// State
window.families = [];
window.familyMaterials = [];
window.factionMaterials = [];
window.editingMaterialIndex = -1;
window.editingFactionMaterialIndex = -1;
window.accounts = []; // accounts section disabled
window.usersList = [];
window.leaders = [];

// Bootstrap
window.currentUser = window.__BOOTSTRAP__?.currentUser ?? null;
window.initialPage = window.__BOOTSTRAP__?.initialPage || 'Панель управления';
window.eventDetailPath = window.__BOOTSTRAP__?.eventDetailPath ?? null;

// DOM refs
window.toastRoot = document.getElementById('toast-root');
window.familyMaterialsBadge = document.getElementById('nav-badge-family-materials');
window.factionMaterialsBadge = document.getElementById('nav-badge-faction-materials');
window.pageContent = document.getElementById('page-content');
window.pageTitle = document.getElementById('current-title');
window.headerActions = document.getElementById('header-actions');
window.leaderModal = document.getElementById('leader-modal-overlay');
window.leaderForm = document.getElementById('leader-form');

window.showToast = function showToast(message, variant = 'error', timeout = 3000) {
  if (!window.toastRoot) return;
  const el = document.createElement('div');
  el.className = `toast toast-${variant}`;
  el.textContent = message;
  window.toastRoot.appendChild(el);
  // force reflow
  void el.offsetWidth;
  el.classList.add('toast-show');
  setTimeout(() => {
    el.classList.remove('toast-show');
    setTimeout(() => {
      el.remove();
    }, 200);
  }, timeout);
};

window.updateFamilyMaterialsBadge = function updateFamilyMaterialsBadge() {
  if (!window.familyMaterialsBadge) return;
  const pending = (window.familyMaterials || []).filter(x => !x.issued).length;
  if (pending > 0) {
    window.familyMaterialsBadge.textContent = String(pending);
    window.familyMaterialsBadge.style.display = 'inline-flex';
  } else {
    window.familyMaterialsBadge.style.display = 'none';
  }
};

window.updateFactionMaterialsBadge = function updateFactionMaterialsBadge() {
  if (!window.factionMaterialsBadge) return;
  const pending = (window.factionMaterials || []).filter(x => !x.issued).length;
  if (pending > 0) {
    window.factionMaterialsBadge.textContent = String(pending);
    window.factionMaterialsBadge.style.display = 'inline-flex';
  } else {
    window.factionMaterialsBadge.style.display = 'none';
  }
};

window.setPageContent = function setPageContent(html) {
  window.pageContent.innerHTML = html;
  window.pageContent.classList.remove('page-fade');
  // force reflow to restart animation
  void window.pageContent.offsetWidth;
  window.pageContent.classList.add('page-fade');
};

window.escapeHtml = function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
};

