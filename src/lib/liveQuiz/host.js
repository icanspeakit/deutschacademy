// The projector side of the live quiz: /lehrkraefte/quiz. See protocol.js for the
// messages and why the host holds all the state.
//
// Screens, in order: setup → lobby (PIN + QR + who is in) → question → reveal →
// leaderboard → (next question …) → podium. Anyone can host; there is no login and no
// database — the game is this tab. Closing it ends the game for everyone.
import QRCode from "qrcode";
import { createBrowserSupabase } from "../supabase/browser.js";
import { channelName, makePin, points, OPTION_STYLES } from "./protocol.js";
import { loadText, t } from "./text.js";

const SHAPES = ["▲", "◆", "●", "■"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function mountHost(root) {
  const $ = (s) => root.querySelector(s);
  const screens = [...root.querySelectorAll("[data-screen]")];
  const show = (name) => screens.forEach((s) => (s.hidden = s.dataset.screen !== name));

  const form = $("[data-setup]");
  const levelSel = $("[data-level]");
  const unitSel = $("[data-unit]");
  const unitOpts = [...unitSel.querySelectorAll("option[data-level]")];
  const shownLang = () => $("[data-show-lang]").value;

  let supabase = null;
  let ch = null;
  let pin = null;
  let questions = [];
  let settings = null;
  let qi = -1;
  let current = null; // { n, sentAt, answers: Map, eligible: Set, timer, tick, done }
  let phase = "setup";
  /** id → { name, lang, score, online } */
  const players = new Map();
  let questionsModule = null;

  // The lexicon is 2 MB; start fetching it while the teacher is still choosing.
  const loadQuestions = () => (questionsModule ??= import("./questions.js"));
  setTimeout(loadQuestions, 300);

  // Only the Lernsets of the chosen level are offered.
  function filterUnits() {
    const lv = levelSel.value;
    unitOpts.forEach((o) => (o.hidden = o.dataset.level !== lv));
    if (unitSel.selectedOptions[0]?.hidden) unitSel.value = "";
  }
  levelSel.addEventListener("change", filterUnits);
  filterUnits();

  /* ---------------------------------------------------------------- room ---- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    settings = {
      level: fd.get("level"),
      unit: fd.get("unit") || null,
      mode: fd.get("mode"),
      count: Number(fd.get("count")),
      seconds: Number(fd.get("seconds")),
    };
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      const { buildQuestions } = await loadQuestions();
      questions = buildQuestions(settings);
      if (questions.length === 0) throw new Error("empty");
      await openRoom();
      show("lobby");
      phase = "lobby";
    } catch (err) {
      console.error(err);
      $("[data-setup-error]").textContent = t("lq.host.error.create", "Der Raum konnte nicht geöffnet werden. Prüfe die Internetverbindung und versuch es noch einmal.");
    } finally {
      btn.disabled = false;
    }
  });

  /** Joins a fresh channel as host; a PIN another host already holds is swapped for a new one. */
  async function openRoom() {
    supabase ??= createBrowserSupabase();
    for (let attempt = 0; attempt < 5; attempt++) {
      pin = makePin();
      ch = supabase.channel(channelName(pin), { config: { broadcast: { self: false }, presence: { key: "host" } } });
      // Every listener goes on before subscribe(): the Realtime client refuses them after.
      ch.on("broadcast", { event: "answer" }, ({ payload }) => onAnswer(payload));
      const taken = await new Promise((resolve, reject) => {
        let settled = false;
        ch.on("presence", { event: "sync" }, () => {
          // Another tab tracking "host" before us means the PIN is in use.
          const hosts = ch.presenceState().host ?? [];
          if (!settled && hosts.length > 1) { settled = true; resolve(true); return; }
          onPresence();
        });
        ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.track({ role: "host" });
            setTimeout(() => { if (!settled) { settled = true; resolve(false); } }, 900);
          } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !settled) {
            settled = true;
            reject(new Error(status));
          }
        });
      });
      if (!taken) break;
      await supabase.removeChannel(ch);
    }
    onPresence();

    const url = `${location.origin}/spiel?pin=${pin}`;
    root.querySelectorAll("[data-pin]").forEach((el) => (el.textContent = `${pin.slice(0, 3)} ${pin.slice(3)}`));
    root.querySelectorAll("[data-join-url]").forEach((el) => (el.textContent = `${location.host}/spiel`));
    $("[data-qr]").innerHTML = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    renderLobby();
  }

  /* ------------------------------------------------------------- players ---- */
  let rosterTimer = null;
  function onPresence() {
    if (!ch) return;
    const state = ch.presenceState();
    const here = new Set();
    for (const [key, metas] of Object.entries(state)) {
      const m = metas[0];
      if (key === "host" || m?.role !== "player") continue;
      here.add(m.id);
      const known = players.get(m.id);
      if (known) {
        known.online = true;
        known.lang = m.lang;
      } else {
        players.set(m.id, { name: uniqueName(m.name), lang: m.lang, score: 0, online: true });
      }
    }
    for (const [id, p] of players) if (!here.has(id)) p.online = false;
    // Someone who left mid-question no longer holds up the "everyone answered" early end.
    if (current && !current.done) maybeFinishEarly();
    if (phase === "lobby") renderLobby();
    if (phase === "question") renderCount();
    // One roster broadcast per burst of joins, not one per presence event.
    clearTimeout(rosterTimer);
    rosterTimer = setTimeout(sendRoster, 250);
  }

  /** Two "Ali"s become "Ali" and "Ali 2" — each phone learns its name from the roster. */
  function uniqueName(name) {
    const base = name || "Gast";
    const taken = new Set([...players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) {
      const next = `${base.slice(0, 13)} ${i}`;
      if (!taken.has(next.toLowerCase())) return next;
    }
  }

  function sendRoster() {
    ch?.send({
      type: "broadcast",
      event: "roster",
      payload: { phase, players: [...players].map(([id, p]) => ({ id, name: p.name })) },
    });
  }

  function renderLobby() {
    const online = [...players.values()].filter((p) => p.online);
    $("[data-lobby-count]").textContent = t("lq.host.players", "{n} Mitspieler", { n: online.length });
    $("[data-lobby-list]").innerHTML = online.length
      ? online.map((p) => `<li>${esc(p.name)}</li>`).join("")
      : `<li class="lq-empty">${esc(t("lq.host.waiting", "Warte auf die ersten Mitspieler …"))}</li>`;
    $("[data-start]").disabled = online.length === 0;
  }

  /* ------------------------------------------------------------ question ---- */
  const optionText = (o) => o.de ?? o[shownLang()] ?? o.en;

  function ask() {
    const q = questions[qi];
    const eligible = new Set([...players].filter(([, p]) => p.online).map(([id]) => id));
    current = { n: qi + 1, sentAt: performance.now(), answers: new Map(), eligible, done: false };
    phase = "question";
    ch.send({
      type: "broadcast",
      event: "question",
      payload: { n: qi + 1, total: questions.length, mode: settings.mode, prompt: q.prompt, options: q.options, seconds: settings.seconds },
    });
    sendRoster();

    $("[data-q-n]").textContent = t("lq.q.of", "Frage {n} von {total}", { n: qi + 1, total: questions.length });
    $("[data-q-kind]").textContent = settings.mode === "meaning-de"
      ? t("lq.mode.meaningDe", "Wie heißt das auf Deutsch?")
      : t("lq.mode.deMeaning", "Was bedeutet das?");
    const prompt = $("[data-q-prompt]");
    prompt.textContent = q.prompt.de ?? q.prompt[shownLang()];
    prompt.dir = !q.prompt.de && shownLang() === "ar" ? "rtl" : "auto";
    $("[data-q-options]").innerHTML = q.options
      .map((o, i) => `<div class="lq-opt lq-opt--${OPTION_STYLES[i]}"><span class="lq-shape" aria-hidden="true">${SHAPES[i]}</span><span dir="auto">${esc(optionText(o))}</span></div>`)
      .join("");
    renderCount();
    show("question");

    const end = current.sentAt + settings.seconds * 1000;
    const bar = $("[data-q-bar]");
    const left = $("[data-q-left]");
    current.tick = setInterval(() => {
      const ms = Math.max(0, end - performance.now());
      left.textContent = Math.ceil(ms / 1000);
      bar.style.width = `${(ms / (settings.seconds * 1000)) * 100}%`;
      if (ms <= 0) finish();
    }, 100);
  }

  function renderCount() {
    if (!current) return;
    const waiting = [...current.eligible].filter((id) => players.get(id)?.online).length;
    $("[data-q-count]").textContent = t("lq.host.answered", "{a} von {n} haben geantwortet", { a: current.answers.size, n: waiting });
  }

  function onAnswer({ id, n, choice } = {}) {
    if (!current || current.done || n !== current.n) return;
    if (!players.has(id) || current.answers.has(id)) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
    current.answers.set(id, { choice, ms: performance.now() - current.sentAt });
    // A late joiner who answers anyway is counted: they saw the question, so it is theirs.
    current.eligible.add(id);
    renderCount();
    maybeFinishEarly();
  }

  function maybeFinishEarly() {
    const open = [...current.eligible].filter((id) => players.get(id)?.online && !current.answers.has(id));
    if (open.length === 0 && current.answers.size > 0) finish();
  }

  function ranking() {
    return [...players].sort((a, b) => b[1].score - a[1].score);
  }

  function finish() {
    if (!current || current.done) return;
    current.done = true;
    clearInterval(current.tick);
    const q = questions[qi];
    const dist = [0, 0, 0, 0];
    const gained = new Map();
    for (const [id, a] of current.answers) {
      dist[a.choice]++;
      const ok = a.choice === q.correct;
      const pts = ok ? points(a.ms, settings.seconds) : 0;
      players.get(id).score += pts;
      gained.set(id, { ok, points: pts });
    }
    const results = {};
    ranking().forEach(([id, p], i) => {
      if (!current.eligible.has(id)) return;
      const g = gained.get(id) ?? { ok: false, points: 0, missed: true };
      results[id] = { ...g, score: p.score, rank: i + 1 };
    });
    ch.send({ type: "broadcast", event: "reveal", payload: { n: current.n, correct: q.correct, dist, results } });
    phase = "reveal";

    const max = Math.max(1, ...dist);
    $("[data-r-answer]").textContent = optionText(q.options[q.correct]);
    $("[data-r-dist]").innerHTML = q.options
      .map((o, i) => `
        <div class="lq-dist lq-opt--${OPTION_STYLES[i]}${i === q.correct ? " is-correct" : ""}">
          <span class="lq-dist-bar"><span style="height:${(dist[i] / max) * 100}%"></span></span>
          <b>${dist[i]}</b>
          <span class="lq-dist-label"><span class="lq-shape" aria-hidden="true">${SHAPES[i]}</span><span dir="auto">${esc(optionText(o))}</span>${i === q.correct ? " ✓" : ""}</span>
        </div>`)
      .join("");
    $("[data-r-next]").textContent = t("lq.host.toBoard", "Rangliste →");
    show("reveal");
  }

  function renderBoard() {
    phase = "board";
    const top = ranking().slice(0, 5);
    $("[data-board]").innerHTML = top
      .map(([, p], i) => `<li><span class="lq-rank">${i + 1}</span><span class="lq-name">${esc(p.name)}</span><b>${p.score}</b></li>`)
      .join("");
    const last = qi === questions.length - 1;
    $("[data-b-next]").textContent = last ? t("lq.host.toPodium", "Siegerehrung →") : t("lq.host.next", "Nächste Frage →");
    show("board");
  }

  function podium() {
    phase = "podium";
    const ranked = ranking();
    const results = Object.fromEntries(ranked.map(([id, p], i) => [id, { score: p.score, rank: i + 1 }]));
    const top = ranked.slice(0, 3).map(([, p]) => ({ name: p.name, score: p.score }));
    ch.send({ type: "broadcast", event: "end", payload: { podium: top, results, total: ranked.length } });
    $("[data-podium]").innerHTML = [1, 0, 2]
      .filter((i) => top[i])
      .map((i) => `<li class="lq-step lq-step--${i + 1}"><span class="lq-name">${esc(top[i].name)}</span><b>${top[i].score}</b><span class="lq-block">${i + 1}</span></li>`)
      .join("");
    show("podium");
  }

  /* ------------------------------------------------------------- buttons ---- */
  $("[data-start]").addEventListener("click", () => { qi = 0; ask(); });
  $("[data-q-skip]").addEventListener("click", () => finish());
  $("[data-r-next]").addEventListener("click", renderBoard);
  $("[data-b-next]").addEventListener("click", () => {
    if (qi < questions.length - 1) { qi++; ask(); } else podium();
  });
  root.querySelectorAll("[data-end]").forEach((b) => b.addEventListener("click", closeRoom));
  $("[data-again]").addEventListener("click", closeRoom);

  async function closeRoom() {
    clearInterval(current?.tick);
    current = null;
    if (ch) {
      await ch.send({ type: "broadcast", event: "closed", payload: {} });
      await supabase.removeChannel(ch);
    }
    ch = null;
    players.clear();
    qi = -1;
    phase = "setup";
    show("setup");
  }

  // Leaving the page ends the game; tell the phones rather than let them time out.
  addEventListener("pagehide", () => ch?.send({ type: "broadcast", event: "closed", payload: {} }));

  loadText(() => { if (phase === "lobby") renderLobby(); });
  show("setup");
  return { get pin() { return pin; }, get players() { return players; } };
}

