# DeutschAcademy auth/SSO Tier 0 v1 (2026-09-22)

Framework foundations for accounts: the Vercel adapter, React, and the two Supabase client
factories. **No authentication behaviour, no Supabase tables, no UI.** Nothing a learner can
see changed, and that was the thing under test rather than a hoped-for side effect.

Tier 0 of `AUTH-SSO-TIERED-PROMPT.md`. Its prerequisites — Supabase project, Google OAuth
client published, both providers enabled, legal pages live — were already done and were not
touched. Tier 1 (sign-in, end to end) has not been started.

## What was built

- **`astro.config.mjs`** — `output: 'static'`, `adapter: vercel()`, `integrations: [react()]`.
  The existing `redirects`, `server` and `vite`/postcss-rtlcss blocks are byte-identical,
  comments included. The two new blocks carry comments saying static stays the default and
  that a route opts out individually with `export const prerender = false`.
- **`src/lib/supabase/browser.js`** — `createBrowserSupabase()` on `createBrowserClient` from
  `@supabase/ssr`, reading `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`.
- **`src/lib/supabase/server.js`** — `createServerSupabase({ request, cookies })` on
  `createServerClient`, wired to Astro's cookie API.
- **`src/pages/auth/ping.ts`** — throwaway proof route, `prerender = false`, returns
  `{"ok":true,"hasSession":false}`. **Tier 1 deletes it.**
- **Dependencies** — `@astrojs/vercel` 11.0.11, `@astrojs/react` 7.0.0, `react` 19.3.0,
  `react-dom` 19.3.0, `@supabase/supabase-js` 2.117.0, `@supabase/ssr` 0.12.7, via pnpm.

JSDoc, no TypeScript, in both lib files — matching the rest of `src/lib/`. `ping.ts` is `.ts`
because the tier prompt names that path; it uses Astro's own `APIRoute` type and nothing else.

## The prerender count: 671 before, 670 after — and why that is not the failure it looks like

This was the check the tier existed to pass, so it gets the detail.

| | before | after |
|---|---|---|
| `dist/**/*.html` | **671** | **670** |
| content pages | 670 | 670 |
| `/dashboard/index.html` | 1 | 0 |

**The one page that disappeared is a redirect stub, not content.** `/dashboard` → `/fortschritt`
has been configured in `astro.config.mjs` since the two dashboards were merged. Without an
adapter Astro can only implement that as a prerendered HTML file containing a meta-refresh.
With the adapter it becomes a real edge redirect, emitted into `.vercel/output/config.json`:

```json
{"src": "^/dashboard$", "headers": {"Location": "/fortschritt"}, "status": 301}
```

A 301 at the edge is strictly better than an HTML file that loads and then bounces the browser
— it is faster, and it passes link equity the meta-refresh version did not. Verified live in
dev: `curl -o /dev/null -w "%{http_code} -> %{redirect_url}" /dashboard` returns
`301 -> /fortschritt`.

**The 670 content pages are identical.** Not "the same number" — the same pages. The full
sorted list of `dist/**/*.html` was captured before the change and diffed against
`.vercel/output/static/**/*.html` after it; the only line in the diff is
`dist/dashboard/index.html`. Nothing fell out of prerendering.

The failure mode the tier prompt warned about — an adapter silently turning static pages into
on-demand ones, with a green build and a hosting bill as the only signal — did not happen.
`.vercel/output/functions/` contains exactly one function, `_render.func`, and exactly one route
points at it:

```json
{"src": "^/auth/ping/?$", "dest": "_render"}
```

**Where the build output now lives.** With the adapter, the deployable artefact is
`.vercel/output/` (`static/` plus `functions/`), not `dist/`. `dist/` is still written and still
holds the 670 content pages, but it is no longer what gets served. `.vercel` is already in
`.gitignore` (line 26). Anything that counts pages from `dist/` in future will be counting the
right pages for the wrong reason — count `.vercel/output/static`.

## Verified, and how

- **`pnpm build` green**, both before and after. 670 pages built, server bundled, no warnings
  beyond pnpm's pre-existing "Ignored build scripts: esbuild".
- **`/auth/ping` serves JSON** under `astro dev`: `200`, `content-type: application/json`,
  body `{"ok":true,"hasSession":false}`. The adapter works; on-demand rendering works.
- **Existing pages still 200** in dev: `/`, `/uebungen`, `/fortschritt`.
- **No React shipped to any content page.** The React client runtime is emitted to
  `_astro/client.DnR7YyAB.js` (221 KB), and **zero HTML files reference it** — checked by
  grepping every built page for the filename. Astro emits the renderer entry once the
  integration is installed whether or not an island uses it; with no islands yet it is an
  unreferenced file on the CDN, not bytes in a learner's browser. Tier 1's islands will be the
  first thing to pull it in, and only on the pages that mount them.
- **`git status` clean of collateral.** The only paths this tier touched are `astro.config.mjs`,
  `package.json`, `pnpm-lock.yaml`, `src/lib/supabase/` and `src/pages/auth/`.

## The Astro middleware constraint, so Tier 1 does not rediscover it

**Astro middleware does not run per request for a prerendered page.** For the 670 static pages
it runs once, at build time. This is not a bug and not something to configure around — it is
what prerendering means.

The consequence for Tier 1: the Next.js habit of "refresh the session in middleware on every
request" applies *only* to the `prerender = false` routes. On every other page — which is to
say, on essentially the whole site — there is no server in the request path, and the browser
client refreshes its own session from the cookie.

This is why `@supabase/ssr` is non-negotiable here and plain `createClient` from
`@supabase/supabase-js` is not an option for anything session-bearing. `createBrowserClient`
stores the session in a **cookie**, not localStorage, so the same bytes are readable by the
static pages in the browser and by the server routes on Vercel. One session, two readers.
A localStorage session would be invisible to `/auth/callback` and the two would drift.

Two things follow that Tier 1 has to design for, not discover:

1. **A prerendered page cannot know who you are at build time**, so the nav's signed-in state
   is necessarily client-side. That is the flash-of-signed-out-UI problem, and Tier 1 step 7
   (the pre-paint cookie-presence hint) is the answer to it.
2. **`getUser()`, never `getSession()`**, on the server. `getSession()` trusts the cookie;
   `getUser()` revalidates it with Supabase. The cookie is attacker-controlled.

## Cookie handling, and the one non-obvious bit of `server.js`

`getAll()` reads the raw `Cookie` header via `parseCookieHeader` rather than Astro's
`cookies.get()`. This is deliberate: `@supabase/ssr` needs *every* cookie at once, because a
session larger than the 4KB cookie limit is split across numbered chunks — and Astro's
`AstroCookies` has `get`, `has`, `set` and `delete` but **no enumeration method**, so there is
no way to find `sb-…-auth-token.1` without reading the header yourself. Confirmed against
`node_modules/astro/dist/core/cookies/cookies.d.ts`.

`parseCookieHeader` can yield `value: undefined` for a bare `name=` cookie, which the auth
library does not expect, so those are coerced to `""`.

`setAll()` passes `@supabase/ssr`'s options straight through to `cookies.set()`. Overriding
`httpOnly` / `sameSite` / `secure` / `maxAge` / `path` there is a known way to make sessions
stop persisting for reasons that look like a server bug.

One limitation, written down rather than left to bite: `getAll()` reads the *incoming* request
header, so a cookie set earlier in the same request is not visible to a later `getAll()` in that
same request. This matches the pattern in Supabase's own Astro guide and does not affect the
single `exchangeCodeForSession` call Tier 1 makes. If a route ever needs to write and then
re-read a session cookie within one request, that is the thing to remember.

## Not done in this tier — deliberately

- No middleware. No `/auth/callback`, no sign-out route, no `/anmelden`.
- No React component of any kind. No `src/styles/auth.css`.
- No Supabase table, no RLS policy, no migration.
- `NavAccount.astro` still says "There is no account system yet" at line 18, and is still
  correct. Tier 1 changes the fact and the comment together.
- `src/lib/progress.js` untouched; `getResume({ remote })` still always local, as its own
  comment says. That seam is Tier 2's.
- No existing page, component, style or lib module was modified. Beyond `astro.config.mjs`,
  nothing that existed before this tier was edited at all.

## Files changed

**New:** `src/lib/supabase/browser.js`, `src/lib/supabase/server.js`,
`src/pages/auth/ping.ts`, `docs/auth-sso-tier0-v1.md`.

**Modified:** `astro.config.mjs`, `package.json`, `pnpm-lock.yaml`.

Unrelated uncommitted work in the tree — `src/pages/fortschritt.astro`,
`src/pages/uebungen/artikel-trainer.astro`, `src/styles/verben-praepositionen.css`, the deleted
`.t/` scratch files, `AUTH-SSO-NEXT-STEPS-PROMPT.md`, `docs/monetization-strategy-v1.md` — was
left alone and must not be swept into a commit with this.

## Still open

- **Nothing is deployed.** The adapter has been exercised by `pnpm build` and by `astro dev`,
  never by Vercel. The first real deploy is the first time the `_render` function runs in
  production, and it is worth watching that `/auth/ping` answers there before Tier 1 depends
  on it.
- **`PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` are set in Vercel** for Production,
  Preview and Development, and in `.env.local`. Production and Preview were created as
  **Sensitive**, so their values can never be read back from the dashboard or CLI — harmless
  for a publishable key that ships in the client bundle anyway, but it means a future typo
  cannot be diagnosed by inspection, only by replacement.
- **Brevo SMTP is not confirmed live.** Tier 1's magic-link half cannot be honestly tested
  without it; the tier prompt's own instruction is to ship the Google half and hold the email
  half rather than test through Supabase's rate-limited built-in mailer.
- **The OAuth client secret passed through a chat transcript** and has still not been rotated.
  Carried over from `docs/auth-legal-pages-v1.md`; it is cheaper to rotate before the provider
  is wired than after.

## Then

Tier 1 — `src/middleware.js`, `/auth/callback` with the open-redirect guard, `/auth/abmelden`,
`SignInCard.jsx`, `/anmelden`, `AuthStatus.jsx` in the nav, and the pre-paint cookie hint.
It deletes `src/pages/auth/ping.ts` as its first step.
