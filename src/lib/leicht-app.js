/* /leicht — the light prototype's whole brain.
 *
 * This is a UX study, not a feature. It answers one question: what does this site feel
 * like if a session never shows more than one thing at a time, never quotes a total, and
 * reports progress as something the learner can *do* rather than as a percentage?
 *
 * Deliberately self-contained. It imports no lexicon, no grammatik.json, no progress.js —
 * the twenty-odd rows below are the entire content model, and its state lives under its
 * own localStorage key so running the prototype cannot touch a real learner's record.
 * When a flow here wins, it gets rebuilt against the real data; nothing here is meant to.
 */

const STORE_KEY = "da_leicht_v1";

/* ---------------------------------------------------------------- content

   Three sittings. Each is five tasks and claims one or two Kann-Sätze — the
   capability line the learner is shown at the end. The sitting is the unit the
   whole prototype is built around: it is small enough to name ("5 Aufgaben ·
   2 Minuten") and finishing one always buys something specific.
*/

export const SITTINGS = [
  {
    id: "weg",
    icon: "🧭",
    title: "Nach dem Weg fragen",
    level: "A1",
    minutes: 2,
    claims: ["Du fragst auf der Straße nach dem Weg.", "Du verstehst eine kurze Wegbeschreibung."],
    tasks: [
      { type: "wort", front: "die Haltestelle", back: "the (bus/tram) stop", hint: "Da wartest du auf den Bus." },
      { type: "artikel", noun: "Bahnhof", answer: "der", back: "station" },
      {
        type: "luecke",
        before: "Entschuldigung, wie komme ich",
        after: "Bahnhof?",
        options: ["zum", "zur", "zu"],
        answer: "zum",
        why: "der Bahnhof → zu dem → zum.",
      },
      { type: "wort", front: "geradeaus", back: "straight ahead", hint: "Nicht links, nicht rechts." },
      {
        type: "satz",
        chips: ["Gehen", "Sie", "hier", "geradeaus"],
        answer: ["Gehen", "Sie", "hier", "geradeaus"],
        why: "Im Imperativ steht das Verb vorn: Gehen Sie …",
      },
    ],
  },
  {
    id: "einkauf",
    icon: "🛒",
    title: "Einkaufen gehen",
    level: "A1",
    minutes: 2,
    claims: ["Du kaufst im Supermarkt ein und fragst nach dem Preis."],
    tasks: [
      { type: "wort", front: "die Kasse", back: "the checkout", hint: "Dort bezahlst du." },
      { type: "artikel", noun: "Brot", answer: "das", back: "bread" },
      {
        type: "luecke",
        before: "Was kostet",
        after: "Brot?",
        options: ["das", "der", "die"],
        answer: "das",
        why: "das Brot — im Nominativ bleibt der Artikel gleich.",
      },
      { type: "wort", front: "die Tüte", back: "the bag", hint: "An der Kasse: „Brauchen Sie eine?“" },
      {
        type: "satz",
        chips: ["Ich", "hätte", "gern", "ein", "Brot"],
        answer: ["Ich", "hätte", "gern", "ein", "Brot"],
        why: "„Ich hätte gern …“ ist der höfliche Satz für jede Theke.",
      },
    ],
  },
  {
    id: "termin",
    icon: "📅",
    title: "Einen Termin machen",
    level: "A2",
    minutes: 3,
    claims: ["Du machst am Telefon einen Termin aus.", "Du nennst Datum und Uhrzeit."],
    tasks: [
      { type: "wort", front: "der Termin", back: "the appointment", hint: "Beim Arzt, beim Amt, beim Friseur." },
      {
        type: "luecke",
        before: "Ich hätte gern einen Termin",
        after: "Dienstag.",
        options: ["am", "im", "um"],
        answer: "am",
        why: "Wochentage bekommen am: am Dienstag, am Wochenende.",
      },
      { type: "artikel", noun: "Uhrzeit", answer: "die", back: "the time (of day)" },
      {
        type: "luecke",
        before: "Passt es Ihnen",
        after: "zehn Uhr?",
        options: ["um", "am", "in"],
        answer: "um",
        why: "Uhrzeiten bekommen um: um zehn, um halb drei.",
      },
      {
        type: "satz",
        chips: ["Kann", "ich", "den", "Termin", "verschieben"],
        answer: ["Kann", "ich", "den", "Termin", "verschieben"],
        why: "Modalverb vorn, Infinitiv ans Ende — die Klammer.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ state */

const blank = () => ({ done: [], answered: 0, right: 0, days: [], streak: 0 });

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch {
    return blank();
  }
}

export function saveState(s) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {}
}

export function resetState() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {}
}

const today = () => new Date().toISOString().slice(0, 10);

/** Finish a sitting: record it once, bump the streak, keep the tally honest. */
export function completeSitting(state, id, right, total) {
  const s = { ...state };
  if (!s.done.includes(id)) s.done = [...s.done, id];
  s.answered += total;
  s.right += right;
  const d = today();
  if (!s.days.includes(d)) {
    s.days = [...s.days, d].slice(-30);
    s.streak = (s.streak || 0) + 1;
  }
  return s;
}

/** Everything the learner has bought so far, in their words. */
export function capabilities(state) {
  return SITTINGS.filter((s) => state.done.includes(s.id)).flatMap((s) =>
    s.claims.map((text) => ({ text, from: s.title }))
  );
}

/** The one thing to offer next. Never a list — the point of the study. */
export function nextSitting(state) {
  return SITTINGS.find((s) => !state.done.includes(s.id)) || SITTINGS[0];
}
