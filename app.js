// ==========================================
// 1. SUPABASE CONFIGURATIE (VUL HIER JE GEGEVENS IN)
// ==========================================
const SUPABASE_URL = "https://lcmjzgqjlkeauabgqtjs.supabase.co";// Jouw Project UR
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbWp6Z3FqbGtlYXVhYmdxdGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjAwMjksImV4cCI6MjEwNDc5NjAyOX0.CHSDiIcLxhre7Dc3IN-v65v3iPGhT9r5OXY8N0Wttj8"; // Jouw anon public key
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- STATE & DATA ---
let tasks = [];
let currentUser = null; // Supabase auth user, ingesteld na succesvolle login

let currentView = 'rolling7'; // 'week' | 'rolling7' | 'courses' — opent standaard op de komende 7 dagen
let timeUnit = localStorage.getItem('study_time_unit') || 'hours';

let currentTheme = localStorage.getItem('study_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
let editingChecklist = []; // tijdelijke checklist-items terwijl de taak-modal open staat

let searchQuery = '';
let selectedCourseFilter = '';

let currentWeekMonday = getMonday(new Date());
let rollingStartDate = new Date();
rollingStartDate.setHours(0, 0, 0, 0);

// Mobiele state
let mobileActiveTab = 'calendar'; // 'calendar' | 'inbox' | 'courses'
let mobileSelectedDate = formatDateISO(new Date());

let activeMatrixDate = null;
let activeTimerTaskId = null;

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
// 2. AUTHENTICATIE (Supabase Auth i.p.v. tekst-matching op een PIN)
// ==========================================
// De pincode is nu je wachtwoord: Supabase slaat 'm gehashed op (nooit
// leesbaar in de database) en Row Level Security op de server zorgt dat
// deze sessie enkel ooit de eigen taken van deze gebruiker teruggeeft,
// zelfs als iemand de (publieke) anon key uit deze file zou misbruiken.
function pinToEmail(pin) {
  return `pin-${pin}@studieplanner.local`; // vast, niet-geheim "domein"; het wachtwoord is het geheim
}

async function checkAuthAndInit() {
  applyTheme(currentTheme);
  if (!supabaseClient) {
    document.getElementById('pin-modal').classList.remove('hidden');
    return;
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    initApp();
  } else {
    document.getElementById('pin-modal').classList.remove('hidden');
  }
}

document.getElementById('pin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const inputPin = document.getElementById('pin-input').value.trim();
  const pinError = document.getElementById('pin-error');
  if (pinError) pinError.textContent = '';

  if (!inputPin || inputPin.length < 6) {
    if (pinError) pinError.textContent = 'Gebruik minstens 6 tekens/cijfers — dit is nu ook je wachtwoord.';
    return;
  }
  if (!supabaseClient) {
    if (pinError) pinError.textContent = 'Kan geen verbinding maken met de cloud.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Bezig...';
  const email = pinToEmail(inputPin);

  // Probeer eerst in te loggen (bestaande pincode op dit of een ander toestel)
  let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: inputPin });

  // Nog geen account met deze pincode? Dan wordt 'm nu aangemaakt.
  if (error) {
    const signUpResult = await supabaseClient.auth.signUp({ email, password: inputPin });
    if (signUpResult.error) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ontgrendel Planner';
      if (pinError) pinError.textContent = 'Inloggen mislukt: ' + signUpResult.error.message;
      return;
    }
    data = signUpResult.data;
  }

  if (!data.session) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Ontgrendel Planner';
    if (pinError) pinError.textContent = 'Geen sessie gestart. Controleer of e-mailbevestiging uitstaat in Supabase (Authentication > Providers > Email > "Confirm email").';
    return;
  }

  currentUser = data.session.user;
  document.getElementById('pin-modal').classList.add('hidden');
  initApp();
});

function initApp() {
  fetchTasksFromCloud();
  setupRealtimeSubscription();
  setupMobileTabs();
  registerServiceWorker();
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

    // Geen handmatige PIN-filter meer nodig: Row Level Security zorgt dat
    // deze query alleen taken van de ingelogde gebruiker teruggeeft.
    tasks = (data || []).map(t => ({
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
      notes: t.notes || '',
      checklist: Array.isArray(t.checklist) ? t.checklist : []
    }));

    renderApp();
  } catch (err) {
    console.error("Fout bij ophalen:", err);
    showToast('Kon taken niet ophalen. Controleer je internetverbinding.', 'error');
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
    notes: task.notes || '',
    checklist: Array.isArray(task.checklist) ? task.checklist : []
  };

  const { error } = await supabaseClient.from('tasks').upsert(dbRecord);
  if (error) {
    console.error("Fout bij opslaan taak:", error);
    showToast('Opslaan mislukt: ' + error.message, 'error');
  }
}

async function deleteTaskFromCloud(taskId) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId);
  if (error) {
    console.error("Fout bij verwijderen:", error);
    showToast('Verwijderen mislukt: ' + error.message, 'error');
  }
}

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
// 4. HULPFUNCTIES
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

function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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
// 5. MOBIELE NAVIGATIE & TABS
// ==========================================
function setupMobileTabs() {
  const tabs = document.querySelectorAll('.mobile-bottom-nav .nav-tab[data-tab]');
  const sidebar = document.getElementById('sidebar-panel');
  const content = document.getElementById('content-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      mobileActiveTab = target;

      if (window.innerWidth <= 768) {
        if (target === 'inbox') {
          sidebar.style.display = 'flex';
          content.style.display = 'none';
        } else if (target === 'courses') {
          sidebar.style.display = 'none';
          content.style.display = 'block';
          setActiveView('courses');
        } else {
          sidebar.style.display = 'none';
          content.style.display = 'block';
          setActiveView('week');
        }
      }
    });
  });

  const quickAdd = document.getElementById('quick-add-mobile-btn');
  if (quickAdd) {
    quickAdd.onclick = () => {
      openNewTaskModal();
      document.getElementById('task-scheduled-date').value = mobileSelectedDate;
    };
  }
}

// ==========================================
// 6. RENDERING
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
  const selects = [document.getElementById('course-filter-select'), document.getElementById('mobile-course-filter-select')];
  const courses = Array.from(new Set(tasks.map(t => t.course ? t.course.trim() : '').filter(Boolean))).sort();

  selects.forEach(select => {
    if (!select) return;
    const existing = select.value;
    select.innerHTML = '<option value="">Alle vakken</option>';
    courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === existing) opt.selected = true;
      select.appendChild(opt);
    });
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

  // Bouw mobiele dagkiezer reep
  const mobileSelector = document.getElementById('mobile-day-selector');
  if (mobileSelector) mobileSelector.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const loopDay = new Date(startDay);
    loopDay.setDate(loopDay.getDate() + i);
    const dayISO = formatDateISO(loopDay);
    const isToday = dayISO === todayISO;

    // Mobiele chip
    if (mobileSelector) {
      const chip = document.createElement('button');
      chip.className = `mobile-day-chip ${dayISO === mobileSelectedDate ? 'active' : ''}`;
      chip.innerHTML = `<strong>${dayNames[loopDay.getDay()].substring(0, 2)}</strong><br>${formatDisplayDate(dayISO)}`;
      chip.onclick = () => {
        mobileSelectedDate = dayISO;
        renderCalendarGrid();
      };
      mobileSelector.appendChild(chip);
    }

    const dayTasksRaw = tasks.filter(t => t.scheduledDate === dayISO);
    const dayTasks = filterTasks(dayTasksRaw);

    const totalHours = dayTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
    const actualHours = dayTasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);

    const isSelectedOnMobile = dayISO === mobileSelectedDate;

    const dayCol = document.createElement('div');
    dayCol.className = `day-column ${isToday ? 'is-today' : ''} ${isSelectedOnMobile ? 'mobile-visible-day' : ''}`;

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

function toggleChecklistItem(taskId, itemId, event) {
  event.stopPropagation();
  const task = tasks.find(t => t.id === taskId);
  if (!task || !Array.isArray(task.checklist)) return;
  const item = task.checklist.find(c => c.id === itemId);
  if (!item) return;
  item.done = !item.done;
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

  card.className = `task-card task-card-clickable ${getPriorityClass(task)} ${isDone ? 'completed' : ''} ${isSubtask ? 'is-subtask' : ''} ${overdue ? 'is-overdue' : ''}`;
  card.setAttribute('draggable', 'true');
  card.dataset.id = task.id;
  card.title = 'Klik om deze taak te bewerken';

  card.addEventListener('click', (e) => {
    editTask(task.id, e);
  });

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

  const gcalBtn = task.deadline
    ? `<button class="btn btn-secondary btn-xs" onclick="addTaskToGoogleCalendar('${task.id}', event)" title="Deadline toevoegen aan Google Agenda">&#128197;</button>`
    : '';

  let checklistHTML = '';
  if (Array.isArray(task.checklist) && task.checklist.length > 0) {
    const doneCount = task.checklist.filter(c => c.done).length;
    const itemsHTML = task.checklist.map(c => `
      <label class="mini-checklist-item ${c.done ? 'done' : ''}">
        <input type="checkbox" ${c.done ? 'checked' : ''} onclick="toggleChecklistItem('${task.id}', '${c.id}', event)">
        <span>${c.text}</span>
      </label>
    `).join('');
    checklistHTML = `
      <details class="mini-checklist" onclick="event.stopPropagation()">
        <summary>&#9745; Checklist ${doneCount}/${task.checklist.length}</summary>
        <div class="mini-checklist-items">${itemsHTML}</div>
      </details>
    `;
  }

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
    ${checklistHTML}
    <div class="task-btn-row">
      ${linkHTML}
      ${gcalBtn}
      ${rescheduleBtn}
      <button class="btn btn-secondary btn-xs" onclick="openTimerModal('${task.id}', event)" title="Start focus-sessie">&#9201;&#65039; Focus</button>
      <button class="btn btn-secondary btn-xs" onclick="deleteTask('${task.id}', event)" title="Taak verwijderen">&times;</button>
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
  document.getElementById('matrix-modal-subtitle').textContent = `Prioriteitenoverzicht.`;

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
  editingChecklist = [];
  renderChecklistEditor();
  taskModal.classList.remove('hidden');
}

// --- CHECKLIST-EDITOR (binnen de taak-modal) ---
function renderChecklistEditor() {
  const container = document.getElementById('checklist-editor-list');
  if (!container) return;
  container.innerHTML = '';

  if (editingChecklist.length === 0) {
    container.innerHTML = '<p class="checklist-empty-hint">Nog geen checklist-items. Voeg er hieronder een toe.</p>';
    return;
  }

  editingChecklist.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'checklist-editor-row';
    row.innerHTML = `
      <label class="custom-checkbox checklist-check">
        <input type="checkbox" ${item.done ? 'checked' : ''}>
        <span class="checkbox-box"></span>
      </label>
      <span class="checklist-item-text ${item.done ? 'done' : ''}">${item.text}</span>
      <button type="button" class="btn-close checklist-remove-btn" title="Verwijder item">&times;</button>
    `;
    row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      editingChecklist[idx].done = e.target.checked;
      renderChecklistEditor();
    });
    row.querySelector('.checklist-remove-btn').addEventListener('click', () => {
      editingChecklist.splice(idx, 1);
      renderChecklistEditor();
    });
    container.appendChild(row);
  });
}

function addChecklistItem() {
  const input = document.getElementById('checklist-new-item-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  editingChecklist.push({ id: 'chk_' + Date.now() + '_' + Math.floor(Math.random() * 1000), text, done: false });
  input.value = '';
  renderChecklistEditor();
  input.focus();
}

document.getElementById('checklist-add-btn')?.addEventListener('click', addChecklistItem);
document.getElementById('checklist-new-item-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addChecklistItem();
  }
});

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
  editingChecklist = JSON.parse(JSON.stringify(task.checklist || []));
  renderChecklistEditor();
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
    notes: document.getElementById('task-notes').value || '',
    checklist: editingChecklist
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

function deleteTask(id, event) {
  event.stopPropagation();
  const removed = tasks.filter(t => t.id === id || t.parentId === id);
  if (removed.length === 0) return;

  tasks = tasks.filter(t => t.id !== id && t.parentId !== id);
  saveTasks();

  showUndoSnackbar(
    removed.length > 1 ? 'Taak + subtaken verwijderd' : 'Taak verwijderd',
    () => {
      // Ongedaan maken: taken terugzetten, cloud wordt niet aangeraakt
      tasks.push(...removed);
      saveTasks();
    },
    async () => {
      // Tijd verstreken zonder "ongedaan maken": nu pas echt uit de cloud wissen
      for (const t of removed) {
        await deleteTaskFromCloud(t.id);
      }
    }
  );
}

// --- ZEN ALPINE FOCUS TIMER ---
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
  if (event) event.stopPropagation();
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

// --- FILTERS & INPUT EVENTS (DESKTOP + MOBIEL) ---
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

['search-input', 'mobile-search-input'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', debounce((e) => {
      searchQuery = e.target.value.trim();
      renderApp();
    }, 250));
  }
});

['course-filter-select', 'mobile-course-filter-select'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', (e) => {
      selectedCourseFilter = e.target.value;
      renderApp();
    });
  }
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

// --- KALENDER NAVIGATIE ---
const btnWeek = document.getElementById('view-week-btn');
const btnRolling7 = document.getElementById('view-rolling7-btn');
const btnCourses = document.getElementById('view-courses-btn');

function setActiveView(view) {
  currentView = view;
  if (btnWeek) btnWeek.classList.toggle('active', view === 'week');
  if (btnRolling7) btnRolling7.classList.toggle('active', view === 'rolling7');
  if (btnCourses) btnCourses.classList.toggle('active', view === 'courses');

  if (view === 'rolling7') {
    rollingStartDate = new Date();
    rollingStartDate.setHours(0, 0, 0, 0);
  }
  renderApp();
}

if (btnWeek) btnWeek.onclick = () => setActiveView('week');
if (btnRolling7) btnRolling7.onclick = () => setActiveView('rolling7');
if (btnCourses) btnCourses.onclick = () => setActiveView('courses');

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
  mobileSelectedDate = formatDateISO(new Date());
  renderApp();
};

// Uitloggen / Pincode wisselen
const logoutBtn = document.getElementById('logout-pin-btn');
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    if (confirm('Wil je uitloggen / van pincode wisselen op dit toestel?')) {
      if (supabaseClient) await supabaseClient.auth.signOut();
      location.reload();
    }
  };
}

// ==========================================
// 7. TOASTS & ONGEDAAN-MAKEN-SNACKBAR
// ==========================================
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showUndoSnackbar(message, onUndo, onConfirm) {
  const existing = document.getElementById('undo-snackbar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'undo-snackbar';
  bar.className = 'undo-snackbar';
  bar.innerHTML = `<span>${message}</span><button class="undo-btn">Ongedaan maken</button>`;
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('show'));

  let undone = false;
  const timeoutId = setTimeout(async () => {
    if (!undone) await onConfirm();
    bar.classList.remove('show');
    setTimeout(() => bar.remove(), 300);
  }, 5000);

  bar.querySelector('.undo-btn').onclick = () => {
    undone = true;
    clearTimeout(timeoutId);
    onUndo();
    bar.classList.remove('show');
    setTimeout(() => bar.remove(), 300);
  };
}

// ==========================================
// 8. DONKERE MODUS
// ==========================================
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('study_theme', theme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// ==========================================
// 9. PWA / SERVICE WORKER (installeerbaar + offline-cache)
// ==========================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('Service worker registratie mislukt:', err);
    });
  }
}

// ==========================================
// 10. GOOGLE AGENDA & ICS-EXPORT (deadlines)
// ==========================================
function formatICSDate(dateStr) {
  return dateStr.replace(/-/g, '');
}

function addOneDay(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return formatDateISO(d);
}

function buildGoogleCalendarUrl(task) {
  const startCompact = formatICSDate(task.deadline);
  const endCompact = formatICSDate(addOneDay(task.deadline)); // Google verwacht een exclusieve einddatum

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Deadline: ${task.title}${task.course ? ' (' + task.course + ')' : ''}`,
    dates: `${startCompact}/${endCompact}`,
    details: task.notes || 'Toegevoegd vanuit Studieplanner'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function addTaskToGoogleCalendar(taskId, event) {
  if (event) event.stopPropagation();
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.deadline) return;
  window.open(buildGoogleCalendarUrl(task), '_blank', 'noopener');
}

function buildICSCalendar(taskList) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studieplanner//NL'];
  taskList.filter(t => t.deadline).forEach(t => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@studieplanner`,
      `DTSTART;VALUE=DATE:${formatICSDate(t.deadline)}`,
      `DTEND;VALUE=DATE:${formatICSDate(addOneDay(t.deadline))}`,
      `SUMMARY:Deadline: ${t.title}${t.course ? ' (' + t.course + ')' : ''}`,
      `DESCRIPTION:${(t.notes || '').replace(/\r?\n/g, '\\n')}`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

document.getElementById('export-ics-btn')?.addEventListener('click', () => {
  const deadlineTasks = tasks.filter(t => t.deadline);
  if (deadlineTasks.length === 0) {
    showToast('Geen taken met een deadline om te exporteren.', 'info');
    return;
  }
  const icsContent = buildICSCalendar(deadlineTasks);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studieplanner_deadlines_${formatDateISO(new Date())}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('ICS-bestand gedownload. Importeer het in Google Agenda via Instellingen > Importeren en exporteren.', 'info');
});

// ==========================================
// 11. SNELTOETSEN
// ==========================================
document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden), .focus-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    return;
  }

  if (typing) return;

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    openNewTaskModal();
  } else if (e.key === '/') {
    e.preventDefault();
    (document.getElementById('search-input') || document.getElementById('mobile-search-input'))?.focus();
  } else if (e.key === 'ArrowLeft') {
    document.getElementById('prev-week-btn')?.click();
  } else if (e.key === 'ArrowRight') {
    document.getElementById('next-week-btn')?.click();
  }
});

// Start
checkAuthAndInit();