# NKNU 選課評價 (NKNU Course Rating Platform)

A course-rating + timetable platform for National Kaohsiung Normal University (高雄師範大學).
Course data is crawled from the school's public schedule; students sign in with their
school Google account to write per-teacher reviews. Inspired by NTU Rating / NCKU Hub.

- **Live**: https://example.invalid
- **Repo**: https://github.com/anon/nknu-course-rating

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind v4** + **shadcn/ui (Nova preset → Base UI, NOT Radix)** + Geist fonts
- **Supabase** (Postgres + Auth + RLS) — DB and auth in one vendor
- **Vercel AI SDK v6** + **DeepSeek** for the AI advisor; **AI Elements** for chat UI
- Crawler: Node + axios + cheerio (`scripts/scraper/`)
- Deployed on Vercel (project `nknu-course-rating`, team `REDACTED`)

### ⚠️ Base UI, not Radix
The shadcn Nova preset uses **Base UI**. Differences that bite:
- Use `render={<Link/>}` + `nativeButton={false}` on `<Button>`, NOT `asChild`.
- `<DropdownMenuTrigger render={<button/>}>`, `UserButton`-style components differ.
- Select `onValueChange` gives `string | null` (coerce nulls).
- AI Elements' `PromptInput` assumes Radix and won't type-check — we use a custom input.

## Commands

```bash
npm run dev            # dev server (localhost:3000)
npm run build          # production build
npm test               # vitest (unit + Supabase RLS integration); needs .env.local
npx tsc --noEmit       # type-check app
npx tsc -p tsconfig.scripts.json   # type-check the crawler/scripts

# Data pipeline (need .env.local with Supabase keys)
npm run migrate                       # apply supabase/migrations/*.sql (tracked in _migrations)
npm run crawl -- --from 110 --to 114  # full crawl all years/學制/日夜/班級 -> Supabase
npm run crawl -- --year 114 --sem 2 --dept 國文 --dump out.json  # preview, no DB write
npm run crawl:rooms                   # build 校區 map + backfill courses.campus
npm run reset-data                    # TRUNCATE all crawled course data (keeps auth)
npm run delete-semester -- 115-1      # remove one semester

vercel deploy --prod --yes            # deploy (CLI logged in as anon)
```

## The 5 course dimensions (mirror the NKNU form)

Every course offering carries: **日夜間** (`day_night` D/N) · **學年期** (`semester_id`,
e.g. `114-2`) · **上課地點** (`classroom` + `campus` 和平/燕巢) · **學制** (`degree_level` +
`degree_level_code` 1/2/3/G/S/H) · **系所/班級** (`department_code` + `class_code`/`class_name`).
The `/courses` filter cascades 學制 → 系所 → 班級 (facets via the `facet_departments` /
`facet_classes` RPCs).

## Key identity model (important)

NKNU course **codes are NOT stable**: the same `course_code` is reused for different
courses across years, AND a course's `course_code` usually **changes every year**
(e.g. 吳明倫's 演算法 was MA231→MA232→MA233→MA234→MA238 across 110–114). So we use a
**two-level identity** (migrations 0016→0019):

- **`syllabus_no`** — the only globally-unique key (per offering). Used for dedup + upsert.
- **`course_key`** = `department_code + ':' + normalized(name) + ':' + teacher_key` — the
  **logical course** (DB trigger; `nrm_name` normalizes full/half-width + strips spaces).
  Stable across years even when the code changes, while keeping different teachers apart
  (EN201 周雋 ≠ EN202 張淑君). Routes/ratings/history use it: `/course/[course_key]` merges
  a course's multi-year 開課紀錄; `course_rating_summary` is keyed by it.
- **Browse list is per-開課代號**: `groupCourses(offerings, "code")` makes the
  single-semester `/courses` list show one card per `course_code` (mirrors the school's
  開課 list, so same-semester sections like EN303/EN304 each appear) — each card links to
  its logical `course_key`. Search/detail use the default `"logical"` grouping.
- **`teacher_key`** = sorted co-teacher set joined by `、` (DB trigger), also embedded in
  `course_key`. The **rateable unit is the logical course** (one teacher's version; a
  co-taught course is one team).
- **Membership arrays** (migration 0017): one offering is listed under many contexts, so
  `class_codes`/`class_names`/`department_codes`/`degree_level_codes` are `text[]` and the
  `/courses` filters use array-containment (a course shared across 甲/乙班 or 合班 shows
  under each). Scalar `class_code`/`department_code`/`degree_level_code` remain the primary.
- Teachers are stored as a denormalized `teacher_names text[]` on each course (handles
  co-teaching; avoids fragile M:N joins). Teacher list via the `teacher_list` RPC.

## Crawler (`scripts/scraper/`)

Reverse-engineers `sso.nknu.edu.tw/Stu/scheduleDepartment.aspx` (ASP.NET WebForms).
- Cascade: 學制(`uDeformType`) → 系所(`uDepartment`) → 班級(`uClass`); search via `uSearch`.
- **Must union ALL 班級**: `全年級選課用` only holds all-grade 選修; each 班級's 必修+選修
  are locked under that class. (國文 全年級=5 vs union-of-9-classes=105.) `pickClasses`
  returns every class; dedup by `syllabus_no`.
- Campus: derived from the room-code prefix (digit → 和平; letter BT/CM/LI/MA/PH/SF/SR/TC →
  燕巢) via `crawl:rooms`, since `scheduleRoom.aspx` building lists are per-campus.
- Upsert sets the columns; DB triggers compute `course_key`/`teacher_key`. ~23k courses
  for 110-1…114-2.

## Auth (Supabase Auth, Google only)

- `/auth` → custom Google-only sign-in (`signInWithOAuth`), `/auth/callback` exchanges the
  code, **enforces the `@mail.nknu.edu.tw` domain** (`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS`),
  bootstraps a privacy-first profile (stores only the auth uid, never the email).
- Writes go through Server Actions (`src/lib/actions.ts`) guarded by `requireUser()`;
  RLS (`auth.uid() = user_id`) is the backstop. Public reads via the anon client.
- **SETUP NEEDED**: enable the Google provider in the Supabase dashboard with a Google
  Cloud OAuth client (redirect `https://<ref>.supabase.co/auth/v1/callback`). Until then
  login is inert. See `docs/SETUP.md`.

## Database

- Migrations in `supabase/migrations/` (numbered; idempotent; tracked in `_migrations`).
  `npm run migrate` applies new ones. Migrations run via direct pg (`scripts/migrate.ts`).
- RLS: public `SELECT` on reference + UGC tables; writes only by the owner.
- `course_rating_summary` is maintained by triggers on `reviews`.

## Layout / data flow

- `src/lib/data/` — server-only data layer (`courses.ts`, `reviews.ts`, `teachers.ts`,
  `community.ts`, `ai-search.ts`). `listCourses` pages past PostgREST's 1000-row cap.
- `src/lib/supabase/` — `client` (browser anon), `server` (RSC anon w/ cookies),
  `admin` (service role; server/crawler only).
- Course detail (`/course/[code]`) renders **per-teacher cards**; submit is scoped by `?t=`.
- Timetable (`/timetable`) is localStorage-only (`src/lib/timetable-store.ts`), with
  conflict detection.

## AI advisor

`/ai` (AI Elements UI) → `/api/ai/chat` streams DeepSeek with a `searchCourses` tool
(grounded RAG over the DB). Gated on `DEEPSEEK_API_KEY`; shows a "not enabled" state without it.

## Known TODO / rough edges

- Enable Google OAuth provider (above) — blocks the whole review side.
- Vote counts (`reviews.like_count/useful_count`) aren't yet maintained by a trigger.
- Comment UI not built (the `addComment` action exists).
- `teacher_list` RPC may cap at 1000 rows; search still works.
- Search is per-semester, substring (no full-text ranking, no cross-year search).
- Nightly re-crawl isn't scheduled; run `npm run crawl` when a new semester opens.
- Mobile layout not audited.
