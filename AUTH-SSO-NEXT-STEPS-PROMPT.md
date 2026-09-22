# DeutschAcademy — Auth/SSO — Next Steps Prompt (v1, 2026-09-21)

## How to use this file

Paste the **Prompt** block below into Claude Code running in this repo
(`C:\Users\Edgar\Projects\deutschacademy`). It is self-contained — a fresh session with no
memory of how these files got here can run it.

This is the work that has to happen **in the repo before the Google app can be published**.
It sits between the console checklist (`docs/auth-sso-console-checklist.md`) and Tier 0 of
`AUTH-SSO-TIERED-PROMPT.md`. Do not start Tier 0 until this is deployed.

---

## State (already done — do not redo)

**Supabase** — project live, Frankfurt, empty:

| | |
|---|---|
| ref | `putrkafrcpqosqxrgttp` |
| URL | `https://putrkafrcpqosqxrgttp.supabase.co` |
| region | `eu-central-1` (Central EU, Frankfurt) |
| publishable key | `sb_publishable_hubmE7PkUjjMbgTXo70qFQ_z95q0dse` |
| automatic RLS | on — an event trigger enables RLS on every new `public` table |

**Google Cloud** — consent screen configured, OAuth client created, **app still in Testing**:

| | |
|---|---|
| client ID | `275259116185-ui85tfjnivl9j8s0htl20v8omi328720.apps.googleusercontent.com` |
| redirect URI | `https://putrkafrcpqosqxrgttp.supabase.co/auth/v1/callback` |

Publishing is blocked by Google with *"To publish your app, you must complete your
configuration on the Branding page"* — Branding wants a privacy-policy URL on an authorised
domain. `/datenschutz` exists in this repo but is **not deployed yet**. That is the whole
reason this file exists.

**Legal pages** — written, not yet verified by a build:
`src/lib/legal.js` (single source of truth — Edgar Kretschmann, Ansbacher Straße 48,
10777 Berlin), `src/pages/impressum.astro`, `src/pages/datenschutz.astro`,
`src/pages/nutzungsbedingungen.astro`, `src/styles/legal.css`, plus a "Rechtliches" footer
column in `src/pages/index.astro` and four i18n keys in all five `public/i18n/*.json`.

They were written on a Linux mount where `pnpm build` could not run (the `node_modules`
pnpm symlinks are Windows junctions and error through the mount). **Nothing here has been
built or rendered. Assume it is unverified.**

---

## Prompt

> Work in the deutschacademy Astro repo at the repo root. Four tasks, in this order. Do not
> start any part of `AUTH-SSO-TIERED-PROMPT.md` — this is the work that comes before it.
>
> **1. Verify the legal pages build and render.**
> Run `pnpm build`. Before you start, record the current prerendered page count
> (`dist/**/*.html` was **668** at the last known-good build); afterwards it should be
> **671** — the three new legal pages and nothing else. If it is not 671, find out why
> before continuing.
> Then run `astro dev --background` (see `CLAUDE.md`) and actually load `/impressum`,
> `/datenschutz` and `/nutzungsbedingungen`. Check in both light and dark mode, and at phone
> width. These pages were written blind — fix whatever is broken.
> Confirm specifically that **no page renders the literal string "TODO"** and that no red
> warning banner appears (`legalComplete()` in `src/lib/legal.js` should return `true`).
>
> **2. Fix the Google Fonts leak — `/datenschutz` currently makes a false claim.**
> `src/pages/pruefungen/leben-in-deutschland/fakten.astro` loads Inter and JetBrains Mono
> from `fonts.googleapis.com`. That sends every visitor's IP address to Google from a real
> learner route, while `src/layouts/Layout.astro` asserts in a comment that "nothing is
> fetched from fonts.googleapis.com" and `/datenschutz` tells learners there are no
> third-party requests beyond the ones it lists. One of those has to change, and it should
> be the font loading, not the policy.
> `public/fonts/` already self-hosts Sora, Albert Sans, Big Shoulders Display, Bungee Shade
> and Aktiv Grotesk. Prefer **switching that page to an already self-hosted family** over
> adding two more font files — check how `fakten-layouts.css` uses `var(--font-body)` and
> `"JetBrains Mono"` and pick the closest existing pair. If the monospace is load-bearing
> for that layout, self-host JetBrains Mono as a woff2 in `public/fonts/` instead, matching
> how the other families are declared.
> `src/pages/concepts.astro` does the same thing and also pulls images from
> `picsum.photos`, but it is a design-exploration page, not a learner route. Do **not**
> rewrite it — instead make sure it is not indexed (see task 3), and note the decision.
>
> **3. Deal with `/former-site`, which contradicts the new Impressum.**
> `src/pages/former-site.astro` renders `src/components/Footer.astro`, which contains
> `Deutsch Academy Inc., 35F Tycoon Centre, Pearl Drive, Ortigas, 1600 Pasig City, Manila`.
> It builds to `dist/former-site/index.html` and is publicly reachable. The operator is now
> a German sole trader in Berlin, so a live page advertising a Manila company address is
> both wrong and a liability the moment the site starts holding accounts.
> There is no `public/robots.txt` and no `noindex` anywhere in the project.
> Ask Edgar which he wants before changing it — archive reference, or delete — and if he is
> not available, take the reversible option: add `<meta name="robots" content="noindex" />`
> to `/former-site` and `/concepts` (and any other prototype route you find under
> `src/pages/` that is not linked from the site's navigation), and add a `public/robots.txt`
> disallowing them. Do not delete anything.
>
> **4. Review the legal pages against the code, then report.**
> The pages claim specific things about what this site stores. Verify each against reality
> rather than trusting the text:
> - `/datenschutz` says there is no analytics or tracking. Grep for `gtag`,
>   `googletagmanager`, `plausible`, `fathom`, `matomo`, `posthog`, `hotjar`, `clarity`,
>   `sentry` and `@vercel/analytics` across `src/`, `public/` and `package.json`.
> - It lists the stored data as progress, exam state, writing drafts and settings. Compare
>   against every `localStorage` key in the repo — `AUTH-SSO-TIERED-PROMPT.md` Tier 3 has
>   the full inventory. If a key exists that the page does not describe, say so.
> - It names Supabase, Vercel, Google and Brevo as the only recipients. Confirm no other
>   third-party endpoint is contacted from any learner-facing route.
> Write `docs/auth-legal-pages-v1.md` in the format of `docs/self-study-tools-v1.md`: what
> was built, every claim that was verified and how, every claim that is aspirational
> (Supabase and Brevo are named but not yet wired up — that is Tiers 1–4 and the page is
> written in advance deliberately, which the note must state plainly), and what you changed
> in tasks 2 and 3.
>
> Do not commit or push unless Edgar asks. Note that the working tree already has unrelated
> uncommitted changes (`src/pages/fortschritt.astro`, the `uebungen/sprechen` pages,
> `src/styles/skills.css`, `scripts/fetch-sprechen-bilder.mjs`) that are **not** part of
> this work — leave them alone and do not sweep them into a commit.

---

## Definition of Done

- `pnpm build` succeeds; `dist/**/*.html` count is 671.
- All three legal routes render correctly in light and dark mode at phone width, with no
  "TODO" text and no warning banner.
- No learner-facing route fetches from `fonts.googleapis.com` — verified in devtools'
  network tab, not just by grep.
- `/former-site` and `/concepts` are either removed or `noindex`-ed, with `robots.txt`
  backing it up, and the choice is recorded.
- `docs/auth-legal-pages-v1.md` written, separating verified claims from aspirational ones.

## Then, and only then

1. **Deploy.** `/datenschutz` must be live at `https://deutschacademy.com/datenschutz`.
2. **Google Auth Platform → Branding** — set home page `https://deutschacademy.com`,
   privacy policy `https://deutschacademy.com/datenschutz`, terms
   `https://deutschacademy.com/nutzungsbedingungen`, authorised domain `deutschacademy.com`.
3. **Audience → Publish app.** Confirm status reads *In production*. This removes the
   100-user lifetime cap and the 7-day consent expiry.
4. Finish the remaining console steps in `docs/auth-sso-console-checklist.md` — Supabase
   Google provider, URL configuration, Brevo, env vars.
5. **Then** start Tier 0 of `AUTH-SSO-TIERED-PROMPT.md`.

## Open question for Edgar

- The OAuth **client secret** was displayed in an automated browser session and so passed
  through a chat transcript. Google shows it once and never again. Rotating it is a
  two-minute job (Clients → delete → create new, consent screen is unaffected) and only the
  Supabase provider config would need the new values. Decide before wiring the provider up,
  not after.
- Phone number for the Impressum: currently none. Email alone is defensible under §5 DDG
  (the law requires a second fast contact channel, not specifically a telephone), but if you
  want one, set `operatorPhone` in `src/lib/legal.js` and the row renders itself.
