/* Dummy progress, for looking at the filled-in state of a page.
 *
 * Every number on /dashboard, /fortschritt and the resume cards is derived from real
 * recorded activity (see the note at the top of progress.js), which is the right rule and
 * also means a fresh browser shows 0 % everywhere. That is the honest empty state, but it
 * is not the state most of the layout was designed for — a ring at 0 %, five bars at zero
 * and no "Weitermachen" card tell you nothing about whether the page works when it is full.
 *
 * So this writes a plausible record straight into the store progress.js reads. It is a
 * development tool: nothing imports it outside an `import.meta.env.DEV` branch, and the
 * button that calls it is not rendered in a production build.
 *
 * It deliberately does NOT invent topic slugs. The caller passes the real items the page is
 * already rendering ({ id: { tasks } }), so every bar that fills is a bar that exists, and a
 * renamed topic shows up as a topic that stays empty rather than as a phantom row.
 */

const STORE_KEY = "da_progress_v1";
const NAME_KEY = "da_display_name";

const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

/* Deterministic, so two runs of the seed produce the same screenshot and a visual diff
   means a real change rather than a different roll of the dice. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

/**
 * @param {Record<string, {tasks?: number}>} items  the page's real items, keyed by slug
 * @param {object} [opts]
 * @param {number} [opts.streak]   consecutive days to claim
 * @param {number} [opts.days]     how far back daily activity goes
 * @param {number} [opts.seed]     changes which topics land where
 */
export function seedProgress(items = {}, { streak = 6, days = 24, seed = 7 } = {}) {
  const rand = rng(seed);
  const today = todayStr();

  // A spread of states, because the interesting bugs are at the ends: a topic that is
  // finished, one barely started, and several untouched so the empty style still shows.
  const topics = {};
  const ids = Object.keys(items);
  ids.forEach((id, i) => {
    const tasks = Number(items[id]?.tasks) || 0;
    if (!tasks) return;
    const phase = i % 5;
    // 0: untouched, 1: just started, 2: mid, 3: nearly there, 4: done
    const frac = phase === 0 ? 0 : phase === 1 ? 0.1 + rand() * 0.15
      : phase === 2 ? 0.4 + rand() * 0.2
      : phase === 3 ? 0.75 + rand() * 0.15
      : 1;
    const done = Math.min(tasks, Math.round(tasks * frac));
    if (!done) return;
    // More attempts than correct answers: a record where they are equal reads as a learner
    // who has never been wrong, which is the one thing no real record looks like.
    topics[id] = { done, attempts: done + Math.round(done * (0.15 + rand() * 0.3)) };
  });

  const totalDone = Object.values(topics).reduce((a, t) => a + t.done, 0);
  const totalTries = Object.values(topics).reduce((a, t) => a + t.attempts, 0);

  // Weighted towards grammar, which is where the seeded topics are.
  const split = { grammatik: 0.55, wortschatz: 0.2, hoeren: 0.1, lesen: 0.08, kultur: 0.07 };
  const skills = {};
  for (const [skill, w] of Object.entries(split)) {
    const attempts = Math.round(totalTries * w);
    if (!attempts) continue;
    skills[skill] = {
      attempts,
      correct: Math.round(totalDone * w),
      sessions: 1 + Math.round(rand() * 4),
      // Not every skill was touched today — a record where all five share one date looks
      // generated, and "heute geübt" badges would all light at once.
      lastActiveDate: rand() < 0.5 ? today : daysAgoStr(1 + Math.floor(rand() * 3)),
    };
  }
  if (skills.grammatik) skills.grammatik.lastActiveDate = today;

  // The streak has to be unbroken back from today or progress.js's own touch() will reset
  // it to 1 on the next real answer; the days before it are sparse on purpose.
  const dailyActivity = {};
  for (let i = 0; i < days; i++) {
    const inStreak = i < streak;
    if (!inStreak && rand() < 0.45) continue;
    dailyActivity[daysAgoStr(i)] = inStreak ? 6 + Math.round(rand() * 14) : 1 + Math.round(rand() * 6);
  }

  const vocabMastered = [];
  for (let i = 0; i < 48; i++) vocabMastered.push(`wortschatz:seed-${i}`);

  const data = {
    streak,
    lastActiveDate: today,
    lastSkill: "grammatik",
    skills,
    dailyActivity,
    vocabMastered,
    topics,
    drills: { dativ: { said: 12, sure: 9 }, "artikel-trainer": { said: 20, sure: 14 } },
    // What the "Weitermachen" card is built from. Real routes, so the card links somewhere.
    recents: [
      { path: "/uebungen/grammatik/dativ", title: "Dativ", n: 3, at: today },
      { path: "/uebungen/wortschatz/a1-01", title: "Person & Vorstellung", n: 2, at: daysAgoStr(1) },
      { path: "/uebungen/artikel-trainer", title: "Artikel-Trainer", n: 5, at: daysAgoStr(2) },
    ],
  };

  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  if (!localStorage.getItem(NAME_KEY)) localStorage.setItem(NAME_KEY, "Testnutzer");
  return data;
}

/* Everything on the page, answered.
 *
 * seedProgress() above spreads the items across five phases on purpose, because the
 * interesting bugs are at the ends and an all-full page hides the empty styles. This is
 * the other end of that: every bar on the page at 100 %, for the questions the spread
 * never answers — what the course looks like once it is finished, whether a section that
 * is complete says so, whether "Stufe starten" becomes something else when there is
 * nothing left to start.
 *
 * Same store, same shape, same rule about not inventing slugs: the caller passes the
 * items the page is already rendering.
 *
 * @param {Record<string, {tasks?: number}>} items  the page's real items, keyed by slug
 * @param {object} [opts]
 * @param {number} [opts.accuracy]  share of attempts that were right, 0..1. Below 1 the
 *   record carries the wrong answers that a real 100 % is reached through.
 * @param {number} [opts.streak]
 * @param {number} [opts.days]
 * @param {number} [opts.seed]
 */
export function fillProgress(items = {}, { accuracy = 0.8, streak = 12, days = 30, seed = 11 } = {}) {
  const rand = rng(seed);
  const today = todayStr();
  const acc = Math.min(1, Math.max(0.05, accuracy));

  const topics = {};
  for (const id of Object.keys(items)) {
    const tasks = Number(items[id]?.tasks) || 0;
    if (!tasks) continue;
    // `done` is the count of correct answers, so a full bar needs `tasks` of them; the
    // attempts above that are the wrong ones it took to get there. At accuracy 1 the two
    // are equal, which is the "never been wrong" record — available, not the default.
    topics[id] = { done: tasks, attempts: Math.max(tasks, Math.round(tasks / acc)) };
  }

  const totalDone = Object.values(topics).reduce((a, t) => a + t.done, 0);
  const totalTries = Object.values(topics).reduce((a, t) => a + t.attempts, 0);

  const split = { grammatik: 0.55, wortschatz: 0.2, hoeren: 0.1, lesen: 0.08, kultur: 0.07 };
  const skills = {};
  for (const [skill, w] of Object.entries(split)) {
    const attempts = Math.round(totalTries * w);
    if (!attempts) continue;
    // Every skill is active today: the page is meant to read as just-finished.
    skills[skill] = { attempts, correct: Math.round(totalDone * w), sessions: 2 + Math.round(rand() * 6), lastActiveDate: today };
  }

  const dailyActivity = {};
  for (let i = 0; i < days; i++) {
    if (i >= streak && rand() < 0.3) continue;
    dailyActivity[daysAgoStr(i)] = i < streak ? 10 + Math.round(rand() * 20) : 2 + Math.round(rand() * 8);
  }

  const vocabMastered = [];
  for (let i = 0; i < 240; i++) vocabMastered.push(`wortschatz:fill-${i}`);

  const data = {
    streak,
    lastActiveDate: today,
    lastSkill: "grammatik",
    skills,
    dailyActivity,
    vocabMastered,
    topics,
    drills: { dativ: { said: 40, sure: 36 }, "artikel-trainer": { said: 60, sure: 54 } },
    recents: [
      { path: "/uebungen/grammatik/dativ", title: "Dativ", n: 9, at: today },
      { path: "/uebungen/wortschatz/a1-01", title: "Person & Vorstellung", n: 7, at: today },
      { path: "/uebungen/artikel-trainer", title: "Artikel-Trainer", n: 12, at: daysAgoStr(1) },
    ],
  };

  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  if (!localStorage.getItem(NAME_KEY)) localStorage.setItem(NAME_KEY, "Testnutzer");
  return data;
}

/** Back to the honest empty state, including the display name the seed set. */
export function clearSeed() {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(NAME_KEY);
}
