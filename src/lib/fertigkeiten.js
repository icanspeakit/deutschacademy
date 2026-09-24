// Build-time helpers for the Lesen, Schreiben and Sprechen libraries.
//
// The three JSON files in src/data/fertigkeiten/ are indexes: they carry the level, the
// task type and the blurb for every exercise, but some entries carry no content of their
// own. Those have a `from` field and borrow it from the material that already exists:
//
//   from: "dtz-simulation"    a Lesen part of src/data/lesen.json
//   from: "dtz-formTask"      \
//   from: "dtz-writingPrompt"  }  the three Schreiben parts of the same file
//   from: "dtz-errorHunt"     /
//   from: "sprechen-dtz"      one picture of src/data/sprechen.json,       by `index`
//   from: "sprechen-telc"     one prompt of src/data/sprechen-b1b2.json,   by `index`
//
// Borrowing rather than copying, because /lesen-schreiben, /sprechen and
// the DTZ mock test all still read those files. Two copies of a Prüfungstext would drift
// apart, and the one that drifted would be the one nobody reopened.
//
// Everything here runs at build time only — the pages that import it are prerendered.
import lesenIndex from "../data/fertigkeiten/lesen.json";
import schreibenIndex from "../data/fertigkeiten/schreiben.json";
import sprechenIndex from "../data/fertigkeiten/sprechen.json";
import dtz from "../data/lesen.json";
import sprechenDtz from "../data/sprechen.json";
import sprechenTelc from "../data/sprechen-b1b2.json";
import { NAV_LEVELS } from "./catalog.js";

/** A `from` id that names nothing is a typo, and a silent one would just render an empty
 *  page. Throwing at build time is the only way anybody finds out. */
function must(value, what) {
  if (value == null) throw new Error(`fertigkeiten: ${what} nicht gefunden`);
  return value;
}

function resolveLesen(entry) {
  if (!entry.from) return entry;
  // "b1-anzeigen" borrows the group "anzeigen": the level prefix is ours, the rest is the
  // group's own id.
  const groupId = entry.id.replace(/^[ab][12]-/, "");
  const group = must(dtz.groups.find((g) => g.id === groupId), `lesen.json #${groupId}`);
  return { ...entry, text: group.text, questions: group.questions };
}

function resolveSchreiben(entry) {
  switch (entry.from) {
    case undefined:
      return entry;
    case "dtz-formTask":
      return { ...entry, source: dtz.formTask.email, fields: dtz.formTask.fields, check: FORM_CHECK };
    case "dtz-writingPrompt": {
      const p = dtz.writingPrompt;
      return { ...entry, situation: p.context, source: p.email, points: p.points,
               // `tips` is one "· "-separated string in lesen.json, not a list.
               phrases: (p.tips ?? "").split(" · ").filter(Boolean), model: "", check: BRIEF_CHECK };
    }
    case "dtz-errorHunt": {
      // No Lösungsschlüssel, deliberately — see the `context` in lesen.json. The page shows
      // the text and says so; this is the one task on the site meant for a second pair of
      // eyes rather than a click.
      const e = dtz.errorHunt;
      return { ...entry, situation: e.context, source: e.text, check: ERROR_CHECK };
    }
    default:
      throw new Error(`fertigkeiten: unbekanntes from "${entry.from}"`);
  }
}

// The DTZ file predates this index and carries no examiner checklist of its own, so the
// three ported tasks get the generic one for their kind. A task written for this folder
// brings its own, which is always the better text.
const FORM_CHECK = [
  "Jedes Feld ist ausgefüllt — ein leeres Feld zählt beim DTZ als Fehler, auch wenn die Angabe im Text steht.",
  "Datum im deutschen Format (TT.MM.JJJJ).",
  "Nichts erfunden: Was nicht im Text steht, bleibt leer oder bekommt einen Strich.",
];
const BRIEF_CHECK = [
  "Alle Leitpunkte kommen vor. Ein fehlender Punkt kostet mehr als drei Grammatikfehler.",
  "Anrede und Gruß passen zueinander und zur Person.",
  "Die Sätze sind verbunden (deshalb, trotzdem, außerdem), nicht aneinandergereiht.",
];
const ERROR_CHECK = [
  "Erst lesen, dann vergleichen — die Lösung erst öffnen, wenn Sie alle Fehler markiert haben.",
  "Die eigenen Lieblingsfehler notieren. Das ist der Zweck der Aufgabe.",
];

function resolveSprechen(entry) {
  switch (entry.from) {
    case undefined:
      return entry;
    case "sprechen-dtz": {
      const pic = must(sprechenDtz[entry.index], `sprechen.json #${entry.index}`);
      return {
        ...entry,
        image: pic.image,
        prompt: "Beschreiben Sie das Bild. Danach stellt Ihnen die Prüferin Fragen zu Ihrer eigenen Erfahrung.",
        bullets: [...pic.beschreibung, ...pic.persoenlich],
        href: "/sprechen/dtz-bildbeschreibung",
        hrefLabel: "im Bildbeschreibungs-Trainer",
      };
    }
    case "sprechen-telc": {
      const p = must(sprechenTelc.prompts[entry.index], `sprechen-b1b2.json #${entry.index}`);
      const diskussion = entry.stage === "diskussion";
      return {
        ...entry,
        image: p.image,
        prompt: diskussion
          ? p.diskussion
          : `Kurzvortrag zum Thema „${p.kurzvortrag.topic}“. Beschreiben Sie zuerst das Bild, halten Sie dann Ihren Vortrag.`,
        bullets: diskussion
          ? ["Nehmen Sie klar Stellung.", "Nennen Sie zwei Argumente.", "Gehen Sie auf den Einwand Ihres Gegenübers ein.", "Fassen Sie Ihre Position am Ende zusammen."]
          : [...p.beschreibung, ...p.kurzvortrag.points],
        href: "/sprechen-b1b2",
        hrefLabel: "im Kurzvortrag-Trainer",
      };
    }
    default:
      throw new Error(`fertigkeiten: unbekanntes from "${entry.from}"`);
  }
}

export const lesen = { ...lesenIndex, texts: lesenIndex.texts.map(resolveLesen) };
export const schreiben = { ...schreibenIndex, tasks: schreibenIndex.tasks.map(resolveSchreiben) };
export const sprechen = { ...sprechenIndex, tasks: sprechenIndex.tasks.map(resolveSprechen) };

/** Level → entries, in NAV_LEVELS order, skipping levels with nothing in them. */
export function byLevel(items) {
  return NAV_LEVELS
    .map((level) => ({ level, items: items.filter((i) => i.level === level) }))
    .filter((g) => g.items.length);
}

/** Previous/next stay inside the level, as on the Hörtext pages: "weiter" should mean
 *  another A2 exercise, not a jump from the last A1 text into a B2 Diskussion.
 *
 *  Where an entry belongs to a set, the set is the smaller and truer boundary: a Satz is
 *  four pictures you sit down to finish, and "weiter" inside one should not wander off
 *  into a different subject at the same level. */
export function neighbours(items, entry) {
  const scope = entry.set
    ? items.filter((i) => i.set === entry.set)
    : items.filter((i) => i.level === entry.level && !i.set);
  const i = scope.indexOf(entry);
  return { prev: scope[i - 1] ?? null, next: scope[i + 1] ?? null };
}

/** The Bildbeschreibungen, grouped into the sets that sprechen.json declares, plus whatever
 *  is left over. A set is one sitting: four pictures on one subject, the same unit the
 *  Wortschatz Lernsets use. The one-off tasks (sich vorstellen, Kurzvortrag, Diskussion,
 *  gemeinsam planen) are not a series and do not get forced into one. */
export function sprechenSets() {
  return sprechen.sets.map((set) => ({
    ...set,
    items: sprechen.tasks.filter((t) => t.set === set.id),
  }));
}

/** Tasks that belong to no set, by level — the "Weitere Aufgaben" column on the hub. */
export function sprechenLoose() {
  return byLevel(sprechen.tasks.filter((t) => !t.set));
}

/* A text sort, an icon. Same one-way/two-way idea the Hörtexte use where it applies:
   what you read alone vs. what several voices say to each other. */
export const LESEN_ICON = {
  schild: "map-pin",
  nachricht: "link",
  anzeige: "folder",
  brief: "document",
  artikel: "book-open",
  forum: "user",
  interview: "mic",
};

export const SCHREIBEN_ICON = {
  formular: "document",
  nachricht: "link",
  email: "link",
  brief: "pencil",
  fehlerjagd: "target",
};

export const SPRECHEN_ICON = {
  vorstellen: "user",
  bild: "map-pin",
  planen: "link",
  vortrag: "volume",
  diskussion: "mic",
};
