# Setup / Operations Runbook — NKNU 選課評價

The app is **live and fully provisioned**. This is the operational reference; the
"from scratch" section at the end is only for re-creating the backend elsewhere.

## Current state (provisioned)

- **Supabase** project `your-project-ref` (region us-east-1). Migrations applied
  through `0023`. ~23k offerings crawled for 110–114 (all terms), with membership arrays.
  Public **`avatars` Storage bucket** provisioned (0023) for profile pictures. Demo reviews
  may be seeded (`npm run seed-reviews`; `--purge` to clear).
- **Auth**: Google provider **enabled**; Email/password **disabled** (Google-only). Site
  URL + redirect allow-list set. Domain gate `mail.nknu.edu.tw` enforced in the callback
  **and** at the DB (`is_nknu()` RLS, migration 0018). First sign-in → `/me?welcome=1` onboarding.
- **AI advisor**: live — `DEEPSEEK_API_KEY` + `DEEPSEEK_MODEL=deepseek-v4-pro` set in Vercel
  (prod/preview/dev) and `.env.local`.
- **Vercel**: deployed to `https://example.invalid` (CLI; the
  GitHub auto-deploy hook is unreliable — deploy with `vercel deploy --prod --yes`).

`.env.local` env var names the app expects:

```
NEXT_PUBLIC_SUPABASE_URL= / NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # server/crawler only — bypasses RLS
SUPABASE_JWT_SECRET=                  # used by tests to mint user sessions
POSTGRES_URL=                         # direct pg, used by npm run migrate
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=mail.nknu.edu.tw
NEXT_PUBLIC_SITE_URL=https://example.invalid
DEEPSEEK_API_KEY=                     # turns on the AI advisor + review TL;DR (set)
DEEPSEEK_MODEL=deepseek-v4-pro        # optional override (default deepseek-v4-pro)
```

## Remaining manual steps

1. **Publish the Google OAuth consent screen** (Google Cloud → OAuth consent screen →
   Publish app). Until then only added test users can log in. Google client lives in the
   project owner's Google Cloud account; redirect URI is
   `https://your-project-ref.supabase.co/auth/v1/callback`. *(Only remaining manual step.)*

`DEEPSEEK_API_KEY` is already set — the AI advisor is live.

## Routine operations

```bash
npm run migrate                         # apply new supabase/migrations/*.sql
npm run crawl -- --year 115             # crawl a newly-opened year (terms 1/2/暑, resilient)
npm run crawl -- --from 110 --to 114    # full re-crawl (idempotent upsert by syllabus_no)
npm run crawl:rooms                     # rebuild 校區 map + backfill courses.campus
npm run seed-reviews                    # seed demo reviews (funny);  -- --purge  to clear all
npm test                                # vitest (unit + live Supabase integration)
vercel deploy --prod --yes              # deploy
```

The nightly GitHub Action (`.github/workflows/crawl.yml`) re-crawls automatically; it needs
repo secrets `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Verify

- `/courses`, `/course/[course_key]` show DB data; search finds a course cross-semester.
- Sign in with an NKNU Google account → `/submit?course=…` shows the rating form.
- A non-NKNU account is rejected at `/auth?error=domain`, and blocked at the DB even if it
  bypasses the app (RLS `is_nknu()`).
- Submit a review → appears on the course page; summary updates (trigger).

## From scratch (re-provision elsewhere)

1. `vercel link` → `vercel integration add supabase` → `vercel env pull .env.local --yes`
   (copy values to the `NEXT_PUBLIC_*` names above if the integration names them differently).
2. `npm run migrate` to apply all migrations (`0001`…`0023`).
3. Google Cloud → OAuth 2.0 Web client (redirect `https://<ref>.supabase.co/auth/v1/callback`);
   enable Google + disable Email in Supabase Auth → Providers; set Site URL + redirect
   allow-list (`<site>/auth/callback`, `http://localhost:3000/auth/callback`). These auth
   settings can be set via the Supabase **Management API** (`PATCH /v1/projects/<ref>/config/auth`)
   with an `sbp_` access token.
4. `npm run crawl -- --from 110 --to 114` to populate courses, then `vercel deploy --prod`.
