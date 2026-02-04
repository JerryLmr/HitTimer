const STORAGE_KEY = "hittimer.templates";
const ACTIVE_KEY = "hittimer.activeTemplateId";
const MUTED_KEY = "hittimer.muted";
const HISTORY_KEY = "hittimer.history";

const DEFAULT_TEMPLATE = {
  id: "default",
  name: "默认训练",
  workSec: 45,
  restSec: 15,
  roundRestSec: 0,
  rounds: 2,
  exercises: ["动作1", "动作2", "动作3", "动作4", "动作5"],
};

const state = {
  templates: [],
  activeId: null,
  muted: false,
  history: { sessions: [] },
  sequence: [],
  seqIndex: 0,
  running: false,
  paused: false,
  remainingSec: 0,
  endTime: 0,
  completedRecorded: false,
  checkinMode: "month",
};

const els = {};

function $(id) { return document.getElementById(id); }

function loadTemplates() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [DEFAULT_TEMPLATE];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [DEFAULT_TEMPLATE];
  } catch {
    return [DEFAULT_TEMPLATE];
  }
}

function saveTemplates() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.templates));
}

function getActiveTemplate() {
  const tpl = state.templates.find(t => t.id === state.activeId) || state.templates[0];
  return normalizeTemplate(tpl);
}

function saveActiveId() {
  localStorage.setItem(ACTIVE_KEY, state.activeId || "");
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function normalizeTemplate(tpl) {
  if (!tpl) return DEFAULT_TEMPLATE;
  tpl.workSec = Number(tpl.workSec) || 0;
  tpl.restSec = Number(tpl.restSec) || 0;
  tpl.roundRestSec = Number(tpl.roundRestSec) || 0;
  tpl.rounds = Math.max(1, Number(tpl.rounds) || 1);
  if (!Array.isArray(tpl.exercises)) tpl.exercises = [];
  if (tpl.exercises.length === 0) tpl.exercises = ["动作1"];
  return tpl;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return { sessions: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.sessions)) return parsed;
    if (parsed && typeof parsed === "object") {
      const sessions = [];
      Object.entries(parsed).forEach(([date, count]) => {
        const times = Number(count) || 0;
        for (let i = 0; i < times; i++) {
          sessions.push({ date, durationSec: 0 });
        }
      });
      return { sessions };
    }
    return { sessions: [] };
  } catch {
    return { sessions: [] };
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
}

function parseTime(input) {
  const match = String(input).trim().match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const m = Number(match[1]);
  const s = Number(match[2]);
  if (Number.isNaN(m) || Number.isNaN(s) || s > 59) return null;
  return m * 60 + s;
}

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("is-active"));
  $(id).classList.add("is-active");
  if (id !== "view-run") {
    document.body.classList.remove("run-work", "run-rest", "run-roundrest", "run-done");
  }
}

function recordCompletion(durationSec) {
  if (state.completedRecorded) return;
  const key = todayKey();
  state.history.sessions.push({ date: key, durationSec });
  saveHistory();
  state.completedRecorded = true;
  renderCalendar();
  renderCheckinView();
}

function formatDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function getMonthSessions(year, monthIndex) {
  const month = String(monthIndex + 1).padStart(2, "0");
  return state.history.sessions.filter(s => s.date.startsWith(`${year}-${month}-`));
}

function getYearSessions(year) {
  return state.history.sessions.filter(s => s.date.startsWith(`${year}-`));
}

function weekdayLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return labels[date.getDay()] || "";
}

function buildMonthGrid(year, monthIndex, gridEl, weekdaysEl, countEl) {
  gridEl.innerHTML = "";
  weekdaysEl.innerHTML = "";
  const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  weekdays.forEach(w => {
    const label = document.createElement("div");
    label.textContent = w;
    weekdaysEl.appendChild(label);
  });

  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startDay = (first.getDay() + 6) % 7;
  const startDate = new Date(year, monthIndex, 1 - startDay);

  const sessions = getMonthSessions(year, monthIndex);
  const dayCounts = {};
  sessions.forEach(s => { dayCounts[s.date] = (dayCounts[s.date] || 0) + 1; });

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

  let monthCount = 0;
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (cellDate.getMonth() === monthIndex) {
      const key = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}-${String(cellDate.getDate()).padStart(2, "0")}`;
      const count = dayCounts[key] || 0;
      if (count > 0) {
        cell.classList.add("is-done");
        monthCount += count;
      }
      if (isCurrentMonth && cellDate.getDate() === today.getDate()) {
        cell.classList.add("is-today");
      }
    }
    gridEl.appendChild(cell);
  }

  if (countEl) countEl.textContent = String(monthCount);
}

function buildYearGrid(year, gridEl, monthsEl) {
  gridEl.innerHTML = "";
  monthsEl.innerHTML = "";

  const start = new Date(year, 0, 1);
  const startDay = (start.getDay() + 6) % 7;
  const startDate = new Date(year, 0, 1 - startDay);
  const endDate = new Date(year, 11, 31);
  const totalDays = Math.floor((endDate - startDate) / 86400000) + 1;
  const totalCells = Math.ceil(totalDays / 7) * 7;
  const totalWeeks = totalCells / 7;

  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const monthLabels = Array(totalWeeks).fill("");
  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1);
    const diffDays = Math.floor((first - startDate) / 86400000);
    const weekIndex = Math.floor(diffDays / 7);
    if (weekIndex >= 0 && weekIndex < monthLabels.length && !monthLabels[weekIndex]) {
      monthLabels[weekIndex] = monthNames[m];
    }
  }
  monthLabels.forEach(label => {
    const div = document.createElement("div");
    div.className = "year-month";
    div.textContent = label;
    monthsEl.appendChild(div);
  });

  const sessions = getYearSessions(year);
  const dayCounts = {};
  sessions.forEach(s => { dayCounts[s.date] = (dayCounts[s.date] || 0) + 1; });

  const today = new Date();
  const isCurrentYear = today.getFullYear() === year;

  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (cellDate.getFullYear() === year) {
      const key = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}-${String(cellDate.getDate()).padStart(2, "0")}`;
      const count = dayCounts[key] || 0;
      if (count > 0) cell.classList.add("is-done");
      if (isCurrentYear && cellDate.getMonth() === today.getMonth() && cellDate.getDate() === today.getDate()) {
        cell.classList.add("is-today");
      }
    }
    gridEl.appendChild(cell);
  }
}

function renderCalendar() {
  const grid = $("calendarGrid");
  const weekdays = $("finishWeekdays");
  const now = new Date();
  if (!grid || !weekdays) return;
  buildMonthGrid(now.getFullYear(), now.getMonth(), grid, weekdays, $("monthCount"));
}

function renderCheckinView() {
  const year = new Date().getFullYear();
  $("checkinYearLabel").textContent = String(year);
  const monthSelect = $("checkinMonthSelect");
  if (monthSelect.options.length === 0) {
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = `${m}月`;
      monthSelect.appendChild(opt);
    }
    monthSelect.value = String(new Date().getMonth() + 1);
  }

  const mode = state.checkinMode;
  $("modeMonth").classList.toggle("is-active", mode === "month");
  $("modeYear").classList.toggle("is-active", mode === "year");
  monthSelect.disabled = mode !== "month";

  const grid = $("checkinCalendar");
  const weekdays = $("checkinWeekdays");
  const monthWrap = $("checkinMonthWrap");
  const yearWrap = $("checkinYearWrap");
  const title = $("checkinTitle");
  const logList = $("logList");
  const logTotal = $("logTotal");
  logList.innerHTML = "";

  let sessions = [];
  if (mode === "month") {
    const monthIndex = Number(monthSelect.value) - 1;
    sessions = getMonthSessions(year, monthIndex);
    title.textContent = `本月完成次数：${sessions.length}`;
    buildMonthGrid(year, monthIndex, grid, weekdays, null);
    monthWrap.classList.remove("is-hidden");
    yearWrap.classList.remove("is-active");
    monthWrap.style.display = "grid";
    yearWrap.style.display = "none";
  } else {
    sessions = getYearSessions(year);
    title.textContent = `本年完成次数：${sessions.length}`;
    const yearGrid = $("checkinYearCalendar");
    const yearMonths = $("checkinYearMonths");
    buildYearGrid(year, yearGrid, yearMonths);
    monthWrap.style.display = "none";
    yearWrap.classList.add("is-active");
    yearWrap.style.display = "block";
  }

  let totalSec = 0;
  sessions.forEach(s => { totalSec += Number(s.durationSec) || 0; });
  logTotal.textContent = `总时间：${formatDuration(totalSec)}`;

  sessions
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach(s => {
      const row = document.createElement("div");
      row.className = "log-item";
      const left = document.createElement("div");
      left.textContent = `${s.date} ${weekdayLabel(s.date)}`;
      const right = document.createElement("div");
      right.textContent = formatDuration(s.durationSec || 0);
      row.append(left, right);
      logList.appendChild(row);
    });
}

function openModal({ title, value, hint, onConfirm }) {
  els.modalTitle.textContent = title;
  els.modalInput.value = value;
  els.modalHint.textContent = hint || "";
  els.modal.classList.add("is-active");
  els.modalInput.focus();

  const confirmHandler = () => {
    const val = els.modalInput.value.trim();
    onConfirm(val);
  };
  const clean = () => {
    els.modal.classList.remove("is-active");
    els.modalOk.removeEventListener("click", confirmHandler);
    els.modalInput.removeEventListener("keydown", enterHandler);
  };
  const enterHandler = e => {
    if (e.key === "Enter") {
      confirmHandler();
      clean();
    }
  };

  els.modalOk.addEventListener("click", () => { confirmHandler(); clean(); }, { once: true });
  els.modalCancel.addEventListener("click", () => clean(), { once: true });
  els.modalInput.addEventListener("keydown", enterHandler);
}

function updateHome() {
  const tpl = getActiveTemplate();
  els.valWork.textContent = formatTime(tpl.workSec);
  els.valRest.textContent = formatTime(tpl.restSec);
  els.valRoundRest.textContent = formatTime(tpl.roundRestSec);
  els.valExercises.textContent = String(tpl.exercises.length);
  els.valRounds.textContent = `${tpl.rounds}X`;
  if (els.homeTotalTime) {
    els.homeTotalTime.textContent = formatTime(tpl.workSec);
  }
}

function renderExercises() {
  const tpl = getActiveTemplate();
  els.exerciseList.innerHTML = "";
  tpl.exercises.forEach((name, idx) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.draggable = true;
    row.dataset.index = idx;

    const index = document.createElement("div");
    index.className = "list-index";
    index.textContent = idx + 1;

    const input = document.createElement("input");
    input.value = name;
    const updateName = () => {
      tpl.exercises[idx] = input.value.trim() || `动作${idx + 1}`;
      saveTemplates();
      updateHome();
    };
    input.addEventListener("input", updateName);
    input.addEventListener("blur", updateName);

    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.textContent = "≡";

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "删除";
    del.addEventListener("click", () => {
      tpl.exercises.splice(idx, 1);
      if (tpl.exercises.length === 0) tpl.exercises.push("动作1");
      saveTemplates();
      renderExercises();
      updateHome();
    });

    row.append(index, input, handle, del);
    els.exerciseList.appendChild(row);
  });

  attachDrag();
  els.exerciseCount.textContent = tpl.exercises.length;
}

function syncExercisesFromInputs() {
  const tpl = getActiveTemplate();
  const inputs = els.exerciseList ? [...els.exerciseList.querySelectorAll("input")] : [];
  if (inputs.length === 0) return;
  const names = inputs.map((el, i) => el.value.trim() || `动作${i + 1}`);
  tpl.exercises = names.length ? names : ["动作1"];
  saveTemplates();
  renderExercises();
  updateHome();
}

function attachDrag() {
  let dragging = null;
  els.exerciseList.querySelectorAll(".list-item").forEach(item => {
    item.addEventListener("dragstart", e => {
      dragging = item;
      e.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      const target = item;
      if (dragging && target !== dragging) {
        const list = els.exerciseList;
        const draggingIndex = [...list.children].indexOf(dragging);
        const targetIndex = [...list.children].indexOf(target);
        if (draggingIndex < targetIndex) {
          list.insertBefore(dragging, target.nextSibling);
        } else {
          list.insertBefore(dragging, target);
        }
      }
    });
    item.addEventListener("drop", () => {
      persistDrag();
      dragging = null;
    });
  });
}

function persistDrag() {
  const tpl = getActiveTemplate();
  const names = [...els.exerciseList.children].map(row => row.querySelector("input").value.trim() || "动作");
  tpl.exercises = names;
  saveTemplates();
  renderExercises();
  updateHome();
}

function renderTemplates() {
  els.templateList.innerHTML = "";
  state.templates.forEach(tpl => {
    const row = document.createElement("div");
    row.className = "list-item";

    const input = document.createElement("input");
    input.value = tpl.name;
    input.addEventListener("change", () => {
      tpl.name = input.value.trim() || "未命名";
      saveTemplates();
    });

    const loadBtn = document.createElement("button");
    loadBtn.className = "pill-btn";
    loadBtn.textContent = tpl.id === state.activeId ? "当前" : "加载";
    loadBtn.addEventListener("click", () => {
      state.activeId = tpl.id;
      saveActiveId();
      updateHome();
      renderTemplates();
    });

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "删除";
    del.addEventListener("click", () => {
      if (state.templates.length === 1) return;
      state.templates = state.templates.filter(x => x.id !== tpl.id);
      if (!state.templates.find(x => x.id === state.activeId)) {
        state.activeId = state.templates[0].id;
      }
      saveTemplates();
      saveActiveId();
      renderTemplates();
      updateHome();
    });

    row.append(input, loadBtn, del);
    els.templateList.appendChild(row);
  });

  els.templateCount.textContent = state.templates.length;
}

function buildSequence(tpl) {
  const seq = [];
  for (let r = 0; r < tpl.rounds; r++) {
    for (let i = 0; i < tpl.exercises.length; i++) {
      seq.push({ type: "work", round: r + 1, exercise: i + 1, duration: tpl.workSec });
      const isLastExercise = i === tpl.exercises.length - 1;
      if (!isLastExercise) {
        seq.push({ type: "rest", round: r + 1, exercise: i + 2, duration: tpl.restSec });
      } else if (r < tpl.rounds - 1 && tpl.roundRestSec > 0) {
        seq.push({ type: "roundRest", round: r + 1, exercise: 1, duration: tpl.roundRestSec });
      }
    }
  }
  return seq;
}

function stageLabel(stage) {
  if (stage.type === "work") return "工作";
  if (stage.type === "rest") return "休息";
  if (stage.type === "roundRest") return "回合休息";
  return "完成";
}

function updateRunUI(stage, remaining) {
  document.body.classList.remove("run-work", "run-rest", "run-roundrest", "run-done");
  if (!stage) {
    document.body.classList.add("run-done");
    return;
  }
  if (stage.type === "work") document.body.classList.add("run-work");
  if (stage.type === "rest") document.body.classList.add("run-rest");
  if (stage.type === "roundRest") document.body.classList.add("run-roundrest");

  els.runStageTitle.textContent = stageLabel(stage);
  els.ringLabel.textContent = stageLabel(stage);
  els.ringTime.textContent = formatTime(remaining);
  if (els.ringClock) els.ringClock.textContent = "";
  els.runRoundInfo.textContent = `第${stage.round}轮 · 第${stage.exercise}个动作`;

  const tpl = getActiveTemplate();
  const totalExercises = Math.max(1, tpl.exercises.length || 0);
  const totalRounds = Math.max(1, Number(tpl.rounds) || 1);
  els.exerciseDots.innerHTML = "";
  for (let i = 0; i < totalExercises; i++) {
    const dot = document.createElement("div");
    dot.className = "dot" + (i < stage.exercise ? " is-active" : "");
    els.exerciseDots.appendChild(dot);
  }
  els.roundDots.innerHTML = "";
  for (let i = 0; i < totalRounds; i++) {
    const dot = document.createElement("div");
    dot.className = "dot" + (i < stage.round ? " is-active" : "");
    els.roundDots.appendChild(dot);
  }

  const ring = els.ringProgress;
  const circumference = 2 * Math.PI * 92;
  ring.style.strokeDasharray = `${circumference}`;
  const ratio = stage.duration ? remaining / stage.duration : 0;
  ring.style.strokeDashoffset = `${circumference * (1 - ratio)}`;

  if (stage.type === "rest") {
    const idx = Math.min(stage.exercise - 1, tpl.exercises.length - 1);
    const nextName = tpl.exercises[idx] || "动作";
    els.runNext.textContent = `接下来: ${nextName}`;
  } else if (stage.type === "roundRest") {
    const nextName = tpl.exercises[0] || "动作";
    els.runNext.textContent = `接下来: ${nextName}`;
  } else {
    const idx = Math.min(stage.exercise - 1, tpl.exercises.length - 1);
    const name = tpl.exercises[idx] || "动作";
    els.runNext.textContent = name;
  }
}

function playBeep() {
  if (state.muted) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = 0.12;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
  osc.onended = () => ctx.close();
}

function setSoundIcon() {
  $("btnSound").textContent = state.muted ? "🔇" : "🔈";
}

function setPauseIcon() {
  const btn = $("btnPause");
  if (state.paused) {
    btn.innerHTML = '<span class="play-icon" style="border-left-color:#222;margin:0 auto"></span>';
  } else {
    btn.innerHTML = '<span class="pause-icon"></span>';
  }
}

function startRun() {
  syncExercisesFromInputs();
  const tpl = getActiveTemplate();
  if (!tpl.exercises || tpl.exercises.length === 0) {
    tpl.exercises = ["动作1"];
    saveTemplates();
  }
  state.sequence = buildSequence(tpl);
  state.seqIndex = 0;
  state.running = true;
  state.paused = false;
  state.completedRecorded = false;
  const stage = state.sequence[0];
  state.remainingSec = stage.duration;
  state.endTime = Date.now() + state.remainingSec * 1000;
  showView("view-run");
  $("runFinish").classList.remove("is-active");
  setPauseIcon();
  tick(true);
  playBeep();
}

function tick(force) {
  if (!state.running || state.paused) return;
  const stage = state.sequence[state.seqIndex];
  if (!stage) {
    endRun();
    return;
  }
  const remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
  state.remainingSec = remaining;
  updateRunUI(stage, remaining);
  if (remaining === 0 || force) {
    if (remaining === 0) {
      nextStage();
      return;
    }
  }
}

function nextStage() {
  state.seqIndex += 1;
  const stage = state.sequence[state.seqIndex];
  if (!stage) {
    endRun();
    return;
  }
  state.remainingSec = stage.duration;
  state.endTime = Date.now() + stage.duration * 1000;
  playBeep();
  updateRunUI(stage, state.remainingSec);
}

function prevStage() {
  state.seqIndex = Math.max(0, state.seqIndex - 1);
  const stage = state.sequence[state.seqIndex];
  state.remainingSec = stage.duration;
  state.endTime = Date.now() + stage.duration * 1000;
  updateRunUI(stage, state.remainingSec);
}

function endRun() {
  state.running = false;
  state.paused = false;
  setPauseIcon();
  document.body.classList.add("run-done");
  els.runStageTitle.textContent = "完成";
  els.ringLabel.textContent = "完成";
  els.ringTime.textContent = "00:00";
  els.runRoundInfo.textContent = "训练结束";
  els.runNext.textContent = "";
  $("runFinish").classList.add("is-active");
  const totalSec = state.sequence.reduce((sum, s) => sum + (s.duration || 0), 0);
  recordCompletion(totalSec);
}

function stopRunToHome() {
  state.running = false;
  state.paused = false;
  state.sequence = [];
  state.seqIndex = 0;
  state.remainingSec = 0;
  state.endTime = 0;
  state.completedRecorded = false;
  $("runFinish").classList.remove("is-active");
  showView("view-home");
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  setPauseIcon();
  if (!state.paused) {
    state.endTime = Date.now() + state.remainingSec * 1000;
  }
}

function init() {
  els.valWork = $("valWork");
  els.valRest = $("valRest");
  els.valRoundRest = $("valRoundRest");
  els.valExercises = $("valExercises");
  els.valRounds = $("valRounds");
  els.homeTotalTime = $("homeTotalTime");
  els.exerciseList = $("exerciseList");
  els.exerciseCount = $("exerciseCount");
  els.templateList = $("templateList");
  els.templateCount = $("templateCount");
  els.runStageTitle = $("runStageTitle");
  els.runRoundInfo = $("runRoundInfo");
  els.ringLabel = $("ringLabel");
  els.ringTime = $("ringTime");
  els.ringClock = $("ringClock");
  els.runNext = $("runNext");
  els.exerciseDots = $("exerciseDots");
  els.roundDots = $("roundDots");
  els.ringProgress = $("ringProgress");
  els.modal = $("modal");
  els.modalTitle = $("modalTitle");
  els.modalInput = $("modalInput");
  els.modalHint = $("modalHint");
  els.modalOk = $("modalOk");
  els.modalCancel = $("modalCancel");

  state.templates = loadTemplates();
  state.activeId = localStorage.getItem(ACTIVE_KEY) || state.templates[0].id;
  state.muted = localStorage.getItem(MUTED_KEY) === "true";
  state.history = loadHistory();
  state.completedRecorded = false;
  state.checkinMode = "month";

  updateHome();
  renderExercises();
  renderTemplates();
  setSoundIcon();
  renderCalendar();
  renderCheckinView();

  $("rowWork").addEventListener("click", () => {
    const tpl = getActiveTemplate();
    openModal({
      title: "工作时间",
      value: formatTime(tpl.workSec),
      hint: "格式 mm:ss",
      onConfirm: val => {
        const sec = parseTime(val);
        if (sec == null) return;
        tpl.workSec = sec;
        saveTemplates();
        updateHome();
      },
    });
  });

  $("rowRest").addEventListener("click", () => {
    const tpl = getActiveTemplate();
    openModal({
      title: "休息时间",
      value: formatTime(tpl.restSec),
      hint: "格式 mm:ss",
      onConfirm: val => {
        const sec = parseTime(val);
        if (sec == null) return;
        tpl.restSec = sec;
        saveTemplates();
        updateHome();
      },
    });
  });

  $("rowRoundRest").addEventListener("click", () => {
    const tpl = getActiveTemplate();
    openModal({
      title: "回合重置",
      value: formatTime(tpl.roundRestSec),
      hint: "格式 mm:ss",
      onConfirm: val => {
        const sec = parseTime(val);
        if (sec == null) return;
        tpl.roundRestSec = sec;
        saveTemplates();
        updateHome();
      },
    });
  });

  $("rowRounds").addEventListener("click", () => {
    const tpl = getActiveTemplate();
    openModal({
      title: "回合数",
      value: String(tpl.rounds),
      hint: "输入数字",
      onConfirm: val => {
        const num = Number(val);
        if (!Number.isInteger(num) || num <= 0) return;
        tpl.rounds = num;
        saveTemplates();
        updateHome();
      },
    });
  });

  $("rowExercises").addEventListener("click", () => {
    showView("view-list");
  });

  $("rowLoad").addEventListener("click", () => {
    renderTemplates();
    showView("view-templates");
  });
  $("rowCheckins").addEventListener("click", () => {
    renderCheckinView();
    showView("view-checkins");
  });

  $("btnListDone").addEventListener("click", () => {
    syncExercisesFromInputs();
    showView("view-home");
  });
  $("btnTemplatesDone").addEventListener("click", () => showView("view-home"));
  $("btnCheckinsDone").addEventListener("click", () => showView("view-home"));

  $("btnAddExercise").addEventListener("click", () => {
    const tpl = getActiveTemplate();
    tpl.exercises.push(`动作${tpl.exercises.length + 1}`);
    saveTemplates();
    renderExercises();
    updateHome();
  });

  $("btnSaveTemplate").addEventListener("click", () => {
    openModal({
      title: "模板名称",
      value: `模板 ${state.templates.length + 1}`,
      hint: "保存当前配置",
      onConfirm: val => {
        const tpl = getActiveTemplate();
        const newTpl = { ...tpl, id: `tpl-${Date.now()}`, name: val || "未命名" };
        state.templates.push(newTpl);
        saveTemplates();
        renderTemplates();
      },
    });
  });

  $("btnStart").addEventListener("click", () => {
    startRun();
  });

  $("btnPause").addEventListener("click", () => {
    togglePause();
  });

  $("btnNext").addEventListener("click", () => {
    if (!state.running) return;
    nextStage();
  });

  $("btnPrev").addEventListener("click", () => {
    if (!state.running) return;
    prevStage();
  });

  $("btnSound").addEventListener("click", () => {
    state.muted = !state.muted;
    localStorage.setItem(MUTED_KEY, String(state.muted));
    setSoundIcon();
  });

  $("btnFinishHome").addEventListener("click", () => {
    stopRunToHome();
  });
  $("modeMonth").addEventListener("click", () => {
    state.checkinMode = "month";
    renderCheckinView();
  });
  $("modeYear").addEventListener("click", () => {
    state.checkinMode = "year";
    renderCheckinView();
  });
  $("checkinMonthSelect").addEventListener("change", () => {
    renderCheckinView();
  });

  setInterval(() => tick(false), 250);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

document.addEventListener("DOMContentLoaded", init);

