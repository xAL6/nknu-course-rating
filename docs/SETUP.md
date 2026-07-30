# Setup Guide — NKNU 選課評價

How to provision a backend and run this project. There is **no hosted instance**; every
step below is something you do against your own Supabase / Google Cloud project.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=             # https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # public anon key (protected by RLS)
SUPABASE_SERVICE_ROLE_KEY=            # server/crawler only — bypasses RLS, never ship to browser
SUPABASE_JWT_SECRET=                  # used by the integration tests to mint user sessions
POSTGRES_URL=                         # direct pg connection string, used by `npm run migrate`
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=mail.nknu.edu.tw
NEXT_PUBLIC_SITE_URL=                 # optional; site origin for sitemap + OG tags
DEEPSEEK_API_KEY=                     # optional; turns on the AI advisor + review TL;DR
DEEPSEEK_MODEL=deepseek-v4-pro        # optional override
```

`.env*` is gitignored. Keep the service-role key and the DeepSeek key out of the repo and
out of anything that reaches the browser.

## Provision from scratch

1. **Create a Supabase project** and copy its URL + keys into `.env.local`.
2. **Apply migrations**: `npm run migrate` (applies `supabase/migrations/0001`…`0023`;
   idempotent, tracked in the `_migrations` table). Migration `0023` also creates the
   public **`avatars` Storage bucket** used for profile pictures.
3. **Google OAuth**: in Google Cloud create an OAuth 2.0 Web client with redirect URI
   `https://<your-project-ref>.supabase.co/auth/v1/callback`. Then in Supabase
   Auth → Providers: enable **Google**, disable **Email**. Set Site URL and the redirect
   allow-list (`<your-site>/auth/callback`, `http://localhost:3000/auth/callback`).
   These auth settings can also be set via the Supabase **Management API**
   (`PATCH /v1/projects/<ref>/config/auth`) with an `sbp_` access token.
   ⚠️ **Publish the OAuth consent screen**, otherwise only accounts you add as test users
   can log in.
4. **Populate courses**: `npm run crawl -- --from 110 --to 114` (~23k offerings across all
   terms), then `npm run crawl:rooms` to build the 校區 map and backfill `courses.campus`.
5. `npm run dev` → http://localhost:3000

Optionally `npm run seed-reviews` to fill in demo reviews for screenshots (`--purge`
removes every seeded user and their reviews).

## Routine operations

```bash
npm run migrate                         # apply new supabase/migrations/*.sql
npm run crawl -- --year 115             # crawl a newly-opened year (terms 1/2/暑, resilient)
npm run crawl -- --from 110 --to 114    # full re-crawl (idempotent upsert by syllabus_no)
npm run crawl:rooms                     # rebuild 校區 map + backfill courses.campus
npm run seed-reviews                    # seed demo reviews;  -- --purge  to clear all
npm run reset-data                      # TRUNCATE crawled course data (keeps auth)
npm test                                # vitest (unit + live Supabase integration)
```

Two GitHub Actions exist for running the pipeline in CI instead of locally:
`.github/workflows/crawl.yml` (manual dispatch; needs repo secrets
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) and
`.github/workflows/migrate.yml` (manual dispatch; needs `POSTGRES_URL_NON_POOLING`).

## Verify

- `/courses` and `/course/[course_key]` show DB data; search finds a course cross-semester.
- Sign in with an allowed campus Google account → `/submit?course=…` shows the rating form.
- A non-campus account is rejected at `/auth?error=domain`, and blocked at the DB even if it
  bypasses the app (RLS `is_nknu()`, migration 0018).
- Submit a review → it appears on the course page and the rating summary updates (trigger).
