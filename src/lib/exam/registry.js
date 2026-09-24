/* One description of every exam trainer on the site: its parts, how many scored items
 * each part holds, and where its answers live.
 *
 * Until now each trainer page built that list inline, in its own module script, which is
 * fine while a page only has to know about itself. A cross-exam "Mein Fortschritt" view
 * cannot work that way — it would have to re-derive six pages' section lists — so the
 * counts move here, derived from the same JSON the trainers load. The trainers keep
 * owning how a part is *rendered*; this file owns what a part *is*.
 *
 * Two storage shapes exist and both are read as-is rather than migrated:
 *   store "exam" → "da-exam-v1:<key>", { answers: { id: {given, correct} } }
 *                  (src/lib/exam/state.js — Start Deutsch 1, TestDaF, Leben in Deutschland)
 *   store "dtz"  → "da-dtz-v1:<key>",  same answers plus a schreiben object
 *                  (src/lib/dtzTrainer.js — the DTZ Übungssatz)
 *
 * A module is `scored: false` when a human marks it (a form, a free text). It still
 * carries ids so "done" survives a reload, but it stays out of every point total.
 */
import sd1 from "../../data/pruefungen/start-deutsch-1/uebungssatz-1.json";
import tdaf from "../../data/pruefungen/testdaf/uebungssatz-1.json";
import lid from "../../data/leben-in-deutschland.json";
import dtz1 from "../../data/pruefungen/dtz/uebungssatz-1.json";
import { qidsOfPart } from "../dtzTrainer.js";

const idsOf = (part) => part.items.map((i) => i.id);

/* Leben in Deutschland numbers its federal questions positionally, exactly as
   test.astro does; the state questions depend on the Bundesland the learner picked,
   which only the browser knows — hence `idsFrom`, resolved client-side. */
const lidFederalIds = lid.questions.map((_, i) => "bund-" + (i + 1));

export const examRegistry = [
  {
    id: "start-deutsch-1",
    title: "Start Deutsch 1",
    subtitle: "Goethe A1 · telc A1",
    level: "A1",
    href: "/start-deutsch-1",
    overview: "/telc",
    store: { kind: "exam", key: "start-deutsch-1" },
    // 36 of 60 is the pass line for the whole exam; Hören and Lesen are 30 of those 60.
    passNote: "Bestanden ab 36 von 60 Punkten (60 %). Hören und Lesen sind davon 30.",
    passPct: 60,
    modules: [
      { key: "hoeren1", label: "Hören · Teil 1", ids: idsOf(sd1.hoeren.teil1) },
      { key: "hoeren2", label: "Hören · Teil 2", ids: idsOf(sd1.hoeren.teil2) },
      { key: "hoeren3", label: "Hören · Teil 3", ids: idsOf(sd1.hoeren.teil3) },
      { key: "lesen1", label: "Lesen · Teil 1", ids: idsOf(sd1.lesen.teil1) },
      { key: "lesen2", label: "Lesen · Teil 2", ids: idsOf(sd1.lesen.teil2) },
      { key: "lesen3", label: "Lesen · Teil 3", ids: idsOf(sd1.lesen.teil3) },
      { key: "schreiben", label: "Schreiben", ids: ["s-formular", "s-nachricht"], scored: false },
    ],
  },
  {
    id: "testdaf",
    title: "TestDaF",
    subtitle: "Leseverstehen · Schreiben",
    level: "TDN 3–5",
    href: "/testdaf/uebungssatz",
    overview: "/testdaf",
    store: { kind: "exam", key: "testdaf" },
    // Deliberately no pass percentage: TestDaF grades each skill separately as TDN 3/4/5
    // and every university sets its own requirement, so a line here would be invented.
    passNote: "Keine Bestehensgrenze in Prozent — jede Fertigkeit wird einzeln als TDN 3, 4 oder 5 bewertet.",
    passPct: null,
    modules: [
      { key: "lesen1", label: "Lesen · Aufgabe 1", ids: idsOf(tdaf.leseverstehen.aufgabe1) },
      { key: "lesen2", label: "Lesen · Aufgabe 2", ids: idsOf(tdaf.leseverstehen.aufgabe2) },
      { key: "lesen3", label: "Lesen · Aufgabe 3", ids: idsOf(tdaf.leseverstehen.aufgabe3) },
      { key: "schreiben", label: "Schreiben", ids: ["tdaf-schreiben"], scored: false },
    ],
  },
  {
    id: "leben-in-deutschland",
    title: "Leben in Deutschland",
    subtitle: "Einbürgerungstest",
    level: "Wissenstest",
    href: "/leben-in-deutschland/test",
    overview: "/leben-in-deutschland",
    store: { kind: "exam", key: "leben-in-deutschland" },
    passNote: `Bestanden ab ${lid.meta.passScore} von ${lid.meta.totalQuestions} Fragen.`,
    passPct: Math.round((lid.meta.passScore / lid.meta.totalQuestions) * 100),
    modules: [
      { key: "bund", label: "Bundesweit", ids: lidFederalIds },
      // The ids depend on the Bundesland stored in "da-lid-land"; only the browser
      // knows which one, so the client resolves this. The count shown until then is
      // Bayern's, the default the trainer itself falls back to.
      { key: "land", label: "Mein Bundesland", idsFrom: "lid-land" },
    ],
  },
  {
    id: "dtz",
    title: "DTZ",
    subtitle: dtz1.label,
    level: "A2 / B1",
    href: "/dtz/uebungssatz",
    overview: "/dtz",
    store: { kind: "dtz", key: dtz1.id },
    passNote: "Hören und Lesen zählen zusammen: ab 20 Punkten Stufe A2, ab 33 Stufe B1.",
    passPct: Math.round((33 / 45) * 100),
    modules: [
      ...dtz1.parts.map((part, i) => ({
        key: "teil-" + (i + 1),
        label: part.label,
        ids: qidsOfPart(part),
      })),
      // The DTZ trainer keeps its writing task outside `answers`, in its own
      // { task, text, selfRate } object, so "done" is the self-rating being set
      // rather than an id being present. `doneFrom` tells the client that.
      { key: "schreiben", label: "Schreiben", ids: [], scored: false, doneFrom: "dtz-schreiben" },
    ],
  },
];

/** The Bundesland question ids for one state, in the trainer's own numbering. */
export function lidLandIds(landId) {
  const land = lid.bundeslaender.find((l) => l.id === landId) ?? lid.bundeslaender[0];
  return land.stateQuestions.map((_, i) => "land-" + land.id + "-" + (i + 1));
}

/** Bayern is the trainer's fallback, so it is what the registry counts until the
 *  browser says otherwise. */
export const lidDefaultLandIds = lidLandIds("bayern");

export function examById(id) {
  return examRegistry.find((e) => e.id === id) ?? null;
}

/** Scored ids only — what a points total is allowed to be built from. */
export function scoredIdsOf(exam, resolve = () => []) {
  return exam.modules
    .filter((m) => m.scored !== false)
    .flatMap((m) => (m.idsFrom ? resolve(m.idsFrom) : m.ids));
}
