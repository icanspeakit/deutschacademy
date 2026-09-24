// "Wie oft hört man das?" — the Artikel-Trainer's second chart. The Lernkurve in the side
// column answers "how far along am I"; this one answers "is this word worth it": where the
// words of the current round sit on the real-life frequency curve, with the one on the card
// picked out and the rarest of the round named.
//
// Data: the same OpenSubtitles counts as the Lernkurve (src/data/artikel-haeufigkeit.json,
// see scripts/artikel-haeufigkeit.mjs). 1 621 nouns have a count; the rest of the A1–B2 pool
// is not in the 50 000-word list at all, which is its own statement — those sit in a
// separate "nicht in der Liste" lane to the right of the curve rather than on it.
//
// One series, so no legend: the title names it. Identity of the highlighted word is carried
// by its label, not by colour alone.

// Drawn at the container's real width, not scaled from a fixed viewBox: scaled, a 600-wide
// chart on a 330px phone card shrinks its 10px axis text to 5.5px. Geometry is recomputed
// on resize instead, so text stays its size and the plot takes whatever width there is.
const PAD = { l: 44, r: 4, t: 14, b: 30 };
const LANE = 64; // the "nicht in der Liste" lane on the right
let W = 600, H = 176, X0 = PAD.l, X1 = 0, LX0 = 0, Y0 = PAD.t, Y1 = 0;
function layout(width) {
  W = Math.max(280, Math.round(width));
  H = W < 480 ? 190 : 176;
  X1 = W - PAD.r - LANE - 10; // end of the ranked curve
  LX0 = W - PAD.r - LANE; // lane start
  Y1 = H - PAD.b;
}

import { t, onUiText } from "./uiText.js";
const tr = t;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const fmt = (n) => n.toLocaleString("de-DE");
// Band names in the UI language; `label` stays the German, for callers that want it.
const bandLabel = (b) => t(`afc.band.${b.key}`, b.label);

/** Plain-words band for a place in the order. The thresholds are where the Lernkurve's
 *  phases already cut it (Woche 1 ≈ the first 125, Monat 3 ends at 1 621). */
export function band(q, total) {
  if (!q.freqPos) return { key: "raritaet", label: "Rarität" };
  if (q.freqPos <= 200) return { key: "sehr-oft", label: "sehr häufig" };
  if (q.freqPos <= 600) return { key: "oft", label: "häufig" };
  if (q.freqPos <= 1200) return { key: "mittel", label: "gelegentlich" };
  return { key: "selten", label: "selten" };
}

export function mountFreqChart(root, { curve, total, maxCount, minCount }) {
  const ly = (c) => {
    const a = Math.log10(minCount), b = Math.log10(maxCount);
    return Y1 - ((Math.log10(c) - a) / (b - a)) * (Y1 - Y0);
  };
  const rx = (pos) => X0 + ((pos - 1) / (total - 1)) * (X1 - X0);

  const svg = root.querySelector("svg");
  const head = root.querySelector("[data-freq-head]");
  const list = root.querySelector("[data-freq-list]");
  const tip = root.querySelector("[data-freq-tip]");

  // Static layer: grid, axes, the curve, the lane. Redrawn when the width changes.
  function drawStatic() {
  layout(svg.parentElement.clientWidth || 600);
  const ticks = [100000, 10000, 1000, 100].filter((t) => t <= maxCount && t >= minCount);
  const line = curve.map(([p, c], i) => `${i ? "L" : "M"}${rx(p).toFixed(1)},${ly(c).toFixed(1)}`).join("");
  const area = `${line}L${rx(total).toFixed(1)},${Y1}L${X0},${Y1}Z`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <g class="afc-grid">
      ${ticks.map((t) => `<line x1="${X0}" x2="${X1}" y1="${ly(t)}" y2="${ly(t)}"/>`).join("")}
    </g>
    <g class="afc-axis">
      ${ticks.map((t) => `<text x="${X0 - 6}" y="${ly(t) + 3}" text-anchor="end">${t >= 1000 ? t / 1000 + " " + tr("afc.thousand", "Tsd.") : t}</text>`).join("")}
      <text x="${X0}" y="${H - 8}">Platz 1</text>
      <text x="${X1}" y="${H - 8}" text-anchor="end">Platz ${fmt(total)}</text>
      <text x="${LX0 + LANE / 2}" y="${H - 8}" text-anchor="middle">nicht gezählt</text>
    </g>
    <rect class="afc-lane" x="${LX0}" y="${Y0}" width="${LANE}" height="${Y1 - Y0}" rx="6"/>
    <path class="afc-area" d="${area}"/>
    <path class="afc-line" d="${line}"/>
    <g class="afc-dots"></g>
    <g class="afc-labels"></g>`;
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  dotsG = svg.querySelector(".afc-dots");
  labelsG = svg.querySelector(".afc-labels");
  wireDots();
  }
  let dotsG, labelsG;

  let questions = [];
  let currentId = null;

  // Unranked words have no count to place them by; they stack in the lane in a stable
  // order so a word does not jump around between renders.
  function place(q, laneIndex, laneCount) {
    if (q.freqPos) return { x: rx(q.freqPos), y: ly(q.freq) };
    const rows = Math.max(1, Math.ceil(laneCount / 3));
    const col = laneIndex % 3, row = Math.floor(laneIndex / 3);
    return {
      x: LX0 + 14 + col * ((LANE - 28) / 2),
      y: Y1 - 12 - row * Math.min(14, (Y1 - Y0 - 24) / rows),
    };
  }

  function draw() {
    const laneQs = questions.filter((q) => !q.freqPos);
    const pts = questions.map((q) => ({ q, ...place(q, laneQs.indexOf(q), laneQs.length) }));
    const cur = pts.find((p) => p.q.id === currentId);
    // The rarest of the round: an unranked word if there is one, else the lowest count.
    const rarest = [...pts].sort((a, b) => (a.q.freq ?? 0) - (b.q.freq ?? 0) || (b.q.freqPos ?? 1e9) - (a.q.freqPos ?? 1e9))[0];

    dotsG.innerHTML = pts
      .map((p) => {
        const on = p === cur;
        return `<g class="afc-dot${on ? " is-current" : ""}${p === rarest ? " is-rare" : ""}" data-id="${esc(p.q.id)}" tabindex="0" role="img"
          aria-label="${esc(word(p.q))}: ${esc(bandText(p.q))}">
          <circle class="afc-hit" cx="${p.x}" cy="${p.y}" r="11"/>
          <circle class="afc-mark" cx="${p.x}" cy="${p.y}" r="${on ? 6 : 4}"/>
        </g>`;
      })
      .join("");
    // The current word on top, so its ring is never under a neighbour.
    const curEl = dotsG.querySelector(".is-current");
    if (curEl) dotsG.appendChild(curEl);

    // Two labels at most: the word on the card, and the round's rarity if it is a
    // different word. Everything else is on hover and in the list below.
    const labels = [];
    if (cur) labels.push({ p: cur, text: word(cur.q), cls: "is-current" });
    // A lane word has no count to rank it by, so it is not "the rarest" — it is one of the
    // words too rare to be counted at all. Say that.
    if (rarest && rarest !== cur) labels.push({ p: rarest, text: `${rarest.q.freqPos ? t("afc.rarest", "seltenstes") : t("afc.band.raritaet", "Rarität")}: ${word(rarest.q)}`, cls: "is-rare" });
    labelsG.innerHTML = labels
      .map(({ p, text, cls }, i) => {
        // Lane words label to the left of the lane, above the curve's tail, not across it.
        const right = p.x > W * 0.62;
        const dy = i === 1 && cur && Math.abs(cur.y - p.y) < 16 && Math.abs(cur.x - p.x) < 140 ? 16 : 0;
        return `<text class="afc-label ${cls}" x="${p.x + (right ? -10 : 10)}" y="${p.y - 9 + dy}" text-anchor="${right ? "end" : "start"}">${esc(text)}</text>`;
      })
      .join("");

    head.innerHTML = cur ? headFor(cur.q) : roundSummary();
    list.innerHTML = [...questions]
      .sort((a, b) => (a.freqPos ?? 1e9) - (b.freqPos ?? 1e9))
      .map((q) => `<li class="${q.id === currentId ? "is-current" : ""}"><span>${esc(word(q))}</span><span>${esc(bandText(q))}</span></li>`)
      .join("");
  }

  const word = (q) => q.lemma;
  function bandText(q) {
    const b = band(q, total);
    return q.freqPos
      ? t("afc.place", "Platz {n} · {band}", { n: fmt(q.freqPos), band: bandLabel(b) })
      : t("afc.unranked", "nicht unter den häufigsten · Rarität");
  }
  function headFor(q) {
    const b = band(q, total);
    if (!q.freqPos) {
      return t("afc.head.rare", "<b>{word}</b> ist nicht unter den {total} häufigsten Nomen — eine <b>Rarität</b>. Gut zu kennen, aber kein Wort für die erste Woche.", { word: esc(q.lemma), total: fmt(total) });
    }
    const top = Math.max(1, Math.round((q.freqPos / total) * 100));
    const vars = { word: esc(q.lemma), n: fmt(q.freqPos), total: fmt(total), band: bandLabel(b), top };
    return top <= 50
      ? t("afc.head.top", "<b>{word}</b> steht auf Platz <b>{n}</b> von {total} — {band}, unter den ersten {top} %.", vars)
      : t("afc.head", "<b>{word}</b> steht auf Platz <b>{n}</b> von {total} — {band}.", vars);
  }
  function roundSummary() {
    const counts = { oft: 0, mittel: 0, selten: 0 };
    for (const q of questions) {
      const k = band(q, total).key;
      if (k === "sehr-oft" || k === "oft") counts.oft++;
      else if (k === "mittel") counts.mittel++;
      else counts.selten++;
    }
    return t("afc.summary", "Diese Übung: <b>{oft}</b> häufige, <b>{mittel}</b> gelegentliche und <b>{selten}</b> seltene Wörter.", counts);
  }

  // Tooltip: hover on a pointer, tap on a phone, focus from the keyboard.
  function showTip(g) {
    const q = questions.find((x) => x.id === g.dataset.id);
    if (!q) return;
    const c = g.querySelector(".afc-mark");
    const box = svg.getBoundingClientRect();
    const k = box.width / W || 1;
    tip.innerHTML = `<b>${esc(word(q))}</b><span>${esc(bandText(q))}</span>${q.freq ? `<span>${esc(t("afc.corpus", "{n}× im Korpus", { n: fmt(q.freq) }))}</span>` : ""}`;
    tip.hidden = false;
    const x = Number(c.getAttribute("cx")) * k, y = Number(c.getAttribute("cy")) * k;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(0, x - tw / 2), box.width - tw)}px`;
    tip.style.top = `${y - tip.offsetHeight - 12}px`;
  }
  const hideTip = () => { tip.hidden = true; };
  function wireDots() {
    dotsG.addEventListener("pointerover", (e) => { const g = e.target.closest(".afc-dot"); if (g) showTip(g); });
    dotsG.addEventListener("pointerout", (e) => { if (!e.relatedTarget?.closest?.(".afc-dot")) hideTip(); });
    dotsG.addEventListener("click", (e) => { const g = e.target.closest(".afc-dot"); if (g) showTip(g); });
    dotsG.addEventListener("focusin", (e) => { const g = e.target.closest(".afc-dot"); if (g) showTip(g); });
    dotsG.addEventListener("focusout", hideTip);
  }
  addEventListener("scroll", hideTip, { passive: true });

  drawStatic();
  let lastW = W;
  new ResizeObserver(() => {
    const w = svg.parentElement.clientWidth;
    if (!w || Math.abs(w - lastW) < 2) return;
    drawStatic();
    lastW = W;
    draw();
  }).observe(svg.parentElement);

  // The words are the UI language's: redraw on a switch.
  onUiText(() => { drawStatic(); if (questions.length) draw(); });

  return {
    setRound(qs) { questions = qs; currentId = null; draw(); },
    setCurrent(id) { if (id === currentId) return; currentId = id; draw(); },
  };
}
