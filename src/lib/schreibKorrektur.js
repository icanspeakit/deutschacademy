// "Text korrigieren" on a Schreibaufgabe.
//
// Two checkers, one result:
//   1. LanguageTool (api.languagetool.org, the free public API) — spelling, capitals,
//      punctuation and a good share of grammar. Called from the browser, so each learner is
//      under LanguageTool's own per-IP limit (20 checks a minute) and nothing of ours has to
//      hold a key. It is the only thing that sends the text anywhere, and only on the click.
//   2. Our own rules, in the browser — what LanguageTool misses in learner German and what
//      only the task knows: the comma before weil/dass, the verb at the end after them, a
//      question without "?", Anrede and Gruß in a message, the word count the task asks for,
//      three sentences in a row that start with "Ich".
//
// Every finding lands in one of four groups — Grammatik, Ausdruck, Satzzeichen,
// Rechtschreibung — which is how a DTZ/Goethe examiner sorts them too. If LanguageTool is
// unreachable the own rules still run and the panel says the spelling check is missing.

import { getLang, onLangChange } from "./i18n.js";

const LT_URL = "https://api.languagetool.org/v2/check";
const COOLDOWN_MS = 6000; // a click every few seconds is plenty; LanguageTool allows 20/min

export const CATS = ["grammatik", "ausdruck", "satzzeichen", "rechtschreibung"];

// UI strings in the UI language. The German findings stay German on purpose: the learner is
// looking at German text, and the correction is German.
const T = {
  de: {
    button: "Text korrigieren", again: "Noch einmal korrigieren", busy: "Wird geprüft …",
    grammatik: "Grammatik", ausdruck: "Ausdruck", satzzeichen: "Satzzeichen", rechtschreibung: "Rechtschreibung",
    none: "Keine Fehler gefunden. Gut gemacht!", apply: "Korrektur übernehmen", applyAll: "Alle Korrekturen übernehmen",
    task: "Aufgabe", words: "{n} Wörter", wordsRange: "{n} Wörter — verlangt sind {min}–{max}.",
    ltDown: "Die Rechtschreibprüfung ist gerade nicht erreichbar. Unten stehen nur unsere eigenen Hinweise.",
    empty: "Schreib zuerst ein paar Sätze.", wait: "Einen Moment — gleich kannst du wieder prüfen.",
    points: "Hast du an alles gedacht?", hint: "Hinweis",
  },
  en: {
    button: "Correct my text", again: "Correct again", busy: "Checking …",
    grammatik: "Grammar", ausdruck: "Expression", satzzeichen: "Punctuation", rechtschreibung: "Spelling",
    none: "No mistakes found. Well done!", apply: "Apply correction", applyAll: "Apply all corrections",
    task: "Task", words: "{n} words", wordsRange: "{n} words — the task asks for {min}–{max}.",
    ltDown: "The spelling check is not reachable right now. Only our own hints are shown below.",
    empty: "Write a few sentences first.", wait: "One moment — you can check again shortly.",
    points: "Did you cover everything?", hint: "Hint",
  },
  uk: {
    button: "Виправити текст", again: "Перевірити ще раз", busy: "Перевіряємо …",
    grammatik: "Граматика", ausdruck: "Вираз", satzzeichen: "Розділові знаки", rechtschreibung: "Правопис",
    none: "Помилок не знайдено. Чудово!", apply: "Прийняти виправлення", applyAll: "Прийняти всі виправлення",
    task: "Завдання", words: "{n} слів", wordsRange: "{n} слів — потрібно {min}–{max}.",
    ltDown: "Перевірка правопису зараз недоступна. Нижче лише наші власні підказки.",
    empty: "Спершу напиши кілька речень.", wait: "Хвилинку — скоро можна перевірити знову.",
    points: "Ти про все подумав(-ла)?", hint: "Підказка",
  },
  ar: {
    button: "صحّح النص", again: "صحّح مرة أخرى", busy: "جارٍ التدقيق …",
    grammatik: "القواعد", ausdruck: "التعبير", satzzeichen: "علامات الترقيم", rechtschreibung: "الإملاء",
    none: "لم يتم العثور على أخطاء. أحسنت!", apply: "اعتمد التصحيح", applyAll: "اعتمد كل التصحيحات",
    task: "المهمة", words: "{n} كلمة", wordsRange: "{n} كلمة — المطلوب {min}–{max}.",
    ltDown: "التدقيق الإملائي غير متاح الآن. تظهر أدناه ملاحظاتنا فقط.",
    empty: "اكتب بعض الجمل أولًا.", wait: "لحظة — يمكنك التدقيق مجددًا بعد قليل.",
    points: "هل تناولت كل النقاط؟", hint: "ملاحظة",
  },
  tr: {
    button: "Metni düzelt", again: "Yeniden düzelt", busy: "Kontrol ediliyor …",
    grammatik: "Dil bilgisi", ausdruck: "Anlatım", satzzeichen: "Noktalama", rechtschreibung: "Yazım",
    none: "Hata bulunamadı. Tebrikler!", apply: "Düzeltmeyi uygula", applyAll: "Tüm düzeltmeleri uygula",
    task: "Görev", words: "{n} kelime", wordsRange: "{n} kelime — istenen {min}–{max}.",
    ltDown: "Yazım denetimine şu an ulaşılamıyor. Aşağıda yalnızca kendi ipuçlarımız var.",
    empty: "Önce birkaç cümle yaz.", wait: "Bir saniye — birazdan yeniden kontrol edebilirsin.",
    points: "Her şeyi düşündün mü?", hint: "İpucu",
  },
};
const t = (key, vars = {}) => {
  const s = (T[getLang()] ?? T.de)[key] ?? T.de[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
};

// ---- LanguageTool --------------------------------------------------------------------

/** Which of the four groups a LanguageTool match belongs to. issueType first — it is the
 *  finer signal — then the category for what it leaves open. */
function ltCat(m) {
  const it = m.rule?.issueType;
  const cat = m.rule?.category?.id ?? "";
  if (it === "misspelling" || cat === "TYPOS" || cat === "CASING" || cat === "COMPOUNDING") return "rechtschreibung";
  if (it === "typographical" || it === "whitespace" || cat === "PUNCTUATION" || cat === "TYPOGRAPHY" || /COMMA|PUNCT|WHITESPACE/.test(m.rule?.id ?? "")) return "satzzeichen";
  if (it === "grammar" || cat === "GRAMMAR" || cat === "CONFUSED_WORDS") return "grammatik";
  return "ausdruck";
}

async function languageTool(text) {
  const body = new URLSearchParams({ text, language: "de-DE", level: "default" });
  const res = await fetch(LT_URL, { method: "POST", body });
  if (!res.ok) throw new Error(`LanguageTool ${res.status}`);
  const j = await res.json();
  return j.matches
    // Gendern-Hinweise are a style debate, not a learner's mistake.
    .filter((m) => m.rule?.category?.id !== "GENDER_NEUTRALITY")
    .map((m) => ({
      cat: ltCat(m),
      offset: m.offset,
      length: m.length,
      message: m.shortMessage && m.shortMessage.length > m.message.length / 2 ? m.shortMessage : m.message,
      replacements: m.replacements.slice(0, 3).map((r) => r.value),
      source: "lt",
    }));
}

// ---- Our own rules ------------------------------------------------------------------

const SUBORD = "weil|dass|obwohl|damit|ob|wenn|nachdem|bevor|sodass";
const FINITE = "bin|bist|ist|sind|seid|war|warst|waren|habe|hast|hat|haben|habt|hatte|hatten|muss|musst|müssen|müsst|kann|kannst|können|könnt|will|willst|wollen|wollt|möchte|möchtest|möchten|darf|darfst|dürfen|soll|sollst|sollen|werde|wirst|wird|werden|werdet|gehe|gehst|geht|gehen|komme|kommst|kommt|kommen|arbeite|arbeitest|arbeitet|arbeiten|habe";
const PRON = "ich|du|er|sie|es|wir|ihr|man|Sie|meine?|mein|deine?|dein";
const QUESTION_START = /^(Wann|Wo|Woher|Wohin|Was|Wer|Wen|Wem|Wie|Warum|Wieso|Weshalb|Welche[rsnm]?|Können|Kannst|Könnt|Kann|Hast|Hat|Haben|Habt|Bist|Sind|Ist|Seid|Willst|Wollen|Möchtest|Möchten|Darf|Darfst|Dürfen|Soll|Sollen|Gehst|Kommst|Kommen Sie|Hättest|Hätten|Würdest|Würden)\b/;

function ownRules(text, task) {
  const out = [];
  const add = (cat, offset, length, message, replacements = []) => out.push({ cat, offset, length, message, replacements, source: "own" });

  // 1. Comma before a subordinating conjunction that is not the first word of a sentence.
  // Not after "und", "aber", "oder" …: "und weil" takes no comma between the two.
  for (const m of text.matchAll(new RegExp(`([\\p{L}\\d]+)(\\s+)(${SUBORD})\\b`, "giu"))) {
    if (/^(und|oder|aber|sondern|denn|so|als|auch|nur|gerade|genau)$/i.test(m[1])) continue;
    const at = m.index + m[1].length;
    add("satzzeichen", at, m[2].length + m[3].length, `Vor „${m[3]}“ steht ein Komma.`, [`, ${m[3]}`]);
  }

  // 2. Verb at the end after weil/dass/obwohl/wenn: "weil ich muss arbeiten" → "weil ich arbeiten muss".
  for (const m of text.matchAll(new RegExp(`\\b(${SUBORD})\\s+(${PRON})\\s+(${FINITE})\\s+([^.,!?;\\n]+)`, "gu"))) {
    const rest = m[4].trim();
    if (!rest) continue;
    const start = m.index + m[0].indexOf(m[3], m[1].length + m[2].length);
    const end = m.index + m[0].length;
    add("grammatik", start, end - start, `Nach „${m[1]}“ steht das Verb am Ende: „… ${m[1]} ${m[2]} ${rest} ${m[3]}“.`, [`${rest} ${m[3]}`]);
  }

  // 3. Sentence ends: a question needs "?", and the text needs a final mark.
  const sentences = [...text.matchAll(/[^.!?\n]+[.!?]*/g)];
  for (const s of sentences) {
    const raw = s[0];
    const body = raw.trimEnd();
    const lead = raw.length - raw.trimStart().length;
    const sentence = body.trimStart();
    if (!sentence || sentence.split(/\s+/).length < 3) continue; // "Liebe Mira," and the Gruß are not sentences
    const endAt = s.index + body.length;
    const lastWord = sentence.match(/(\S+)$/)[1];
    const wordAt = endAt - lastWord.length;
    if (QUESTION_START.test(sentence) && !/\?$/.test(sentence)) {
      add("satzzeichen", wordAt, lastWord.length, "Eine Frage endet mit einem Fragezeichen.", [lastWord.replace(/[.!]$/, "") + "?"]);
    } else if (!/[.!?:]$/.test(sentence) && s.index + lead + sentence.length === text.trimEnd().length && !/,$/.test(sentence)) {
      add("satzzeichen", wordAt, lastWord.length, "Am Satzende fehlt ein Punkt.", [`${lastWord}.`]);
    }
  }

  // 4. Three sentences in a row that start with "Ich".
  let run = 0;
  for (const s of sentences) {
    const sentence = s[0].trimStart();
    if (/^Ich\b/.test(sentence)) {
      run++;
      if (run === 3) add("ausdruck", s.index + (s[0].length - sentence.length), 3, "Drei Sätze hintereinander mit „Ich“. Beginne einen anders: „Leider …“, „Am Samstag …“, „Dann …“.");
    } else run = 0;
  }

  // 5. A message or letter needs an Anrede and a Gruß.
  if (["nachricht", "email", "brief"].includes(task?.type)) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && !/^(Liebe|Lieber|Hallo|Hi|Hey|Sehr geehrte|Guten Tag|Servus|Moin)\b/i.test(lines[0])) {
      add("ausdruck", 0, 0, "Am Anfang fehlt eine Anrede, z. B. „Liebe Mira,“ oder „Sehr geehrte Frau …,“.");
    }
    const tail = lines.slice(-3).join(" ");
    if (lines.length > 1 && !/(Grüße|Gruß|Grüßen|Bis bald|Tschüss|Ciao|LG\b|Mit freundlichen|Bis dann|Viele Grüße|Alles Liebe)/i.test(tail)) {
      add("ausdruck", text.trimEnd().length, 0, "Am Ende fehlt ein Gruß, z. B. „Liebe Grüße“ oder „Mit freundlichen Grüßen“.");
    }
  }
  return out;
}

/** "(30–40 Wörter)" in the task situation, or null. */
export function wordRange(task) {
  const m = (task?.situation ?? "").match(/(\d+)\s*[–-]\s*(\d+)\s*Wörter/);
  return m ? { min: +m[1], max: +m[2] } : null;
}

/** Overlapping findings: keep LanguageTool's where both flag the same place — it carries
 *  the better suggestion — and ours where only we saw it. */
function merge(lt, own) {
  const overlaps = (a, b) => a.length > 0 && b.length > 0 && a.offset < b.offset + b.length && b.offset < a.offset + a.length;
  return [...lt, ...own.filter((o) => !lt.some((l) => overlaps(l, o)))].sort((a, b) => a.offset - b.offset);
}

export async function korrigieren(text, task) {
  const own = ownRules(text, task);
  let lt = [];
  let ltDown = false;
  try { lt = await languageTool(text); } catch { ltDown = true; }
  return { issues: merge(lt, own), ltDown };
}

// ---- The panel --------------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Apply the first suggestion of each given finding, right to left so offsets stay valid. */
function applyAll(text, issues) {
  let out = text;
  for (const i of [...issues].filter((i) => i.replacements.length).sort((a, b) => b.offset - a.offset)) {
    out = out.slice(0, i.offset) + i.replacements[0] + out.slice(i.offset + i.length);
  }
  return out;
}

/**
 * @param {HTMLElement} root     the panel container (empty; filled here)
 * @param {HTMLTextAreaElement} area
 * @param {object} task          the task from schreiben.json
 */
export function mountKorrektur(root, area, task) {
  root.innerHTML = `
    <div class="skk-bar">
      <button type="button" class="sk-btn skk-go" data-skk-go></button>
      <span class="skk-status" data-skk-status aria-live="polite"></span>
    </div>
    <div class="skk-out" data-skk-out hidden></div>`;
  const go = root.querySelector("[data-skk-go]");
  const status = root.querySelector("[data-skk-status]");
  const out = root.querySelector("[data-skk-out]");
  let last = null; // { text, issues, ltDown }
  let lastAt = 0;
  let busy = false;

  const paintButton = () => { go.textContent = busy ? t("busy") : last ? t("again") : t("button"); go.disabled = busy; };

  function render() {
    if (!last) { out.hidden = true; return; }
    const { text, issues, ltDown } = last;
    const counts = Object.fromEntries(CATS.map((c) => [c, issues.filter((i) => i.cat === c).length]));
    // The text with every finding underlined in its group's colour.
    let marked = "";
    let pos = 0;
    issues.forEach((i, n) => {
      if (i.offset < pos || !i.length) return; // overlaps and whole-text hints: the list has them
      marked += esc(text.slice(pos, i.offset));
      const bad = text.slice(i.offset, i.offset + i.length) || " ";
      marked += `<mark class="skk-m skk-${i.cat}" data-n="${n}" title="${esc(i.message)}">${esc(bad)}</mark>`;
      pos = i.offset + i.length;
    });
    marked += esc(text.slice(pos));

    const n = text.trim().split(/\s+/).filter(Boolean).length;
    const range = wordRange(task);
    const wordsLine = range ? t("wordsRange", { n, ...range }) : t("words", { n });
    const wordsOk = !range || (n >= range.min * 0.9 && n <= range.max * 1.2);

    out.innerHTML = `
      ${ltDown ? `<p class="skk-note">${esc(t("ltDown"))}</p>` : ""}
      <div class="skk-chips">${CATS.map((c) => `<span class="skk-chip skk-${c}${counts[c] ? "" : " is-zero"}"><b>${counts[c]}</b> ${esc(t(c))}</span>`).join("")}</div>
      ${issues.length ? `<div class="skk-text" lang="de">${marked}</div>` : `<p class="skk-none">${esc(t("none"))}</p>`}
      ${issues.length ? `<ol class="skk-list">${issues.map((i, k) => {
        const bad = text.slice(i.offset, i.offset + i.length);
        const fix = i.replacements[0];
        return `<li class="skk-item" data-n="${k}">
          <span class="skk-tag skk-${i.cat}">${esc(t(i.cat))}</span>
          <span class="skk-what" lang="de">${bad.trim() ? `<s>${esc(bad)}</s>` : ""}${fix != null ? ` → <b>${esc(fix.trim() || fix)}</b>` : ""}</span>
          <span class="skk-msg" lang="de">${esc(i.message)}</span>
          ${fix != null ? `<button type="button" class="skk-apply" data-apply="${k}">${esc(t("apply"))}</button>` : ""}
        </li>`;
      }).join("")}</ol>
      ${issues.some((i) => i.replacements.length) ? `<p><button type="button" class="sk-btn skk-applyall" data-apply-all>${esc(t("applyAll"))}</button></p>` : ""}` : ""}
      <div class="skk-task">
        <p class="skk-task-h">${esc(t("task"))}</p>
        <p class="skk-words${wordsOk ? "" : " is-off"}">${esc(wordsLine)}</p>
        ${task?.points?.length ? `<p class="skk-task-q">${esc(t("points"))}</p><ul class="skk-points" lang="de">${task.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
      </div>`;
    out.hidden = false;
  }

  function useText(next) {
    area.value = next;
    area.dispatchEvent(new Event("input", { bubbles: true }));
    last = null;
    render();
    paintButton();
    area.focus();
  }

  out.addEventListener("click", (e) => {
    const one = e.target.closest("[data-apply]");
    if (one && last) return useText(applyAll(last.text, [last.issues[+one.dataset.apply]]));
    if (e.target.closest("[data-apply-all]") && last) return useText(applyAll(last.text, last.issues));
    const m = e.target.closest(".skk-m");
    if (m) out.querySelector(`.skk-item[data-n="${m.dataset.n}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  go.addEventListener("click", async () => {
    const text = area.value;
    if (text.trim().split(/\s+/).filter(Boolean).length < 3) { status.textContent = t("empty"); return; }
    if (Date.now() - lastAt < COOLDOWN_MS) { status.textContent = t("wait"); return; }
    status.textContent = "";
    busy = true; lastAt = Date.now(); paintButton();
    try {
      const r = await korrigieren(text, task);
      last = { text, ...r };
      render();
      out.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } finally { busy = false; paintButton(); }
  });

  // Editing after a check makes the underlines point at the wrong letters; drop them.
  area.addEventListener("input", () => { if (last && area.value !== last.text) { last = null; render(); paintButton(); } });
  onLangChange(() => { paintButton(); render(); });
  paintButton();
}
