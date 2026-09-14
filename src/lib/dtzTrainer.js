// DTZ trainer: nine exam parts, 45 scored items, plus the two writing tasks.
//
// The part shapes and the scoring model are ported from the DTZ trainer in the
// Pflegeplace project (src/lib/dtz/{render,scoring,state}.ts) — same nine task
// types, same id ranges, same GER bands — but rewritten against this project's
// plain-JS + design-token style instead of its TS + Tailwind one, and driven by
// JSON in src/data/pruefungen/dtz/ rather than TS modules.
//
// The content is *not* ported: the Übungssätze here are our own, written to the
// official format. See that folder's files for their own source notes.

const STORAGE_PREFIX = "da-dtz-v1:";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ------------------------------------------------------------------ state -- */

function freshState() {
  return { answers: {}, schreiben: { task: null, text: "", selfRate: null } };
}

function loadState(id) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.answers) return { ...freshState(), ...parsed };
  } catch {
    /* private mode or corrupt entry — start fresh */
  }
  return freshState();
}

function saveState(id, state) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(state));
  } catch {
    /* quota or private mode — the session still works, it just won't persist */
  }
}

/* ---------------------------------------------------------------- scoring -- */

/** Every part carries its scored ids under one of three keys. */
export function qidsOfPart(part) {
  if (part.items) return part.items.map((i) => i.id);
  if (part.groups) return part.groups.flatMap((g) => g.questions.map((q) => q.id));
  if (part.texts) return part.texts.flatMap((t) => t.questions.map((q) => q.id));
  return [];
}

export function allQids(data) {
  return data.parts.flatMap(qidsOfPart);
}

/**
 * Official DTZ "Hören und Lesen" bands: the two skills are scored together out of
 * 45, and the total decides which level the certificate states.
 */
export function stufeFor(score) {
  if (score >= 33) return { stufe: "Stufe B1", cls: "is-b1" };
  if (score >= 20) return { stufe: "Stufe A2", cls: "is-a2" };
  return { stufe: "unter A2", cls: "is-low" };
}

export function wordCount(s) {
  const t = (s || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/* --------------------------------------------------------------- renderers -- */

function optionRow(qid, options, given, solved, correctIdx) {
  return options
    .map((opt, i) => {
      const picked = given === String(i);
      let cls = "";
      if (solved) {
        if (i === correctIdx) cls = "is-solved";
        else if (picked) cls = "is-wrongpick";
      } else if (picked) cls = "is-selected";
      return `<button type="button" class="dtz-opt ${cls}" data-q="${qid}" data-v="${i}" ${solved ? "disabled" : ""}><strong>${"abc"[i]}</strong>${escapeHtml(opt)}</button>`;
    })
    .join("");
}

function tfRow(qid, given, solved, correct) {
  return ["richtig", "falsch"]
    .map((v) => {
      const picked = given === v;
      let cls = "";
      if (solved) {
        if (v === correct) cls = "is-solved";
        else if (picked) cls = "is-wrongpick";
      } else if (picked) cls = "is-selected";
      return `<button type="button" class="dtz-opt dtz-opt--tf ${cls}" data-q="${qid}" data-v="${v}" ${solved ? "disabled" : ""}>${v}</button>`;
    })
    .join("");
}

function transcriptBlock(text, label) {
  return `<details class="dtz-transcript"><summary>${label || "Hörtext lesen"}</summary><p>${escapeHtml(text)}</p></details>`;
}

function renderMcAudio(part, state, solved) {
  const ex = part.example
    ? `<div class="dtz-example">
         <span class="badge badge-neutral">Beispiel</span>
         ${transcriptBlock(part.example.transcript)}
         <p class="dtz-q">${escapeHtml(part.example.question)}</p>
         <div class="dtz-opts">${part.example.options.map((o, i) => `<span class="dtz-opt ${i === part.example.correct ? "is-solved" : ""}"><strong>${"abc"[i]}</strong>${escapeHtml(o)}</span>`).join("")}</div>
       </div>`
    : "";
  const items = part.items
    .map((it) => {
      const a = state.answers[it.id];
      return `<div class="dtz-item">
        <div class="dtz-item-head"><span class="dtz-num">${it.id}</span>${transcriptBlock(it.transcript)}</div>
        <p class="dtz-q">${escapeHtml(it.question)}</p>
        <div class="dtz-opts">${optionRow(it.id, it.options, a?.given, solved, it.correct)}</div>
      </div>`;
    })
    .join("");
  return ex + items;
}

function renderDialog(part, state, solved) {
  return part.groups
    .map((g, gi) => {
      const lines = g.dialog.map(([who, said]) => `<p><strong>${escapeHtml(who)}:</strong> ${escapeHtml(said)}</p>`).join("");
      const qs = g.questions
        .map((q) => {
          const a = state.answers[q.id];
          const body =
            q.type === "tf"
              ? tfRow(q.id, a?.given, solved, q.correct)
              : optionRow(q.id, q.options, a?.given, solved, q.correct);
          return `<div class="dtz-item">
            <p class="dtz-q"><span class="dtz-num">${q.id}</span>${escapeHtml(q.question)}</p>
            <div class="dtz-opts ${q.type === "tf" ? "dtz-opts--tf" : ""}">${body}</div>
          </div>`;
        })
        .join("");
      return `<div class="dtz-group">
        <details class="dtz-transcript" ${gi === 0 ? "open" : ""}><summary>Gespräch ${gi + 1} lesen</summary>${lines}</details>
        ${qs}
      </div>`;
    })
    .join("");
}

function renderStatementMatch(part, state, solved) {
  const keys = Object.keys(part.statements);
  const list = keys
    .map((k) => `<li><strong>${k}</strong> ${escapeHtml(part.statements[k])}</li>`)
    .join("");
  const ex = part.example
    ? `<div class="dtz-example">
         <span class="badge badge-neutral">Beispiel</span>
         ${transcriptBlock(part.example.transcript)}
         <p class="dtz-q">Lösung: <strong>${part.example.answer}</strong></p>
       </div>`
    : "";
  const items = part.items
    .map((it) => {
      const a = state.answers[it.id];
      const opts = keys
        .map((k) => {
          const picked = a?.given === k;
          let cls = "";
          if (solved) {
            if (k === it.correct) cls = "is-solved";
            else if (picked) cls = "is-wrongpick";
          } else if (picked) cls = "is-selected";
          return `<button type="button" class="dtz-opt dtz-opt--letter ${cls}" data-q="${it.id}" data-v="${k}" ${solved ? "disabled" : ""}>${k}</button>`;
        })
        .join("");
      return `<div class="dtz-item">
        <div class="dtz-item-head"><span class="dtz-num">${it.id}</span>${transcriptBlock(it.transcript, "Was die Person sagt")}</div>
        <div class="dtz-opts dtz-opts--letters">${opts}</div>
      </div>`;
    })
    .join("");
  return `<div class="dtz-statements"><ul>${list}</ul></div>${ex}${items}`;
}

function renderToc(part, state, solved) {
  const toc = part.toc
    .map((t) => `<li><strong>${t.label ?? `Kapitel ${t.n}`} — ${escapeHtml(t.title)}</strong><span>${escapeHtml(t.desc)}</span></li>`)
    .join("");
  const ex = part.example
    ? `<div class="dtz-example"><span class="badge badge-neutral">Beispiel</span><p class="dtz-q">${escapeHtml(part.example.question)}</p>
         <div class="dtz-opts">${part.example.options.map((o, i) => `<span class="dtz-opt ${i === part.example.correct ? "is-solved" : ""}"><strong>${"abc"[i]}</strong>${escapeHtml(o)}</span>`).join("")}</div></div>`
    : "";
  const items = part.items
    .map((it) => {
      const a = state.answers[it.id];
      return `<div class="dtz-item">
        <p class="dtz-q"><span class="dtz-num">${it.id}</span>${escapeHtml(it.question)}</p>
        <div class="dtz-opts">${optionRow(it.id, it.options, a?.given, solved, it.correct)}</div>
      </div>`;
    })
    .join("");
  return `<div class="dtz-toc"><p class="dtz-toc-head">${escapeHtml(part.tocHeading)}</p><ol>${toc}</ol></div>${ex}${items}`;
}

function renderAds(part, state, solved) {
  const keys = Object.keys(part.ads);
  const ads = keys
    .map((k) => `<div class="dtz-ad"><span class="dtz-ad-key">${k}</span><strong>${escapeHtml(part.ads[k].title)}</strong><p>${escapeHtml(part.ads[k].body)}</p></div>`)
    .join("");
  // "x" = no matching ad. The real exam always includes one such situation.
  const choices = [...keys, "x"];
  const items = part.items
    .map((it) => {
      const a = state.answers[it.id];
      const opts = choices
        .map((k) => {
          const picked = a?.given === k;
          let cls = "";
          if (solved) {
            if (k === it.correct) cls = "is-solved";
            else if (picked) cls = "is-wrongpick";
          } else if (picked) cls = "is-selected";
          return `<button type="button" class="dtz-opt dtz-opt--letter ${cls}" data-q="${it.id}" data-v="${k}" ${solved ? "disabled" : ""}>${k === "x" ? "keine" : k}</button>`;
        })
        .join("");
      return `<div class="dtz-item">
        <p class="dtz-q"><span class="dtz-num">${it.id}</span>${escapeHtml(it.question)}</p>
        <div class="dtz-opts dtz-opts--letters">${opts}</div>
      </div>`;
    })
    .join("");
  return `<div class="dtz-ads">${ads}</div>${items}`;
}

function renderTexts(part, state, solved) {
  return part.texts
    .map((t) => {
      const paras = t.paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      const qs = t.questions
        .map((q) => {
          const a = state.answers[q.id];
          const body =
            q.type === "tf"
              ? tfRow(q.id, a?.given, solved, q.correct)
              : optionRow(q.id, q.options, a?.given, solved, q.correct);
          return `<div class="dtz-item">
            <p class="dtz-q"><span class="dtz-num">${q.id}</span>${escapeHtml(q.question)}</p>
            <div class="dtz-opts ${q.type === "tf" ? "dtz-opts--tf" : ""}">${body}</div>
          </div>`;
        })
        .join("");
      return `<div class="dtz-group">
        <div class="dtz-reading ${t.letter ? "dtz-reading--letter" : ""}"><h4>${escapeHtml(t.title)}</h4>${paras}</div>
        ${qs}
      </div>`;
    })
    .join("");
}

function renderRegulative(part, state, solved) {
  const paras = part.paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  const items = part.items
    .map((it) => {
      const a = state.answers[it.id];
      return `<div class="dtz-item">
        <p class="dtz-q"><span class="dtz-num">${it.id}</span>${escapeHtml(it.question)}</p>
        <div class="dtz-opts dtz-opts--tf">${tfRow(it.id, a?.given, solved, it.correct)}</div>
      </div>`;
    })
    .join("");
  return `<div class="dtz-reading"><h4>${escapeHtml(part.readingTitle)}</h4>${paras}</div>${items}`;
}

function renderLetterGaps(part, state, solved) {
  const text = part.letterSegments
    .map((seg) => {
      if (seg.text !== undefined) return escapeHtml(seg.text);
      const item = part.items[seg.blank];
      const a = state.answers[item.id];
      const filled = a?.given != null ? item.options[+a.given] : null;
      let cls = "";
      if (solved) cls = +a?.given === item.correct ? "is-correct" : "is-wrong";
      else if (filled) cls = "is-filled";
      return `<span class="dtz-gap ${cls}">${filled ? escapeHtml(filled) : `___ ${item.id} ___`}</span>`;
    })
    .join("");
  const items = part.items
    .map((it) => {
      const a = state.answers[it.id];
      return `<div class="dtz-item dtz-item--inline">
        <span class="dtz-num">${it.id}</span>
        <div class="dtz-opts">${optionRow(it.id, it.options, a?.given, solved, it.correct)}</div>
      </div>`;
    })
    .join("");
  const intro = part.letterIntro ? `<p class="dtz-q">${escapeHtml(part.letterIntro)}</p>` : "";
  return `${intro}<div class="dtz-reading dtz-reading--letter dtz-letter">${text}</div>${items}`;
}

const RENDERERS = {
  "mc-audio": renderMcAudio,
  dialog: renderDialog,
  "statement-match": renderStatementMatch,
  toc: renderToc,
  ads: renderAds,
  texts: renderTexts,
  regulative: renderRegulative,
  "letter-gaps": renderLetterGaps,
};

/** Correct answer of a question id, in the string form the state stores. */
function correctValue(data, qid) {
  for (const part of data.parts) {
    if (part.items) {
      const it = part.items.find((i) => i.id === qid);
      if (it) return typeof it.correct === "number" ? String(it.correct) : it.correct;
    }
    for (const g of part.groups ?? []) {
      const q = g.questions.find((q) => q.id === qid);
      if (q) return typeof q.correct === "number" ? String(q.correct) : q.correct;
    }
    for (const t of part.texts ?? []) {
      const q = t.questions.find((q) => q.id === qid);
      if (q) return typeof q.correct === "number" ? String(q.correct) : q.correct;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ mount -- */

export function mountDtzTrainer(root, data, { onAnswer } = {}) {
  const state = loadState(data.id);
  const ids = allQids(data);
  const hoerenIds = ids.filter((i) => i <= 20);
  const lesenIds = ids.filter((i) => i > 20);
  let current = 0; // index into data.parts; data.parts.length === the Schreiben tab
  let solved = false;

  const nav = root.querySelector("[data-dtz-nav]");
  const body = root.querySelector("[data-dtz-body]");
  const summary = root.querySelector("[data-dtz-summary]");

  function answeredCount(list) {
    return list.filter((id) => state.answers[id]).length;
  }
  function correctCount(list) {
    return list.filter((id) => state.answers[id]?.correct).length;
  }

  function renderNav() {
    const tabs = data.parts.map((p, i) => {
      const pids = qidsOfPart(p);
      const done = answeredCount(pids);
      return `<button type="button" class="dtz-tab ${i === current ? "is-active" : ""} ${done === pids.length ? "is-done" : ""}" data-tab="${i}">
        <span class="dtz-tab-label">${escapeHtml(p.label)}</span>
        <span class="dtz-tab-count">${done}/${pids.length}</span>
      </button>`;
    });
    tabs.push(`<button type="button" class="dtz-tab ${current === data.parts.length ? "is-active" : ""}" data-tab="${data.parts.length}">
      <span class="dtz-tab-label">Schreiben</span>
      <span class="dtz-tab-count">${state.schreiben.task ? "1/1" : "0/1"}</span>
    </button>`);
    nav.innerHTML = tabs.join("");
    nav.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        current = +b.dataset.tab;
        render();
        body.scrollIntoView({ block: "start", behavior: "smooth" });
      })
    );
  }

  function renderSchreiben() {
    const s = data.schreiben;
    const chosen = state.schreiben.task;
    const task = chosen === "A" ? s.taskA : chosen === "B" ? s.taskB : null;
    const wc = wordCount(state.schreiben.text);
    const picker = ["A", "B"]
      .map((k) => {
        const t = k === "A" ? s.taskA : s.taskB;
        return `<button type="button" class="dtz-opt ${chosen === k ? "is-selected" : ""}" data-task="${k}"><strong>${k}</strong>${escapeHtml(t.prompt.slice(0, 70))}…</button>`;
      })
      .join("");
    return `
      <p class="dtz-instruction">${escapeHtml(s.instruction)}</p>
      <div class="dtz-opts dtz-opts--tasks">${picker}</div>
      ${
        task
          ? `<div class="dtz-reading"><h4>${escapeHtml(task.label)}</h4><p>${escapeHtml(task.prompt)}</p>
               <ul class="dtz-points">${task.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul></div>
             <textarea class="dtz-textarea" data-schreiben placeholder="Schreiben Sie hier…">${escapeHtml(state.schreiben.text)}</textarea>
             <div class="dtz-wordcount ${wc >= 40 ? "is-ok" : ""}">${wc} Wörter${wc < 40 ? " — Ziel: etwa 40" : " ✓"}</div>
             <p class="dtz-note">${escapeHtml(s.selfRateNote)}</p>`
          : ""
      }`;
  }

  function renderBody() {
    if (current === data.parts.length) {
      body.innerHTML = `<div class="dtz-part"><h3>Schreiben</h3>${renderSchreiben()}</div>`;
      body.querySelectorAll("[data-task]").forEach((b) =>
        b.addEventListener("click", () => {
          state.schreiben.task = b.dataset.task;
          persist();
          render();
        })
      );
      const ta = body.querySelector("[data-schreiben]");
      ta?.addEventListener("input", (e) => {
        state.schreiben.text = e.target.value;
        // Live word count without re-rendering the textarea (that would eat the caret).
        const el = body.querySelector(".dtz-wordcount");
        const n = wordCount(e.target.value);
        if (el) {
          el.textContent = `${n} Wörter${n < 40 ? " — Ziel: etwa 40" : " ✓"}`;
          el.classList.toggle("is-ok", n >= 40);
        }
        persist();
      });
      return;
    }

    const part = data.parts[current];
    const renderPart = RENDERERS[part.type];
    body.innerHTML = `<div class="dtz-part">
      <div class="dtz-part-head">
        <span class="badge badge-info">${escapeHtml(part.group)}</span>
        <h3>${escapeHtml(part.title)}</h3>
      </div>
      <p class="dtz-instruction">${escapeHtml(part.instruction)}</p>
      ${renderPart ? renderPart(part, state, solved) : ""}
    </div>`;

    body.querySelectorAll("[data-q]").forEach((b) =>
      b.addEventListener("click", () => {
        const qid = +b.dataset.q;
        const given = b.dataset.v;
        state.answers[qid] = { given, correct: given === correctValue(data, qid) };
        persist();
        if (onAnswer) onAnswer(state.answers[qid].correct);
        renderBody();
        renderNav();
        renderSummary();
      })
    );
  }

  function renderSummary() {
    const hAns = answeredCount(hoerenIds);
    const lAns = answeredCount(lesenIds);
    const total = ids.length;
    const answered = hAns + lAns;

    if (!solved) {
      summary.innerHTML = `
        <div class="dtz-progress">
          <div class="dtz-progress-bar"><span style="width:${(answered / total) * 100}%"></span></div>
          <span class="dtz-progress-label">${answered} von ${total} Aufgaben bearbeitet</span>
        </div>
        <div class="dtz-actions">
          <button type="button" class="quiz-btn quiz-btn--primary" data-dtz-check ${answered === 0 ? "disabled" : ""}>Auswerten</button>
          <button type="button" class="vp-link-btn" data-dtz-reset>Zurücksetzen</button>
        </div>`;
    } else {
      const h = correctCount(hoerenIds);
      const l = correctCount(lesenIds);
      const score = h + l;
      const { stufe, cls } = stufeFor(score);
      const rows = data.parts
        .map((p) => {
          const pids = qidsOfPart(p);
          return `<tr><td>${escapeHtml(p.label)}</td><td>${correctCount(pids)} / ${pids.length}</td></tr>`;
        })
        .join("");
      summary.innerHTML = `
        <div class="dtz-result ${cls}">
          <div class="dtz-result-score"><strong>${score}</strong> / ${total}</div>
          <div class="dtz-result-stufe">${stufe}</div>
          <div class="dtz-result-split">Hören ${h}/${hoerenIds.length} · Lesen ${l}/${lesenIds.length}</div>
        </div>
        <p class="dtz-note">Die DTZ-Auswertung zählt Hören und Lesen zusammen: ab 33 Punkten wird B1 bescheinigt, ab 20 Punkten A2. Der Schreib- und der Sprechteil werden getrennt bewertet und fließen hier nicht ein.</p>
        <div class="format-table-wrap">
          <table class="format-table"><thead><tr><th>Prüfungsteil</th><th>Richtig</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
        <div class="dtz-actions">
          <button type="button" class="vp-link-btn" data-dtz-reset>Neu starten</button>
        </div>`;
    }

    summary.querySelector("[data-dtz-check]")?.addEventListener("click", () => {
      solved = true;
      render();
      summary.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    summary.querySelector("[data-dtz-reset]")?.addEventListener("click", () => {
      Object.assign(state, freshState());
      solved = false;
      persist();
      current = 0;
      render();
    });
  }

  function persist() {
    saveState(data.id, state);
  }

  function render() {
    renderNav();
    renderBody();
    renderSummary();
  }

  render();
}
