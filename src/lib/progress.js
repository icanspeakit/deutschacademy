// Shared, honest progress tracking for the /uebungen dashboard. No accounts, no server —
// everything lives in this browser's localStorage. Every number the dashboard shows is derived
// from real recorded activity; nothing here is a placeholder or estimate presented as fact.
const STORE_KEY = "da_progress_v1";
const NAME_KEY = "da_display_name";
const GOAL_KEY = "da_weekly_goal";
const DEFAULT_WEEKLY_GOAL = 50;
const DAILY_ACTIVITY_RETENTION_DAYS = 60;

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        streak: data.streak || 0,
        lastActiveDate: data.lastActiveDate || null,
        lastSkill: data.lastSkill || null,
        skills: data.skills || {},
        dailyActivity: data.dailyActivity || {},
        vocabMastered: data.vocabMastered || [],
      };
    }
  } catch {}
  return { streak: 0, lastActiveDate: null, lastSkill: null, skills: {}, dailyActivity: {}, vocabMastered: [] };
}

function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}

function touch(data, skill) {
  const t = todayStr();
  if (data.lastActiveDate !== t) {
    data.streak = data.lastActiveDate === daysAgoStr(1) ? data.streak + 1 : 1;
    data.lastActiveDate = t;
  }
  data.dailyActivity[t] = (data.dailyActivity[t] || 0) + 1;
  if (skill) data.lastSkill = skill;
  const cutoff = daysAgoStr(DAILY_ACTIVITY_RETENTION_DAYS);
  for (const key of Object.keys(data.dailyActivity)) {
    if (key < cutoff) delete data.dailyActivity[key];
  }
}

function ensureSkill(data, skill) {
  if (!data.skills[skill]) data.skills[skill] = { attempts: 0, correct: 0, sessions: 0, lastActiveDate: null };
  return data.skills[skill];
}

// Call once per graded answer (a quiz question checked, a flashcard self-assessed, …).
// `trackVocab: true` + a stable `id` also counts this toward the "Wörter gelernt" stat the
// first time that id is answered correctly — pass it only from genuinely vocabulary-teaching
// tools (Wortschatz, Artikel-Trainer), not grammar drills like Akkusativ.
export function recordAttempt({ skill, correct, id, trackVocab } = {}) {
  if (!skill) return;
  const data = load();
  touch(data, skill);
  const s = ensureSkill(data, skill);
  s.attempts += 1;
  if (correct) s.correct += 1;
  s.lastActiveDate = todayStr();
  if (trackVocab && correct && id) {
    const key = `${skill}:${id}`;
    if (!data.vocabMastered.includes(key)) data.vocabMastered.push(key);
  }
  save(data);
}

// Call once per session for tools with no right/wrong answer (Aussprache, Sprechen, flipping
// through flashcards) — counts as real engagement without pretending there's a "correct" score.
export function recordSession(skill) {
  if (!skill) return;
  const data = load();
  touch(data, skill);
  const s = ensureSkill(data, skill);
  s.sessions += 1;
  s.lastActiveDate = todayStr();
  save(data);
}

export function getProgress() {
  return load();
}

export function getWeeklyCount(data = load()) {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += data.dailyActivity[daysAgoStr(i)] || 0;
  return sum;
}

export function activeToday(skill, data = load()) {
  return data.skills[skill]?.lastActiveDate === todayStr();
}

export function getWeeklyGoal() {
  try {
    const v = parseInt(localStorage.getItem(GOAL_KEY), 10);
    if (v > 0) return v;
  } catch {}
  return DEFAULT_WEEKLY_GOAL;
}

export function setWeeklyGoal(n) {
  try { localStorage.setItem(GOAL_KEY, String(Math.max(10, Math.round(n)))); } catch {}
}

export function getDisplayName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}

export function setDisplayName(name) {
  try { localStorage.setItem(NAME_KEY, name.trim().slice(0, 40)); } catch {}
}
