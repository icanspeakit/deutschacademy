// The phone side of the live quiz: /spiel. See protocol.js for the messages.
//
// A student types (or scans) the PIN, picks a nickname and the language meanings should
// appear in, and plays — no account. The phone never holds the answer: it shows the four
// options it was sent, reports a tap, and learns whether it was right at the reveal.
import { createBrowserSupabase } from "../supabase/browser.js";
import { getLang } from "../i18n.js";
import { channelName, cleanName, makeId, MEANING_LANGS, OPTION_STYLES } from "./protocol.js";
import { loadText, t } from "./text.js";

const SHAPES = ["▲", "◆", "●", "■"];
const HOST_WAIT_MS = 6000; // how long "is there a host?" gets before the PIN is called wrong
const HOST_GONE_MS = 8000; // grace for a host whose tab blinked (reload, flaky Wi-Fi)

export function mountPlayer(root) {
  const $ = (s) => root.querySelector(s);
  const screens = [...root.querySelectorAll("[data-screen]")];
  const show = (name) => screens.forEach((s) => (s.hidden = s.dataset.screen !== name));
  const form = $("[data-join]");
  const err = $("[data-join-error]");
  const banner = $("[data-banner]");

  // The meaning language: the site's own language where it is one of the four, else English.
  const ui = getLang();
  const langInput = form.querySelector(`[name=lang][value="${MEANING_LANGS.includes(ui) ? ui : "en"}"]`);
  if (langInput) langInput.checked = true;

  const params = new URLSearchParams(location.search);
  if (params.get("pin")) form.pin.value = params.get("pin").replace(/\D/g, "").slice(0, 6);
  try { form.name.value = sessionStorage.getItem("lq.name") ?? ""; } catch {}

  let supabase = null;
  let ch = null;
  let me = null; // { id, name, lang, pin }
  let q = null; // the question on screen: { n, seconds, answered, tick }
  let hostSeen = false;
  let hostGoneTimer = null;
  let finished = false;

  const meaning = (o) => o[me.lang] ?? o.en;
  const text = (o) => (o.de != null ? o.de : meaning(o));
  const dirOf = (o) => (o.de == null && me.lang === "ar" ? "rtl" : "ltr");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const pin = form.pin.value.replace(/\D/g, "");
    const name = cleanName(form.name.value);
    if (pin.length !== 6) { err.textContent = t("lq.join.pinInvalid", "Die PIN hat 6 Ziffern."); return; }
    if (!name) { err.textContent = t("lq.join.nameMissing", "Gib einen Namen ein."); return; }
    const lang = new FormData(form).get("lang") || "en";
    // Same tab, same PIN → same id, so a reload keeps the score instead of starting at 0.
    let id = null;
    try { id = sessionStorage.getItem(`lq.id.${pin}`); } catch {}
    id ??= makeId();
    try { sessionStorage.setItem(`lq.id.${pin}`, id); sessionStorage.setItem("lq.name", name); } catch {}
    me = { id, name, lang, pin };
    form.querySelector("[type=submit]").disabled = true;
    const ok = await connect();
    form.querySelector("[type=submit]").disabled = false;
    if (!ok) return;
    $("[data-me-name]").textContent = me.name;
    setWaiting(t("lq.wait.lobby", "Du bist dabei! Gleich geht es los."));
    show("wait");
  });

  /** Joins the room; resolves false (with the reason on screen) when there is no host. */
  function connect() {
    supabase ??= createBrowserSupabase();
    ch = supabase.channel(channelName(me.pin), { config: { presence: { key: me.id } } });
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };

      ch.on("presence", { event: "sync" }, () => {
        const hosted = (ch.presenceState().host ?? []).length > 0;
        if (hosted) {
          hostSeen = true;
          clearTimeout(hostGoneTimer);
          hostGoneTimer = null;
          done(true);
        } else if (hostSeen && !finished && !hostGoneTimer) {
          hostGoneTimer = setTimeout(() => stop(t("lq.err.hostLeft", "Die Lehrkraft hat das Spiel verlassen.")), HOST_GONE_MS);
        }
      });
      ch.on("broadcast", { event: "roster" }, ({ payload }) => onRoster(payload));
      ch.on("broadcast", { event: "question" }, ({ payload }) => onQuestion(payload));
      ch.on("broadcast", { event: "reveal" }, ({ payload }) => onReveal(payload));
      ch.on("broadcast", { event: "end" }, ({ payload }) => onEnd(payload));
      ch.on("broadcast", { event: "closed" }, () => stop(t("lq.err.closed", "Die Lehrkraft hat das Spiel beendet.")));

      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          banner.hidden = true;
          // Tracked again after every reconnect: presence is what keeps a seat.
          await ch.track({ role: "player", id: me.id, name: me.name, lang: me.lang });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!settled) {
            err.textContent = t("lq.err.connect", "Keine Verbindung. Prüfe das Internet und versuch es noch einmal.");
            cleanup();
            done(false);
            return;
          }
          // The client rejoins on its own; say so meanwhile.
          banner.textContent = t("lq.err.reconnecting", "Verbindung verloren – verbinde neu …");
          banner.hidden = false;
        }
      });

      setTimeout(() => {
        if (settled) return;
        err.textContent = t("lq.err.noRoom", "Zu dieser PIN läuft gerade kein Spiel. Prüfe die Zahl auf dem Beamer.");
        cleanup();
        done(false);
      }, HOST_WAIT_MS);
    });
  }

  function cleanup() {
    if (ch) supabase.removeChannel(ch);
    ch = null;
    hostSeen = false;
  }

  function stop(message) {
    // After the podium the host closing the room is expected: keep the result on screen.
    if (finished) { cleanup(); return; }
    clearInterval(q?.tick);
    clearTimeout(hostGoneTimer);
    cleanup();
    $("[data-stop-msg]").textContent = message;
    show("stopped");
  }

  function onRoster({ players = [], phase } = {}) {
    const mine = players.find((p) => p.id === me.id);
    if (mine && mine.name !== me.name) {
      me.name = mine.name;
      root.querySelectorAll("[data-me-name]").forEach((el) => (el.textContent = me.name));
    }
    // Joined while a question is running: it is not ours, the next one is.
    if (!q && (phase === "question" || phase === "reveal" || phase === "board")) {
      setWaiting(t("lq.wait.late", "Du bist ab der nächsten Frage dabei."));
    }
  }

  function setWaiting(msg) {
    $("[data-wait-msg]").textContent = msg;
  }

  function onQuestion({ n, total, mode, prompt, options, seconds }) {
    clearInterval(q?.tick);
    q = { n, seconds, answered: false };
    $("[data-q-n]").textContent = t("lq.q.of", "Frage {n} von {total}", { n, total });
    $("[data-q-kind]").textContent = mode === "meaning-de"
      ? t("lq.mode.meaningDe", "Wie heißt das auf Deutsch?")
      : t("lq.mode.deMeaning", "Was bedeutet das?");
    const p = $("[data-q-prompt]");
    p.textContent = text(prompt);
    p.dir = dirOf(prompt);
    p.lang = prompt.de != null ? "de" : me.lang;
    const box = $("[data-q-options]");
    box.innerHTML = options
      .map((o, i) => `<button type="button" class="lq-opt lq-opt--${OPTION_STYLES[i]}" data-choice="${i}" lang="${o.de != null ? "de" : me.lang}"><span class="lq-shape" aria-hidden="true">${SHAPES[i]}</span><span dir="${dirOf(o)}">${escapeHtml(text(o))}</span></button>`)
      .join("");
    $("[data-q-sent]").hidden = true;
    show("question");

    // The phone's own countdown, started when the question arrived: close enough to the
    // host's for a progress bar, and the host's clock is the one that scores.
    const end = performance.now() + seconds * 1000;
    const bar = $("[data-q-bar]");
    q.tick = setInterval(() => {
      const ms = Math.max(0, end - performance.now());
      bar.style.width = `${(ms / (seconds * 1000)) * 100}%`;
      if (ms <= 0) {
        clearInterval(q.tick);
        if (!q.answered) lockOptions(null);
      }
    }, 100);
  }

  $("[data-q-options]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-choice]");
    if (!b || !q || q.answered) return;
    const choice = Number(b.dataset.choice);
    q.answered = true;
    ch?.send({ type: "broadcast", event: "answer", payload: { id: me.id, n: q.n, choice } });
    lockOptions(choice);
  });

  function lockOptions(choice) {
    root.querySelectorAll("[data-choice]").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("is-picked", Number(b.dataset.choice) === choice);
      b.classList.toggle("is-dim", choice != null && Number(b.dataset.choice) !== choice);
    });
    const sent = $("[data-q-sent]");
    sent.textContent = choice == null ? t("lq.q.timeUp", "Zeit ist um!") : t("lq.q.sent", "Antwort gesendet – warte auf die anderen …");
    sent.hidden = false;
  }

  function onReveal({ n, results }) {
    if (!q || q.n !== n) return;
    clearInterval(q.tick);
    const r = results?.[me.id];
    const card = $("[data-result]");
    if (!r) {
      card.dataset.kind = "missed";
      $("[data-res-title]").textContent = t("lq.res.missed", "Diese Frage hast du verpasst.");
      $("[data-res-points]").textContent = "";
    } else {
      card.dataset.kind = r.ok ? "ok" : "wrong";
      $("[data-res-title]").textContent = r.ok ? t("lq.res.ok", "Richtig!") : r.missed ? t("lq.res.none", "Keine Antwort") : t("lq.res.wrong", "Leider falsch");
      $("[data-res-points]").textContent = r.ok ? `+${r.points}` : "+0";
    }
    $("[data-res-score]").textContent = r ? t("lq.res.score", "{score} Punkte · Platz {rank}", { score: r.score, rank: r.rank }) : "";
    show("result");
  }

  function onEnd({ results, total }) {
    finished = true;
    clearInterval(q?.tick);
    const r = results?.[me.id];
    $("[data-end-rank]").textContent = r ? t("lq.end.rank", "Platz {rank} von {total}", { rank: r.rank, total }) : "";
    $("[data-end-score]").textContent = r ? t("lq.end.score", "{score} Punkte", { score: r.score }) : "";
    $("[data-end-title]").textContent = r?.rank === 1 ? t("lq.end.win", "Gewonnen! 🏆") : t("lq.end.title", "Geschafft!");
    show("end");
  }

  root.querySelectorAll("[data-rejoin]").forEach((b) => b.addEventListener("click", () => {
    finished = false;
    q = null;
    cleanup();
    show("join");
  }));

  loadText();
  show("join");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
