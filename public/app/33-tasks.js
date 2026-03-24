// Раздел «Задачи» — сетка карточек и модалка (Заголовок / Описание), по аналогии с материалами семей.

const taskModal = document.getElementById('task-modal-overlay');
const taskForm = document.getElementById('task-form');
const taskModalTitle = document.getElementById('task-modal-title');
const taskTitleInput = document.getElementById('task-title');
const taskDescriptionInput = document.getElementById('task-description');
const taskDeleteBtn = document.getElementById('task-delete-btn');
const taskCompletedBtn = document.getElementById('task-completed-btn');
const taskViewModal = document.getElementById('task-view-overlay');
const taskViewTitle = document.getElementById('task-view-title');
const taskViewBody = document.getElementById('task-view-body');

function taskPreviewDescription(text, maxLen) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

window.closeTaskModal = function closeTaskModal() {
  if (taskModal) taskModal.classList.remove('is-open');
  window.editingTaskIndex = -1;
};

window.openTaskModal = function openTaskModal(index) {
  if (!taskModal || !taskTitleInput || !taskDescriptionInput) return;
  const idx =
    typeof index === 'number' && !Number.isNaN(index) && index >= 0 ? Math.floor(index) : -1;
  window.editingTaskIndex = idx;

  if (idx >= 0 && window.tasks[idx]) {
    const item = window.tasks[idx];
    taskTitleInput.value = item.title || '';
    taskDescriptionInput.value = item.description || '';
    if (taskModalTitle) taskModalTitle.textContent = 'Редактировать задачу';
    if (taskDeleteBtn) taskDeleteBtn.style.display = 'inline-flex';
    if (taskCompletedBtn) {
      taskCompletedBtn.style.display = 'inline-flex';
      taskCompletedBtn.title = item.completed ? 'Вернуть в работу' : 'Отметить как выполненную';
    }
  } else {
    taskTitleInput.value = '';
    taskDescriptionInput.value = '';
    if (taskModalTitle) taskModalTitle.textContent = 'Новая задача';
    if (taskDeleteBtn) taskDeleteBtn.style.display = 'none';
    if (taskCompletedBtn) taskCompletedBtn.style.display = 'none';
  }
  taskModal.classList.add('is-open');
};

window.openTaskView = function openTaskView(index) {
  const item = window.tasks[index];
  if (!item || !taskViewModal || !taskViewTitle || !taskViewBody) return;
  taskViewTitle.textContent = item.title || 'Задача';
  taskViewBody.textContent = (item.description || '').trim() || '—';
  taskViewModal.classList.add('is-open');
};

window.renderTasks = function renderTasks() {
  const sorted = window.tasks
    .map((item, idx) => ({ ...item, _idx: idx }))
    .sort((a, b) => {
      if (a.completed === b.completed) return a._idx - b._idx;
      return a.completed ? 1 : -1;
    });

  const cards = sorted.map((item) => {
    const created = item.createdAt ? new Date(item.createdAt) : null;
    const timeLabel =
      created && !isNaN(created.getTime())
        ? created.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '';
    const safeTitle = window.escapeHtml(item.title || 'Без названия');
    const preview = taskPreviewDescription(item.description, 200);
    const safePreview = preview ? window.escapeHtml(preview) : '';
    const descBlock = safePreview
      ? `<div class="materials-card-meta" style="margin-top:6px;font-size:12px;color:rgba(255,255,255,0.8);"><div class="materials-card-meta-line">${safePreview}</div></div>`
      : '';
    return `
        <div class="materials-card ${item.completed ? 'issued' : 'pending'}" onclick="window.openTaskView(${item._idx})">
            <div class="materials-card-header">
                <div class="materials-card-header-main">
                    <div class="materials-card-title">${safeTitle}</div>
                </div>
                <div class="materials-card-time">${timeLabel}</div>
            </div>
            ${descBlock}
            <div style="margin-top:8px; display:flex; justify-content:flex-end;">
                <button type="button" class="materials-edit-btn" onclick="event.stopPropagation(); window.openTaskModal(${item._idx});" title="Редактировать задачу">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
                </button>
            </div>
        </div>`;
  }).join('');

  window.setPageContent(`
        <div class="materials-page">
            <div class="materials-grid">
                ${cards || '<div style="color:rgba(255,255,255,0.5);font-size:13px;">Пока нет задач.</div>'}
            </div>
        </div>
    `);
};

window.deleteCurrentTask = function deleteCurrentTask() {
  if (window.editingTaskIndex < 0 || !window.tasks[window.editingTaskIndex]) return;
  const idx = window.editingTaskIndex;
  (async () => {
    const item = window.tasks[idx];
    try {
      if (item && item.dbId != null) {
        const res = await fetch(`/api/tasks/${item.dbId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
      }
      window.closeTaskModal();
      window.tasks.splice(idx, 1);
      window.renderTasks();
    } catch (e) {
      console.error(e);
      window.showToast('Не удалось удалить задачу.', 'error');
    }
  })();
};

window.markTaskCompleted = function markTaskCompleted() {
  if (window.editingTaskIndex < 0 || !window.tasks[window.editingTaskIndex]) return;
  (async () => {
    const item = window.tasks[window.editingTaskIndex];
    const title = (taskTitleInput?.value || '').trim() || item.title || '';
    const description = taskDescriptionInput?.value ?? item.description ?? '';
    const newCompleted = !item.completed;
    try {
      if (item.dbId != null) {
        const res = await fetch(`/api/tasks/${item.dbId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            completed: newCompleted
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'error');
        const updated = await res.json();
        window.tasks[window.editingTaskIndex] = updated;
      } else {
        window.tasks[window.editingTaskIndex].completed = newCompleted;
        window.tasks[window.editingTaskIndex].title = title;
        window.tasks[window.editingTaskIndex].description = description;
      }
      if (taskCompletedBtn) {
        taskCompletedBtn.title = newCompleted ? 'Вернуть в работу' : 'Отметить как выполненную';
      }
      window.closeTaskModal();
      window.renderTasks();
    } catch (e) {
      console.error(e);
      window.showToast('Не удалось изменить статус задачи.', 'error');
    }
  })();
};

if (taskModal) {
  taskModal.addEventListener('click', (e) => {
    if (e.target === taskModal) window.closeTaskModal();
  });
}
if (taskViewModal) {
  taskViewModal.addEventListener('click', (e) => {
    if (e.target === taskViewModal) taskViewModal.classList.remove('is-open');
  });
}

if (taskForm) {
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = (taskTitleInput?.value || '').trim();
    if (!title) {
      window.showToast('Укажите заголовок.', 'error');
      return;
    }
    const description = (taskDescriptionInput?.value || '').trim();
    (async () => {
      try {
        if (window.editingTaskIndex >= 0 && window.tasks[window.editingTaskIndex]) {
          const item = window.tasks[window.editingTaskIndex];
          if (item.dbId != null) {
            const res = await fetch(`/api/tasks/${item.dbId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title,
                description,
                completed: !!item.completed
              })
            });
            if (!res.ok) throw new Error((await res.json()).error || 'error');
            const updated = await res.json();
            window.tasks[window.editingTaskIndex] = updated;
          } else {
            window.tasks[window.editingTaskIndex] = {
              ...item,
              title,
              description
            };
          }
        } else {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
          });
          if (!res.ok) throw new Error((await res.json()).error || 'error');
          const created = await res.json();
          window.tasks.push(created);
        }
        window.closeTaskModal();
        window.renderTasks();
      } catch (err) {
        console.error(err);
        window.showToast('Не удалось сохранить задачу.', 'error');
      }
    })();
  });
}

if (taskDeleteBtn) {
  taskDeleteBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    window.deleteCurrentTask();
  });
}
if (taskCompletedBtn) {
  taskCompletedBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    window.markTaskCompleted();
  });
}
