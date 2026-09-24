// Shared, honest progress tracking for the /uebungen dashboard. No accounts, no server —
// everything lives in this browser's localStorage. Every number the dashboard shows is derived
// from real recorded activity; nothing here is a placeholder or estimate presented as fact.
const STORE_KEY = "da_progress_v1";
const NAME_KEY = "da_display_name";
const GOAL_KEY = "da_weekly_goal";
const DEFAULT_WEEKLY_GOAL = 50;
const DAILY_ACTIVITY_RETENTION_DAYS = 60;
const RECENTS_MAX = 6;
// Routes worth remembering as "where I was": every page except the hubs and overviews,
// which are places you pass through (see src/lib/routes.js). The trainers are the only
// callers of remember(), so a page that never grades anything never lands here.
import { NOT_RESUMABLE, flattenPath } from "./routes.js";

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
        topics: data.topics || {},
        drills: data.drills || {},
        // Saved before the flat URLs: point old entries at the new address.
        recents: (data.recents || []).map((r) => (r && r.path ? { ...r, path: flattenPath(r.path) } : r)),
      };
    }
  } catch {}
  return { streak: 0, lastActiveDate: null, lastSkill: null, skills: {}, dailyActivity: {}, vocabMastered: [], topics: {}, drills: {}, recents: [] };
}

function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}

// Where the learner was when something got graded. recordAttempt/recordSession always run
// inside the tool's own page, so the route and its <title> ARE the record — no call site has
// to pass them, and a page that never grades anything never appears here. This is the only
// thing the "Weitermachen" card on /uebungen and / is built from; if it is empty, that card
// does not render at all rather than inventing a plausible last session.
function remember(data) {
  if (typeof location === "undefined") return;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (NOT_RESUMABLE.has(path)) return;
  // "Perfekt – Grammatik – DeutschAcademy" -> "Perfekt". The suffix is the same on every
  // page, so keeping it would make every card in the list read as the site's name.
  const title = (typeof document === "undefined" ? "" : document.title).split(/\s[–—-]\s/)[0].trim();
  const list = data.recents.filter((r) => r.path !== path);
  const prev = data.recents.find((r) => r.path === path);
  list.unshift({ path, title: title || path, n: (prev?.n || 0) + 1, at: todayStr() });
  data.recents = list.slice(0, RECENTS_MAX);
}

function touch(data, skill) {
  const t = todayStr();
  if (data.lastActiveDate !== t) {
    data.streak = data.lastActiveDate === daysAgoStr(1) ? data.streak + 1 : 1;
    data.lastActiveDate = t;
  }
  data.dailyActivity[t] = (data.dailyActivity[t] || 0) + 1;
  if (skill) data.lastSkill = skill;
  remember(data);
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
//
// `topic` is the slug of the thing being practised ("dativ", "artikel-trainer", …). The skill
// buckets above are too coarse for /dashboard, which shows a bar per topic and per CEFR level,
// so correct answers are additionally counted per topic here. It stays a count of real answers:
// nothing is ever written except from a graded attempt.
export function recordAttempt({ skill, correct, id, trackVocab, topic } = {}) {
  if (!skill) return;
  const data = load();
  touch(data, skill);
  const s = ensureSkill(data, skill);
  s.attempts += 1;
  if (correct) s.correct += 1;
  s.lastActiveDate = todayStr();
  if (topic) {
    if (!data.topics[topic]) data.topics[topic] = { done: 0, attempts: 0 };
    data.topics[topic].attempts += 1;
    if (correct) data.topics[topic].done += 1;
  }
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

/**
 * One item of the Sprechen drill, rated by the learner who said it out loud.
 *
 * Deliberately not recordAttempt(): a tap on "Konnte ich" is the learner's own word, not
 * something the site checked. Folding it into skills.grammatik.correct would inflate the
 * accuracy figure /dashboard presents as measured, and the first learner who noticed
 * would be right to stop believing the rest of it. Its own shelf, counted in its own
 * words — "gesprochen", not "richtig".
 *
 * It still touches the skill, because the day you spent drilling out loud is a day you
 * practised, and the streak should say so.
 */
export function recordDrill({ topic, sure } = {}) {
  const data = load();
  touch(data, "grammatik");
  const s = ensureSkill(data, "grammatik");
  s.lastActiveDate = todayStr();
  const key = topic || "_";
  if (!data.drills[key]) data.drills[key] = { said: 0, sure: 0 };
  data.drills[key].said += 1;
  if (sure) data.drills[key].sure += 1;
  save(data);
}

// { [topicSlug]: { said, sure } } — spoken drill items, kept apart from graded answers.
export function getDrillProgress() {
  return load().drills;
}

export function getProgress() {
  return load();
}

// { [topicSlug]: { done, attempts } } — what /dashboard draws its bars from.
export function getTopicProgress() {
  return load().topics;
}

// What the "Weitermachen" card needs, or null when this browser has never practised anything.
// `remote` is the seam for a logged-in learner: when there is an account to read from, the
// caller fetches that record and passes it here, and the newer of the two wins. Nothing in
// this module ever fabricates one — no login exists yet, so today it is always local.
export function getResume({ remote } = {}) {
  const data = load();
  let list = (data.recents || []).filter((r) => r && r.path);
  if (remote?.path) {
    list = [{ ...remote }, ...list.filter((r) => r.path !== remote.path)]
      .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  }
  if (!list.length) return null;
  return {
    last: list[0],
    recents: list.slice(1, 4),
    week: { count: getWeeklyCount(data), goal: getWeeklyGoal() },
    streak: data.streak,
  };
}

// Clears everything this module stores. Behind an explicit user action only
// ("Fortschritt zurücksetzen"); there is no undo because there is no server.
export function resetProgress() {
  try { localStorage.removeItem(STORE_KEY); } catch {}
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
