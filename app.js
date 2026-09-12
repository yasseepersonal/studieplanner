// ==========================================
// 1. SUPABASE CONFIGURATIE (VUL HIER JE GEGEVENS IN)
// ==========================================
const SUPABASE_URL = "https://lcmjzgqjlkeauabgqtjs.supabase.co";// Jouw Project UR
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbWp6Z3FqbGtlYXVhYmdxdGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjAwMjksImV4cCI6MjEwNDc5NjAyOX0.CHSDiIcLxhre7Dc3IN-v65v3iPGhT9r5OXY8N0Wttj8"; // Jouw anon public key
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- STATE & DATA ---
let tasks = [];
let userPin = localStorage.getItem('study_user_pin') || '';

let currentView = 'week'; // 'week' | 'rolling7' | 'courses'
let timeUnit = localStorage.getItem('study_time_unit') || 'hours'; // 'hours' | 'minutes'

let searchQuery = '';
let selectedCourseFilter = '';

let currentWeekMonday = getMonday(new Date());
let rollingStartDate = new Date();
rollingStartDate.setHours(0, 0, 0, 0);

let activeMatrixDate = null;
let activeTimerTaskId = null;

// Timer State (Tijdstempel-gebaseerd)
let timerInterval = null;
let timerStartTime = null;
let timerAccumulatedSeconds = 0;
let quoteInterval = null;
let draggedTaskId = null;

const focusQuotes = [
  "\"Kalmte in het dal, helderheid op de top.\"",
  "\"Stap voor stap, zonder haast. De berg beweegt niet.\"",
  "\"Volledige aandacht voor deze ene taak.\"",
  "\"De rust van de natuur brengt rust in de geest.\"",
  "\"Adem rustig in. Begin eenvoudig.\""
];

const circleRadius = 115;
const circumference = 2 * Math.PI * circleRadius;

// ==========================================
// 2. PINCODE AUTHENTICATIE & INITIALISATIE
// ==========================================
function checkAuthAndInit() {
  if (!userPin) {
    document.getElementById('pin-modal').classList.remove('hidden');
  } else {
    initApp();
  }
}

document.getElementById('pin-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const inputPin = document.getElementById('pin-input').value.trim();
  if (inputPin) {
    userPin = inputPin;
    localStorage.setItem('study_user_pin', userPin);
    document.getElementById('pin-modal').classList.add('hidden');
    initApp();
  }
});

function initApp() {
  fetchTasksFromCloud();
  setupRealtimeSubscription();
}

// ==========================================
// 3. CLOUD DATABASE ACTIES (SUPABASE)
// ==========================================
async function fetchTasksFromCloud() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    // Filter lokaal op basis van de pincode (zo ziet alleen de bezitter van de pin zijn taken)
    const userTasks = (data || []).filter(t => t.notes && t.notes.includes(`[PIN:${userPin}]`));

    tasks = userTasks.map(t => ({
      id: t.id,
      title: t.title,
      course: t.course,
      estimatedHours: Number(t.estimated_hours) || 0,
      actualHours: Number(t.actual_hours) || 0,
      deadline: t.deadline,
      scheduledDate: t.scheduled_date,
      isUrgent: t.is_urgent,
      isImportant: t.is_important,
      status: t.status,
      completed: t.status === 'done',
      link: t.link,
      parentId: t.parent_id,
      notes: (t.notes || '').replace(`[PIN:${userPin}]`, '').trim()
    }));

    renderApp();
  } catch (err) {
    console.error("Fout bij ophalen:", err);
  }
}

async function saveTaskToCloud(task) {
  if (!supabaseClient) return;

  const dbRecord = {
    id: task.id,
    title: task.title,
    course: task.course || null,
    estimated_hours: task.estimatedHours || 0,
    actual_hours: task.actualHours || 0,
    deadline: task.deadline || null,
    scheduled_date: task.scheduledDate || null,
    is_urgent: Boolean(task.isUrgent),
    is_important: Boolean(task.isImportant),
    status: task.status || 'not_started',
    link: task.link || null,
    parent_id: task.parentId || null,
    notes: `${task.notes || ''} [PIN:${userPin}]`
  };

  const { error } = await supabaseClient.from('tasks').upsert(dbRecord);
  if (error) console.error("Fout bij opslaan taak:", error);
}

async function deleteTaskFromCloud(taskId) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId);
  if (error) console.error("Fout bij verwijderen:", error);
}

// Realtime synchronisatie: wijzigingen op ander apparaat direct binnenhalen
function setupRealtimeSubscription() {
  if (!supabaseClient) return;

  supabaseClient
    .channel('tasks-realtime-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
      fetchTasksFromCloud();
    })
    .subscribe();
}

function saveTasks() {
  renderApp();
  if (activeMatrixDate && !document.getElementById('matrix-modal').classList.contains('hidden')) {
    openMatrixModal(activeMatrixDate);
  }
}

// ==========================================
// 4. HULPFUNCTIES & KALENDERLOGICA
// ==========================================
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setHours(0, 0, 0, 0);
  return new Date(date.setDate(diff));
}

function formatDateISO(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function formatDuration(hours) {
  const h = Number(hours) || 0;
  if (timeUnit === 'minutes') {
    const mins = Math.round(h * 60);
    return `${mins}m`;
  }
  return `${h.toFixed(1)}u`;
}

function getPriorityClass(task) {
  if (task.isUrgent && task.isImportant) return 'priority-q1';
  if (!task.isUrgent && task.isImportant) return 'priority-q2';
  if (task.isUrgent && !task.isImportant) return 'priority-q3';
  return 'priority-q4';
}

function isTaskOverdue(task) {
  if (task.completed || task.status === 'done') return false;
  const todayISO = formatDateISO(new Date());
  const scheduledInPast = task.scheduledDate && task.scheduledDate < todayISO;
  const deadlineInPast = task.deadline && task.deadline < todayISO;
  return Boolean(scheduledInPast || deadlineInPast);
}

function filterTasks(taskList) {
  return taskList.filter(task => {
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (task.course && task.course.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.notes && task.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCourse = !selectedCourseFilter || task.course === selectedCourseFilter;
    return matchesSearch && matchesCourse;
  });
}

// ==========================================
// 5. RENDERING (KALENDER, INBOX, VAKKEN)
// ==========================================
function renderApp() {
  const weekGrid = document.getElementById('week-grid');
  const coursesView = document.getElementById('courses-view');
  const navGroup = document.getElementById('nav-arrows-group');

  document.getElementById('unit-hours-btn').classList.toggle('active', timeUnit === 'hours');
  document.getElementById('unit-minutes-btn').classList.toggle('active', timeUnit === 'minutes');

  updateFilterOptions();
  renderCountdownWidget();

  if (currentView === 'courses') {
    weekGrid.classList.add('hidden');
    coursesView.classList.remove('hidden');
    navGroup.classList.add('hidden');
    document.getElementById('current-week-label').textContent = 'Vakken & Categorieën';
    renderCoursesView();
  } else {
    coursesView.classList.add('hidden');
    weekGrid.classList.remove('hidden');
    navGroup.classList.remove('hidden');
    renderCalendarGrid();
  }

  renderInbox();
  updateParentTaskOptions();
}

function renderCountdownWidget() {
  const container = document.getElementById('countdown-list');
  container.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingDeadlines = tasks
    .filter(t => t.deadline && !t.completed && t.status !== 'done')
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4);

  if (upcomingDeadlines.length === 0) {
    container.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted)">Geen actieve deadlines</span>';
    return;
  }

  upcomingDeadlines.forEach(task => {
    const dDate = new Date(task.deadline + 'T00:00:00');
    const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));

    let badgeClass = 'countdown-days';
    let badgeText = `${diffDays}d`;

    if (diffDays < 0) {
      badgeClass += ' urgent';
      badgeText = `${Math.abs(diffDays)}d te laat`;
    } else if (diffDays === 0) {
      badgeClass += ' today';
      badgeText = 'Vandaag!';
    } else if (diffDays <= 3) {
      badgeClass += ' urgent';
      badgeText = `${diffDays}d`;
    }

    const item = document.createElement('div');
    item.className = 'countdown-item';
    item.innerHTML = `
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px;" title="${task.title}">
        <strong>${task.course ? task.course + ': ' : ''}</strong>${task.title}
      </span>
      <span class="${badgeClass}">${badgeText}</span>
    `;
    container.appendChild(item);
  });
}

function updateFilterOptions() {
  const select = document.getElementById('course-filter-select');
  const existing = select.value;
  select.innerHTML = '<option value="">Alle vakken</option>';

  const courses = Array.from(new Set(tasks.map(t => t.course ? t.course.trim() : '').filter(Boolean))).sort();
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === existing) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderCalendarGrid() {
  const grid = document.getElementById('week-grid');
  grid.innerHTML = '';

  const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const todayISO = formatDateISO(new Date());

  const startDay = currentView === 'week' ? new Date(currentWeekMonday) : new Date(rollingStartDate);
  const endDay = new Date(startDay);
  endDay.setDate(endDay.getDate() + 6);

  document.getElementById('current-week-label').textContent = 
    `${currentView === 'week' ? 'Kalenderweek' : '7-Dagen'}: ${formatDisplayDate(formatDateISO(startDay))} - ${formatDisplayDate(formatDateISO(endDay))}`;

  for (let i = 0; i < 7; i++) {
    const loopDay = new Date(startDay);
    loopDay.setDate(loopDay.getDate() + i);
    const dayISO = formatDateISO(loopDay);
    const isToday = dayISO === todayISO;

    const dayTasksRaw = tasks.filter(t => t.scheduledDate === dayISO);
    const dayTasks = filterTasks(dayTasksRaw);

    const totalHours = dayTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
    const actualHours = dayTasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);

    const dayCol = document.createElement('div');
    dayCol.className = `day-column ${isToday ? 'is-today' : ''}`;

    dayCol.innerHTML = `
      <div class="day-header">
        <div class="day-title-row">
          <span class="day-name">${dayNames[loopDay.getDay()]} ${formatDisplayDate(dayISO)}</span>
          <button class="btn-matrix-open" onclick="openMatrixModal('${dayISO}')">Matrix</button>
        </div>
        <div class="day-stats">
          Plan: <strong>${formatDuration(totalHours)}</strong> | Werk: <strong>${formatDuration(actualHours)}</strong>
        </div>
      </div>
      <div class="task-list dropzone" id="day-list-${dayISO}" data-date="${dayISO}"></div>
    `;

    const taskListContainer = dayCol.querySelector(`#day-list-${dayISO}`);
    renderTaskHierarchy(taskListContainer, dayTasks);
    setupDropzone(taskListContainer, 'calendar');

    grid.appendChild(dayCol);
  }
}

function renderCoursesView() {
  const container = document.getElementById('courses-grid');
  container.innerHTML = '';

  const coursesSet = new Set();
  tasks.forEach(t => {
    coursesSet.add(t.course && t.course.trim() ? t.course.trim() : 'Zonder Vak');
  });

  const courses = Array.from(coursesSet).sort();

  courses.forEach(courseName => {
    const allCourseTasks = tasks.filter(t => {
      const match = t.course && t.course.trim() ? t.course.trim() : 'Zonder Vak';
      return match === courseName;
    });

    const filteredCourseTasks = filterTasks(allCourseTasks);

    const totalEst = allCourseTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
    const totalAct = allCourseTasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);
    const completedCount = allCourseTasks.filter(t => t.completed || t.status === 'done').length;
    const percent = allCourseTasks.length > 0 ? Math.round((completedCount / allCourseTasks.length) * 100) : 0;

    const courseCard = document.createElement('div');
    courseCard.className = 'course-card';

    courseCard.innerHTML = `
      <div class="course-card-header">
        <div class="course-title-row">
          <div class="course-card-title">${courseName}</div>
          <button class="btn btn-secondary btn-xs" onclick="openTaskModalForCourse('${courseName === 'Zonder Vak' ? '' : courseName}')">+ Taak</button>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-track">
            <div class="progress-bar-fill ${percent === 100 ? 'complete' : ''}" style="width: ${percent}%;"></div>
          </div>
          <span class="progress-bar-percent">${percent}%</span>
        </div>
        <div class="course-card-stats">
          Voltooid: ${completedCount}/${allCourseTasks.length} | Plan: ${formatDuration(totalEst)} | Werk: ${formatDuration(totalAct)}
        </div>
      </div>
      <div class="course-tasks-list course-dropzone" id="course-list-${encodeURIComponent(courseName)}" data-course="${courseName}"></div>
    `;

    const listEl = courseCard.querySelector(`#course-list-${encodeURIComponent(courseName)}`);
    renderTaskHierarchy(listEl, filteredCourseTasks);
    setupDropzone(listEl, 'course');

    container.appendChild(courseCard);
  });
}

function openTaskModalForCourse(courseName) {
  openNewTaskModal();
  document.getElementById('task-course').value = courseName;
}

function renderInbox() {
  const container = document.getElementById('inbox-task-list');
  container.innerHTML = '';

  const overdueTasks = filterTasks(tasks.filter(t => isTaskOverdue(t)));
  const backlogTasks = filterTasks(tasks.filter(t => !t.scheduledDate && !isTaskOverdue(t)));

  document.getElementById('inbox-count').textContent = overdueTasks.length + backlogTasks.length;

  if (overdueTasks.length > 0) {
    const overdueHeader = document.createElement('div');
    overdueHeader.className = 'inbox-section-title overdue-title';
    overdueHeader.innerHTML = `
      <span>In te halen / Te laat</span>
      <span class="badge badge-danger">${overdueTasks.length}</span>
    `;
    container.appendChild(overdueHeader);
    renderTaskHierarchy(container, overdueTasks);
  }

  if (backlogTasks.length > 0 || overdueTasks.length === 0) {
    const backlogHeader = document.createElement('div');
    backlogHeader.className = 'inbox-section-title';
    backlogHeader.innerHTML = `
      <span>Backlog</span>
      <span class="badge">${backlogTasks.length}</span>
    `;
    container.appendChild(backlogHeader);
    renderTaskHierarchy(container, backlogTasks);
  }

  setupDropzone(container, 'calendar');
}

function rescheduleToToday(taskId, event) {
  event.stopPropagation();
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.scheduledDate = formatDateISO(new Date());
    saveTaskToCloud(task);
    saveTasks();
  }
}

function cycleTaskStatus(taskId, event) {
  event.stopPropagation();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const current = task.status || (task.completed ? 'done' : 'not_started');
  if (current === 'not_started') task.status = 'in_progress';
  else if (current === 'in_progress') {
    task.status = 'done';
    task.completed = true;
  } else {
    task.status = 'not_started';
    task.completed = false;
  }
  saveTaskToCloud(task);
  saveTasks();
}

function renderTaskHierarchy(container, taskList) {
  const rootTasks = taskList.filter(t => !t.parentId);

  rootTasks.forEach(task => {
    const card = createTaskCard(task, false);
    container.appendChild(card);

    const subtasks = tasks.filter(t => t.parentId === task.id);
    if (subtasks.length > 0) {
      const subContainer = document.createElement('div');
      subContainer.className = 'subtasks-container';
      subtasks.forEach(sub => {
        subContainer.appendChild(createTaskCard(sub, true));
      });
      container.appendChild(subContainer);
    }
  });

  const orphaned = taskList.filter(t => t.parentId && !rootTasks.some(r => r.id === t.parentId));
  orphaned.forEach(t => container.appendChild(createTaskCard(t, true)));
}

function createTaskCard(task, isSubtask = false) {
  const overdue = isTaskOverdue(task);
  const card = document.createElement('div');
  const isDone = task.completed || task.status === 'done';

  card.className = `task-card ${getPriorityClass(task)} ${isDone ? 'completed' : ''} ${isSubtask ? 'is-subtask' : ''} ${overdue ? 'is-overdue' : ''}`;
  card.setAttribute('draggable', 'true');
  card.dataset.id = task.id;

  card.addEventListener('dragstart', (e) => {
    draggedTaskId = task.id;
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggedTaskId = null;
  });

  const linkHTML = task.link 
    ? `<a href="${task.link}" target="_blank" class="task-link-badge" onclick="event.stopPropagation()">Link &#8599;</a>` 
    : '';

  const overdueBadge = overdue 
    ? `<span class="overdue-badge">&#9888; Te laat!</span>` 
    : '';

  const rescheduleBtn = overdue 
    ? `<button class="btn btn-xs btn-reschedule-today" onclick="rescheduleToToday('${task.id}', event)" title="Verzet naar vandaag">&#10148; Vandaag</button>` 
    : '';

  const statusKey = task.status || (task.completed ? 'done' : 'not_started');
  const statusLabels = { not_started: 'Niet gestart', in_progress: 'Bezig', done: 'Voltooid' };

  card.innerHTML = `
    <div class="task-header-line">
      <span>${isSubtask ? '↳ ' : ''}${task.title}</span>
      <input type="checkbox" ${isDone ? 'checked' : ''} onclick="toggleTaskStatus('${task.id}', event)">
    </div>
    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 4px;">
      ${task.course ? `<span class="task-course-badge">${task.course}</span>` : ''}
      <span class="status-pill status-${statusKey}" onclick="cycleTaskStatus('${task.id}', event)">${statusLabels[statusKey]}</span>
      ${overdueBadge}
    </div>
    <div class="task-meta">
      <span>Tijd: ${formatDuration(task.actualHours || 0)} / ${formatDuration(task.estimatedHours || 0)}</span>
      ${task.deadline ? `<span>Deadl: ${formatDisplayDate(task.deadline)}</span>` : ''}
    </div>
    <div class="task-btn-row">
      ${linkHTML}
      ${rescheduleBtn}
      <button class="btn btn-secondary btn-xs" onclick="openTimerModal('${task.id}', event)">Focus</button>
      <button class="btn btn-secondary btn-xs" onclick="editTask('${task.id}', event)">Bewerk</button>
      <button class="btn btn-secondary btn-xs" onclick="deleteTask('${task.id}', event)">&times;</button>
    </div>
  `;

  return card;
}

// --- DRAG & DROP LOGICA ---
function setupDropzone(el, type) {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('dragover');
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('dragover');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('dragover');
    const id = e.dataTransfer.getData('text/plain') || draggedTaskId;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (type === 'calendar') {
      task.scheduledDate = el.dataset.date || null;
      saveTaskToCloud(task);
      saveTasks();
    } else if (type === 'matrix') {
      task.isUrgent = el.dataset.urgent === 'true';
      task.isImportant = el.dataset.important === 'true';
      saveTaskToCloud(task);
      saveTasks();
    } else if (type === 'course') {
      const targetCourse = el.dataset.course;
      task.course = targetCourse === 'Zonder Vak' ? '' : targetCourse;
      saveTaskToCloud(task);
      saveTasks();
    }
  });
}

// --- EISENHOWER MATRIX ---
const matrixModal = document.getElementById('matrix-modal');
document.getElementById('close-matrix-modal').onclick = () => matrixModal.classList.add('hidden');
document.getElementById('close-matrix-btn').onclick = () => matrixModal.classList.add('hidden');

function openMatrixModal(dateISO) {
  activeMatrixDate = dateISO;
  document.getElementById('matrix-modal-title').textContent = `Eisenhower Matrix: ${formatDisplayDate(dateISO)}`;
  document.getElementById('matrix-modal-subtitle').textContent = `Sleep taken tussen kwadranten om hun prioriteit aan te passen.`;

  const quadrants = [
    { id: 'matrix-q1-list', urgent: true, important: true },
    { id: 'matrix-q2-list', urgent: false, important: true },
    { id: 'matrix-q3-list', urgent: true, important: false },
    { id: 'matrix-q4-list', urgent: false, important: false }
  ];

  const dayTasks = tasks.filter(t => t.scheduledDate === dateISO);

  quadrants.forEach(q => {
    const el = document.getElementById(q.id);
    el.innerHTML = '';
    setupDropzone(el, 'matrix');

    const matching = dayTasks.filter(t => Boolean(t.isUrgent) === q.urgent && Boolean(t.isImportant) === q.important);
    matching.forEach(task => {
      el.appendChild(createTaskCard(task, !!task.parentId));
    });
  });

  matrixModal.classList.remove('hidden');
}

function openTaskModalForQuadrant(urgent, important) {
  openNewTaskModal();
  document.getElementById('task-scheduled-date').value = activeMatrixDate || '';
  document.getElementById('task-urgent').checked = urgent;
  document.getElementById('task-important').checked = important;
}

// --- TAAK TOEVOEGEN / BEWERKEN ---
const taskModal = document.getElementById('task-modal');

function updateParentTaskOptions(selectedParentId = '') {
  const select = document.getElementById('task-parent-id');
  select.innerHTML = '<option value="">-- Geen (hoofdtaak) --</option>';
  tasks.filter(t => !t.parentId).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.title} (${t.course || 'Geen vak'})`;
    if (t.id === selectedParentId) opt.selected = true;
    select.appendChild(opt);
  });
}

function openNewTaskModal() {
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('task-duration-unit').value = timeUnit;
  document.getElementById('task-duration-input').value = timeUnit === 'minutes' ? 60 : 1.0;
  document.getElementById('task-status').value = 'not_started';
  document.getElementById('modal-title').textContent = 'Nieuwe taak toevoegen';
  updateParentTaskOptions();
  taskModal.classList.remove('hidden');
}

document.getElementById('open-new-task-btn').onclick = openNewTaskModal;
document.getElementById('close-task-modal').onclick = () => taskModal.classList.add('hidden');
document.getElementById('cancel-task-btn').onclick = () => taskModal.classList.add('hidden');

function editTask(id, event) {
  event.stopPropagation();
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('task-id').value = task.id;
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-course').value = task.course || '';
  document.getElementById('task-status').value = task.status || (task.completed ? 'done' : 'not_started');

  if (timeUnit === 'minutes') {
    document.getElementById('task-duration-unit').value = 'minutes';
    document.getElementById('task-duration-input').value = Math.round((task.estimatedHours || 0) * 60);
  } else {
    document.getElementById('task-duration-unit').value = 'hours';
    document.getElementById('task-duration-input').value = task.estimatedHours || 1.0;
  }

  document.getElementById('task-deadline').value = task.deadline || '';
  document.getElementById('task-scheduled-date').value = task.scheduledDate || '';
  document.getElementById('task-urgent').checked = !!task.isUrgent;
  document.getElementById('task-important').checked = !!task.isImportant;
  document.getElementById('task-link').value = task.link || '';
  document.getElementById('task-notes').value = task.notes || '';

  updateParentTaskOptions(task.parentId || '');
  document.getElementById('modal-title').textContent = 'Taak bewerken';
  taskModal.classList.remove('hidden');
}

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const parentId = document.getElementById('task-parent-id').value || null;

  const enteredDuration = parseFloat(document.getElementById('task-duration-input').value) || 0;
  const enteredUnit = document.getElementById('task-duration-unit').value;
  const estimatedHours = enteredUnit === 'minutes' ? enteredDuration / 60 : enteredDuration;
  const status = document.getElementById('task-status').value;

  const taskData = {
    title: document.getElementById('task-title').value,
    parentId: parentId,
    course: document.getElementById('task-course').value.trim(),
    status: status,
    completed: status === 'done',
    estimatedHours: estimatedHours,
    deadline: document.getElementById('task-deadline').value || null,
    scheduledDate: document.getElementById('task-scheduled-date').value || null,
    isUrgent: document.getElementById('task-urgent').checked,
    isImportant: document.getElementById('task-important').checked,
    link: document.getElementById('task-link').value || null,
    notes: document.getElementById('task-notes').value || ''
  };

  let savedTask;
  if (id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...taskData };
      savedTask = tasks[idx];
    }
  } else {
    savedTask = {
      id: 'task_' + Date.now(),
      actualHours: 0,
      ...taskData
    };
    tasks.push(savedTask);
  }

  saveTasks();
  taskModal.classList.add('hidden');
  if (savedTask) await saveTaskToCloud(savedTask);
});

function toggleTaskStatus(id, event) {
  event.stopPropagation();
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    task.status = task.completed ? 'done' : 'not_started';
    saveTaskToCloud(task);
    saveTasks();
  }
}

async function deleteTask(id, event) {
  event.stopPropagation();
  if (confirm('Wil je deze taak verwijderen?')) {
    tasks = tasks.filter(t => t.id !== id && t.parentId !== id);
    saveTasks();
    await deleteTaskFromCloud(id);
  }
}

// --- ZEN ALPINE FOCUS TIMER (MET TIMESTAMP CORRECTIE) ---
const timerModal = document.getElementById('timer-modal');
const timerDisplay = document.getElementById('timer-display');
const timerSubStatus = document.getElementById('timer-sub-status');
const timerToggleBtn = document.getElementById('timer-toggle-btn');
const timerSaveBtn = document.getElementById('timer-save-btn');
const focusQuoteEl = document.getElementById('focus-quote');

function setZenProgress(percent) {
  const p = Math.min(100, Math.max(0, percent));
  const circle = document.getElementById('progress-ring-circle');
  if (circle) {
    const offset = circumference - (p / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }
}

function getExactElapsedSeconds() {
  if (!timerStartTime) return timerAccumulatedSeconds;
  const diffInSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
  return timerAccumulatedSeconds + diffInSeconds;
}

function openTimerModal(taskId, event) {
  event.stopPropagation();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  activeTimerTaskId = taskId;
  timerStartTime = null;
  timerAccumulatedSeconds = 0;

  document.getElementById('timer-task-title').textContent = task.title;
  document.getElementById('timer-task-course').textContent = task.course || 'Rustige Focus';
  document.getElementById('timer-estimated').textContent = formatDuration(task.estimatedHours || 0);
  document.getElementById('timer-actual').textContent = formatDuration(task.actualHours || 0);

  timerSubStatus.textContent = 'Adem in • Focus';
  timerToggleBtn.textContent = 'Start Sessie';
  timerToggleBtn.classList.remove('is-running');

  updateTimerDisplay();

  const initialPercent = task.estimatedHours > 0 
    ? ((task.actualHours || 0) / task.estimatedHours) * 100 
    : 0;
  setZenProgress(initialPercent);

  focusQuoteEl.textContent = focusQuotes[Math.floor(Math.random() * focusQuotes.length)];
  if (quoteInterval) clearInterval(quoteInterval);
  quoteInterval = setInterval(() => {
    focusQuoteEl.textContent = focusQuotes[Math.floor(Math.random() * focusQuotes.length)];
  }, 25000);

  timerModal.classList.remove('hidden');
}

function updateTimerDisplay() {
  const totalSec = getExactElapsedSeconds();
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${h}:${m}:${s}`;

  const task = tasks.find(t => t.id === activeTimerTaskId);
  if (task && task.estimatedHours > 0) {
    const totalCurrentHours = (task.actualHours || 0) + (totalSec / 3600);
    const percent = (totalCurrentHours / task.estimatedHours) * 100;
    setZenProgress(percent);
  } else {
    const percent = (totalSec / 1500) * 100;
    setZenProgress(percent);
  }
}

timerToggleBtn.onclick = () => {
  if (timerStartTime) {
    timerAccumulatedSeconds += Math.floor((Date.now() - timerStartTime) / 1000);
    timerStartTime = null;
    clearInterval(timerInterval);
    timerInterval = null;

    timerToggleBtn.textContent = 'Hervat Focus';
    timerToggleBtn.classList.remove('is-running');
    timerSubStatus.textContent = 'Even gepauzeerd';
    updateTimerDisplay();
  } else {
    timerStartTime = Date.now();
    timerInterval = setInterval(updateTimerDisplay, 250);

    timerToggleBtn.textContent = 'Pauzeer Sessie';
    timerToggleBtn.classList.add('is-running');
    timerSubStatus.textContent = 'In Diepe Rust';
    updateTimerDisplay();
  }
};

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !timerModal.classList.contains('hidden')) {
    updateTimerDisplay();
  }
});

timerSaveBtn.onclick = () => stopTimerAndSave();

document.getElementById('close-timer-modal').onclick = () => {
  const elapsed = getExactElapsedSeconds();
  if (elapsed > 0) {
    if (confirm('Wil je de verstreken tijd opslaan bij deze taak?')) {
      stopTimerAndSave();
      return;
    }
  }
  closeTimerModalDirect();
};

function stopTimerAndSave() {
  const elapsed = getExactElapsedSeconds();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerStartTime = null;

  const task = tasks.find(t => t.id === activeTimerTaskId);
  if (task && elapsed > 0) {
    task.actualHours = (task.actualHours || 0) + (elapsed / 3600);
    saveTaskToCloud(task);
    saveTasks();
  }
  closeTimerModalDirect();
}

function closeTimerModalDirect() {
  if (timerInterval) clearInterval(timerInterval);
  if (quoteInterval) clearInterval(quoteInterval);
  timerInterval = null;
  quoteInterval = null;
  timerStartTime = null;
  timerAccumulatedSeconds = 0;
  timerModal.classList.add('hidden');
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

document.getElementById('fullscreen-toggle-btn').onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      alert(`Kon volledig scherm niet activeren: ${err.message}`);
    });
  } else {
    document.exitFullscreen().catch(() => {});
  }
};

// --- EENHEID & FILTERS LISTENERS ---
document.getElementById('unit-hours-btn').onclick = () => {
  timeUnit = 'hours';
  localStorage.setItem('study_time_unit', 'hours');
  renderApp();
};

document.getElementById('unit-minutes-btn').onclick = () => {
  timeUnit = 'minutes';
  localStorage.setItem('study_time_unit', 'minutes');
  renderApp();
};

document.getElementById('search-input').addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  renderApp();
});

document.getElementById('course-filter-select').addEventListener('change', (e) => {
  selectedCourseFilter = e.target.value;
  renderApp();
});

// --- JSON BACKUP EXPORT & IMPORT ---
document.getElementById('export-json-btn').onclick = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `studieplanner_backup_${formatDateISO(new Date())}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

document.getElementById('import-json-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const importedTasks = JSON.parse(event.target.result);
      if (Array.isArray(importedTasks)) {
        if (confirm(`Wil je ${importedTasks.length} taken importeren? Huidige taken worden overschreven.`)) {
          tasks = importedTasks;
          saveTasks();
          for (const t of tasks) {
            await saveTaskToCloud(t);
          }
        }
      } else {
        alert('Ongeldig back-upbestand: verwacht een lijst met taken.');
      }
    } catch (err) {
      alert('Fout bij importeren van JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// --- VIEW SWITCHER & NAVIGATIE ---
const btnWeek = document.getElementById('view-week-btn');
const btnRolling7 = document.getElementById('view-rolling7-btn');
const btnCourses = document.getElementById('view-courses-btn');

function setActiveView(view) {
  currentView = view;
  btnWeek.classList.toggle('active', view === 'week');
  btnRolling7.classList.toggle('active', view === 'rolling7');
  btnCourses.classList.toggle('active', view === 'courses');

  if (view === 'rolling7') {
    rollingStartDate = new Date();
    rollingStartDate.setHours(0, 0, 0, 0);
  }
  renderApp();
}

btnWeek.onclick = () => setActiveView('week');
btnRolling7.onclick = () => setActiveView('rolling7');
btnCourses.onclick = () => setActiveView('courses');

document.getElementById('prev-week-btn').onclick = () => {
  if (currentView === 'week') currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
  else if (currentView === 'rolling7') rollingStartDate.setDate(rollingStartDate.getDate() - 7);
  renderApp();
};

document.getElementById('next-week-btn').onclick = () => {
  if (currentView === 'week') currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
  else if (currentView === 'rolling7') rollingStartDate.setDate(rollingStartDate.getDate() + 7);
  renderApp();
};

document.getElementById('today-btn').onclick = () => {
  if (currentView === 'week') currentWeekMonday = getMonday(new Date());
  else if (currentView === 'rolling7') {
    rollingStartDate = new Date();
    rollingStartDate.setHours(0, 0, 0, 0);
  }
  renderApp();
};

// Start de controle & applicatie
checkAuthAndInit();