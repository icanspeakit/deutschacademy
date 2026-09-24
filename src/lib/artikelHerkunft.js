// "Etymologie" — the card above "Wie oft hört man das?" in the Artikel-Trainer.
//
// Data: the {{Herkunft}} section of de.wiktionary.org, worked up by
// scripts/artikel-herkunft.mjs into { text, chain?, parts? } per noun:
//   chain  the line of descent, oldest first: [{ lang, form, gloss? }] — drawn as a
//          Stammbaum, one box per language, arrows down to today's word;
//   parts  a compound or derivation: ["Schmerz", "Mittel"], ["wohnen", "-ung"] — drawn as
//          the parts side by side over the word;
//   text   a sentence or two of the prose, under the tree (dates live there).
// ~400 KB for all 2 577 nouns, so it is a static file fetched on the first card rather than
// inlined into the page.
//
// It never names the article before the answer: the card is on screen while the question is
// still open, and Wiktionary often writes the word with it ("später: der Tag"). Until the
// card is answered every "der/die/das <Wort>" reads "___ <Wort>".
// CC BY-SA 4.0 asks for attribution: a small (i) in the card's corner links each entry back
// to its Wiktionary page — the credit without a line of citation under every word.
//
// In the UI language: the tree's language labels come from LANG_LABELS below, and the prose
// and glosses from /data/herkunft/<lang>.json (machine drafts, `reviewed: false`), fetched
// only when the UI is not German. A word with no translation yet keeps its German text.
// The historical forms themselves (hūs, *fader, discus) are never translated.

import { getLang, onLangChange } from "./i18n.js";

const SRC = "/data/artikel-herkunft.json";
const TR_SRC = (lang) => `/data/herkunft/${lang}.json`;

// Every `lang` the chains use (scripts/artikel-herkunft.mjs), plus today's German.
const LANG_LABELS = {
  "Deutsch, heute": { en: "German today", ar: "الألمانية اليوم", uk: "німецька сьогодні", tr: "bugünkü Almanca" },
  Latein: { en: "Latin", ar: "اللاتينية", uk: "латина", tr: "Latince" },
  Mittelhochdeutsch: { en: "Middle High German", ar: "الألمانية العليا الوسطى", uk: "середньоверхньонімецька", tr: "Orta Yüksek Almanca" },
  Althochdeutsch: { en: "Old High German", ar: "الألمانية العليا القديمة", uk: "давньоверхньонімецька", tr: "Eski Yüksek Almanca" },
  Französisch: { en: "French", ar: "الفرنسية", uk: "французька", tr: "Fransızca" },
  Altgriechisch: { en: "Ancient Greek", ar: "اليونانية القديمة", uk: "давньогрецька", tr: "Eski Yunanca" },
  Englisch: { en: "English", ar: "الإنجليزية", uk: "англійська", tr: "İngilizce" },
  Italienisch: { en: "Italian", ar: "الإيطالية", uk: "італійська", tr: "İtalyanca" },
  Germanisch: { en: "Proto-Germanic", ar: "الجرمانية البدائية", uk: "прагерманська", tr: "Ön-Germence" },
  Niederländisch: { en: "Dutch", ar: "الهولندية", uk: "нідерландська", tr: "Felemenkçe" },
  Altfranzösisch: { en: "Old French", ar: "الفرنسية القديمة", uk: "старофранцузька", tr: "Eski Fransızca" },
  Indogermanisch: { en: "Proto-Indo-European", ar: "الهندية الأوروبية البدائية", uk: "праіндоєвропейська", tr: "Ön-Hint-Avrupa dili" },
  Mittelniederdeutsch: { en: "Middle Low German", ar: "الألمانية السفلى الوسطى", uk: "середньонижньонімецька", tr: "Orta Aşağı Almanca" },
  Griechisch: { en: "Greek", ar: "اليونانية", uk: "грецька", tr: "Yunanca" },
  Russisch: { en: "Russian", ar: "الروسية", uk: "російська", tr: "Rusça" },
  Sanskrit: { en: "Sanskrit", ar: "السنسكريتية", uk: "санскрит", tr: "Sanskritçe" },
  Niederdeutsch: { en: "Low German", ar: "الألمانية السفلى", uk: "нижньонімецька", tr: "Aşağı Almanca" },
  Arabisch: { en: "Arabic", ar: "العربية", uk: "арабська", tr: "Arapça" },
  Westgermanisch: { en: "West Germanic", ar: "الجرمانية الغربية", uk: "західногерманська", tr: "Batı Germence" },
  Mittelenglisch: { en: "Middle English", ar: "الإنجليزية الوسطى", uk: "середньоанглійська", tr: "Orta İngilizce" },
  Spanisch: { en: "Spanish", ar: "الإسبانية", uk: "іспанська", tr: "İspanyolca" },
  Polnisch: { en: "Polish", ar: "البولندية", uk: "польська", tr: "Lehçe" },
  Tschechisch: { en: "Czech", ar: "التشيكية", uk: "чеська", tr: "Çekçe" },
  Türkisch: { en: "Turkish", ar: "التركية", uk: "турецька", tr: "Türkçe" },
  Portugiesisch: { en: "Portuguese", ar: "البرتغالية", uk: "португальська", tr: "Portekizce" },
  Persisch: { en: "Persian", ar: "الفارسية", uk: "перська", tr: "Farsça" },
  Ungarisch: { en: "Hungarian", ar: "المجرية", uk: "угорська", tr: "Macarca" },
  Mittelfranzösisch: { en: "Middle French", ar: "الفرنسية الوسطى", uk: "середньофранцузька", tr: "Orta Fransızca" },
};
const NONE = {
  de: "Für dieses Wort ist noch keine Herkunft hinterlegt.",
  en: "There is no etymology for this word yet.",
  ar: "لا يوجد أصل لهذه الكلمة بعد.",
  uk: "Для цього слова ще немає етимології.",
  tr: "Bu kelimenin kökeni henüz eklenmedi.",
};
// "Ähnliche Wörter" — synonyms from Wiktionary, kept to words in our own lexicon.
const SYN = { de: "Ähnliche Wörter", en: "Similar words", ar: "كلمات مشابهة", uk: "Схожі слова", tr: "Benzer kelimeler" };
const CREDIT = {
  de: "Herkunft: Wiktionary, CC BY-SA 4.0",
  en: "Etymology: Wiktionary, CC BY-SA 4.0",
  ar: "أصل الكلمة: Wiktionary، CC BY-SA 4.0",
  uk: "Етимологія: Wiktionary, CC BY-SA 4.0",
  tr: "Köken: Wiktionary, CC BY-SA 4.0",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** @param {HTMLElement} root  the card; @param {Map<string, {lemma: string}>} byId */
export function mountHerkunft(root, byId) {
  const word = root.querySelector("[data-herkunft-word]");
  const tree = root.querySelector("[data-herkunft-tree]");
  const text = root.querySelector("[data-herkunft-text]");
  const src = root.querySelector("[data-herkunft-src]");
  // The synonyms row lives under the tree; made here so the card's markup stays as it is.
  const syn = document.createElement("p");
  syn.className = "ahk-syn";
  syn.hidden = true;
  tree.after(syn);
  let data = null;
  let loading = null;
  let want = null;
  let open = true; // the question on the card is not answered yet
  let lang = getLang();
  const tr = {}; // lang → { id: { text, gloss: { German gloss → translated } } }, once fetched
  const trLoading = {};
  const label = (de) => (lang !== "de" && LANG_LABELS[de]?.[lang]) || de;

  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mask = (t, lemma) => (open ? t.replace(new RegExp(`\\b(der|die|das|dem|den|des)(\\s+${reEsc(lemma)})`, "gi"), "___$2") : t);

  const load = () =>
    (loading ??= fetch(SRC)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((d) => { data = d; }));

  const loadTr = (l) =>
    (trLoading[l] ??= fetch(TR_SRC(l))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((d) => { tr[l] = d.entries ?? {}; }));

  const box = (from, form, gloss, now = false) => `
    <li class="ahk-node${now ? " ahk-node--now" : ""}">
      <span class="ahk-form">${esc(form)}</span>
      <span class="ahk-lang">${esc(label(from))}</span>
      ${gloss ? `<span class="ahk-gloss">„${esc(gloss)}“</span>` : ""}
    </li>`;

  function drawTree(entry, lemma, glossTr) {
    // The last box says what the word means now, in the learner's language (from our
    // lexicon, `mean`). Ukrainian has no word translations yet, so it reads the English.
    const meaning = lang === "de" ? null : entry.mean?.[lang] ?? entry.mean?.en ?? null;
    const today = box("Deutsch, heute", lemma, meaning, true);
    if (entry.chain) {
      // Translated glosses are keyed by the German gloss, so a chain that gains a step
      // keeps every translation that still applies.
      return entry.chain.map((s) => box(s.lang, s.form, s.gloss && mask(glossTr?.[s.gloss] || s.gloss, lemma))).join("") + today;
    }
    if (entry.parts) {
      const parts = entry.parts.map((p) => `<span class="ahk-part">${esc(p)}</span>`).join(`<span class="ahk-plus" aria-hidden="true">+</span>`);
      return `<li class="ahk-node ahk-node--parts" aria-label="${esc(entry.parts.join(" + "))}">${parts}</li>${today}`;
    }
    return "";
  }

  function paint() {
    const q = want && byId.get(want);
    root.hidden = !q;
    if (!q) return;
    word.textContent = q.lemma;
    if (!data) { text.textContent = "…"; tree.hidden = true; src.hidden = true; return; }
    const entry = data[want];
    const t = typeof entry === "string" ? { text: entry } : entry;
    const x = lang !== "de" ? tr[lang]?.[want] : null;
    const html = t ? drawTree(t, q.lemma, x?.gloss) : "";
    tree.innerHTML = html;
    syn.hidden = !t?.syn?.length;
    if (t?.syn?.length) {
      syn.innerHTML = `<span class="ahk-syn-h">${esc(SYN[lang] ?? SYN.de)}</span>` +
        t.syn.map((w) => `<span class="ahk-syn-w" lang="de">${esc(w)}</span>`).join("");
    }
    tree.hidden = !html;
    // The tree ends in the word itself, so the heading above it would say it twice.
    word.hidden = !!html;
    text.textContent = t ? mask(x?.text || t.text, q.lemma) : NONE[lang] ?? NONE.de;
    text.classList.toggle("is-empty", !t);
    // Translated prose reads in its own direction; the German stays left-to-right.
    text.lang = x?.text ? lang : "de";
    text.dir = x?.text && lang === "ar" ? "rtl" : "ltr";
    src.hidden = !t;
    if (t) {
      const url = `https://de.wiktionary.org/wiki/${encodeURIComponent(q.lemma)}`;
      const credit = CREDIT[lang] ?? CREDIT.de;
      src.innerHTML = `<a class="ahk-credit" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(credit)}" aria-label="${esc(credit)}">i</a>`;
    }
  }

  onLangChange((code) => {
    lang = code;
    if (lang !== "de" && !tr[lang]) loadTr(lang).then(paint);
    else paint();
  });

  return {
    setCurrent(id, answered = false) {
      if (id === want && open === !answered) return;
      want = id;
      open = !answered;
      paint();
      if (!data) load().then(paint);
      if (lang !== "de" && !tr[lang]) loadTr(lang).then(paint);
    },
  };
}
