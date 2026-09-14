// Renders the mobile studies at a real phone viewport and writes one PNG per
// variant, plus a report of anything that overflows horizontally.
//
//   node scripts/shoot-mobile.mjs [outDir]
//
// Expects `astro dev` on :4321. Chromium at iPhone-ish 430x932, dpr 3.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:4321";
const OUT = process.argv[2] ?? "mobile-shots";

const PAGES = [
  { url: "/mobile", attr: "data-variant-btn", variants: ["stapel", "tabs", "karussell"] },
  { url: "/mobile2", attr: "data-concept-btn", variants: ["sofort", "niveau", "story"] },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const problems = [];

await mkdir(OUT, { recursive: true });

for (const spec of PAGES) {
  for (const variant of spec.variants) {
    await page.goto(BASE + spec.url, { waitUntil: "networkidle" });
    await page.click(`[${spec.attr}="${variant}"]`);
    await page.waitForTimeout(350);

    const name = spec.url.replace(/\W+/g, "") + "-" + variant;
    await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });

    // Horizontal overflow is the one mobile bug that is always a bug.
    const scan = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const wide = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || getComputedStyle(el).position === "fixed") continue;
        // Children of a horizontal scroller are meant to sit off-screen (carousel).
        if (el.closest("[data-mocks], .m2-deck")) continue;
        if (r.right > docW + 1 || r.left < -1) {
          wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), right: Math.round(r.right), left: Math.round(r.left) });
        }
      }
      // Tap targets that are too small to hit reliably.
      const small = [];
      for (const el of document.querySelectorAll("button:not([disabled]), a[href]")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 32) small.push({ tag: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 24), h: Math.round(r.height) });
      }
      return {
        docW,
        scrollW: document.documentElement.scrollWidth,
        bodyH: Math.round(document.body.scrollHeight),
        wide: wide.slice(0, 6),
        smallCount: small.length,
        small: small.slice(0, 5),
      };
    });

    const overflows = scan.scrollW > scan.docW + 1;
    if (overflows || scan.wide.length) problems.push({ page: spec.url, variant, scan });
    console.log(
      `${spec.url} · ${variant}: ${scan.docW}px viewport, Seite ${scan.bodyH}px hoch, scrollWidth ${scan.scrollW}` +
        (overflows ? "  ← ÜBERLAUF" : "") +
        (scan.wide.length ? `  ← ${scan.wide.length} Element(e) ragen raus` : "") +
        (scan.smallCount ? `  · ${scan.smallCount} Tap-Ziel(e) < 32px` : "")
    );
    for (const w of scan.wide) console.log(`    raus: <${w.tag} class="${w.cls}"> left=${w.left} right=${w.right}`);
    for (const s of scan.small) console.log(`    klein: <${s.tag}> "${s.text}" h=${s.h}px`);
  }
}

await browser.close();
console.log(`\nPNGs in ${path.resolve(OUT)}`);
if (problems.length) {
  console.log(`${problems.length} Variante(n) mit Überlauf.`);
  process.exitCode = 1;
}
