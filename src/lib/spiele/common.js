// Shared machinery for the printable group games (/lehrkraefte/spiele/*): the seeded
// shuffle, the settings in the URL, the word data, the Lernset picker, the on-screen
// preview and the A4 sheet frame. Each game (bingo.js, domino.js, erklaeren.js) only
// decides what goes on the sheets.
//
// Everything a sheet shows is derived from (level, Lernsets, options, seed), and all of it
// lives in the URL. A teacher who prints 30 Bingo cards on Monday and needs one more on
// Thursday opens the same link and gets the same 30 — plus the 31st.
import { getLang, loadDict, onLangChange, translate } from "../i18n.js";

/* ----------------------------------------------------------------- random -- */

/** A small, fast, seedable PRNG (mulberry32). Math.random() cannot be replayed. */
export function rng(seed) {
  let a = hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

/** Six characters, short enough to read out or type from a printout. */
export const newSeed = () => Math.random().toString(36).slice(2, 8);

/** Fisher–Yates on a copy. */
export function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ words -- */

// Column order of the rows in /lehrkraefte/spiele/woerter-<level>.json — see
// src/pages/lehrkraefte/spiele/woerter-[level].json.ts.
const WORD_FIELDS = ["unit", "lemma", "pos", "gender", "plural", "en", "ar", "ru", "tr"];

/** The meaning languages the lexicon carries. Arabic is right-to-left on the sheets. */
export const MEANING_LANGS = {
  en: { label: "English" },
  ar: { label: "العربية", rtl: true },
  ru: { label: "Русский" },
  tr: { label: "Türkçe" },
};

const levelCache = new Map();

/** The level's Lernsets and words, fetched once per page view. */
export function loadLevel(level) {
  const key = level.toLowerCase();
  if (!levelCache.has(key)) {
    levelCache.set(
      key,
      fetch(`/lehrkraefte/spiele/woerter-${key}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then((data) => {
          const units = data.units.map(([id, title]) => ({ id, title }));
          const words = data.words.map((row) => {
            const w = Object.fromEntries(WORD_FIELDS.map((f, i) => [f, row[i]]));
            w.unitId = units[w.unit].id;
            w.unitTitle = units[w.unit].title;
            // "der Tisch" for a noun, the bare lemma for everything else.
            w.display = w.pos === "noun" && w.gender ? `${w.gender} ${w.lemma}` : w.lemma;
            return w;
          });
          return { level: data.level, units, words };
        })
        .catch((err) => {
          levelCache.delete(key);
          throw err;
        }),
    );
  }
  return levelCache.get(key);
}

/* --------------------------------------------------------------- strings -- */

// The controls are server-rendered German with data-i18n keys; the few strings the script
// writes itself go through here, with the German as the fallback while a key is missing.
let dict = {};
loadDict(getLang()).then((d) => { dict = d; }).catch(() => {});
onLangChange((_, d) => { dict = d; });
export function tx(key, fallback, vars) {
  const s = dict[key] != null ? translate(dict, key, vars) : fallback;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ----------------------------------------------------------------- sheets -- */

/**
 * One printed A4 page. Every sheet carries the same footer: where it came from and the link
 * that regenerates it, so a photocopy found in a drawer a year later can still be reprinted.
 */
export function sheet(inner, { title, page, pages }) {
  const url = location.href.replace(/^https?:\/\//, "");
  return `<section class="sp-sheet">
    <div class="sp-sheet-body">${inner}</div>
    <footer class="sp-sheet-foot">
      <span><b>DeutschAcademy</b> · ${esc(title)} · ${page}/${pages}</span>
      <span class="sp-sheet-url">${esc(url)}</span>
    </footer>
  </section>`;
}

/** Splits a list into pages of `per`. */
export const chunk = (list, per) => Array.from({ length: Math.ceil(list.length / per) }, (_, i) => list.slice(i * per, i * per + per));

/* ------------------------------------------------------------------ state -- */

/**
 * Reads the form's settings from the URL, writes them back on every change, loads the
 * level, and calls `render(state, data)`. The form names its fields; `sets` is the Lernset
 * checkbox list this function builds.
 *
 * @param {HTMLElement} root  the page root with [data-sp-controls], [data-sp-sets],
 *   [data-sp-sheets], [data-sp-preview], [data-sp-status]
 * @param {{ defaults: Record<string,string>, render: (state: any, data: any) => { html: string, status?: string, error?: boolean } }} opts
 */
export function mountGenerator(root, { defaults, render }) {
  const form = root.querySelector("[data-sp-controls]");
  const setsBox = root.querySelector("[data-sp-sets]");
  const sheets = root.querySelector("[data-sp-sheets]");
  const preview = root.querySelector("[data-sp-preview]");
  const status = root.querySelector("[data-sp-status]");

  const params = new URLSearchParams(location.search);
  const state = { ...defaults, level: "A1", sets: "", seed: newSeed() };
  for (const k of Object.keys(state)) if (params.has(k)) state[k] = params.get(k);
  if (!["A1", "A2", "B1", "B2"].includes(state.level)) state.level = "A1";

  // The form shows the state it was opened with.
  for (const el of form.elements) {
    if (!el.name || el.name === "sets" || !(el.name in state)) continue;
    if (el.type === "radio" || el.type === "checkbox") el.checked = el.value === state[el.name];
    else el.value = state[el.name];
  }

  let data = null;
  let token = 0;

  // Commas stay commas: the footer prints this link for a human to type back in, and
  // "a1-01%2Ca1-02" is harder to read off paper than "a1-01,a1-02".
  const writeUrl = () => {
    const q = new URLSearchParams(state).toString().replace(/%2C/gi, ",");
    history.replaceState(null, "", `${location.pathname}?${q}`);
  };

  const fit = () => {
    // The sheets are real A4 (210 mm) on screen too, so the preview is exactly what prints;
    // `zoom` shrinks them to the column. zoom, not transform: it also shrinks the layout
    // box, so a phone gets no sideways scroll and no gap under the last sheet.
    const w = preview.clientWidth;
    const sheetPx = 794; // 210 mm at 96 dpi
    sheets.style.zoom = String(Math.min(1, (w - 2) / sheetPx));
  };

  const draw = () => {
    if (!data) return;
    const chosen = state.sets.split(",").filter(Boolean);
    const words = data.words.filter((w) => chosen.includes(w.unitId));
    // The URL first: every sheet's footer prints it, and it has to be the link that
    // reproduces these sheets, not the one the page was opened with.
    writeUrl();
    const out = render(state, { ...data, chosen, words });
    sheets.innerHTML = out.html;
    status.textContent = out.status ?? "";
    status.dataset.kind = out.error ? "error" : "";
    fit();
  };

  const buildSets = () => {
    const chosen = new Set(state.sets.split(",").filter(Boolean));
    // A level opened without a choice starts with its first Lernset, so the preview is
    // never empty on arrival.
    if (!data.units.some((u) => chosen.has(u.id))) {
      chosen.clear();
      chosen.add(data.units[0].id);
    }
    state.sets = [...chosen].join(",");
    const counts = new Map();
    for (const w of data.words) counts.set(w.unitId, (counts.get(w.unitId) ?? 0) + 1);
    setsBox.innerHTML = data.units
      .map(
        (u) => `<label class="sp-set"><input type="checkbox" name="sets" value="${esc(u.id)}"${chosen.has(u.id) ? " checked" : ""} />
          <span class="sp-set-name">${esc(u.title)}</span><span class="sp-set-n">${counts.get(u.id) ?? 0}</span></label>`,
      )
      .join("");
  };

  const loadAndDraw = async () => {
    const my = ++token;
    status.textContent = tx("sp.loading", "Wörter werden geladen …");
    try {
      const d = await loadLevel(state.level);
      if (my !== token) return;
      data = d;
      buildSets();
      draw();
    } catch {
      status.textContent = tx("sp.loadError", "Die Wörter konnten nicht geladen werden. Bitte lade die Seite neu.");
      status.dataset.kind = "error";
    }
  };

  form.addEventListener("change", (e) => {
    const el = e.target;
    if (!el.name) return;
    if (el.name === "sets") {
      state.sets = [...form.querySelectorAll('input[name="sets"]:checked')].map((c) => c.value).join(",");
      draw();
      return;
    }
    state[el.name] = el.value;
    if (el.name === "level") {
      state.sets = "";
      loadAndDraw();
    } else draw();
  });
  form.addEventListener("submit", (e) => e.preventDefault());
  root.querySelector("[data-sp-shuffle]")?.addEventListener("click", () => {
    state.seed = newSeed();
    draw();
  });
  root.querySelector("[data-sp-print]")?.addEventListener("click", () => window.print());
  root.querySelector("[data-sp-all]")?.addEventListener("click", () => {
    form.querySelectorAll('input[name="sets"]').forEach((c) => { c.checked = true; });
    state.sets = [...form.querySelectorAll('input[name="sets"]')].map((c) => c.value).join(",");
    draw();
  });
  root.querySelector("[data-sp-none]")?.addEventListener("click", () => {
    form.querySelectorAll('input[name="sets"]').forEach((c) => { c.checked = false; });
    state.sets = "";
    draw();
  });
  addEventListener("resize", fit);
  // Print at full size, whatever the preview zoom was.
  addEventListener("beforeprint", () => { sheets.style.zoom = "1"; });
  addEventListener("afterprint", fit);

  loadAndDraw();
}
