// The worksheet in the browser: one page, two uses.
//
//   Zum Drucken     the paper layout on screen, answer key below it; Print → A4.
//   Online ausfüllen the same gaps are live inputs, "Prüfen" marks them, the key is hidden.
//
// Printing always produces the paper layout (the print stylesheet ignores the mode), so a
// teacher can switch to "online" to try the sheet and still print from there.
//
// The accepted answers sit on each input as data-a (a JSON list). They are in the page by
// necessity — the printed key needs them — but never shown on screen in online mode until
// the learner asks for them to be checked.

const MODE_KEY = "ab.mode";

const norm = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();

/** Right if it matches any accepted answer. Letters ignore case; sentences ignore a
    missing final full stop; everything else is exact apart from spacing — capitals are
    part of German spelling, so "brüder" is not "Brüder". */
function isRight(input) {
  const kind = input.dataset.kind;
  let given = norm(input.value);
  let accepted = JSON.parse(input.dataset.a || "[]").map(norm);
  if (kind === "letter") {
    given = given.toLowerCase();
    accepted = accepted.map((a) => a.toLowerCase());
  }
  if (kind === "sentence") {
    const strip = (s) => s.replace(/[.!?]$/, "");
    given = strip(given);
    accepted = accepted.map(strip);
  }
  return given !== "" && accepted.includes(given);
}

export function mountWorksheet(root) {
  const inputs = () => [...root.querySelectorAll("[data-a]")];
  const score = root.querySelector("[data-ab-score]");

  function setMode(mode) {
    root.dataset.mode = mode;
    root.querySelectorAll("[data-ab-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.abMode === mode)));
    try { localStorage.setItem(MODE_KEY, mode); } catch {}
  }

  function clearMarks() {
    inputs().forEach((i) => i.classList.remove("is-right", "is-wrong"));
    if (score) score.textContent = "";
  }

  function check() {
    let right = 0;
    const all = inputs();
    all.forEach((i) => {
      const ok = isRight(i);
      i.classList.toggle("is-right", ok);
      i.classList.toggle("is-wrong", !ok);
      if (ok) right++;
    });
    if (score) {
      score.textContent = score.dataset.tpl.replace("{n}", right).replace("{total}", all.length);
      score.dataset.all = String(right === all.length);
    }
    root.querySelector(".is-wrong")?.focus();
  }

  root.querySelectorAll("[data-ab-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.abMode)));
  root.querySelector("[data-ab-print]")?.addEventListener("click", () => window.print());
  root.querySelector("[data-ab-check]")?.addEventListener("click", check);
  root.querySelector("[data-ab-reset]")?.addEventListener("click", () => {
    inputs().forEach((i) => (i.value = ""));
    clearMarks();
  });
  // Editing an answer clears its mark, so a corrected gap does not stay red.
  root.addEventListener("input", (e) => e.target.classList?.remove("is-right", "is-wrong"));

  // Whether the key is printed: on by default, off for a copy to hand out.
  const withKey = root.querySelector("[data-ab-withkey]");
  withKey?.addEventListener("change", () => (root.dataset.key = withKey.checked ? "on" : "off"));

  // The meaning language of a vocabulary sheet: ?lang=ar, remembered in the URL so the
  // link a teacher shares opens in the same language.
  const langBtns = [...root.querySelectorAll("[data-ab-lang]")];
  if (langBtns.length) {
    const setLang = (l) => {
      root.dataset.lang = l;
      langBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.abLang === l)));
      const u = new URL(location.href);
      u.searchParams.set("lang", l);
      history.replaceState(null, "", u);
    };
    const wanted = new URL(location.href).searchParams.get("lang");
    if (wanted && langBtns.some((b) => b.dataset.abLang === wanted)) setLang(wanted);
    langBtns.forEach((b) => b.addEventListener("click", () => setLang(b.dataset.abLang)));
  }

  let saved = null;
  try { saved = localStorage.getItem(MODE_KEY); } catch {}
  setMode(saved === "online" ? "online" : "print");
}
