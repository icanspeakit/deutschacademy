// Short German tips for the Aussprache-Check: one rule per sound that learners of German
// most often get wrong. No API — the tip is picked from the spelling of the word the
// learner scored worst on, which is enough: ü is written ü, "ich" is written ch.
//
// Each sound has a `test` on the lower-cased word and a `tip` written for A1–B1 readers:
// short main clauses, the mouth position first, one example they already know.

/** @typedef {{ id: string, label: string, test: (w: string) => boolean, tip: (w: string, shown: string) => string }} Sound */

const BACK_VOWEL_CH = /(a|o|u|au)ch/; // Bach, doch, Buch, auch → the "ach" sound

// st/sp is "scht"/"schp" at the start of a word stem, so a prefix is stripped first:
// verstehen, bestellen, gespielt. Inside a stem (Fenster, Kasten) it stays s-t.
const PREFIX = /^(ge|be|ver|er|zer|ent|auf|an|aus|ab|mit|vor|nach|um)(?=st|sp)/;
const stem = (w) => w.replace(PREFIX, "");

/** @type {Sound[]} */
export const SOUNDS = [
  {
    id: "ue",
    label: "ü",
    test: (w) => w.includes("ü"),
    tip: () => "ü: Sag „i“ und lass die Zunge, wo sie ist. Dann mach die Lippen rund und spitz wie bei „u“. So klingt „grün“, „Tür“, „früh“.",
  },
  {
    id: "oe",
    label: "ö",
    test: (w) => w.includes("ö"),
    tip: () => "ö: Sag „e“ und halte die Zunge still. Dann mach die Lippen rund wie bei „o“. So klingt „schön“, „können“, „Brötchen“.",
  },
  {
    id: "ae",
    label: "ä",
    test: (w) => /ä(?!u)/.test(w),
    tip: () => "ä: Klingt fast wie ein offenes „e“ — wie in „Bett“. Der Mund ist etwas weiter offen. Beispiele: „Mädchen“, „fährt“, „Käse“.",
  },
  {
    id: "sch-st-sp",
    label: "sch · st · sp",
    test: (w) => w.includes("sch") || /^(st|sp)/.test(stem(w)),
    tip: (w, shown) =>
      /^(st|sp)/.test(stem(w))
        ? `Am Wortanfang — auch nach ver-, be-, ge- — spricht man st wie „scht“ und sp wie „schp“: „${shown}“ klingt wie „${schify(shown)}“. Die Lippen sind rund und etwas nach vorn.`
        : "sch: Lippen rund und nach vorn, als ob du „psst“ sagst. Die Zunge berührt die Zähne nicht. Beispiele: „schön“, „Tisch“, „schicken“.",
  },
  {
    id: "ch",
    label: "ch",
    test: (w) => w.includes("ch") && !w.includes("sch"),
    tip: (w, shown) =>
      BACK_VOWEL_CH.test(w)
        ? `ch nach a, o, u, au ist hinten im Hals, wie ein leises Kratzen: „${shown}“ wie „Bach“, „doch“, „Buch“. Kein „k“!`
        : `ch nach e, i, ä, ö, ü und nach Konsonanten ist vorn: Sag „ja“, halte das „j“ und blas Luft darüber — kein „sch“, kein „k“. So klingt „ich“, „möchte“, „${shown}“.`,
  },
  {
    id: "r",
    label: "r",
    test: (w) => w.includes("r"),
    tip: (w, shown) =>
      /er$/.test(w)
        ? `Am Wortende klingt -er fast wie ein kurzes „a“: „${shown}“ endet wie „…a“. Nicht rollen!`
        : "Das deutsche r ist hinten im Hals, wie ein ganz leises Gurgeln — nicht mit der Zungenspitze rollen. Beispiele: „rot“, „Brot“, „fahren“.",
  },
  {
    id: "en",
    label: "-en",
    test: (w) => /en$/.test(w),
    tip: (w, shown) => `Endung -en: Das e ist ganz kurz und schwach, fast weg. „${shown}“ klingt eher wie „…n“ am Ende. Sprich die Endung trotzdem — sonst hört man das Verb nicht.`,
  },
  {
    id: "z",
    label: "z",
    test: (w) => w.includes("z"),
    tip: () => "z spricht man immer wie „ts“: „Zeit“ = „Tseit“, „zwei“ = „tswei“. Nie wie ein weiches englisches z.",
  },
  {
    id: "ei-ie",
    label: "ei · ie",
    test: (w) => w.includes("ei") || w.includes("ie"),
    tip: () => "ei klingt wie „ai“ (mein, zwei). ie ist ein langes „i“ (die, spielen). Merke: Man spricht immer den zweiten Buchstaben.",
  },
  {
    id: "w-v",
    label: "w · v",
    test: (w) => w.startsWith("w") || w.startsWith("v"),
    tip: () => "w klingt wie ein englisches „v“: „Wasser“, „wir“. Das deutsche v klingt meistens wie „f“: „Vater“, „viel“.",
  },
];

const GENERIC = "Hör dir das Wort noch einmal an und sprich es langsam nach — Silbe für Silbe. Dann den ganzen Satz im normalen Tempo.";

// "verstehe" → "verschtehe": the st/sp after the prefix, written as it sounds.
// Keeps the word's own capital: "Stuttgart" → "Schtuttgart".
function schify(shown) {
  const pre = shown.toLowerCase().match(PREFIX)?.[0] ?? "";
  return shown.slice(0, pre.length) + shown.slice(pre.length).replace(/^(s)(t|p)/i, (_, s, t) => `${s}ch${t}`);
}

/**
 * The tip for one word. Sounds the sentence was chosen to practise come first, so a
 * learner on the ü sentence hears about ü even if the word also has an r.
 * @param {string} word as shown in the sentence (punctuation is ignored)
 * @param {string[]} [focus] the sentence's focus sound ids
 * @returns {{ sound: string | null, label: string | null, text: string }}
 */
export function tipFor(word, focus = []) {
  const shown = word.replace(/[^A-Za-zÄÖÜäöüß-]/g, "");
  const w = shown.toLowerCase();
  const ordered = [
    ...SOUNDS.filter((s) => focus.includes(s.id)),
    ...SOUNDS.filter((s) => !focus.includes(s.id)),
  ];
  const hit = ordered.find((s) => s.test(w));
  return hit ? { sound: hit.id, label: hit.label, text: hit.tip(w, shown) } : { sound: null, label: null, text: GENERIC };
}

/** The label for a focus id, for the chips above the sentence. */
export function soundLabel(id) {
  return SOUNDS.find((s) => s.id === id)?.label ?? id;
}
