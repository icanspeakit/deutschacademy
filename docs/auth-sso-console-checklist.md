# DeutschAcademy — SSO Console Checklist (Edgar's manual work, v1, 2026-09-21)

Everything here is clicking in someone else's dashboard — none of it can be done by an
agent in the repo. Work top to bottom; later steps consume values produced by earlier
ones. The companion build prompt is `AUTH-SSO-TIERED-PROMPT.md` at the repo root, and
**Tier 0 there must not start until Section 4 below is done**, because it needs the
Supabase project ref and anon key.

Record every value you produce in the "Values produced" table at the bottom. Nothing in
this file should ever contain a secret — write secrets straight into Vercel and
`.env.local`, never into a tracked file.

---

## 0. Ground rules

- **Identity for everything:** `hello@deutschacademy.com`. Never `icanspeak`.
  icanspeak's only role from here on is *recovery owner*.
- **Region: EU (Frankfurt, `eu-central-1`)** for Supabase. DeutschAcademy serves learners
  in Germany; DSGVO makes an EU region the default, and the region **cannot be changed
  after the project is created**.
- Never commit `service_role` keys, SMTP passwords or OAuth client secrets.

---

## 1. Make the mailbox real (do this first — everything else sends mail to it)

- [ ] Set up forwarding `hello@deutschacademy.com` → your icanspeak Gmail
      (Cloudflare Email Routing if DNS is on Cloudflare; otherwise registrar forwarding)
- [ ] Send a test message to `hello@` and confirm it arrives
- [ ] Gmail → Filters → create a filter on `to:hello@deutschacademy.com` with
      **Never send it to Spam** (forwarded mail fails SPF alignment and gets filtered —
      security alerts are exactly the mail you cannot afford to lose)
- [ ] Gmail → "Send mail as" → add `hello@deutschacademy.com`
      (park this until Section 6 gives you SMTP credentials, then finish it)

## 2. Harden the Google account behind `hello@`

Forwarding lives in DNS. If the domain lapses, the mailbox *and* the account recovery
path die together. These settings live in Google's own records and survive that.

- [ ] Recovery email = icanspeak Gmail
- [ ] Recovery phone set
- [ ] 2-Step Verification on
- [ ] Backup codes saved somewhere that is **not** that Gmail

## 3. Google Cloud — OAuth client

No billing account. No free trial. No card. Sign-in uses only the non-sensitive scopes
(`email`, `profile`, `openid`): no verification, no quota, no 100-user cap once published.

- [ ] Project `deutschacademy` created (Organization: "No organization" is correct and
      expected for a consumer account — see notes at the bottom)
- [ ] **IAM & Admin → IAM** → add icanspeak Gmail as a second **Owner** (break-glass)
- [ ] **APIs & Services → OAuth consent screen**
  - [ ] User type: **External**
  - [ ] App name: `DeutschAcademy` — this is what learners read on the Google screen
  - [ ] User support email: `hello@deutschacademy.com`
  - [ ] App domain / home page: `https://deutschacademy.com`
  - [ ] Authorised domain: `deutschacademy.com`
  - [ ] Developer contact: `hello@deutschacademy.com`
  - [ ] Scopes: add **nothing**. The three basic ones are implicit. Adding any other
        scope drops you into verification and the 100-user cap.
  - [ ] **Publish app** (Publishing status → In production). Leaving it in Testing caps
        you at 100 users and expires every consent after 7 days.
- [ ] **APIs & Services → Credentials → Create credentials → OAuth client ID**
  - [ ] Application type: **Web application**
  - [ ] Name: `deutschacademy-web`
  - [ ] **Authorised redirect URIs** — this is the field people get wrong. It is
        **Supabase's** URL, not yours. You need Section 4's project ref first, so either
        do Section 4 now and come back, or save and edit:
        `https://<SUPABASE-PROJECT-REF>.supabase.co/auth/v1/callback`
  - [ ] Authorised JavaScript origins: leave empty. Only needed if you later add Google
        One Tap; the standard flow never touches it.
  - [ ] Copy **Client ID** and **Client secret** → Section 4

## 4. Supabase project

- [ ] Sign up / sign in as `hello@deutschacademy.com`
- [ ] **Check first:** if Colevitate's Supabase lives on this same account you are at the
      Free plan's 2-active-project ceiling. Keep the two products on separate accounts.
- [ ] New project
  - [ ] Name: `deutschacademy`
  - [ ] **Region: Central EU (Frankfurt)** — permanent, see Section 0
  - [ ] Database password → password manager, not this file
- [ ] Organization → Members → invite icanspeak Gmail as Owner (break-glass)
- [ ] **Project Settings → API** → copy **Project URL** and **anon / public key** → Section 7
- [ ] Note the **project ref** (the subdomain in the Project URL) → go finish Section 3's
      redirect URI with it
- [ ] The `service_role` key exists on that same page. You do **not** need it for any
      tier of the build prompt. Do not copy it anywhere.

## 5. Connect Google to Supabase

- [ ] **Authentication → Sign In / Providers → Google** → Enable
- [ ] Paste Client ID and Client secret from Section 3
- [ ] Confirm the callback URL Supabase displays matches, character for character, the
      redirect URI you registered in Google Cloud
- [ ] **Authentication → URL Configuration**
  - [ ] Site URL: `https://deutschacademy.com`
  - [ ] Redirect URLs — add all of:
        - `https://deutschacademy.com/auth/callback`
        - `https://*.vercel.app/auth/callback`  (preview deployments)
        - `http://localhost:4321/auth/callback` (Astro dev default port)

## 6. Brevo (transactional mail)

Supabase's built-in mailer is rate-limited and explicitly not for production. Free Brevo
is 300 sends/day, 100k contacts, with a non-removable "Sent with Brevo" footer.

- [ ] Brevo account as `hello@deutschacademy.com`
- [ ] **Senders, Domains & Dedicated IPs → Domains** → authenticate `deutschacademy.com`
- [ ] Add the **SPF, DKIM and DMARC** records Brevo gives you to the domain's DNS,
      wait for all three to verify green
- [ ] **SMTP & API → SMTP** → generate an SMTP key
- [ ] Supabase → **Project Settings → Authentication → SMTP Settings** → Enable custom SMTP
  - Host `smtp-relay.brevo.com`, Port `587`
  - User = your Brevo SMTP login, Password = the SMTP key
  - Sender email `hello@deutschacademy.com`, Sender name `DeutschAcademy`
- [ ] Go back and finish Gmail "Send mail as" from Section 1 with the same credentials
- [ ] Send yourself a test magic link and confirm it lands in the inbox, not spam

## 7. Environment variables

Astro only exposes variables prefixed `PUBLIC_` to the browser. The anon key is designed
to be public — RLS is what protects the data, not key secrecy.

- [ ] **Vercel → Project → Settings → Environment Variables**, set for
      Production + Preview + Development:
      - `PUBLIC_SUPABASE_URL`
      - `PUBLIC_SUPABASE_ANON_KEY`
- [ ] Local `.env.local` — add the same two keys
- [ ] Confirm `.env.local` is gitignored

## 8. Verification pass (do this before starting Tier 1)

- [ ] Google consent screen shows "DeutschAcademy" and `hello@deutschacademy.com`
- [ ] Publishing status reads **In production**
- [ ] Supabase project region reads **Frankfurt**
- [ ] Both Supabase and Google Cloud list icanspeak as a second owner
- [ ] A test mail from Brevo arrives at `hello@`
- [ ] `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` present in Vercel and `.env.local`

---

## Values produced (fill in — no secrets)

| Value | Where it came from | Where it goes |
|---|---|---|
| Supabase project ref | Section 4 | Google redirect URI (Section 3) |
| Supabase Project URL | Section 4 | `PUBLIC_SUPABASE_URL` |
| Supabase anon key | Section 4 | `PUBLIC_SUPABASE_ANON_KEY` |
| Google Client ID | Section 3 | Supabase Google provider |
| Google Client secret | Section 3 | Supabase Google provider — **secret, do not record here** |
| Brevo SMTP key | Section 6 | Supabase custom SMTP — **secret, do not record here** |

## Notes / decisions

- **"No organization" is correct.** A Google Cloud Organization only exists for domains
  enrolled in Google Workspace or Cloud Identity. A consumer account gets "No organization"
  and there is nothing to choose. Projects can be migrated into an org later if
  DeutschAcademy ever becomes a company with staff, so this is not a one-way door.
- **No billing account anywhere in this checklist.** If a Google API that actually bills
  is ever enabled (Maps, Translate, Cloud TTS), add the card *then*, and set a budget
  alert at €1 in the same sitting.
- **Free-tier ceilings that actually bind:** Supabase 2 active projects, 500 MB database,
  and a pause after 1 week of inactivity. The 50,000 MAU allowance is not a real
  constraint at this stage and should be ignored when planning.
