// Users section UI + modals.

window.renderUsers = function renderUsers() {
  const editSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  const trashSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>';
  const rows = window.usersList.map(u => `
        <tr>
            <td>${window.escapeHtml(u.username)}</td>
            <td>${window.escapeHtml(u.roleName)}</td>
            <td>${u.roleLevel}</td>
            <td class="cell-actions-users">
                <button type="button" class="btn-icon" onclick="openUserEditModal(${u.dbId})" title="Редактировать">${editSvg}</button>
                <button type="button" class="btn-icon btn-icon-delete" onclick="deleteUser(${u.dbId})" title="Удалить">${trashSvg}</button>
            </td>
        </tr>
    `).join('');
  window.setPageContent(`
        <div class="workspace-panel">
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
        </div>
    `);
};

const userModal = document.getElementById('user-modal-overlay');
const userForm = document.getElementById('user-form');
const userEditModal = document.getElementById('user-edit-modal-overlay');
const userEditForm = document.getElementById('user-edit-form');

window.openUserModal = function openUserModal() {
  document.getElementById('user-username').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value = 'Curator';
  userModal.classList.add('is-open');
};
function closeUserModal() {
  userModal.classList.remove('is-open');
}
userModal.addEventListener('click', function (e) {
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
    await window.loadUsers();
    window.renderUsers();
  } catch (err) {
    console.error(err);
    alert('Не удалось создать пользователя');
  }
};

window.openUserEditModal = function openUserEditModal(dbId) {
  const u = window.usersList.find(x => x.dbId === dbId);
  if (!u) return;
  document.getElementById('user-edit-id').value = String(dbId);
  document.getElementById('user-edit-username').value = u.username;
  document.getElementById('user-edit-role').value = '';
  document.getElementById('user-edit-password').value = '';
  userEditModal.classList.add('is-open');
};
function closeUserEditModal() {
  userEditModal.classList.remove('is-open');
}
userEditModal.addEventListener('click', function (e) {
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
    await window.loadUsers();
    window.renderUsers();
  } catch (err) {
    console.error(err);
    alert('Не удалось сохранить пользователя');
  }
};

window.deleteUser = async function deleteUser(dbId) {
  if (!confirm('Удалить пользователя? Доступ будет отозван.')) return;
  try {
    const res = await fetch(`/api/users/${dbId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error || 'error');
    await window.loadUsers();
    window.renderUsers();
  } catch (err) {
    console.error(err);
    alert('Не удалось удалить пользователя');
  }
};

