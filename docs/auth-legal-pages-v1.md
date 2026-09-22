# DeutschAcademy legal pages v1 (2026-09-21)

Three legal routes plus the repo work that has to land before the Google OAuth app can leave
Testing. Google blocks publishing until the Branding page has a privacy-policy URL on an
authorised domain, and `/datenschutz` was written but never built or rendered. This pass
verified it, then fixed the two things on the site that made its claims untrue.

Sits between `docs/auth-sso-console-checklist.md` and Tier 0 of `AUTH-SSO-TIERED-PROMPT.md`.
Nothing here touches Supabase or Brevo; that is Tiers 1–4.

## What was built

- **`/impressum`** — §5 DDG provider details, contact, Streitbeilegung, liability for content
  and links, copyright.
- **`/datenschutz`** — what is stored, when, and where; legal bases; cookies and localStorage;
  recipients; retention; data-subject rights; minors.
- **`/nutzungsbedingungen`** — service, accounts, acceptable use, content, disclaimers,
  liability under §§ 276/309 BGB, changes, contact.
- **`src/lib/legal.js`** — one source of truth for the operator details all three repeat.
  `legalComplete()` gates a loud red banner; `filled()` makes sure no placeholder ever reaches
  a visitor.
- **`src/styles/legal.css`** — reading column built only from existing `global.css` tokens, so
  dark mode needs no separate values.
- **Footer** — a "Rechtliches" column in `src/pages/index.astro` linking all three, with
  `home.footer.col.legal` / `.link.imprint` / `.link.privacy` / `.link.terms` in all five
  locales.

## Verified claims — what was checked, and how

| Claim | How it was checked | Result |
|---|---|---|
| The pages build | `pnpm build` | Succeeds. 670 Astro pages, 671 `dist/**/*.html` (the extra file is `dist/dashboard/index.html`, an Astro redirect stub to `/fortschritt`, not a route). Matches the expected 668 + 3. |
| No page renders "TODO" | `grep TODO dist/{impressum,datenschutz,nutzungsbedingungen}/index.html`, plus `document.body.innerText.includes("TODO")` in a real browser | Zero, in markup and in rendered text. `operatorPhone` is still `"TODO"` in `legal.js`, and `filled()` correctly drops the row rather than printing it. The only `TODO` anywhere in `dist/` is a pre-existing HTML *comment* on `/` about pricing — invisible, and unrelated to these pages. |
| No warning banner | `legalComplete()` reads only the five required fields, none of which is `TODO`; confirmed no `<div class="legal-warn">` exists in any built page (the class appears only in the inlined stylesheet) and `document.querySelector(".legal-warn")` is null on all three | `true`, no banner |
| Renders in light and dark, at phone width | Playwright, Chromium at 390×844, `isMobile`, `da-theme` seeded to each value, full-page screenshots plus a bounding-box overflow scan | Pass after one fix — see below |
| No analytics or tracking | `grep -rniE 'gtag\|googletagmanager\|plausible\|fathom\|matomo\|posthog\|hotjar\|clarity\|@sentry\|@vercel/analytics\|speed-insights'` over `src/`, `public/`, `package.json` | No hits. Every match was the German/English word *plausibel/plausible* in lexicon data and code comments. `package.json` has one runtime dependency: `astro`. |
| Supabase, Vercel, Google and Brevo are the only recipients | Playwright network sweep over **32 learner routes**, recording every request with a non-localhost hostname; plus a static scan of all `src`/`href`/`srcset` attributes across the built HTML | **Zero off-origin requests** from any learner route. The only external hosts in built HTML are `href=` hyperlinks the reader chooses to follow — `bamf.de`, `telc.net`, `goethe.de`, `policies.google.com` (linked from `/datenschutz` itself), and `pexels.com` photo attributions on the Sprechen pages, whose images are served from `/assets/sprechen/`. |
| Five locale files stay in step | `node scripts/validate-i18n.mjs` | 1272 keys × 5 locales — keys, order and placeholders all match `de.json` |

### One rendering bug, found and fixed

`/datenschutz` overflowed at 390px. The three-column `.legal-table` has a min-content width of
394px, so the layout viewport expanded to 410 and the page panned sideways — the one mobile bug
that is always a bug, on a site where the readers are on phones.

Below `34rem` each row is now a stacked card: `thead` hidden, the column heading moved into the
cell through `data-label` + `::before`. `src/pages/datenschutz.astro` gained the `data-label`
attributes; `src/styles/legal.css` gained the media query. Re-measured at 390px in both themes:
`scrollWidth === innerWidth === 390`, no overflowing elements.

## Aspirational claims — true by design, not yet true in code

`/datenschutz` is written for the site as it will be at the end of Tier 4, **deliberately and in
advance**, because Google will not publish the OAuth app without a live policy URL and the policy
has to describe what the app will do. Until the tiers land, these parts describe nothing that
currently happens:

- **Supabase** — named as the processor holding accounts and synced progress in Frankfurt. The
  project exists (`putrkafrcpqosqxrgttp`, `eu-central-1`) and is **empty**; no client, no table,
  no row. `LEGAL.dataRegion` is right about where data *will* sit.
- **Google** — "Mit Google anmelden" does not exist on the site yet. The OAuth client is created
  but the app is still in Testing, which is what this whole pass unblocks.
- **Brevo** — named as the sender of magic-link and password-reset mail. Not wired up; no account
  referenced anywhere in the repo.
- **The login cookie** — "Ein technisch notwendiges Anmelde-Cookie" is accurate about
  `@supabase/ssr`'s intended behaviour. Today the site sets **no cookies at all**.
- **Server-side storage and the Art. 6(1)(b) basis** — both presuppose accounts. Today every
  learner is anonymous and every byte of state is in their own browser, which the page's opening
  paragraph already says correctly.
- **Data-subject rights (access, deletion, portability)** — currently satisfied trivially and
  vacuously: there is nothing on a server to access, delete or export. They become real
  obligations with Tier 1.

Nothing on the page is *false* about today; the account-dependent parts are simply inert. Revisit
this section at the end of Tier 4 and confirm each line has become true.

**Also aspirational on `/nutzungsbedingungen`:** the page states nothing costs anything. If a paid
tier appears (see `docs/monetization-strategy-v1.md`), it needs a Widerrufsbelehrung — not a small
edit, and the file's own header comment says so.

## localStorage: what the page describes, and what the repo actually stores

`/datenschutz` lists the stored data as progress, exam state, writing drafts and settings. Every
key in the repo falls under one of those headings, **except one class the page does not mention**:

**Undescribed: UI dismissal flags and per-page view preferences.** `da-stufen-foldtab-seen`,
`da_ov_jiggled_v1`, `da-pruefung-info` / `-seen`, `da-wortschatz-lernsets` / `-seen`,
`da-artikel-rule` / `-peek`, `da-grammatik-rule` / `-peek`, `da-grammatik-ex-rule-peek`,
`da-ex-rule-peek`, `da-fertigkeiten-tab`, `da-hub-view`. These record "you have already seen this
hint" and "you had this panel open". The page's *Einstellungen* row names only Anzeigename,
Wochenziel, Sprache and helles/dunkles Design, so these are not covered by it.

This is not a compliance problem — they never leave the device, and the page already says
localStorage is not a transmission to the operator. It is a completeness gap: if the *Einstellungen*
row is meant to be exhaustive, widen its wording to cover interface state, or say the list is
illustrative. Flagging rather than editing, because the wording is a judgement call.

Also present and out of scope for the page: prototype keys that only design routes write
(`da-front-variant`, `da-mobile-variant`, `da-mobile2-concept`, `da-better-mode`, `da-font-test`,
`da-no3-brief`, `da-navnew-variant`, `da-navnew-rule`, `da-pivot-idea`, `nv-variant`, `nv-view`,
`hp-concept`, `concepts-active`, `fakten-lang`, `fakten-layout`), and `da-fc-theme`, a dead legacy
key `Layout.astro` reads once to migrate an old night-mode setting.

**Correction to `AUTH-SSO-TIERED-PROMPT.md` Tier 3:** its inventory does not mention the dismissal
and view-preference keys above, and its `NEVER_SYNC` list omits `da-navnew-rule`,
`da-navnew-rule-peek` and `da-pivot-idea`. Tier 3's own acceptance criterion is that every key in
the repo appears in exactly one of its three lists, so add them before starting it.

## Task 2 — the Google Fonts leak, now closed

`/datenschutz` tells readers there are no third-party requests beyond the ones it lists, and
`src/layouts/Layout.astro` carries a comment claiming "nothing is fetched from
fonts.googleapis.com". Neither was true. **Three** routes fetched from Google, not the one the
brief named:

| Route | What it pulled | Fix |
|---|---|---|
| `/pruefungen/leben-in-deutschland/fakten` — a **real learner route** | Inter 400–700 + JetBrains Mono 500/600, via a `<link>` in a head `Fragment` | Fixed properly |
| `/layout` — prototype | Sora, via `@import url(...)` at the top of `src/styles/layout-redesign.css` | Fixed properly |
| `/concepts` — design exploration | Ten families, plus images from `picsum.photos` | Left alone, `noindex`-ed |

**`/fakten`.** `--font-body` and `--font-display` now resolve to **Albert Sans**, already
self-hosted at `/fonts/albert-sans-latin.woff2` as a 300–800 variable face, which covers every
weight the page asked Inter for. No new font file was added, per the brief's preference. The page
keeps its own neutral voice, distinct from the site's Sora.

JetBrains Mono was *not* self-hosted, because it is not load-bearing here: it styles exactly three
letter-spaced label classes (`.eyebrow`, `.fk-fact-card-count`, `.format-note`) — no code, no
aligned columns — and already fell back to Consolas. It is now a system stack
(`ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, monospace`), so the look survives at
zero network cost.

**`/layout`.** The `@import` was pure waste: Sora is already self-hosted in `global.css`, and
`/layout` uses `Layout.astro`, so the face was loading twice. Deleted the line.

**Verified in the network tab, not by grep** — `/fakten` reloaded in Chrome with request recording
on: 45 requests, all `localhost`, including `/fonts/albert-sans-latin.woff2`. Zero requests to
`fonts.googleapis.com` or `fonts.gstatic.com`. The 32-route Playwright sweep above independently
confirms no learner route contacts any off-origin host.

`Layout.astro`'s comment is now accurate for every route that uses it.

## Task 3 — `/former-site` and the prototype routes

`src/pages/former-site.astro` renders `src/components/Footer.astro`, which prints
`Deutsch Academy Inc., 35F Tycoon Centre, Pearl Drive, Ortigas, 1600 Pasig City, Manila`. It
builds to a public URL and contradicts the new Impressum's Berlin sole trader. `Footer.astro` is
used by that page and nothing else, and the Manila address appears in exactly one built file.

**Edgar's decision: keep it as an archive reference, `noindex` plus `robots.txt`. Nothing deleted.**
He also chose to extend the sweep to **every unlinked prototype route**, not just the two the brief
named.

- `src/layouts/Layout.astro` gained a `noindex` prop that emits
  `<meta name="robots" content="noindex, nofollow">`.
- 21 routes now pass it: `better`, `design-system`, `font`, `former-site`, `front`, `jetzt`,
  `layout`, `m1`, `mobile`, `mobile2`, `mobile3`, `nav`, `navnew`, `no3`, `pivot`, `sora`,
  `uebungen-vorschau`, `v1`, `v2`, `wortliste-luft`, `wortliste-rail`. `/concepts` does not use
  the layout and already had the tag inline.
- **`public/robots.txt` is new** — the project had none — disallowing all 22.

**The brief was wrong that there is no `noindex` anywhere in the project.** Eleven pages already
carried the tag in their own `Fragment slot="head"`: `concepts`, `design-system`, `m1`, `mobile`,
`mobile2`, `mobile3`, `nav`, `uebungen-vorschau`, `v2`, `wortliste-luft`, `wortliste-rail`. Those
ten that use the layout had their inline copies removed so the tag is emitted once, from one place.

`/leicht` is **not** in the sweep: `NavDrawer.astro` links it, so it is reachable from the site's
own navigation. `/dashboard` is not in `robots.txt` either — it is an Astro redirect stub to
`/fortschritt`, and blocking it would stop crawlers following the redirect.

Note the split: `robots.txt` only stops the *next* crawl; the meta tag is what removes an
already-indexed page. Both are in place, and `public/robots.txt` carries a comment saying to keep
the two lists in step.

`/concepts` keeps its Google Fonts and `picsum.photos` requests. It is a design-exploration page,
the brief said not to rewrite it, and it is now `noindex`-ed and disallowed. If it is ever linked
from the live site, it has to be fixed first — it is the last route that would make
`/datenschutz` false.

## Files changed

**New:** `docs/auth-legal-pages-v1.md`, `public/robots.txt`.

**Modified for the font leak:** `src/pages/pruefungen/leben-in-deutschland/fakten.astro`,
`src/styles/fakten-layouts.css`, `src/styles/layout-redesign.css`.

**Modified for the mobile fix:** `src/pages/datenschutz.astro`, `src/styles/legal.css`.

**Modified for `noindex`:** `src/layouts/Layout.astro` (new prop), plus the 21 prototype pages
listed above.

Unrelated uncommitted work in the tree — `src/pages/fortschritt.astro`, the `uebungen/sprechen`
pages, `src/styles/skills.css`, `scripts/fetch-sprechen-bilder.mjs`, `src/lib/sprechenBilder.js`,
`public/assets/sprechen/`, `docs/monetization-strategy-v1.md` — was left alone and must not be
swept into a commit with this.

## Still open

- **`operatorPhone` is `"TODO"`.** `filled()` keeps it off the page, so nothing is broken and
  `legalComplete()` is `true`. §5 DDG wants a second fast contact channel, not specifically a
  telephone, and the email is defensible on its own. Set it in `src/lib/legal.js` if you want one
  — the row renders itself.
- **The OAuth client secret passed through a chat transcript.** Rotating it is Clients → delete →
  create new; the consent screen is unaffected and only the Supabase provider config needs the new
  values. Decide before wiring the provider, not after.
- **Neither page has been reviewed by a lawyer.** `nutzungsbedingungen.astro`'s own header says so.
  The Impressum and the DSGVO sections follow the standard shape, but "adapted from another site's
  terms" is not the same as reviewed.

## Then

Deploy so `https://deutschacademy.com/datenschutz` is live, set Branding in the Google Auth
Platform, publish the app, finish `docs/auth-sso-console-checklist.md`, and only then start Tier 0.
