// Theme (light/dark) — mirrors the shape of i18n.js so both switchers in the nav
// behave the same way: read once, write to localStorage, notify subscribers.
//
// Stored value is "light" | "dark", or absent, which means "follow the OS".
// The actual applied theme always lands on <html data-theme="…"> so CSS only ever
// has to match one selector; the pre-paint snippet in Layout.astro sets it before
// first paint so there is no white flash on a dark-mode reload.

const STORAGE_KEY = "da-theme";
const THEMES = ["light", "dark"];
const listeners = new Set();

// Browser chrome (address bar on mobile, PWA titlebar) follows these.
const THEME_COLOR = { light: "#4d9be1", dark: "#0f141b" };

function systemTheme() {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function stored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(v) ? v : null;
  } catch {
    return null; // private mode / storage blocked — fall back to the OS preference
  }
}

/** The theme actually in effect right now. */
export function getTheme() {
  return document.documentElement.dataset.theme || stored() || systemTheme();
}

/** True when the user has made an explicit choice (so we stop following the OS). */
export function hasExplicitTheme() {
  return stored() !== null;
}

export function setTheme(theme) {
  const next = THEMES.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore — the theme still applies for this page view */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[next]);
  listeners.forEach((fn) => fn(next));
  return next;
}

export function toggleTheme() {
  return setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Keep following the OS until the user picks a side. Called once per page by the
 * toggle component; safe to call more than once.
 */
export function watchSystemTheme() {
  if (typeof matchMedia !== "function") return;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (hasExplicitTheme()) return;
    const next = e.matches ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    listeners.forEach((fn) => fn(next));
  });
}
