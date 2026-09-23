# DeutschAcademy — Google sign-in without the funky hostname (v1, 2026-09-23)

## How to use this file

Paste the **Prompt** block into Claude Code in this repo. Self-contained — a fresh session
can run it. It builds on Tiers 0 and 1, which are already merged (`eda040c`).

---

## The problem, precisely

The Google consent screen currently reads:

> Choose an account **to continue to putrkafrcpqosqxrgttp.supabase.co**

That string is the host of the OAuth **redirect URI**. Google displays it because the app is
not brand-verified, and it cannot be: brand verification requires proving ownership of every
authorised domain, and `supabase.co` is not ours. Nothing set on the Branding page overrides
this while the redirect goes through Supabase. This is Google correctly telling the learner
where they are being sent — the warning works, the address is just unrecognisable.

For this audience — people preparing for DTZ and Leben in Deutschland, often cautious about
anything official-looking — a random hostname on a Google sign-in screen reads as phishing.

**Two supported fixes exist.** A Supabase Custom Domain (`auth.deutschacademy.com`) is the
official one but needs a Pro plan plus the add-on, about $35/month. This file does the other:
switch Google sign-in from the redirect flow to the **Google Identity Services ID-token
flow**, which costs nothing.

## What actually changes

| | Now (`signInWithOAuth`) | After (`signInWithIdToken`) |
|---|---|---|
| Where sign-in happens | Browser leaves the site, goes to Google, is redirected to Supabase, then back | A Google button/prompt **on `/anmelden`**; the browser never leaves |
| What Google is told | "send them to `<ref>.supabase.co/auth/v1/callback`" | Nothing — no redirect is involved |
| What the learner reads | `putrkafrcpqosqxrgttp.supabase.co` | Our own page; One Tap often shows no consent screen at all |
| Google Cloud field used | Authorised **redirect URIs** | Authorised **JavaScript origins** |
| Supabase's role | Talks to Google on our behalf | Verifies a signed ID token we hand it |

Security is equivalent: the ID token is signed by Google and Supabase verifies that signature
server-side. The conversation simply happens on our origin instead of Supabase's.

**Magic link and password sign-in are unaffected** and must keep working exactly as they do.
`/auth/callback` stays — it still handles the PKCE `?code=` for magic link and the
`type=recovery` branch for password reset. Only the Google path changes.

---

## Prompt

> In the deutschacademy Astro repo, replace the Google **redirect** sign-in flow with the
> Google Identity Services **ID-token** flow, so the consent screen stops showing
> `putrkafrcpqosqxrgttp.supabase.co`. Read `docs/auth-sso-tier1-v1.md` first — it documents
> what Tier 1 built and why.
>
> **1. Read before changing.** `src/components/auth/SignInCard.jsx` currently calls
> `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } })`
> at around line 126. Everything else in that file — magic link, password sign-in, sign-up,
> the reset-password branch at line 224 — stays exactly as it is.
>
> **2. Load the GIS script only where it is used.** `https://accounts.google.com/gsi/client`,
> loaded from `/anmelden` only — never from `Layout.astro` and never from a component that
> the nav renders. The nav's `AuthStatus` island is already on all ~670 pages and that
> payload is a live concern (see "Still open" in the Tier 1 note); do not make it worse.
> Load it lazily on mount and clean up on unmount.
>
> **3. Swap the call.** Google's callback hands back `response.credential`, a JWT. Pass it to:
> ```js
> await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce })
> ```
> Then navigate to `next` (same value the current Google button computes) using the same
> open-redirect guard shape as `src/pages/auth/callback.ts` — a `next` must start with a
> single `/`. Do not trust anything else.
>
> **4. Use a nonce.** Optional per Supabase's docs, recommended here. Generate a random
> string, pass the **SHA-256 hash** to GIS as its `nonce`, and the **raw** string to
> `signInWithIdToken`. Getting these the wrong way round fails with an unhelpful error, so
> comment which is which. If you cannot make the nonce work reliably, say so and stop rather
> than silently enabling Supabase's "skip nonce check" — that is a security setting and it is
> Edgar's call, not yours.
>
> **5. Accept a real constraint and flag it.** The ID-token flow requires **Google's own
> rendered button** (`google.accounts.id.renderButton`) or One Tap; a fully custom-styled
> button is not permitted for this flow. The existing `da-auth-btn--google` button with the
> German label `Mit Google anmelden` and the inline `GoogleMark` SVG therefore cannot survive
> as-is. Get as close as the API allows (`renderButton` takes locale, size, shape, theme, and
> width — set locale from `da_lang` so it matches the page language), keep the surrounding
> card layout and dark-mode treatment from `src/styles/auth.css` intact, and note in the tier
> doc exactly what visual control was lost. Do not fake a custom button that triggers the
> Google one underneath.
>
> **6. Keep One Tap off for now.** `renderButton` only. One Tap interacts with FedCM and
> third-party-cookie behaviour that varies by browser, and debugging that is a separate job
> from this change. Note it as a possible follow-up.
>
> **7. Do not touch** `src/pages/auth/callback.ts`, `src/pages/auth/abmelden.ts`,
> `src/middleware.js`, or `src/components/auth/AuthStatus.jsx`. Magic link and password reset
> both still route through the callback and must keep working — test both after the change,
> not just Google.
>
> **8. Console changes are Edgar's**, not yours. List them precisely in the tier doc:
> which Google Cloud fields to fill (Authorised JavaScript origins), with which exact values,
> and whether the existing redirect URI should stay or go. State plainly that the code will
> not work until those are set, so a failed first test is expected rather than a bug to chase.
>
> Write `docs/auth-gis-v1.md` in the format of `docs/auth-sso-tier1-v1.md`: what changed, what
> was verified and how, what visual control was lost on the button, and what Edgar must do in
> the console. Do not commit unless asked.

## Definition of Done

- `/anmelden` renders Google's button; signing in completes without leaving the site, and no
  screen anywhere shows `putrkafrcpqosqxrgttp.supabase.co`.
- Magic link still works end to end. Password sign-in and reset still work end to end.
- The GIS script is requested **only** on `/anmelden` — verify in the network tab from a
  content page such as `/uebungen`, not by reading the code.
- The nav account state still reflects sign-in/sign-out with no regression.
- `docs/auth-gis-v1.md` written, including the console steps and the button-styling loss.

## Console steps for Edgar (the code depends on these)

1. **Google Cloud → Google Auth Platform → Clients → `deutschacademy-web`**
   - **Authorised JavaScript origins** — add:
     - `https://deutschacademy.com`
     - `http://localhost:4321` (Astro dev)
   - **Authorised redirect URIs** — *leave* `https://putrkafrcpqosqxrgttp.supabase.co/auth/v1/callback`
     in place. It is unused by the new flow but harmless, and removing it breaks the old flow
     instantly if this change ever has to be reverted.
2. **Supabase → Authentication → Providers → Google** — stays enabled with the same client ID
   and secret. If the provider panel offers an **Authorized Client IDs** field, put the same
   client ID there: the ID-token flow checks the token's `aud` against that list.
3. Changes to JavaScript origins can take a few minutes to propagate. A first failure right
   after saving usually means "wait", not "broken".

## Still open, unchanged by this file

- **React on every page** (~66 KB gzipped extra). Tier 1's note documents it and offers the
  fix: keep React for `/anmelden` only and rewrite `AuthStatus` as a vanilla script like every
  other interactive thing in this repo. Cheaper now than after Tier 4.
- **Local `pnpm build` fails on Windows** — `EPERM ... symlink`, because Developer Mode is off.
  Vercel is unaffected.
- **Three places still say "ohne Konto"** — a positioning decision, not a bug.
