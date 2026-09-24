// Wörter erklären: speaking cards, Tabu-style. One student explains the word on the card,
// the group guesses, and the word itself may not be said.
//
// "Verbotene Wörter" only when there are real ones. A random word from the same Lernset is
// not forbidden for any reason — "Name" with "Hose" and "Bahnhof" teaches nothing — so a
// word counts as related only if one contains the other (Zimmer → Schlafzimmer, Reise →
// reisen, Mieter → Vermieter) or both are built on a third word of the Lernset (Vorname ↔
// Nachname, both on Name). Those are exactly the words a student reaches for first when
// explaining. Words from the example sentence were tried and dropped: "Kollegin" forbidding
// "Urlaub" only because the example mentions a holiday is noise. With no related word the
// card shows the rule line instead, which is honest about what the card is.
import { chunk, esc, rng, sheet, shuffle, tx } from "./common.js";

const norm = (s) => s.toLowerCase().replace(/[^a-zäöüß]/g, "");

/** Up to three words of the same Lernset that are genuinely tied to `w`. */
export function relatedWords(w, sameUnit) {
  const lemma = norm(w.lemma);
  // Lernset words that are part of this one: the shared stems a sibling compound can have.
  const parts = sameUnit.map((o) => norm(o.lemma)).filter((p) => p.length >= 4 && p !== lemma && lemma.includes(p));
  const out = [];
  for (const o of sameUnit) {
    if (o === w || out.length >= 3) continue;
    const other = norm(o.lemma);
    if (other.length < 4 || other === lemma) continue;
    const compound = lemma.length >= 4 && (other.includes(lemma) || lemma.includes(other));
    const sibling = parts.some((p) => p !== other && other.includes(p));
    if (compound || sibling) out.push(o.display);
  }
  return out;
}

export function buildCards(words, { count, seed }) {
  const byUnit = new Map();
  for (const w of words) {
    if (!byUnit.has(w.unitId)) byUnit.set(w.unitId, []);
    byUnit.get(w.unitId).push(w);
  }
  const rand = rng(`erklaeren:${seed}`);
  const pick = shuffle(words, rand).slice(0, count);
  return pick.map((w) => {
    const forbidden = relatedWords(w, byUnit.get(w.unitId));
    return { word: w, forbidden };
  });
}

export function renderErklaeren(state, data) {
  const count = Math.max(8, Math.min(96, Number(state.count) || 32));
  if (!data.words.length) return { html: "", status: tx("sp.pickSet", "Wähle mindestens ein Lernset."), error: true };
  const cards = buildCards(data.words, { count, seed: state.seed });
  const pages = chunk(cards, 8);
  const title = "Wörter erklären";
  const cardHtml = ({ word, forbidden }) => `<div class="sp-card">
      <div class="sp-card-meta"><span>${esc(word.unitTitle)}</span><span>${esc(data.level)}</span></div>
      <div class="sp-card-word">${esc(word.display)}</div>
      ${
        forbidden.length
          ? `<div class="sp-card-forbid"><span class="sp-card-forbid-h">Nicht sagen:</span>${forbidden.map((f) => `<span>${esc(f)}</span>`).join("")}</div>`
          : `<div class="sp-card-rule">Erklär das Wort, ohne es zu sagen — 60 Sekunden.</div>`
      }
    </div>`;
  const html = pages.map((list, i) => sheet(`<div class="sp-card-grid">${list.map(cardHtml).join("")}</div>`, { title, page: i + 1, pages: pages.length })).join("");
  const withForbidden = cards.filter((c) => c.forbidden.length).length;
  return {
    html,
    status:
      pages.length === 1
        ? tx("sp.erklaeren.ok1", "{n} Karten auf einer Seite, {f} davon mit verbotenen Wörtern.", { n: cards.length, f: withForbidden })
        : tx("sp.erklaeren.ok", "{n} Karten auf {pages} Seiten, {f} davon mit verbotenen Wörtern.", { n: cards.length, pages: pages.length, f: withForbidden }),
  };
}
