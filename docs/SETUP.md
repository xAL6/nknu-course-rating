# Setup Runbook — NKNU 選課評價

The app code (Phases 0–1c) is complete. These steps provision the live backend so
auth, reviews, and the real course database activate. Until then the UI runs on a
bundled real-data fixture (`src/data/fixture-courses.json`, 5 departments).

## 1. Link the project to Vercel + provision Supabase (Marketplace)

Run these in the chat with a leading `!` so the output is captured:

```
! vercel login
! vercel link            # create/select a project
! vercel integration add supabase
! vercel env pull .env.local --yes
```

`vercel integration add supabase` provisions Supabase and injects env vars. After
`env pull`, confirm `.env.local` contains a Supabase URL + anon key + service-role
key. The app expects these names:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

If the integration named them differently (e.g. `SUPABASE_URL`), copy the values to
the `NEXT_PUBLIC_*` names above (tell me and I'll do it).

## 2. Apply the database schema

Either paste `supabase/migrations/0001_init.sql` into the Supabase dashboard
**SQL Editor** and run it, or with the Postgres connection string:

```
! psql "$POSTGRES_URL" -f supabase/migrations/0001_init.sql
```

## 3. Enable Google sign-in (NKNU-domain gated)

1. Google Cloud Console → create OAuth 2.0 Client (Web). Authorized redirect URI:
   `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
2. Supabase dashboard → Authentication → Providers → **Google**: paste the Client
   ID + secret, enable.
3. Supabase → Authentication → URL Configuration → add `http://localhost:3000` and
   your production URL to redirect allow-list.
4. **Confirm the NKNU student mail domain** and set it in `.env.local`:
   `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=gm.nknu.edu.tw,...`
   (The OAuth callback at `src/app/auth/callback/route.ts` rejects other domains
   and stores only the provider `sub` — never the email.)

## 4. Crawl real course data into the DB

```
! npm run crawl -- --year 115 --sem 1        # one semester, all departments
! npm run crawl -- --year 114 --sem 1 --year 114 --sem 2   # add more as desired
```

(Add `--dump out.json` to preview without writing.) Re-running is idempotent
(upsert by `syllabus_no`). Once the DB has data, swap the data layer off the
fixture by implementing the `TODO(supabase)` queries in `src/lib/data/courses.ts`
(or tell me and I'll wire them).

## 5. Verify

```
! npm run dev
```

- `/courses`, `/course/[code]` show DB data
- Sign in with an NKNU Google account → `/submit?course=…` shows the rating form
- A non-NKNU account is rejected at `/auth?error=domain`
- Submit a review → it appears on the course page and the summary updates (trigger)

## 6. Deploy

```
! vercel deploy --prod
```

Set the same env vars on the Vercel project (the integration handles Supabase
ones; add `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS`, `NEXT_PUBLIC_SITE_URL`, and later
`DEEPSEEK_API_KEY`).
