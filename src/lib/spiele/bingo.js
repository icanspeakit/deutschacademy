// Bingo: N different cards from the chosen Lernsets, plus the caller's list.
//
// The teacher calls a word — in German, or its meaning in the class's language, which turns
// it into a listening-and-understanding game — and the students cross it off. Every card is
// a different SET of words, not just a different order: two cards with the same words would
// win on the same call.
import { chunk, esc, MEANING_LANGS, rng, sheet, shuffle, tx } from "./common.js";

/**
 * @param {Array<{display: string}>} words  the chosen Lernsets' words
 * @param {{ n: number, size: 4|5, seed: string }} opts
 * @returns {{ cards: object[][], pool: object[], cells: number, error?: string }}
 */
export function buildBingo(words, { n, size, seed }) {
  // A free centre on 5×5 only: 4×4 has no centre.
  const cells = size === 5 ? 24 : 16;
  const seen = new Set();
  const pool = words.filter((w) => !seen.has(w.display) && seen.add(w.display));
  if (pool.length < cells) return { cards: [], pool, cells, error: "few" };

  const rand = rng(`bingo:${seed}`);
  const cards = [];
  const keys = new Set();
  // Rejection sampling. With a pool only a little larger than a card there are only a few
  // distinct sets (25 words, 24 cells: 25 cards), so it gives up after enough misses and
  // reports how many it found instead of looping.
  let misses = 0;
  while (cards.length < n && misses < 400) {
    const pick = shuffle(pool, rand).slice(0, cells);
    const key = pick.map((w) => w.display).sort().join("|");
    if (keys.has(key)) { misses++; continue; }
    keys.add(key);
    cards.push(pick);
  }
  return { cards, pool, cells };
}

function cardHtml(card, size, i, total, label) {
  const cellsHtml = [];
  let k = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const centre = size === 5 && r === 2 && c === 2;
      cellsHtml.push(
        centre
          ? `<div class="sp-bingo-cell sp-bingo-free">FREI</div>`
          : `<div class="sp-bingo-cell">${esc(card[k++].display)}</div>`,
      );
    }
  }
  return `<div class="sp-bingo-card">
    <div class="sp-bingo-head"><b>BINGO</b><span>${esc(label)}</span><span>Karte ${i}/${total}</span></div>
    <div class="sp-bingo-grid sp-bingo-grid--${size}">${cellsHtml.join("")}</div>
    <div class="sp-bingo-name">Name: ____________________</div>
  </div>`;
}

/** The whole print run: two cards per A4 page, then the caller's list. */
export function renderBingo(state, data) {
  const n = Math.max(1, Math.min(60, Number(state.n) || 30));
  const size = state.size === "4" ? 4 : 5;
  const lang = MEANING_LANGS[state.lang] ? state.lang : "en";
  if (!data.words.length) return { html: "", status: tx("sp.pickSet", "Wähle mindestens ein Lernset."), error: true };

  const { cards, pool, cells, error } = buildBingo(data.words, { n, size, seed: state.seed });
  if (error) {
    return {
      html: "",
      error: true,
      status: tx("sp.bingo.few", "Zu wenige Wörter: eine Karte braucht {cells}, die Auswahl hat {n}. Wähle ein Lernset mehr.", { cells, n: pool.length }),
    };
  }

  const label = `${data.level} · ${data.units.filter((u) => data.chosen.includes(u.id)).map((u) => u.title).join(", ")}`;
  const cardPages = chunk(cards, 2);
  // The caller list holds every word that is on at least one card, alphabetically, with a
  // box to tick when it has been called.
  const used = new Map();
  for (const card of cards) for (const w of card) used.set(w.display, w);
  const called = [...used.values()].sort((a, b) => a.lemma.localeCompare(b.lemma, "de"));
  const callerPages = chunk(called, 40);
  const pages = cardPages.length + callerPages.length;
  const title = "Bingo";

  let page = 0;
  const html = [
    ...cardPages.map((pair) =>
      sheet(
        `<div class="sp-bingo-pair">${pair.map((card) => cardHtml(card, size, cards.indexOf(card) + 1, cards.length, label)).join("")}</div>`,
        { title, page: ++page, pages },
      ),
    ),
    ...callerPages.map((list, pi) =>
      sheet(
        `<h2 class="sp-sheet-h">Rufliste${callerPages.length > 1 ? ` (${pi + 1}/${callerPages.length})` : ""}</h2>
         <p class="sp-sheet-sub">${esc(label)} · ${called.length} Wörter · ${esc(MEANING_LANGS[lang].label)}</p>
         <table class="sp-caller">
           <thead><tr><th></th><th>Deutsch</th><th>${esc(MEANING_LANGS[lang].label)}</th></tr></thead>
           <tbody>${list
             .map(
               (w) => `<tr><td class="sp-tick">☐</td><td>${esc(w.display)}</td><td${MEANING_LANGS[lang].rtl ? ' dir="rtl" lang="ar"' : ""}>${esc(w[lang] || "—")}</td></tr>`,
             )
             .join("")}</tbody>
         </table>`,
        { title, page: ++page, pages },
      ),
    ),
  ].join("");

  const short = cards.length < n;
  return {
    html,
    error: short,
    status: short
      ? tx("sp.bingo.short", "Mit diesen Wörtern gibt es nur {got} verschiedene Karten (gewünscht: {n}). Wähle mehr Lernsets für mehr Karten.", { got: cards.length, n })
      : tx("sp.bingo.ok", "{cards} Karten, {pages} Seiten. Alle Karten sind verschieden.", { cards: cards.length, pages }),
  };
}
