
/* ==========================================
   STUDYSMART - MAIN JAVASCRIPT
   ========================================== */

// 1. GET ELEMENTS
const $ = (id) => document.getElementById(id);

const authScreen = $("authScreen");
const app = $("app");
const authForm = $("authForm");
const subjectForm = $("subjectForm");

// 2. SAVE AND LOAD DATA
function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    return fallback;
  }
}

let currentUser = loadData("studySmartUser", null);
let subjects = loadData("studySmartSubjects", []);
let studyHours = Number(localStorage.getItem("studySmartHours")) || 3;
let totalSessions = Number(localStorage.getItem("studySmartSessions")) || 0;

let isSignup = false;
let timerSeconds = 25 * 60;
let timerInterval = null;
let generatedSchedule = [];

// Save data in the browser
function saveData() {
  localStorage.setItem("studySmartSubjects", JSON.stringify(subjects));
  localStorage.setItem("studySmartHours", studyHours);
  localStorage.setItem("studySmartSessions", totalSessions);
}

// 3. HELPER FUNCTIONS
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return replacements[character];
  });
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

function getDaysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exam = new Date(dateString + "T00:00:00");
  return Math.ceil((exam - today) / (1000 * 60 * 60 * 24));
}

function formatExamDate(dateString) {
  if (!dateString) return "No exam date";
  return new Date(dateString + "T00:00:00").toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric" }
  );
}

function getPriorityValue(priority) {
  const values = { high: 3, medium: 2, low: 1 };
  return values[priority] || 2;
}

function calculateAverage() {
  if (subjects.length === 0) return 0;

  const total = subjects.reduce((sum, subject) => {
    return sum + Number(subject.marks);
  }, 0);

  return Math.round(total / subjects.length);
}

function calculateTargetProgress() {
  if (subjects.length === 0) return 0;

  const total = subjects.reduce((sum, subject) => {
    const target = Math.max(1, Number(subject.target));
    return sum + Math.min(100, (Number(subject.marks) / target) * 100);
  }, 0);

  return Math.round(total / subjects.length);
}

// 4. LOGIN AND SIGNUP DEMO
function updateAuthMode() {
  $("authTitle").textContent = isSignup ? "Create your account" : "Welcome back!";
  $("authButton").textContent = isSignup ? "Create Account" : "Login to Dashboard";
  $("switchText").textContent = isSignup
    ? "Already have an account?"
    : "New student?";

  $("switchAuth").textContent = isSignup ? "Login" : "Create account";
  $("userName").classList.toggle("hidden", !isSignup);
  $("nameLabel").classList.toggle("hidden", !isSignup);
  $("userName").required = isSignup;
}

$("switchAuth").addEventListener("click", () => {
  isSignup = !isSignup;
  updateAuthMode();
});

authForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = $("userEmail").value.trim();
  const password = $("userPassword").value;
  const typedName = $("userName").value.trim();

  if (password.length < 4) {
    showToast("Password must contain at least 4 characters.");
    return;
  }

  if (isSignup && !typedName) {
    showToast("Please enter your name.");
    return;
  }

  // This is a front-end demo, not secure authentication.
  currentUser = {
    name: isSignup
      ? typedName
      : (currentUser && currentUser.email === email
          ? currentUser.name
          : email.split("@")[0]),
    email: email
  };

  localStorage.setItem("studySmartUser", JSON.stringify(currentUser));

  openApp();
  showToast("Welcome to StudySmart!");
});

function openApp() {
  if (!currentUser) return;

  authScreen.classList.add("hidden");
  app.classList.remove("hidden");

  const name = currentUser.name || "Student";
  $("welcomeText").textContent = "Welcome back, " + name + "!";
  $("sidebarName").textContent = name;
  $("userAvatar").textContent = name.charAt(0).toUpperCase();

  $("studyHours").value = studyHours;

  renderAll();
}

$("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem("studySmartUser");

  clearInterval(timerInterval);
  timerInterval = null;

  app.classList.add("hidden");
  authScreen.classList.remove("hidden");
  authForm.reset();

  showToast("You have logged out.");
});

// 5. NAVIGATION
function showView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.add("hidden");
  });

  const selectedView = $(viewName + "View");
  if (selectedView) selectedView.classList.remove("hidden");

  document.querySelectorAll(".nav-btn[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  const titles = {
    dashboard: "Dashboard",
    subjects: "My Subjects",
    timetable: "Study Timetable",
    analytics: "Progress & Analytics"
  };

  $("pageTitle").textContent = titles[viewName] || "Dashboard";
}

document.querySelectorAll(".nav-btn[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.go);
  });
});

// 6. ADD, EDIT AND DELETE SUBJECTS
subjectForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("subjectName").value.trim();
  const marks = Number($("subjectMarks").value);
  const target = Number($("subjectTarget").value);
  const examDate = $("examDate").value;
  const priority = $("subjectPriority").value;
  const editingId = $("subjectId").value;

  if (!name || marks < 0 || marks > 100 ||
      target < 1 || target > 100 || !examDate) {
    showToast("Please enter valid subject details.");
    return;
  }

  const duplicate = subjects.some((subject) =>
    subject.name.toLowerCase() === name.toLowerCase() &&
    String(subject.id) !== editingId
  );

  if (duplicate) {
    showToast("This subject already exists.");
    return;
  }

  const subjectData = {
    id: editingId ? Number(editingId) : Date.now(),
    name,
    marks,
    target,
    examDate,
    priority
  };

  if (editingId) {
    subjects = subjects.map((subject) =>
      String(subject.id) === editingId ? subjectData : subject
    );
    showToast("Subject updated successfully!");
  } else {
    subjects.push(subjectData);
    showToast("Subject added successfully!");
  }

  saveData();
  subjectForm.reset();
  $("subjectId").value = "";
  $("subjectMarks").value = 60;
  $("subjectTarget").value = 85;
  $("subjectFormTitle").textContent = "Add a Subject";
  $("saveSubjectBtn").textContent = "Add Subject";
  $("cancelEditBtn").classList.add("hidden");

  renderAll();
});

function editSubject(id) {
  const subject = subjects.find((item) => item.id === id);
  if (!subject) return;

  $("subjectId").value = subject.id;
  $("subjectName").value = subject.name;
  $("subjectMarks").value = subject.marks;
  $("subjectTarget").value = subject.target;
  $("examDate").value = subject.examDate;
  $("subjectPriority").value = subject.priority;

  $("subjectFormTitle").textContent = "Edit Subject";
  $("saveSubjectBtn").textContent = "Save Changes";
  $("cancelEditBtn").classList.remove("hidden");

  showView("subjects");
  $("subjectName").focus();
}

function deleteSubject(id) {
  const subject = subjects.find((item) => item.id === id);
  if (!subject) return;

  if (!confirm("Delete " + subject.name + "?")) return;

  subjects = subjects.filter((item) => item.id !== id);
  saveData();
  renderAll();
  showToast("Subject deleted.");
}

$("cancelEditBtn").addEventListener("click", () => {
  subjectForm.reset();
  $("subjectId").value = "";
  $("subjectMarks").value = 60;
  $("subjectTarget").value = 85;
  $("subjectFormTitle").textContent = "Add a Subject";
  $("saveSubjectBtn").textContent = "Add Subject";
  $("cancelEditBtn").classList.add("hidden");
});

$("allSubjects").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);

  if (button.dataset.action === "edit") editSubject(id);
  if (button.dataset.action === "delete") deleteSubject(id);
});

// 7. DISPLAY SUBJECT CARDS
function renderDashboardSubjects() {
  const container = $("dashboardSubjects");

  if (subjects.length === 0) {
    container.innerHTML =
      '<div class="empty-state">No subjects yet. Add your first subject to begin!</div>';
    return;
  }

  container.innerHTML = subjects.slice(0, 5).map((subject) => {
    const marks = Number(subject.marks);

    return `
      <div class="subject-item">
        <div class="subject-top">
          <strong>${escapeHTML(subject.name)}</strong>
          <span>${marks}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${marks}%"></div>
        </div>
        <div class="subject-meta">
          <span>Target: ${subject.target}%</span>
          <span>${Math.max(0, getDaysUntil(subject.examDate))} days to exam</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderAllSubjects() {
  const container = $("allSubjects");

  if (subjects.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Your subject list is empty. Add a subject using the form.</div>';
    return;
  }

  container.innerHTML = subjects.map((subject) => `
    <div class="subject-item">
      <div class="subject-top">
        <strong>${escapeHTML(subject.name)}</strong>
        <span>${subject.marks}/100</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${subject.marks}%"></div>
      </div>
      <div class="subject-meta">
        <span>Target: ${subject.target}%</span>
        <span>${escapeHTML(subject.priority)} priority</span>
      </div>
      <div class="subject-meta">
        <span>Exam: ${formatExamDate(subject.examDate)}</span>
        <span>${Math.max(0, getDaysUntil(subject.examDate))} days left</span>
      </div>
      <div class="subject-actions">
        <button data-action="edit" data-id="${subject.id}">Edit</button>
        <button class="delete-btn" data-action="delete"
                data-id="${subject.id}">Delete</button>
      </div>
    </div>
  `).join("");
}

// 8. DASHBOARD STATISTICS
function renderStats() {
  $("totalSubjects").textContent = subjects.length;
  $("averageMarks").textContent = calculateAverage() + "%";
  $("totalSessions").textContent = totalSessions;
  $("targetProgress").textContent = calculateTargetProgress() + "%";
}

// 9. STUDY RECOMMENDATIONS
function getRankedSubjects() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return subjects.map((subject) => {
    const marks = Number(subject.marks);
    const target = Number(subject.target);
    const days = getDaysUntil(subject.examDate);

    // Lower marks create a greater need for study.
    const weakness = 100 - marks;

    // Closer exams increase urgency.
    const urgency = days < 0 ? 0 : 100 / (days + 1);

    // Higher priority gives the subject extra weight.
    const priority = getPriorityValue(subject.priority);

    // Simple rule-based score, not a trained AI model.
    const score =
      weakness * 0.45 +
      Math.min(100, urgency * 3) * 0.25 +
      Math.max(0, target - marks) * 0.15 +
      (priority / 3) * 100 * 0.15;

    return { ...subject, days, score };
  }).sort((a, b) => b.score - a.score);
}

function renderRecommendations() {
  const container = $("recommendations");

  if (subjects.length === 0) {
    container.innerHTML = `
      <div class="recommendation">
        <strong>👋 Let's get started</strong>
        Add your subjects and marks. The assistant can then suggest which
        subjects need more attention.
      </div>
    `;
    return;
  }

  const ranked = getRankedSubjects();
  const top = ranked[0];
  const belowTarget = subjects.filter((s) => s.marks < s.target).length;

  const messages = [
    {
      title: "🎯 Focus on " + escapeHTML(top.name),
      text: "This subject has the highest calculated study priority based on your marks, exam date and selected priority."
    },
    {
      title: "📈 Track your target",
      text: belowTarget === 0
        ? "Your current marks meet all your recorded targets. Keep revising and practising."
        : belowTarget + " subject(s) are currently below your target marks. Review these regularly."
    },
    {
      title: "⏰ Study consistently",
      text: "Try focused study sessions and short breaks. Update your marks as your performance changes."
    }
  ];

  container.innerHTML = messages.map((message) => `
    <div class="recommendation">
      <strong>${message.title}</strong>
      <span>${message.text}</span>
    </div>
  `).join("");
}

// 10. GENERATE A SEVEN-DAY TIMETABLE
function generateTimetable() {
  studyHours = Number($("studyHours").value);

  if (!Number.isFinite(studyHours) ||
      studyHours < 1 || studyHours > 12) {
    showToast("Choose between 1 and 12 study hours per day.");
    return;
  }

  localStorage.setItem("studySmartHours", studyHours);

  if (subjects.length === 0) {
    showToast("Add at least one subject before generating a timetable.");
    showView("subjects");
    return;
  }

  const ranked = getRankedSubjects();
  const dailyBlocks = Math.min(studyHours, 4);
  const blocks = [];

  // Allocate more blocks to higher-priority subjects.
  for (let i = 0; i < dailyBlocks; i++) {
    blocks.push(ranked[i % ranked.length]);
  }

  generatedSchedule = [];

  const today = new Date();

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayIndex);

    const dateLabel = date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short"
    });

    const tasks = blocks.map((subject, blockIndex) => {
      const startHour = 9 + blockIndex * 2;
      const endHour = startHour + 1;

      return {
        subject: subject.name,
        hours: 1,
        time: formatHour(startHour) + " - " + formatHour(endHour),
        task: Number(subject.marks) < 50
          ? "Review fundamentals and solve basic questions"
          : Number(subject.marks) < Number(subject.target)
            ? "Practise problems and revise weak topics"
            : "Revise important topics and practise questions"
      };
    });

    generatedSchedule.push({ dateLabel, tasks });
  }

  renderTimetable();
  renderTodayPlan();
  showToast("Your seven-day timetable is ready!");
}

function formatHour(hour) {
  const adjusted = hour % 12 || 12;
  return adjusted + (hour < 12 ? " AM" : " PM");
}

function renderTimetable() {
  const container = $("timetableOutput");

  if (generatedSchedule.length === 0) {
    container.innerHTML =
      '<div class="panel empty-state">Generate a timetable to see your weekly plan.</div>';
    return;
  }

  container.innerHTML = generatedSchedule.map((day) => `
    <article class="day-card">
      <h3>📅 ${escapeHTML(day.dateLabel)}</h3>
      ${day.tasks.map((task) => `
        <div class="day-task">
          <strong>${escapeHTML(task.time)} · ${escapeHTML(task.subject)}</strong>
          <p>${escapeHTML(task.task)}</p>
          <p>Duration: ${task.hours} hour</p>
        </div>
      `).join("")}
    </article>
  `).join("");
}

function renderTodayPlan() {
  const container = $("todayPlan");

  if (generatedSchedule.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Your timetable will appear here after you generate it.</div>';
    return;
  }

  container.innerHTML = generatedSchedule[0].tasks.map((task) => `
    <div class="plan-item">
      <div class="plan-time">${escapeHTML(task.time)}</div>
      <div>
        <strong>${escapeHTML(task.subject)}</strong>
        <p>${escapeHTML(task.task)}</p>
      </div>
    </div>
  `).join("");
}

$("timetableBtn").addEventListener("click", generateTimetable);
$("generateBtn").addEventListener("click", () => {
  showView("timetable");
  generateTimetable();
});

// 11. ANALYTICS CHART
function renderChart() {
  const container = $("marksChart");

  if (subjects.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Add subjects to compare marks with your targets.</div>';
    return;
  }

  container.innerHTML = subjects.map((subject) => `
    <div class="chart-row">
      <span title="${escapeHTML(subject.name)}">${escapeHTML(subject.name)}</span>
      <div class="chart-bars">
        <div class="chart-bar" style="width:${subject.marks}%"></div>
        <div class="chart-bar target" style="width:${subject.target}%"></div>
      </div>
    </div>
  `).join("") + `
    <div class="chart-legend">
      <span>🟣 Current marks</span>
      <span>🟢 Target marks</span>
    </div>
  `;
}

function renderInsights() {
  const container = $("analyticsInsights");

  if (subjects.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Add your subjects to see your study insights.</div>';
    return;
  }

  const ranked = getRankedSubjects();
  const average = calculateAverage();
  const top = ranked[0];

  container.innerHTML = `
    <div class="insight-item">
      <strong>📊 Average performance:</strong>
      Your average current marks are ${average}% across ${subjects.length} subject(s).
    </div>
    <div class="insight-item">
      <strong>🎯 Priority subject:</strong>
      ${escapeHTML(top.name)} is currently ranked highest for study attention
      by the rule-based planner.
    </div>
    <div class="insight-item">
      <strong>📚 Target review:</strong>
      ${subjects.filter((s) => s.marks < s.target).length}
      subject(s) are below their recorded target marks.
    </div>
    <div class="insight-item">
      <strong>⏱️ Focus sessions:</strong>
      You have completed ${totalSessions} timer session(s).
    </div>
  `;
}

// 12. STUDY TIMER
function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;

  $("timerDisplay").textContent =
    String(minutes).padStart(2, "0") + ":" +
    String(seconds).padStart(2, "0");
}

$("startTimer").addEventListener("click", () => {
  if (timerInterval !== null) return;

  if (timerSeconds <= 0) timerSeconds = 25 * 60;

  $("timerMessage").textContent = "Focus time. You've got this!";

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;

      totalSessions++;
      saveData();
      renderStats();

      $("timerMessage").textContent = "Session complete! Take a short break.";
      showToast("Great work! Your focus session is complete.");
    }
  }, 1000);
});

$("pauseTimer").addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  $("timerMessage").textContent = "Timer paused. Resume when ready.";
});

$("resetTimer").addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 25 * 60;
  updateTimerDisplay();
  $("timerMessage").textContent = "A focused 25-minute session.";
});

// 13. RENDER ALL SECTIONS
function renderAll() {
  renderStats();
  renderDashboardSubjects();
  renderAllSubjects();
  renderRecommendations();
  renderTodayPlan();
  renderTimetable();
  renderChart();
  renderInsights();
}

// 14. START THE APPLICATION
updateAuthMode();
updateTimerDisplay();

if (currentUser) {
  openApp();
} else {
  authScreen.classList.remove("hidden");
  app.classList.add("hidden");
}
