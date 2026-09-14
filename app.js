// ==========================================
// 1. SUPABASE CONFIGURATIE (VUL HIER JE GEGEVENS IN)
// ==========================================
const SUPABASE_URL = "https://lcmjzgqjlkeauabgqtjs.supabase.co"; //
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbWp6Z3FqbGtlYXVhYmdxdGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjAwMjksImV4cCI6MjEwNDc5NjAyOX0.CHSDiIcLxhre7Dc3IN-v65v3iPGhT9r5OXY8N0Wttj8"; //[cite: 1]
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null; //[cite: 1]

// --- STATE & DATA ---
let tasks = []; //[cite: 1]
let habits = []; // Definities van habits
let habitLogs = []; // Checks per datum: { id, habit_id, date }
let currentUser = null; //[cite: 1]

let currentView = 'rolling7'; //[cite: 1]
let timeUnit = localStorage.getItem('study_time_unit') || 'hours'; //[cite: 1]
let currentTheme = localStorage.getItem('study_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); //[cite: 1]
let editingChecklist = []; //[cite: 1]

let searchQuery = ''; //[cite: 1]
let selectedCourseFilter = ''; //[cite: 1]

let currentWeekMonday = getMonday(new Date()); //[cite: 1]
let rollingStartDate = new Date(); //[cite: 1]
rollingStartDate.setHours(0, 0, 0, 0); //[cite: 1]

let mobileActiveTab = 'calendar'; //[cite: 1]
let mobileSelectedDate = formatDateISO(new Date()); //[cite: 1]

let activeMatrixDate = null; //[cite: 1]
let activeTimerTaskId = null; //[cite: 1]

let timerInterval = null; //[cite: 1]
let timerStartTime = null; //[cite: 1]
let timerAccumulatedSeconds = 0; //[cite: 1]
let quoteInterval = null; //[cite: 1]
let draggedTaskId = null; //[cite: 1]

let timerMode = 'free'; //[cite: 1]
let timerDurationSeconds = 0; //[cite: 1]
let countdownCompleted = false; //[cite: 1]

const focusQuotes = [ //[cite: 1]
  "\"Kalmte in het dal, helderheid op de top.\"", //[cite: 1]
  "\"Stap voor stap, zonder haast. De berg beweegt niet.\"", //[cite: 1]
  "\"Volledige aandacht voor deze ene taak.\"", //[cite: 1]
  "\"De rust van de natuur brengt rust in de geest.\"", //[cite: 1]
  "\"Adem rustig in. Begin eenvoudig.\"" //[cite: 1]
]; //[cite: 1]

const circleRadius = 101; //[cite: 1]
const circumference = 2 * Math.PI * circleRadius; //[cite: 1]

// ==========================================
// 2. AUTHENTICATIE
// ==========================================
function pinToEmail(pin) { //[cite: 1]
  return `pin-${pin}@studieplanner.local`; //[cite: 1]
} //[cite: 1]

async function checkAuthAndInit() { //[cite: 1]
  applyTheme(currentTheme); //[cite: 1]
  if (!supabaseClient) { //[cite: 1]
    document.getElementById('pin-modal').classList.remove('hidden'); //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]
  const { data: { session } } = await supabaseClient.auth.getSession(); //[cite: 1]
  if (session) { //[cite: 1]
    currentUser = session.user; //[cite: 1]
    initApp(); //[cite: 1]
  } else { //[cite: 1]
    document.getElementById('pin-modal').classList.remove('hidden'); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

document.getElementById('pin-form').addEventListener('submit', async (e) => { //[cite: 1]
  e.preventDefault(); //[cite: 1]
  const submitBtn = e.target.querySelector('button[type="submit"]'); //[cite: 1]
  const inputPin = document.getElementById('pin-input').value.trim(); //[cite: 1]
  const pinError = document.getElementById('pin-error'); //[cite: 1]
  if (pinError) pinError.textContent = ''; //[cite: 1]

  if (!inputPin || inputPin.length < 6) { //[cite: 1]
    if (pinError) pinError.textContent = 'Gebruik minstens 6 tekens/cijfers — dit is nu ook je wachtwoord.'; //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]
  if (!supabaseClient) { //[cite: 1]
    if (pinError) pinError.textContent = 'Kan geen verbinding maken met de cloud.'; //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]

  submitBtn.disabled = true; //[cite: 1]
  submitBtn.textContent = 'Bezig...'; //[cite: 1]
  const email = pinToEmail(inputPin); //[cite: 1]

  let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: inputPin }); //[cite: 1]

  if (error) { //[cite: 1]
    const signUpResult = await supabaseClient.auth.signUp({ email, password: inputPin }); //[cite: 1]
    if (signUpResult.error) { //[cite: 1]
      submitBtn.disabled = false; //[cite: 1]
      submitBtn.textContent = 'Ontgrendel Planner'; //[cite: 1]
      if (pinError) pinError.textContent = 'Inloggen mislukt: ' + signUpResult.error.message; //[cite: 1]
      return; //[cite: 1]
    } //[cite: 1]
    data = signUpResult.data; //[cite: 1]
  } //[cite: 1]

  if (!data.session) { //[cite: 1]
    submitBtn.disabled = false; //[cite: 1]
    submitBtn.textContent = 'Ontgrendel Planner'; //[cite: 1]
    if (pinError) pinError.textContent = 'Geen sessie gestart. Controleer e-mailbevestiging in Supabase.'; //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]

  currentUser = data.session.user; //[cite: 1]
  document.getElementById('pin-modal').classList.add('hidden'); //[cite: 1]
  initApp(); //[cite: 1]
}); //[cite: 1]

function initApp() { //[cite: 1]
  fetchTasksFromCloud(); //[cite: 1]
  fetchHabitsFromCloud();
  setupRealtimeSubscription(); //[cite: 1]
  setupMobileTabs(); //[cite: 1]
  registerServiceWorker(); //[cite: 1]
} //[cite: 1]

// ==========================================
// 3. CLOUD DATABASE ACTIES
// ==========================================
async function fetchTasksFromCloud() { //[cite: 1]
  if (!supabaseClient) return; //[cite: 1]

  try { //[cite: 1]
    const { data, error } = await supabaseClient //[cite: 1]
      .from('tasks') //[cite: 1]
      .select('*') //[cite: 1]
      .order('id', { ascending: true }); //[cite: 1]

    if (error) throw error; //[cite: 1]

    tasks = (data || []).map(t => ({ //[cite: 1]
      id: t.id, //[cite: 1]
      title: t.title, //[cite: 1]
      course: t.course, //[cite: 1]
      estimatedHours: Number(t.estimated_hours) || 0, //[cite: 1]
      actualHours: Number(t.actual_hours) || 0, //[cite: 1]
      deadline: t.deadline, //[cite: 1]
      scheduledDate: t.scheduled_date, //[cite: 1]
      isUrgent: t.is_urgent, //[cite: 1]
      isImportant: t.is_important, //[cite: 1]
      status: t.status, //[cite: 1]
      completed: t.status === 'done', //[cite: 1]
      link: t.link, //[cite: 1]
      parentId: t.parent_id, //[cite: 1]
      notes: t.notes || '', //[cite: 1]
      checklist: Array.isArray(t.checklist) ? t.checklist : [] //[cite: 1]
    })); //[cite: 1]

    renderApp(); //[cite: 1]
  } catch (err) { //[cite: 1]
    console.error("Fout bij ophalen:", err); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

async function saveTaskToCloud(task) { //[cite: 1]
  if (!supabaseClient) return; //[cite: 1]
  const dbRecord = { //[cite: 1]
    id: task.id, //[cite: 1]
    title: task.title, //[cite: 1]
    course: task.course || null, //[cite: 1]
    estimated_hours: task.estimatedHours || 0, //[cite: 1]
    actual_hours: task.actualHours || 0, //[cite: 1]
    deadline: task.deadline || null, //[cite: 1]
    scheduled_date: task.scheduledDate || null, //[cite: 1]
    is_urgent: Boolean(task.isUrgent), //[cite: 1]
    is_important: Boolean(task.isImportant), //[cite: 1]
    status: task.status || 'not_started', //[cite: 1]
    link: task.link || null, //[cite: 1]
    parent_id: task.parentId || null, //[cite: 1]
    notes: task.notes || '', //[cite: 1]
    checklist: Array.isArray(task.checklist) ? task.checklist : [] //[cite: 1]
  }; //[cite: 1]
  const { error } = await supabaseClient.from('tasks').upsert(dbRecord); //[cite: 1]
  if (error) console.error("Fout bij opslaan taak:", error); //[cite: 1]
} //[cite: 1]

async function deleteTaskFromCloud(taskId) { //[cite: 1]
  if (!supabaseClient) return; //[cite: 1]
  const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId); //[cite: 1]
  if (error) console.error("Fout bij verwijderen:", error); //[cite: 1]
} //[cite: 1]

// Habits ophalen en opslaan
async function fetchHabitsFromCloud() {
  if (!supabaseClient) return;
  try {
    const [hRes, lRes] = await Promise.all([
      supabaseClient.from('habits').select('*').order('created_at', { ascending: true }),
      supabaseClient.from('habit_logs').select('*')
    ]);
    if (hRes.data) habits = hRes.data;
    if (lRes.data) habitLogs = lRes.data;
    renderCalendarGrid(); //[cite: 1]
  } catch (err) {
    console.error("Fout bij ophalen habits:", err);
  }
}

async function toggleHabitLog(habitId, dateStr) {
  const existingIdx = habitLogs.findIndex(l => l.habit_id === habitId && l.date === dateStr);
  if (existingIdx !== -1) {
    const toDelete = habitLogs[existingIdx];
    habitLogs.splice(existingIdx, 1);
    renderCalendarGrid(); //[cite: 1]
    if (supabaseClient) {
      await supabaseClient.from('habit_logs').delete().eq('id', toDelete.id);
    }
  } else {
    const newLog = { id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), habit_id: habitId, date: dateStr };
    habitLogs.push(newLog);
    renderCalendarGrid(); //[cite: 1]
    if (supabaseClient) {
      await supabaseClient.from('habit_logs').insert([newLog]);
    }
  }
}

async function createNewHabit(title, icon) {
  const newHabit = {
    id: 'hab_' + Date.now(),
    title: title.trim(),
    icon: icon.trim() || '✨'
  };
  habits.push(newHabit);
  renderCalendarGrid(); //[cite: 1]
  renderHabitManageList();
  if (supabaseClient) {
    await supabaseClient.from('habits').insert([newHabit]);
  }
}

async function deleteHabit(habitId) {
  habits = habits.filter(h => h.id !== habitId);
  habitLogs = habitLogs.filter(l => l.habit_id !== habitId);
  renderCalendarGrid(); //[cite: 1]
  renderHabitManageList();
  if (supabaseClient) {
    await supabaseClient.from('habits').delete().eq('id', habitId);
  }
}

function setupRealtimeSubscription() { //[cite: 1]
  if (!supabaseClient) return; //[cite: 1]
  supabaseClient //[cite: 1]
    .channel('study-realtime-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasksFromCloud())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, () => fetchHabitsFromCloud())
    .subscribe(); //[cite: 1]
} //[cite: 1]

function saveTasks() { //[cite: 1]
  renderApp(); //[cite: 1]
  if (activeMatrixDate && !document.getElementById('matrix-modal').classList.contains('hidden')) { //[cite: 1]
    openMatrixModal(activeMatrixDate); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

// ==========================================
// 4. HULPFUNCTIES
// ==========================================
function getMonday(d) { //[cite: 1]
  const date = new Date(d); //[cite: 1]
  const day = date.getDay(); //[cite: 1]
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); //[cite: 1]
  date.setHours(0, 0, 0, 0); //[cite: 1]
  return new Date(date.setDate(diff)); //[cite: 1]
} //[cite: 1]

function formatDateISO(d) { //[cite: 1]
  const year = d.getFullYear(); //[cite: 1]
  const month = String(d.getMonth() + 1).padStart(2, '0'); //[cite: 1]
  const day = String(d.getDate()).padStart(2, '0'); //[cite: 1]
  return `${year}-${month}-${day}`; //[cite: 1]
} //[cite: 1]

function formatDisplayDate(dateStr) { //[cite: 1]
  if (!dateStr) return ''; //[cite: 1]
  const parts = dateStr.split('-'); //[cite: 1]
  return `${parts[2]}/${parts[1]}`; //[cite: 1]
} //[cite: 1]

function formatDuration(hours) { //[cite: 1]
  const h = Number(hours) || 0; //[cite: 1]
  if (timeUnit === 'minutes') { //[cite: 1]
    const mins = Math.round(h * 60); //[cite: 1]
    return `${mins}m`; //[cite: 1]
  } //[cite: 1]
  return `${h.toFixed(1)}u`; //[cite: 1]
} //[cite: 1]

function getPriorityClass(task) { //[cite: 1]
  if (task.isUrgent && task.isImportant) return 'priority-q1'; //[cite: 1]
  if (!task.isUrgent && task.isImportant) return 'priority-q2'; //[cite: 1]
  if (task.isUrgent && !task.isImportant) return 'priority-q3'; //[cite: 1]
  return 'priority-q4'; //[cite: 1]
} //[cite: 1]

function isTaskOverdue(task) { //[cite: 1]
  if (task.completed || task.status === 'done') return false; //[cite: 1]
  const todayISO = formatDateISO(new Date()); //[cite: 1]
  const scheduledInPast = task.scheduledDate && task.scheduledDate < todayISO; //[cite: 1]
  const deadlineInPast = task.deadline && task.deadline < todayISO; //[cite: 1]
  return Boolean(scheduledInPast || deadlineInPast); //[cite: 1]
} //[cite: 1]

function debounce(fn, delay = 250) { //[cite: 1]
  let timer = null; //[cite: 1]
  return (...args) => { //[cite: 1]
    clearTimeout(timer); //[cite: 1]
    timer = setTimeout(() => fn(...args), delay); //[cite: 1]
  }; //[cite: 1]
} //[cite: 1]

function filterTasks(taskList) { //[cite: 1]
  return taskList.filter(task => { //[cite: 1]
    const matchesSearch = !searchQuery ||  //[cite: 1]
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||  //[cite: 1]
      (task.course && task.course.toLowerCase().includes(searchQuery.toLowerCase())) || //[cite: 1]
      (task.notes && task.notes.toLowerCase().includes(searchQuery.toLowerCase())); //[cite: 1]

    const matchesCourse = !selectedCourseFilter || task.course === selectedCourseFilter; //[cite: 1]
    return matchesSearch && matchesCourse; //[cite: 1]
  }); //[cite: 1]
} //[cite: 1]

// ==========================================
// 5. MOBIELE NAVIGATIE & TABS
// ==========================================
function setupMobileTabs() { //[cite: 1]
  const tabs = document.querySelectorAll('.mobile-bottom-nav .nav-tab[data-tab]'); //[cite: 1]
  const sidebar = document.getElementById('sidebar-panel'); //[cite: 1]
  const content = document.getElementById('content-panel'); //[cite: 1]

  tabs.forEach(tab => { //[cite: 1]
    tab.addEventListener('click', () => { //[cite: 1]
      tabs.forEach(t => t.classList.remove('active')); //[cite: 1]
      tab.classList.add('active'); //[cite: 1]

      const target = tab.dataset.tab; //[cite: 1]
      mobileActiveTab = target; //[cite: 1]

      if (window.innerWidth <= 768) { //[cite: 1]
        if (target === 'inbox') { //[cite: 1]
          sidebar.style.display = 'flex'; //[cite: 1]
          content.style.display = 'none'; //[cite: 1]
        } else if (target === 'courses') { //[cite: 1]
          sidebar.style.display = 'none'; //[cite: 1]
          content.style.display = 'block'; //[cite: 1]
          setActiveView('courses'); //[cite: 1]
        } else { //[cite: 1]
          sidebar.style.display = 'none'; //[cite: 1]
          content.style.display = 'block'; //[cite: 1]
          setActiveView('week'); //[cite: 1]
        } //[cite: 1]
      } //[cite: 1]
    }); //[cite: 1]
  }); //[cite: 1]

  const quickAdd = document.getElementById('quick-add-mobile-btn'); //[cite: 1]
  if (quickAdd) { //[cite: 1]
    quickAdd.onclick = () => { //[cite: 1]
      openNewTaskModal(); //[cite: 1]
      document.getElementById('task-scheduled-date').value = mobileSelectedDate; //[cite: 1]
    }; //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

// ==========================================
// 6. RENDERING
// ==========================================
function renderApp() { //[cite: 1]
  const weekGrid = document.getElementById('week-grid'); //[cite: 1]
  const coursesView = document.getElementById('courses-view'); //[cite: 1]
  const navGroup = document.getElementById('nav-arrows-group'); //[cite: 1]

  document.getElementById('unit-hours-btn').classList.toggle('active', timeUnit === 'hours'); //[cite: 1]
  document.getElementById('unit-minutes-btn').classList.toggle('active', timeUnit === 'minutes'); //[cite: 1]

  updateFilterOptions(); //[cite: 1]
  renderCountdownWidget(); //[cite: 1]

  if (currentView === 'courses') { //[cite: 1]
    weekGrid.classList.add('hidden'); //[cite: 1]
    coursesView.classList.remove('hidden'); //[cite: 1]
    navGroup.classList.add('hidden'); //[cite: 1]
    document.getElementById('current-week-label').textContent = 'Vakken & Categorieën'; //[cite: 1]
    renderCoursesView(); //[cite: 1]
  } else { //[cite: 1]
    coursesView.classList.add('hidden'); //[cite: 1]
    weekGrid.classList.remove('hidden'); //[cite: 1]
    navGroup.classList.remove('hidden'); //[cite: 1]
    renderCalendarGrid(); //[cite: 1]
  } //[cite: 1]

  renderInbox(); //[cite: 1]
  updateParentTaskOptions(); //[cite: 1]
} //[cite: 1]

function renderCountdownWidget() { //[cite: 1]
  const container = document.getElementById('countdown-list'); //[cite: 1]
  container.innerHTML = ''; //[cite: 1]

  const today = new Date(); //[cite: 1]
  today.setHours(0, 0, 0, 0); //[cite: 1]

  const upcomingDeadlines = tasks //[cite: 1]
    .filter(t => t.deadline && !t.completed && t.status !== 'done') //[cite: 1]
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline)) //[cite: 1]
    .slice(0, 4); //[cite: 1]

  if (upcomingDeadlines.length === 0) { //[cite: 1]
    container.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted)">Geen actieve deadlines</span>'; //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]

  upcomingDeadlines.forEach(task => { //[cite: 1]
    const dDate = new Date(task.deadline + 'T00:00:00'); //[cite: 1]
    const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24)); //[cite: 1]

    let badgeClass = 'countdown-days'; //[cite: 1]
    let badgeText = `${diffDays}d`; //[cite: 1]

    if (diffDays < 0) { //[cite: 1]
      badgeClass += ' urgent'; //[cite: 1]
      badgeText = `${Math.abs(diffDays)}d te laat`; //[cite: 1]
    } else if (diffDays === 0) { //[cite: 1]
      badgeClass += ' today'; //[cite: 1]
      badgeText = 'Vandaag!'; //[cite: 1]
    } else if (diffDays <= 3) { //[cite: 1]
      badgeClass += ' urgent'; //[cite: 1]
      badgeText = `${diffDays}d`; //[cite: 1]
    } //[cite: 1]

    const item = document.createElement('div'); //[cite: 1]
    item.className = 'countdown-item'; //[cite: 1]
    item.innerHTML = `
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px;" title="${task.title}">
        <strong>${task.course ? task.course + ': ' : ''}</strong>${task.title}
      </span>
      <span class="${badgeClass}">${badgeText}</span>
    `; //[cite: 1]
    container.appendChild(item); //[cite: 1]
  }); //[cite: 1]
} //[cite: 1]

function updateFilterOptions() { //[cite: 1]
  const selects = [document.getElementById('course-filter-select'), document.getElementById('mobile-course-filter-select')]; //[cite: 1]
  const courses = Array.from(new Set(tasks.map(t => t.course ? t.course.trim() : '').filter(Boolean))).sort(); //[cite: 1]

  selects.forEach(select => { //[cite: 1]
    if (!select) return; //[cite: 1]
    const existing = select.value; //[cite: 1]
    select.innerHTML = '<option value="">Alle vakken</option>'; //[cite: 1]
    courses.forEach(c => { //[cite: 1]
      const opt = document.createElement('option'); //[cite: 1]
      opt.value = c; //[cite: 1]
      opt.textContent = c; //[cite: 1]
      if (c === existing) opt.selected = true; //[cite: 1]
      select.appendChild(opt); //[cite: 1]
    }); //[cite: 1]
  }); //[cite: 1]
} //[cite: 1]

function renderCalendarGrid() { //[cite: 1]
  const grid = document.getElementById('week-grid'); //[cite: 1]
  grid.innerHTML = ''; //[cite: 1]

  const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']; //[cite: 1]
  const todayISO = formatDateISO(new Date()); //[cite: 1]

  const startDay = currentView === 'week' ? new Date(currentWeekMonday) : new Date(rollingStartDate); //[cite: 1]
  const endDay = new Date(startDay); //[cite: 1]
  endDay.setDate(endDay.getDate() + 6); //[cite: 1]

  document.getElementById('current-week-label').textContent =  //[cite: 1]
    `${currentView === 'week' ? 'Kalenderweek' : '7-Dagen'}: ${formatDisplayDate(formatDateISO(startDay))} - ${formatDisplayDate(formatDateISO(endDay))}`; //[cite: 1]

  const mobileSelector = document.getElementById('mobile-day-selector'); //[cite: 1]
  if (mobileSelector) mobileSelector.innerHTML = ''; //[cite: 1]

  for (let i = 0; i < 7; i++) { //[cite: 1]
    const loopDay = new Date(startDay); //[cite: 1]
    loopDay.setDate(loopDay.getDate() + i); //[cite: 1]
    const dayISO = formatDateISO(loopDay); //[cite: 1]
    const isToday = dayISO === todayISO; //[cite: 1]

    if (mobileSelector) { //[cite: 1]
      const chip = document.createElement('button'); //[cite: 1]
      chip.className = `mobile-day-chip ${dayISO === mobileSelectedDate ? 'active' : ''}`; //[cite: 1]
      chip.innerHTML = `<strong>${dayNames[loopDay.getDay()].substring(0, 2)}</strong><br>${formatDisplayDate(dayISO)}`; //[cite: 1]
      chip.onclick = () => { //[cite: 1]
        mobileSelectedDate = dayISO; //[cite: 1]
        renderCalendarGrid(); //[cite: 1]
      }; //[cite: 1]
      mobileSelector.appendChild(chip); //[cite: 1]
    } //[cite: 1]

    const dayTasksRaw = tasks.filter(t => t.scheduledDate === dayISO); //[cite: 1]
    const dayTasks = filterTasks(dayTasksRaw); //[cite: 1]

    const totalHours = dayTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0); //[cite: 1]
    const actualHours = dayTasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0); //[cite: 1]

    const isSelectedOnMobile = dayISO === mobileSelectedDate; //[cite: 1]

    // Habit Dag-Strip opbouwen
    const habitBubblesHTML = habits.map(h => {
      const isCompleted = habitLogs.some(l => l.habit_id === h.id && l.date === dayISO);
      return `<button type="button" class="habit-bubble ${isCompleted ? 'completed' : ''}" title="${h.title}" onclick="toggleHabitLog('${h.id}', '${dayISO}')">${h.icon || '✨'}</button>`;
    }).join('');

    const dayCol = document.createElement('div'); //[cite: 1]
    dayCol.className = `day-column ${isToday ? 'is-today' : ''} ${isSelectedOnMobile ? 'mobile-visible-day' : ''}`; //[cite: 1]

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
      <div class="day-habit-strip">
        ${habitBubblesHTML}
        <button type="button" class="habit-bubble habit-bubble-add" onclick="openHabitModal()" title="Gewoontes beheren">＋</button>
      </div>
      <div class="task-list dropzone" id="day-list-${dayISO}" data-date="${dayISO}"></div>
    `; //[cite: 1]

    const taskListContainer = dayCol.querySelector(`#day-list-${dayISO}`); //[cite: 1]
    renderTaskHierarchy(taskListContainer, dayTasks); //[cite: 1]
    setupDropzone(taskListContainer, 'calendar'); //[cite: 1]

    grid.appendChild(dayCol); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

function renderCoursesView() { //[cite: 1]
  const container = document.getElementById('courses-grid'); //[cite: 1]
  container.innerHTML = ''; //[cite: 1]

  const coursesSet = new Set(); //[cite: 1]
  tasks.forEach(t => { //[cite: 1]
    coursesSet.add(t.course && t.course.trim() ? t.course.trim() : 'Zonder Vak'); //[cite: 1]
  }); //[cite: 1]

  const courses = Array.from(coursesSet).sort(); //[cite: 1]

  courses.forEach(courseName => { //[cite: 1]
    const allCourseTasks = tasks.filter(t => { //[cite: 1]
      const match = t.course && t.course.trim() ? t.course.trim() : 'Zonder Vak'; //[cite: 1]
      return match === courseName; //[cite: 1]
    }); //[cite: 1]

    const filteredCourseTasks = filterTasks(allCourseTasks); //[cite: 1]

    const totalEst = allCourseTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0); //[cite: 1]
    const totalAct = allCourseTasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0); //[cite: 1]
    const completedCount = allCourseTasks.filter(t => t.completed || t.status === 'done').length; //[cite: 1]
    const percent = allCourseTasks.length > 0 ? Math.round((completedCount / allCourseTasks.length) * 100) : 0; //[cite: 1]

    const courseCard = document.createElement('div'); //[cite: 1]
    courseCard.className = 'course-card'; //[cite: 1]

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
    `; //[cite: 1]

    const listEl = courseCard.querySelector(`#course-list-${encodeURIComponent(courseName)}`); //[cite: 1]
    renderTaskHierarchy(listEl, filteredCourseTasks); //[cite: 1]
    setupDropzone(listEl, 'course'); //[cite: 1]

    container.appendChild(courseCard); //[cite: 1]
  }); //[cite: 1]
} //[cite: 1]

function openTaskModalForCourse(courseName) { //[cite: 1]
  openNewTaskModal(); //[cite: 1]
  document.getElementById('task-course').value = courseName; //[cite: 1]
} //[cite: 1]

function renderInbox() { //[cite: 1]
  const container = document.getElementById('inbox-task-list'); //[cite: 1]
  container.innerHTML = ''; //[cite: 1]

  const overdueTasks = filterTasks(tasks.filter(t => isTaskOverdue(t))); //[cite: 1]
  const backlogTasks = filterTasks(tasks.filter(t => !t.scheduledDate && !isTaskOverdue(t))); //[cite: 1]

  document.getElementById('inbox-count').textContent = overdueTasks.length + backlogTasks.length; //[cite: 1]

  if (overdueTasks.length > 0) { //[cite: 1]
    const overdueHeader = document.createElement('div'); //[cite: 1]
    overdueHeader.className = 'inbox-section-title overdue-title'; //[cite: 1]
    overdueHeader.innerHTML = `
      <span>In te halen / Te laat</span>
      <span class="badge badge-danger">${overdueTasks.length}</span>
    `; //[cite: 1]
    container.appendChild(overdueHeader); //[cite: 1]
    renderTaskHierarchy(container, overdueTasks); //[cite: 1]
  } //[cite: 1]

  if (backlogTasks.length > 0 || overdueTasks.length === 0) { //[cite: 1]
    const backlogHeader = document.createElement('div'); //[cite: 1]
    backlogHeader.className = 'inbox-section-title'; //[cite: 1]
    backlogHeader.innerHTML = `
      <span>Backlog</span>
      <span class="badge">${backlogTasks.length}</span>
    `; //[cite: 1]
    container.appendChild(backlogHeader); //[cite: 1]
    renderTaskHierarchy(container, backlogTasks); //[cite: 1]
  } //[cite: 1]

  setupDropzone(container, 'calendar'); //[cite: 1]
} //[cite: 1]

function rescheduleToToday(taskId, event) { //[cite: 1]
  event.stopPropagation(); //[cite: 1]
  const task = tasks.find(t => t.id === taskId); //[cite: 1]
  if (task) { //[cite: 1]
    task.scheduledDate = formatDateISO(new Date()); //[cite: 1]
    saveTaskToCloud(task); //[cite: 1]
    saveTasks(); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

function cycleTaskStatus(taskId, event) { //[cite: 1]
  event.stopPropagation(); //[cite: 1]
  const task = tasks.find(t => t.id === taskId); //[cite: 1]
  if (!task) return; //[cite: 1]

  const current = task.status || (task.completed ? 'done' : 'not_started'); //[cite: 1]
  if (current === 'not_started') task.status = 'in_progress'; //[cite: 1]
  else if (current === 'in_progress') { //[cite: 1]
    task.status = 'done'; //[cite: 1]
    task.completed = true; //[cite: 1]
  } else { //[cite: 1]
    task.status = 'not_started'; //[cite: 1]
    task.completed = false; //[cite: 1]
  } //[cite: 1]
  saveTaskToCloud(task); //[cite: 1]
  saveTasks(); //[cite: 1]
} //[cite: 1]

function toggleChecklistItem(taskId, itemId, event) { //[cite: 1]
  event.stopPropagation(); //[cite: 1]
  const task = tasks.find(t => t.id === taskId); //[cite: 1]
  if (!task || !Array.isArray(task.checklist)) return; //[cite: 1]
  const item = task.checklist.find(c => c.id === itemId); //[cite: 1]
  if (!item) return; //[cite: 1]
  item.done = !item.done; //[cite: 1]
  saveTaskToCloud(task); //[cite: 1]
  saveTasks(); //[cite: 1]
} //[cite: 1]

function renderTaskHierarchy(container, taskList) { //[cite: 1]
  const rootTasks = taskList.filter(t => !t.parentId); //[cite: 1]

  rootTasks.forEach(task => { //[cite: 1]
    const card = createTaskCard(task, false); //[cite: 1]
    container.appendChild(card); //[cite: 1]

    const subtasks = tasks.filter(t => t.parentId === task.id); //[cite: 1]
    if (subtasks.length > 0) { //[cite: 1]
      const subContainer = document.createElement('div'); //[cite: 1]
      subContainer.className = 'subtasks-container'; //[cite: 1]
      subtasks.forEach(sub => { //[cite: 1]
        subContainer.appendChild(createTaskCard(sub, true)); //[cite: 1]
      }); //[cite: 1]
      container.appendChild(subContainer); //[cite: 1]
    } //[cite: 1]
  }); //[cite: 1]

  const orphaned = taskList.filter(t => t.parentId && !rootTasks.some(r => r.id === t.parentId)); //[cite: 1]
  orphaned.forEach(t => container.appendChild(createTaskCard(t, true))); //[cite: 1]
} //[cite: 1]

function createTaskCard(task, isSubtask = false) { //[cite: 1]
  const overdue = isTaskOverdue(task); //[cite: 1]
  const card = document.createElement('div'); //[cite: 1]
  const isDone = task.completed || task.status === 'done'; //[cite: 1]

  card.className = `task-card task-card-clickable ${getPriorityClass(task)} ${isDone ? 'completed' : ''} ${isSubtask ? 'is-subtask' : ''} ${overdue ? 'is-overdue' : ''}`; //[cite: 1]
  card.setAttribute('draggable', 'true'); //[cite: 1]
  card.dataset.id = task.id; //[cite: 1]
  card.title = 'Klik om deze taak te bewerken'; //[cite: 1]

  card.addEventListener('click', (e) => { //[cite: 1]
    editTask(task.id, e); //[cite: 1]
  }); //[cite: 1]

  card.addEventListener('dragstart', (e) => { //[cite: 1]
    draggedTaskId = task.id; //[cite: 1]
    card.classList.add('dragging'); //[cite: 1]
    e.dataTransfer.setData('text/plain', task.id); //[cite: 1]
  }); //[cite: 1]

  card.addEventListener('dragend', () => { //[cite: 1]
    card.classList.remove('dragging'); //[cite: 1]
    draggedTaskId = null; //[cite: 1]
  }); //[cite: 1]

  const linkHTML = task.link //[cite: 1]
    ? `<a href="${task.link}" target="_blank" class="task-link-badge" onclick="event.stopPropagation()">Link &#8599;</a>` //[cite: 1]
    : ''; //[cite: 1]

  const overdueBadge = overdue //[cite: 1]
    ? `<span class="overdue-badge">&#9888; Te laat!</span>` //[cite: 1]
    : ''; //[cite: 1]

  const notesBadge = (task.notes && task.notes.trim().length > 0)
    ? `<span class="task-notes-badge" title="${task.notes.replace(/"/g, '&quot;')}" onclick="event.stopPropagation(); editTask('${task.id}', event)">📝 Notitie</span>`
    : '';

  const rescheduleBtn = overdue //[cite: 1]
    ? `<button class="btn btn-xs btn-reschedule-today" onclick="rescheduleToToday('${task.id}', event)" title="Verzet naar vandaag">&#10148; Vandaag</button>` //[cite: 1]
    : ''; //[cite: 1]

  const gcalBtn = task.deadline //[cite: 1]
    ? `<button class="btn btn-secondary btn-xs" onclick="addTaskToGoogleCalendar('${task.id}', event)" title="Deadline toevoegen aan Google Agenda">&#128197;</button>` //[cite: 1]
    : ''; //[cite: 1]

  let checklistHTML = ''; //[cite: 1]
  if (Array.isArray(task.checklist) && task.checklist.length > 0) { //[cite: 1]
    const doneCount = task.checklist.filter(c => c.done).length; //[cite: 1]
    const itemsHTML = task.checklist.map(c => `
      <label class="mini-checklist-item ${c.done ? 'done' : ''}">
        <input type="checkbox" ${c.done ? 'checked' : ''} onclick="toggleChecklistItem('${task.id}', '${c.id}', event)">
        <span>${c.text}</span>
      </label>
    `).join(''); //[cite: 1]
    checklistHTML = `
      <details class="mini-checklist" onclick="event.stopPropagation()">
        <summary>&#9745; Checklist ${doneCount}/${task.checklist.length}</summary>
        <div class="mini-checklist-items">${itemsHTML}</div>
      </details>
    `; //[cite: 1]
  } //[cite: 1]

  const statusKey = task.status || (task.completed ? 'done' : 'not_started'); //[cite: 1]
  const statusLabels = { not_started: 'Niet gestart', in_progress: 'Bezig', done: 'Voltooid' }; //[cite: 1]

  card.innerHTML = `
    <div class="task-header-line">
      <span>${isSubtask ? '↳ ' : ''}${task.title}</span>
      <input type="checkbox" ${isDone ? 'checked' : ''} onclick="toggleTaskStatus('${task.id}', event)">
    </div>
    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 4px;">
      ${task.course ? `<span class="task-course-badge">${task.course}</span>` : ''}
      <span class="status-pill status-${statusKey}" onclick="cycleTaskStatus('${task.id}', event)">${statusLabels[statusKey]}</span>
      ${overdueBadge}
      ${notesBadge}
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
  `; //[cite: 1]

  return card; //[cite: 1]
} //[cite: 1]

// ==========================================
// 7. HABIT MODAL LOGICA
// ==========================================
const habitModal = document.getElementById('habit-modal');

function openHabitModal() {
  renderHabitManageList();
  if (habitModal) habitModal.classList.remove('hidden');
}

document.getElementById('close-habit-modal')?.addEventListener('click', () => habitModal.classList.add('hidden'));
document.getElementById('done-habit-modal-btn')?.addEventListener('click', () => habitModal.classList.add('hidden'));

document.getElementById('new-habit-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const icon = document.getElementById('habit-icon-input').value;
  const title = document.getElementById('habit-title-input').value;
  if (!title) return;
  createNewHabit(title, icon);
  document.getElementById('habit-title-input').value = '';
});

function renderHabitManageList() {
  const container = document.getElementById('habit-manage-list');
  if (!container) return;
  container.innerHTML = '';
  if (habits.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.8rem; padding: 6px;">Nog geen gewoontes aangemaakt.</p>';
    return;
  }
  habits.forEach(h => {
    const row = document.createElement('div');
    row.className = 'habit-manage-row';
    row.innerHTML = `
      <span>${h.icon} <strong>${h.title}</strong></span>
      <button class="btn-close" style="font-size:1.1rem;" onclick="deleteHabit('${h.id}')">&times;</button>
    `;
    container.appendChild(row);
  });
}

// --- DRAG & DROP LOGICA ---
function setupDropzone(el, type) { //[cite: 1]
  el.addEventListener('dragover', (e) => { //[cite: 1]
    e.preventDefault(); //[cite: 1]
    el.classList.add('dragover'); //[cite: 1]
  }); //[cite: 1]

  el.addEventListener('dragleave', () => { //[cite: 1]
    el.classList.remove('dragover'); //[cite: 1]
  }); //[cite: 1]

  el.addEventListener('drop', (e) => { //[cite: 1]
    e.preventDefault(); //[cite: 1]
    el.classList.remove('dragover'); //[cite: 1]
    const id = e.dataTransfer.getData('text/plain') || draggedTaskId; //[cite: 1]
    const task = tasks.find(t => t.id === id); //[cite: 1]
    if (!task) return; //[cite: 1]

    if (type === 'calendar') { //[cite: 1]
      task.scheduledDate = el.dataset.date || null; //[cite: 1]
      saveTaskToCloud(task); //[cite: 1]
      saveTasks(); //[cite: 1]
    } else if (type === 'matrix') { //[cite: 1]
      task.isUrgent = el.dataset.urgent === 'true'; //[cite: 1]
      task.isImportant = el.dataset.important === 'true'; //[cite: 1]
      saveTaskToCloud(task); //[cite: 1]
      saveTasks(); //[cite: 1]
    } else if (type === 'course') { //[cite: 1]
      const targetCourse = el.dataset.course; //[cite: 1]
      task.course = targetCourse === 'Zonder Vak' ? '' : targetCourse; //[cite: 1]
      saveTaskToCloud(task); //[cite: 1]
      saveTasks(); //[cite: 1]
    } //[cite: 1]
  }); //[cite: 1]
} //[cite: 1]

// --- EISENHOWER MATRIX ---
const matrixModal = document.getElementById('matrix-modal'); //[cite: 1]
document.getElementById('close-matrix-modal').onclick = () => matrixModal.classList.add('hidden'); //[cite: 1]
document.getElementById('close-matrix-btn').onclick = () => matrixModal.classList.add('hidden'); //[cite: 1]

function openMatrixModal(dateISO) { //[cite: 1]
  activeMatrixDate = dateISO; //[cite: 1]
  document.getElementById('matrix-modal-title').textContent = `Eisenhower Matrix: ${formatDisplayDate(dateISO)}`; //[cite: 1]
  document.getElementById('matrix-modal-subtitle').textContent = `Prioriteitenoverzicht.`; //[cite: 1]

  const quadrants = [ //[cite: 1]
    { id: 'matrix-q1-list', urgent: true, important: true }, //[cite: 1]
    { id: 'matrix-q2-list', urgent: false, important: true }, //[cite: 1]
    { id: 'matrix-q3-list', urgent: true, important: false }, //[cite: 1]
    { id: 'matrix-q4-list', urgent: false, important: false } //[cite: 1]
  ]; //[cite: 1]

  const dayTasks = tasks.filter(t => t.scheduledDate === dateISO); //[cite: 1]

  quadrants.forEach(q => { //[cite: 1]
    const el = document.getElementById(q.id); //[cite: 1]
    el.innerHTML = ''; //[cite: 1]
    setupDropzone(el, 'matrix'); //[cite: 1]

    const matching = dayTasks.filter(t => Boolean(t.isUrgent) === q.urgent && Boolean(t.isImportant) === q.important); //[cite: 1]
    matching.forEach(task => { //[cite: 1]
      el.appendChild(createTaskCard(task, !!task.parentId)); //[cite: 1]
    }); //[cite: 1]
  }); //[cite: 1]

  matrixModal.classList.remove('hidden'); //[cite: 1]
} //[cite: 1]

function openTaskModalForQuadrant(urgent, important) { //[cite: 1]
  openNewTaskModal(); //[cite: 1]
  document.getElementById('task-scheduled-date').value = activeMatrixDate || ''; //[cite: 1]
  document.getElementById('task-urgent').checked = urgent; //[cite: 1]
  document.getElementById('task-important').checked = important; //[cite: 1]
} //[cite: 1]

// --- TAAK TOEVOEGEN / BEWERKEN ---
const taskModal = document.getElementById('task-modal'); //[cite: 1]

function updateParentTaskOptions(selectedParentId = '') { //[cite: 1]
  const select = document.getElementById('task-parent-id'); //[cite: 1]
  select.innerHTML = '<option value="">-- Geen (hoofdtaak) --</option>'; //[cite: 1]
  tasks.filter(t => !t.parentId).forEach(t => { //[cite: 1]
    const opt = document.createElement('option'); //[cite: 1]
    opt.value = t.id; //[cite: 1]
    opt.textContent = `${t.title} (${t.course || 'Geen vak'})`; //[cite: 1]
    if (t.id === selectedParentId) opt.selected = true; //[cite: 1]
    select.appendChild(opt); //[cite: 1]
  }); //[cite: 1]
} //[cite: 1]

function openNewTaskModal() { //[cite: 1]
  document.getElementById('task-form').reset(); //[cite: 1]
  document.getElementById('task-id').value = ''; //[cite: 1]
  document.getElementById('task-duration-unit').value = timeUnit; //[cite: 1]
  document.getElementById('task-duration-input').value = timeUnit === 'minutes' ? 60 : 1.0; //[cite: 1]
  document.getElementById('task-status').value = 'not_started'; //[cite: 1]
  document.getElementById('modal-title').textContent = 'Nieuwe taak toevoegen'; //[cite: 1]
  updateParentTaskOptions(); //[cite: 1]
  editingChecklist = []; //[cite: 1]
  renderChecklistEditor(); //[cite: 1]
  taskModal.classList.remove('hidden'); //[cite: 1]
} //[cite: 1]

function renderChecklistEditor() { //[cite: 1]
  const container = document.getElementById('checklist-editor-list'); //[cite: 1]
  if (!container) return; //[cite: 1]
  container.innerHTML = ''; //[cite: 1]

  if (editingChecklist.length === 0) { //[cite: 1]
    container.innerHTML = '<p class="checklist-empty-hint">Nog geen checklist-items. Voeg er hieronder een toe.</p>'; //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]

  editingChecklist.forEach((item, idx) => { //[cite: 1]
    const row = document.createElement('div'); //[cite: 1]
    row.className = 'checklist-editor-row'; //[cite: 1]
    row.innerHTML = `
      <label class="custom-checkbox checklist-check">
        <input type="checkbox" ${item.done ? 'checked' : ''}>
        <span class="checkbox-box"></span>
      </label>
      <span class="checklist-item-text ${item.done ? 'done' : ''}">${item.text}</span>
      <button type="button" class="btn-close checklist-remove-btn" title="Verwijder item">&times;</button>
    `; //[cite: 1]
    row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => { //[cite: 1]
      editingChecklist[idx].done = e.target.checked; //[cite: 1]
      renderChecklistEditor(); //[cite: 1]
    }); //[cite: 1]
    row.querySelector('.checklist-remove-btn').addEventListener('click', () => { //[cite: 1]
      editingChecklist.splice(idx, 1); //[cite: 1]
      renderChecklistEditor(); //[cite: 1]
    }); //[cite: 1]
    container.appendChild(row); //[cite: 1]
  }); //[cite: 1]
} //[cite: 1]

function addChecklistItem() { //[cite: 1]
  const input = document.getElementById('checklist-new-item-input'); //[cite: 1]
  if (!input) return; //[cite: 1]
  const text = input.value.trim(); //[cite: 1]
  if (!text) return; //[cite: 1]
  editingChecklist.push({ id: 'chk_' + Date.now() + '_' + Math.floor(Math.random() * 1000), text, done: false }); //[cite: 1]
  input.value = ''; //[cite: 1]
  renderChecklistEditor(); //[cite: 1]
  input.focus(); //[cite: 1]
} //[cite: 1]

document.getElementById('checklist-add-btn')?.addEventListener('click', addChecklistItem); //[cite: 1]
document.getElementById('checklist-new-item-input')?.addEventListener('keydown', (e) => { //[cite: 1]
  if (e.key === 'Enter') { //[cite: 1]
    e.preventDefault(); //[cite: 1]
    addChecklistItem(); //[cite: 1]
  } //[cite: 1]
}); //[cite: 1]

document.getElementById('open-new-task-btn').onclick = openNewTaskModal; //[cite: 1]
document.getElementById('close-task-modal').onclick = () => taskModal.classList.add('hidden'); //[cite: 1]
document.getElementById('cancel-task-btn').onclick = () => taskModal.classList.add('hidden'); //[cite: 1]

function editTask(id, event) { //[cite: 1]
  event.stopPropagation(); //[cite: 1]
  const task = tasks.find(t => t.id === id); //[cite: 1]
  if (!task) return; //[cite: 1]

  document.getElementById('task-id').value = task.id; //[cite: 1]
  document.getElementById('task-title').value = task.title; //[cite: 1]
  document.getElementById('task-course').value = task.course || ''; //[cite: 1]
  document.getElementById('task-status').value = task.status || (task.completed ? 'done' : 'not_started'); //[cite: 1]

  if (timeUnit === 'minutes') { //[cite: 1]
    document.getElementById('task-duration-unit').value = 'minutes'; //[cite: 1]
    document.getElementById('task-duration-input').value = Math.round((task.estimatedHours || 0) * 60); //[cite: 1]
  } else { //[cite: 1]
    document.getElementById('task-duration-unit').value = 'hours'; //[cite: 1]
    document.getElementById('task-duration-input').value = task.estimatedHours || 1.0; //[cite: 1]
  } //[cite: 1]

  document.getElementById('task-deadline').value = task.deadline || ''; //[cite: 1]
  document.getElementById('task-scheduled-date').value = task.scheduledDate || ''; //[cite: 1]
  document.getElementById('task-urgent').checked = !!task.isUrgent; //[cite: 1]
  document.getElementById('task-important').checked = !!task.isImportant; //[cite: 1]
  document.getElementById('task-link').value = task.link || ''; //[cite: 1]
  document.getElementById('task-notes').value = task.notes || ''; //[cite: 1]

  updateParentTaskOptions(task.parentId || ''); //[cite: 1]
  document.getElementById('modal-title').textContent = 'Taak bewerken'; //[cite: 1]
  editingChecklist = JSON.parse(JSON.stringify(task.checklist || [])); //[cite: 1]
  renderChecklistEditor(); //[cite: 1]
  taskModal.classList.remove('hidden'); //[cite: 1]
} //[cite: 1]

document.getElementById('task-form').addEventListener('submit', async (e) => { //[cite: 1]
  e.preventDefault(); //[cite: 1]
  const id = document.getElementById('task-id').value; //[cite: 1]
  const parentId = document.getElementById('task-parent-id').value || null; //[cite: 1]

  const enteredDuration = parseFloat(document.getElementById('task-duration-input').value) || 0; //[cite: 1]
  const enteredUnit = document.getElementById('task-duration-unit').value; //[cite: 1]
  const estimatedHours = enteredUnit === 'minutes' ? enteredDuration / 60 : enteredDuration; //[cite: 1]
  const status = document.getElementById('task-status').value; //[cite: 1]

  const taskData = { //[cite: 1]
    title: document.getElementById('task-title').value, //[cite: 1]
    parentId: parentId, //[cite: 1]
    course: document.getElementById('task-course').value.trim(), //[cite: 1]
    status: status, //[cite: 1]
    completed: status === 'done', //[cite: 1]
    estimatedHours: estimatedHours, //[cite: 1]
    deadline: document.getElementById('task-deadline').value || null, //[cite: 1]
    scheduledDate: document.getElementById('task-scheduled-date').value || null, //[cite: 1]
    isUrgent: document.getElementById('task-urgent').checked, //[cite: 1]
    isImportant: document.getElementById('task-important').checked, //[cite: 1]
    link: document.getElementById('task-link').value || null, //[cite: 1]
    notes: document.getElementById('task-notes').value || '', //[cite: 1]
    checklist: editingChecklist //[cite: 1]
  }; //[cite: 1]

  let savedTask; //[cite: 1]
  if (id) { //[cite: 1]
    const idx = tasks.findIndex(t => t.id === id); //[cite: 1]
    if (idx !== -1) { //[cite: 1]
      tasks[idx] = { ...tasks[idx], ...taskData }; //[cite: 1]
      savedTask = tasks[idx]; //[cite: 1]
    } //[cite: 1]
  } else { //[cite: 1]
    savedTask = { //[cite: 1]
      id: 'task_' + Date.now(), //[cite: 1]
      actualHours: 0, //[cite: 1]
      ...taskData //[cite: 1]
    }; //[cite: 1]
    tasks.push(savedTask); //[cite: 1]
  } //[cite: 1]

  saveTasks(); //[cite: 1]
  taskModal.classList.add('hidden'); //[cite: 1]
  if (savedTask) await saveTaskToCloud(savedTask); //[cite: 1]
}); //[cite: 1]

function toggleTaskStatus(id, event) { //[cite: 1]
  event.stopPropagation(); //[cite: 1]
  const task = tasks.find(t => t.id === id); //[cite: 1]
  if (task) { //[cite: 1]
    task.completed = !task.completed; //[cite: 1]
    task.status = task.completed ? 'done' : 'not_started'; //[cite: 1]
    saveTaskToCloud(task); //[cite: 1]
    saveTasks(); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

function deleteTask(id, event) { //[cite: 1]
  event.stopPropagation(); //[cite: 1]
  const removed = tasks.filter(t => t.id === id || t.parentId === id); //[cite: 1]
  if (removed.length === 0) return; //[cite: 1]

  tasks = tasks.filter(t => t.id !== id && t.parentId !== id); //[cite: 1]
  saveTasks(); //[cite: 1]

  showUndoSnackbar( //[cite: 1]
    removed.length > 1 ? 'Taak + subtaken verwijderd' : 'Taak verwijderd', //[cite: 1]
    () => { //[cite: 1]
      tasks.push(...removed); //[cite: 1]
      saveTasks(); //[cite: 1]
    }, //[cite: 1]
    async () => { //[cite: 1]
      for (const t of removed) { //[cite: 1]
        await deleteTaskFromCloud(t.id); //[cite: 1]
      } //[cite: 1]
    } //[cite: 1]
  ); //[cite: 1]
} //[cite: 1]

// --- ZEN ALPINE FOCUS TIMER ---
const timerModal = document.getElementById('timer-modal'); //[cite: 1]
const timerDisplay = document.getElementById('timer-display'); //[cite: 1]
const timerSubStatus = document.getElementById('timer-sub-status'); //[cite: 1]
const timerToggleBtn = document.getElementById('timer-toggle-btn'); //[cite: 1]
const timerSaveBtn = document.getElementById('timer-save-btn'); //[cite: 1]
const focusQuoteEl = document.getElementById('focus-quote'); //[cite: 1]
const zenFocusCardEl = document.querySelector('.zen-focus-card'); //[cite: 1]
const presetButtons = Array.from(document.querySelectorAll('.zen-preset-btn')); //[cite: 1]

function setZenProgress(percent) { //[cite: 1]
  const p = Math.min(100, Math.max(0, percent)); //[cite: 1]
  const circle = document.getElementById('progress-ring-circle'); //[cite: 1]
  if (circle) { //[cite: 1]
    const offset = circumference - (p / 100) * circumference; //[cite: 1]
    circle.style.strokeDashoffset = offset; //[cite: 1]
  } //[cite: 1]
  if (timerModal) { //[cite: 1]
    timerModal.style.setProperty('--zen-progress', (p / 100).toFixed(3)); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

function getExactElapsedSeconds() { //[cite: 1]
  if (!timerStartTime) return timerAccumulatedSeconds; //[cite: 1]
  const diffInSeconds = Math.floor((Date.now() - timerStartTime) / 1000); //[cite: 1]
  return timerAccumulatedSeconds + diffInSeconds; //[cite: 1]
} //[cite: 1]

function playFocusChime() { //[cite: 1]
  try { //[cite: 1]
    const Ctx = window.AudioContext || window.webkitAudioContext; //[cite: 1]
    if (!Ctx) return; //[cite: 1]
    const ctx = new Ctx(); //[cite: 1]
    [523.25, 659.25].forEach((freq, i) => { //[cite: 1]
      const osc = ctx.createOscillator(); //[cite: 1]
      const gain = ctx.createGain(); //[cite: 1]
      osc.type = 'sine'; //[cite: 1]
      osc.frequency.value = freq; //[cite: 1]
      const startAt = ctx.currentTime + i * 0.18; //[cite: 1]
      gain.gain.setValueAtTime(0, startAt); //[cite: 1]
      gain.gain.linearRampToValueAtTime(0.15, startAt + 0.05); //[cite: 1]
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.6); //[cite: 1]
      osc.connect(gain); //[cite: 1]
      gain.connect(ctx.destination); //[cite: 1]
      osc.start(startAt); //[cite: 1]
      osc.stop(startAt + 0.65); //[cite: 1]
    }); //[cite: 1]
    setTimeout(() => ctx.close().catch(() => {}), 1500); //[cite: 1]
  } catch (e) { } //[cite: 1]
} //[cite: 1]

function updatePresetLockState() { //[cite: 1]
  const locked = Boolean(timerStartTime) || timerAccumulatedSeconds > 0; //[cite: 1]
  presetButtons.forEach(btn => { btn.disabled = locked; }); //[cite: 1]
} //[cite: 1]

function setPresetActive(preset) { //[cite: 1]
  presetButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.preset === preset)); //[cite: 1]
} //[cite: 1]

function selectTimerPreset(preset) { //[cite: 1]
  if (timerStartTime || timerAccumulatedSeconds > 0) return; //[cite: 1]
  countdownCompleted = false; //[cite: 1]
  if (preset === 'free') { //[cite: 1]
    timerMode = 'free'; //[cite: 1]
    timerDurationSeconds = 0; //[cite: 1]
  } else { //[cite: 1]
    timerMode = 'countdown'; //[cite: 1]
    timerDurationSeconds = parseInt(preset, 10) * 60; //[cite: 1]
  } //[cite: 1]
  setPresetActive(preset); //[cite: 1]
  timerSubStatus.textContent = 'Adem in • Focus'; //[cite: 1]
  updateTimerDisplay(); //[cite: 1]
} //[cite: 1]

presetButtons.forEach(btn => { //[cite: 1]
  btn.addEventListener('click', () => selectTimerPreset(btn.dataset.preset)); //[cite: 1]
}); //[cite: 1]

function openTimerModal(taskId, event) { //[cite: 1]
  if (event) event.stopPropagation(); //[cite: 1]
  const task = tasks.find(t => t.id === taskId); //[cite: 1]
  if (!task) return; //[cite: 1]

  activeTimerTaskId = taskId; //[cite: 1]
  timerStartTime = null; //[cite: 1]
  timerAccumulatedSeconds = 0; //[cite: 1]
  timerMode = 'free'; //[cite: 1]
  timerDurationSeconds = 0; //[cite: 1]
  countdownCompleted = false; //[cite: 1]
  if (zenFocusCardEl) zenFocusCardEl.classList.remove('zen-complete-pulse'); //[cite: 1]
  setPresetActive('free'); //[cite: 1]
  updatePresetLockState(); //[cite: 1]

  document.getElementById('timer-task-title').textContent = task.title; //[cite: 1]
  document.getElementById('timer-task-course').textContent = task.course || 'Rustige Focus'; //[cite: 1]
  document.getElementById('timer-estimated').textContent = formatDuration(task.estimatedHours || 0); //[cite: 1]
  document.getElementById('timer-actual').textContent = formatDuration(task.actualHours || 0); //[cite: 1]

  timerSubStatus.textContent = 'Adem in • Focus'; //[cite: 1]
  timerToggleBtn.textContent = 'Start Sessie'; //[cite: 1]
  timerToggleBtn.classList.remove('is-running'); //[cite: 1]

  updateTimerDisplay(); //[cite: 1]

  const initialPercent = task.estimatedHours > 0  //[cite: 1]
    ? ((task.actualHours || 0) / task.estimatedHours) * 100  //[cite: 1]
    : 0; //[cite: 1]
  setZenProgress(initialPercent); //[cite: 1]

  focusQuoteEl.textContent = focusQuotes[Math.floor(Math.random() * focusQuotes.length)]; //[cite: 1]
  if (quoteInterval) clearInterval(quoteInterval); //[cite: 1]
  quoteInterval = setInterval(() => { //[cite: 1]
    focusQuoteEl.textContent = focusQuotes[Math.floor(Math.random() * focusQuotes.length)]; //[cite: 1]
  }, 25000); //[cite: 1]

  timerModal.classList.remove('hidden'); //[cite: 1]
} //[cite: 1]

function pauseTimerInternal() { //[cite: 1]
  if (timerStartTime) { //[cite: 1]
    timerAccumulatedSeconds += Math.floor((Date.now() - timerStartTime) / 1000); //[cite: 1]
    timerStartTime = null; //[cite: 1]
  } //[cite: 1]
  clearInterval(timerInterval); //[cite: 1]
  timerInterval = null; //[cite: 1]
} //[cite: 1]

function handleCountdownComplete() { //[cite: 1]
  countdownCompleted = true; //[cite: 1]
  timerAccumulatedSeconds = timerDurationSeconds; //[cite: 1]
  pauseTimerInternal(); //[cite: 1]
  setZenProgress(100); //[cite: 1]

  timerDisplay.textContent = '00:00:00'; //[cite: 1]
  timerSubStatus.textContent = 'Sessie voltooid • Goed gedaan! 🏔️'; //[cite: 1]
  timerToggleBtn.textContent = 'Nog een ronde'; //[cite: 1]
  timerToggleBtn.classList.remove('is-running'); //[cite: 1]
  updatePresetLockState(); //[cite: 1]

  if (zenFocusCardEl) { //[cite: 1]
    zenFocusCardEl.classList.remove('zen-complete-pulse'); //[cite: 1]
    void zenFocusCardEl.offsetWidth; //[cite: 1]
    zenFocusCardEl.classList.add('zen-complete-pulse'); //[cite: 1]
  } //[cite: 1]
  playFocusChime(); //[cite: 1]
} //[cite: 1]

function updateTimerDisplay() { //[cite: 1]
  const totalSec = getExactElapsedSeconds(); //[cite: 1]

  if (timerMode === 'countdown') { //[cite: 1]
    const remaining = Math.max(0, timerDurationSeconds - totalSec); //[cite: 1]
    const h = Math.floor(remaining / 3600).toString().padStart(2, '0'); //[cite: 1]
    const m = Math.floor((remaining % 3600) / 60).toString().padStart(2, '0'); //[cite: 1]
    const s = (remaining % 60).toString().padStart(2, '0'); //[cite: 1]
    timerDisplay.textContent = `${h}:${m}:${s}`; //[cite: 1]

    const percent = timerDurationSeconds > 0 ? (totalSec / timerDurationSeconds) * 100 : 0; //[cite: 1]
    setZenProgress(percent); //[cite: 1]

    if (remaining <= 0 && !countdownCompleted && timerStartTime) { //[cite: 1]
      handleCountdownComplete(); //[cite: 1]
    } //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]

  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0'); //[cite: 1]
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0'); //[cite: 1]
  const s = (totalSec % 60).toString().padStart(2, '0'); //[cite: 1]
  timerDisplay.textContent = `${h}:${m}:${s}`; //[cite: 1]

  const task = tasks.find(t => t.id === activeTimerTaskId); //[cite: 1]
  if (task && task.estimatedHours > 0) { //[cite: 1]
    const totalCurrentHours = (task.actualHours || 0) + (totalSec / 3600); //[cite: 1]
    const percent = (totalCurrentHours / task.estimatedHours) * 100; //[cite: 1]
    setZenProgress(percent); //[cite: 1]
  } else { //[cite: 1]
    const percent = (totalSec / 1500) * 100; //[cite: 1]
    setZenProgress(percent); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

timerToggleBtn.onclick = () => { //[cite: 1]
  if (timerStartTime) { //[cite: 1]
    pauseTimerInternal(); //[cite: 1]
    timerToggleBtn.textContent = 'Hervat Focus'; //[cite: 1]
    timerToggleBtn.classList.remove('is-running'); //[cite: 1]
    timerSubStatus.textContent = 'Even gepauzeerd'; //[cite: 1]
    updateTimerDisplay(); //[cite: 1]
    updatePresetLockState(); //[cite: 1]
  } else if (countdownCompleted) { //[cite: 1]
    countdownCompleted = false; //[cite: 1]
    timerAccumulatedSeconds = 0; //[cite: 1]
    if (zenFocusCardEl) zenFocusCardEl.classList.remove('zen-complete-pulse'); //[cite: 1]
    timerStartTime = Date.now(); //[cite: 1]
    timerInterval = setInterval(updateTimerDisplay, 250); //[cite: 1]
    timerToggleBtn.textContent = 'Pauzeer Sessie'; //[cite: 1]
    timerToggleBtn.classList.add('is-running'); //[cite: 1]
    timerSubStatus.textContent = 'In Diepe Rust'; //[cite: 1]
    updateTimerDisplay(); //[cite: 1]
    updatePresetLockState(); //[cite: 1]
  } else { //[cite: 1]
    timerStartTime = Date.now(); //[cite: 1]
    timerInterval = setInterval(updateTimerDisplay, 250); //[cite: 1]
    timerToggleBtn.textContent = 'Pauzeer Sessie'; //[cite: 1]
    timerToggleBtn.classList.add('is-running'); //[cite: 1]
    timerSubStatus.textContent = 'In Diepe Rust'; //[cite: 1]
    updateTimerDisplay(); //[cite: 1]
    updatePresetLockState(); //[cite: 1]
  } //[cite: 1]
}; //[cite: 1]

document.addEventListener('visibilitychange', () => { //[cite: 1]
  if (!document.hidden && !timerModal.classList.contains('hidden')) { //[cite: 1]
    updateTimerDisplay(); //[cite: 1]
  } //[cite: 1]
}); //[cite: 1]

timerSaveBtn.onclick = () => stopTimerAndSave(); //[cite: 1]

document.getElementById('close-timer-modal').onclick = () => { //[cite: 1]
  const elapsed = getExactElapsedSeconds(); //[cite: 1]
  if (elapsed > 0) { //[cite: 1]
    if (confirm('Wil je de verstreken tijd opslaan bij deze taak?')) { //[cite: 1]
      stopTimerAndSave(); //[cite: 1]
      return; //[cite: 1]
    } //[cite: 1]
  } //[cite: 1]
  closeTimerModalDirect(); //[cite: 1]
}; //[cite: 1]

function stopTimerAndSave() { //[cite: 1]
  const elapsed = getExactElapsedSeconds(); //[cite: 1]
  if (timerInterval) clearInterval(timerInterval); //[cite: 1]
  timerInterval = null; //[cite: 1]
  timerStartTime = null; //[cite: 1]

  const task = tasks.find(t => t.id === activeTimerTaskId); //[cite: 1]
  if (task && elapsed > 0) { //[cite: 1]
    task.actualHours = (task.actualHours || 0) + (elapsed / 3600); //[cite: 1]
    saveTaskToCloud(task); //[cite: 1]
    saveTasks(); //[cite: 1]
  } //[cite: 1]
  closeTimerModalDirect(); //[cite: 1]
} //[cite: 1]

function closeTimerModalDirect() { //[cite: 1]
  if (timerInterval) clearInterval(timerInterval); //[cite: 1]
  if (quoteInterval) clearInterval(quoteInterval); //[cite: 1]
  timerInterval = null; //[cite: 1]
  quoteInterval = null; //[cite: 1]
  timerStartTime = null; //[cite: 1]
  timerAccumulatedSeconds = 0; //[cite: 1]
  timerMode = 'free'; //[cite: 1]
  timerDurationSeconds = 0; //[cite: 1]
  countdownCompleted = false; //[cite: 1]
  if (zenFocusCardEl) zenFocusCardEl.classList.remove('zen-complete-pulse'); //[cite: 1]
  timerModal.classList.add('hidden'); //[cite: 1]
  if (document.fullscreenElement) { //[cite: 1]
    document.exitFullscreen().catch(() => {}); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

document.getElementById('fullscreen-toggle-btn').onclick = () => { //[cite: 1]
  if (!document.fullscreenElement) { //[cite: 1]
    document.documentElement.requestFullscreen().catch(err => { //[cite: 1]
      alert(`Kon volledig scherm niet activeren: ${err.message}`); //[cite: 1]
    }); //[cite: 1]
  } else { //[cite: 1]
    document.exitFullscreen().catch(() => {}); //[cite: 1]
  } //[cite: 1]
}; //[cite: 1]

// --- FILTERS & INPUT EVENTS ---
document.getElementById('unit-hours-btn').onclick = () => { //[cite: 1]
  timeUnit = 'hours'; //[cite: 1]
  localStorage.setItem('study_time_unit', 'hours'); //[cite: 1]
  renderApp(); //[cite: 1]
}; //[cite: 1]

document.getElementById('unit-minutes-btn').onclick = () => { //[cite: 1]
  timeUnit = 'minutes'; //[cite: 1]
  localStorage.setItem('study_time_unit', 'minutes'); //[cite: 1]
  renderApp(); //[cite: 1]
}; //[cite: 1]

['search-input', 'mobile-search-input'].forEach(id => { //[cite: 1]
  const el = document.getElementById(id); //[cite: 1]
  if (el) { //[cite: 1]
    el.addEventListener('input', debounce((e) => { //[cite: 1]
      searchQuery = e.target.value.trim(); //[cite: 1]
      renderApp(); //[cite: 1]
    }, 250)); //[cite: 1]
  } //[cite: 1]
}); //[cite: 1]

['course-filter-select', 'mobile-course-filter-select'].forEach(id => { //[cite: 1]
  const el = document.getElementById(id); //[cite: 1]
  if (el) { //[cite: 1]
    el.addEventListener('change', (e) => { //[cite: 1]
      selectedCourseFilter = e.target.value; //[cite: 1]
      renderApp(); //[cite: 1]
    }); //[cite: 1]
  } //[cite: 1]
}); //[cite: 1]

// --- JSON BACKUP EXPORT & IMPORT ---
document.getElementById('export-json-btn').onclick = () => { //[cite: 1]
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tasks, habits, habitLogs }, null, 2));
  const downloadAnchor = document.createElement('a'); //[cite: 1]
  downloadAnchor.setAttribute("href", dataStr); //[cite: 1]
  downloadAnchor.setAttribute("download", `studieplanner_backup_${formatDateISO(new Date())}.json`); //[cite: 1]
  document.body.appendChild(downloadAnchor); //[cite: 1]
  downloadAnchor.click(); //[cite: 1]
  downloadAnchor.remove(); //[cite: 1]
}; //[cite: 1]

document.getElementById('import-json-input').addEventListener('change', (e) => { //[cite: 1]
  const file = e.target.files[0]; //[cite: 1]
  if (!file) return; //[cite: 1]

  const reader = new FileReader(); //[cite: 1]
  reader.onload = async (event) => { //[cite: 1]
    try { //[cite: 1]
      const parsed = JSON.parse(event.target.result);
      const importedTasks = Array.isArray(parsed) ? parsed : (parsed.tasks || []);
      if (confirm(`Wil je ${importedTasks.length} taken importeren? Huidige data wordt overschreven.`)) { //[cite: 1]
        tasks = importedTasks; //[cite: 1]
        if (parsed.habits) habits = parsed.habits;
        if (parsed.habitLogs) habitLogs = parsed.habitLogs;
        saveTasks(); //[cite: 1]
        for (const t of tasks) await saveTaskToCloud(t); //[cite: 1]
      } //[cite: 1]
    } catch (err) { //[cite: 1]
      alert('Fout bij importeren van JSON: ' + err.message); //[cite: 1]
    } //[cite: 1]
  }; //[cite: 1]
  reader.readAsText(file); //[cite: 1]
}); //[cite: 1]

// --- KALENDER NAVIGATIE ---
const btnWeek = document.getElementById('view-week-btn'); //[cite: 1]
const btnRolling7 = document.getElementById('view-rolling7-btn'); //[cite: 1]
const btnCourses = document.getElementById('view-courses-btn'); //[cite: 1]

function setActiveView(view) { //[cite: 1]
  currentView = view; //[cite: 1]
  if (btnWeek) btnWeek.classList.toggle('active', view === 'week'); //[cite: 1]
  if (btnRolling7) btnRolling7.classList.toggle('active', view === 'rolling7'); //[cite: 1]
  if (btnCourses) btnCourses.classList.toggle('active', view === 'courses'); //[cite: 1]

  if (view === 'rolling7') { //[cite: 1]
    rollingStartDate = new Date(); //[cite: 1]
    rollingStartDate.setHours(0, 0, 0, 0); //[cite: 1]
  } //[cite: 1]
  renderApp(); //[cite: 1]
} //[cite: 1]

if (btnWeek) btnWeek.onclick = () => setActiveView('week'); //[cite: 1]
if (btnRolling7) btnRolling7.onclick = () => setActiveView('rolling7'); //[cite: 1]
if (btnCourses) btnCourses.onclick = () => setActiveView('courses'); //[cite: 1]

document.getElementById('prev-week-btn').onclick = () => { //[cite: 1]
  if (currentView === 'week') currentWeekMonday.setDate(currentWeekMonday.getDate() - 7); //[cite: 1]
  else if (currentView === 'rolling7') rollingStartDate.setDate(rollingStartDate.getDate() - 7); //[cite: 1]
  renderApp(); //[cite: 1]
}; //[cite: 1]

document.getElementById('next-week-btn').onclick = () => { //[cite: 1]
  if (currentView === 'week') currentWeekMonday.setDate(currentWeekMonday.getDate() + 7); //[cite: 1]
  else if (currentView === 'rolling7') rollingStartDate.setDate(rollingStartDate.getDate() + 7); //[cite: 1]
  renderApp(); //[cite: 1]
}; //[cite: 1]

document.getElementById('today-btn').onclick = () => { //[cite: 1]
  if (currentView === 'week') currentWeekMonday = getMonday(new Date()); //[cite: 1]
  else if (currentView === 'rolling7') { //[cite: 1]
    rollingStartDate = new Date(); //[cite: 1]
    rollingStartDate.setHours(0, 0, 0, 0); //[cite: 1]
  } //[cite: 1]
  mobileSelectedDate = formatDateISO(new Date()); //[cite: 1]
  renderApp(); //[cite: 1]
}; //[cite: 1]

const logoutBtn = document.getElementById('logout-pin-btn'); //[cite: 1]
if (logoutBtn) { //[cite: 1]
  logoutBtn.onclick = async () => { //[cite: 1]
    if (confirm('Wil je uitloggen / van pincode wisselen op dit toestel?')) { //[cite: 1]
      if (supabaseClient) await supabaseClient.auth.signOut(); //[cite: 1]
      location.reload(); //[cite: 1]
    } //[cite: 1]
  }; //[cite: 1]
} //[cite: 1]

// ==========================================
// 8. TOASTS & ONGEDAAN-MAKEN-SNACKBAR
// ==========================================
function showToast(message, type = 'info') { //[cite: 1]
  let container = document.getElementById('toast-container'); //[cite: 1]
  if (!container) { //[cite: 1]
    container = document.createElement('div'); //[cite: 1]
    container.id = 'toast-container'; //[cite: 1]
    document.body.appendChild(container); //[cite: 1]
  } //[cite: 1]
  const toast = document.createElement('div'); //[cite: 1]
  toast.className = `toast toast-${type}`; //[cite: 1]
  toast.textContent = message; //[cite: 1]
  container.appendChild(toast); //[cite: 1]

  requestAnimationFrame(() => toast.classList.add('show')); //[cite: 1]
  setTimeout(() => { //[cite: 1]
    toast.classList.remove('show'); //[cite: 1]
    setTimeout(() => toast.remove(), 300); //[cite: 1]
  }, 4000); //[cite: 1]
} //[cite: 1]

function showUndoSnackbar(message, onUndo, onConfirm) { //[cite: 1]
  const existing = document.getElementById('undo-snackbar'); //[cite: 1]
  if (existing) existing.remove(); //[cite: 1]

  const bar = document.createElement('div'); //[cite: 1]
  bar.id = 'undo-snackbar'; //[cite: 1]
  bar.className = 'undo-snackbar'; //[cite: 1]
  bar.innerHTML = `<span>${message}</span><button class="undo-btn">Ongedaan maken</button>`; //[cite: 1]
  document.body.appendChild(bar); //[cite: 1]
  requestAnimationFrame(() => bar.classList.add('show')); //[cite: 1]

  let undone = false; //[cite: 1]
  const timeoutId = setTimeout(async () => { //[cite: 1]
    if (!undone) await onConfirm(); //[cite: 1]
    bar.classList.remove('show'); //[cite: 1]
    setTimeout(() => bar.remove(), 300); //[cite: 1]
  }, 5000); //[cite: 1]

  bar.querySelector('.undo-btn').onclick = () => { //[cite: 1]
    undone = true; //[cite: 1]
    clearTimeout(timeoutId); //[cite: 1]
    onUndo(); //[cite: 1]
    bar.classList.remove('show'); //[cite: 1]
    setTimeout(() => bar.remove(), 300); //[cite: 1]
  }; //[cite: 1]
} //[cite: 1]

// ==========================================
// 9. THEMA & SERVICE WORKER
// ==========================================
function applyTheme(theme) { //[cite: 1]
  currentTheme = theme; //[cite: 1]
  document.documentElement.setAttribute('data-theme', theme); //[cite: 1]
  localStorage.setItem('study_theme', theme); //[cite: 1]
  const themeBtn = document.getElementById('theme-toggle-btn'); //[cite: 1]
  if (themeBtn) themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙'; //[cite: 1]
} //[cite: 1]

document.getElementById('theme-toggle-btn')?.addEventListener('click', () => { //[cite: 1]
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); //[cite: 1]
}); //[cite: 1]

function registerServiceWorker() { //[cite: 1]
  if ('serviceWorker' in navigator) { //[cite: 1]
    navigator.serviceWorker.register('service-worker.js').catch(err => { //[cite: 1]
      console.warn('Service worker registratie mislukt:', err); //[cite: 1]
    }); //[cite: 1]
  } //[cite: 1]
} //[cite: 1]

// ==========================================
// 10. GOOGLE AGENDA & ICS-EXPORT
// ==========================================
function formatICSDate(dateStr) { return dateStr.replace(/-/g, ''); } //[cite: 1]
function addOneDay(dateISO) { //[cite: 1]
  const d = new Date(dateISO + 'T00:00:00'); //[cite: 1]
  d.setDate(d.getDate() + 1); //[cite: 1]
  return formatDateISO(d); //[cite: 1]
} //[cite: 1]

function buildGoogleCalendarUrl(task) { //[cite: 1]
  const startCompact = formatICSDate(task.deadline); //[cite: 1]
  const endCompact = formatICSDate(addOneDay(task.deadline)); //[cite: 1]
  const params = new URLSearchParams({ //[cite: 1]
    action: 'TEMPLATE', //[cite: 1]
    text: `Deadline: ${task.title}${task.course ? ' (' + task.course + ')' : ''}`, //[cite: 1]
    dates: `${startCompact}/${endCompact}`, //[cite: 1]
    details: task.notes || 'Toegevoegd vanuit Studieplanner' //[cite: 1]
  }); //[cite: 1]
  return `https://calendar.google.com/calendar/render?${params.toString()}`; //[cite: 1]
} //[cite: 1]

function addTaskToGoogleCalendar(taskId, event) { //[cite: 1]
  if (event) event.stopPropagation(); //[cite: 1]
  const task = tasks.find(t => t.id === taskId); //[cite: 1]
  if (!task || !task.deadline) return; //[cite: 1]
  window.open(buildGoogleCalendarUrl(task), '_blank', 'noopener'); //[cite: 1]
} //[cite: 1]

function buildICSCalendar(taskList) { //[cite: 1]
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studieplanner//NL']; //[cite: 1]
  taskList.filter(t => t.deadline).forEach(t => { //[cite: 1]
    lines.push( //[cite: 1]
      'BEGIN:VEVENT', //[cite: 1]
      `UID:${t.id}@studieplanner`, //[cite: 1]
      `DTSTART;VALUE=DATE:${formatICSDate(t.deadline)}`, //[cite: 1]
      `DTEND;VALUE=DATE:${formatICSDate(addOneDay(t.deadline))}`, //[cite: 1]
      `SUMMARY:Deadline: ${t.title}${t.course ? ' (' + t.course + ')' : ''}`, //[cite: 1]
      `DESCRIPTION:${(t.notes || '').replace(/\r?\n/g, '\\n')}`, //[cite: 1]
      'END:VEVENT' //[cite: 1]
    ); //[cite: 1]
  }); //[cite: 1]
  lines.push('END:VCALENDAR'); //[cite: 1]
  return lines.join('\r\n'); //[cite: 1]
} //[cite: 1]

document.getElementById('export-ics-btn')?.addEventListener('click', () => { //[cite: 1]
  const deadlineTasks = tasks.filter(t => t.deadline); //[cite: 1]
  if (deadlineTasks.length === 0) { //[cite: 1]
    showToast('Geen taken met een deadline om te exporteren.', 'info'); //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]
  const icsContent = buildICSCalendar(deadlineTasks); //[cite: 1]
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' }); //[cite: 1]
  const url = URL.createObjectURL(blob); //[cite: 1]
  const a = document.createElement('a'); //[cite: 1]
  a.href = url; //[cite: 1]
  a.download = `studieplanner_deadlines_${formatDateISO(new Date())}.ics`; //[cite: 1]
  document.body.appendChild(a); //[cite: 1]
  a.click(); //[cite: 1]
  a.remove(); //[cite: 1]
  URL.revokeObjectURL(url); //[cite: 1]
  showToast('ICS-bestand gedownload.', 'info');
}); //[cite: 1]

// --- SNELTOETSEN ---
document.addEventListener('keydown', (e) => { //[cite: 1]
  const tag = (e.target.tagName || '').toLowerCase(); //[cite: 1]
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable; //[cite: 1]

  if (e.key === 'Escape') { //[cite: 1]
    document.querySelectorAll('.modal-overlay:not(.hidden), .focus-overlay:not(.hidden)').forEach(m => m.classList.add('hidden')); //[cite: 1]
    return; //[cite: 1]
  } //[cite: 1]

  if (typing) return; //[cite: 1]

  if (e.key === 'n' || e.key === 'N') { //[cite: 1]
    e.preventDefault(); //[cite: 1]
    openNewTaskModal(); //[cite: 1]
  } else if (e.key === '/') { //[cite: 1]
    e.preventDefault(); //[cite: 1]
    (document.getElementById('search-input') || document.getElementById('mobile-search-input'))?.focus(); //[cite: 1]
  } else if (e.key === 'ArrowLeft') { //[cite: 1]
    document.getElementById('prev-week-btn')?.click(); //[cite: 1]
  } else if (e.key === 'ArrowRight') { //[cite: 1]
    document.getElementById('next-week-btn')?.click(); //[cite: 1]
  } //[cite: 1]
}); //[cite: 1]

// Start
checkAuthAndInit(); //[cite: 1]