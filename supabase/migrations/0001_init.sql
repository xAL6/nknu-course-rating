-- NKNU Course Rating — initial schema
-- Conventions: snake_case, RLS on. Public can read course/review data;
-- only authenticated NKNU-domain users can write reviews/votes/bookmarks.

create extension if not exists pg_trgm;

-- ── Reference data (populated by the crawler, service-role only) ──

create table if not exists semesters (
  id    text primary key,                 -- e.g. '115-1'
  year  smallint not null,                -- ROC year, e.g. 115
  term  smallint not null,                -- 1 / 2 / 3 (暑期)
  label text not null
);

create table if not exists departments (
  code        text primary key,           -- e.g. '201011014'
  name        text not null,              -- 國文學系
  college     text,                       -- 文學院
  campus      text,                        -- 和平 / 燕巢
  degree_type text                         -- 大學部 / 碩士班 ...
);

create table if not exists teachers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  name_en    text
);

-- One row per offering (a course in a specific semester). The "logical course"
-- that reviews attach to is keyed by (course_code, primary_teacher_id).
create table if not exists courses (
  id              uuid primary key default gen_random_uuid(),
  syllabus_no     text unique,            -- NKNU SyllabusNo — stable offering id
  course_code     text not null,          -- e.g. 'CH001'
  name            text not null,
  name_en         text,
  credits         numeric(3,1),
  course_type     text,                   -- 必修 / 選修
  category        text,                   -- raw extra column (備註/必選別)
  department_code text references departments(code),
  class_name      text,                   -- 國文系全年級 ...
  semester_id     text references semesters(id),
  campus          text,
  day_night       text,                   -- D / N
  class_time_raw  text,                   -- '13,14'
  slots           jsonb default '[]'::jsonb,  -- [{weekday:1, period:'3'}, ...]
  classroom       text,
  enroll_count    smallint,
  enroll_cap      smallint,
  syllabus_url    text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists courses_code_idx on courses (course_code);
create index if not exists courses_semester_idx on courses (semester_id);
create index if not exists courses_dept_idx on courses (department_code);
create index if not exists courses_name_trgm on courses using gin (name gin_trgm_ops);

create table if not exists course_teachers (
  course_id  uuid references courses(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete cascade,
  primary key (course_id, teacher_id)
);

-- ── User-generated content ──

create table if not exists profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  reputation   int not null default 0,
  created_at   timestamptz default now()
  -- NOTE: no email column by design (privacy-first).
);

create table if not exists reviews (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  semester_id  text references semesters(id),
  sweetness    smallint check (sweetness between 1 and 5),
  coolness     smallint check (coolness between 1 and 5),
  loading      smallint check (loading between 1 and 5),
  quality      smallint check (quality between 1 and 5),
  grading      smallint check (grading between 1 and 5),
  short_comment text,
  body         text,
  display_name text not null,             -- snapshot of anonymized name
  like_count   int not null default 0,
  useful_count int not null default 0,
  ai_flagged   boolean not null default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (course_id, user_id)             -- one review per user per course
);
create index if not exists reviews_course_idx on reviews (course_id);
create index if not exists reviews_user_idx on reviews (user_id);

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references reviews(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

create table if not exists votes (
  user_id   uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references reviews(id) on delete cascade,
  kind      text not null check (kind in ('like','useful','not_useful')),
  primary key (user_id, review_id, kind)
);

create table if not exists bookmarks (
  user_id   uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, course_id)
);

-- ── Aggregates ──
-- Per logical course (course_code) rating summary, refreshed on review write.
create table if not exists course_rating_summary (
  course_code   text primary key,
  review_count  int not null default 0,
  avg_sweetness numeric(3,2),
  avg_coolness  numeric(3,2),
  avg_loading   numeric(3,2),
  avg_quality   numeric(3,2),
  avg_grading   numeric(3,2),
  ai_summary    text,                     -- DeepSeek TL;DR (Phase 3)
  ai_summary_at timestamptz,
  updated_at    timestamptz default now()
);

create or replace function refresh_course_summary(p_course_code text)
returns void language sql as $$
  insert into course_rating_summary as s (
    course_code, review_count, avg_sweetness, avg_coolness, avg_loading,
    avg_quality, avg_grading, updated_at)
  select
    c.course_code,
    count(r.id),
    avg(r.sweetness), avg(r.coolness), avg(r.loading),
    avg(r.quality), avg(r.grading), now()
  from courses c
  join reviews r on r.course_id = c.id
  where c.course_code = p_course_code
  group by c.course_code
  on conflict (course_code) do update set
    review_count = excluded.review_count,
    avg_sweetness = excluded.avg_sweetness,
    avg_coolness = excluded.avg_coolness,
    avg_loading = excluded.avg_loading,
    avg_quality = excluded.avg_quality,
    avg_grading = excluded.avg_grading,
    updated_at = now();
$$;

create or replace function on_review_change() returns trigger
language plpgsql as $$
declare cc text;
begin
  select course_code into cc from courses
    where id = coalesce(new.course_id, old.course_id);
  perform refresh_course_summary(cc);
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_review_summary on reviews;
create trigger trg_review_summary
  after insert or update or delete on reviews
  for each row execute function on_review_change();

-- ── Row Level Security ──
alter table profiles enable row level security;
alter table reviews enable row level security;
alter table comments enable row level security;
alter table votes enable row level security;
alter table bookmarks enable row level security;

-- Public read of UGC.
drop policy if exists reviews_read on reviews;
create policy reviews_read on reviews for select using (true);
drop policy if exists comments_read on comments;
create policy comments_read on comments for select using (true);
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (true);

-- Owner writes (auth required). Domain allow-listing is enforced at the
-- application layer (OAuth callback) before a profile is created.
drop policy if exists reviews_write on reviews;
create policy reviews_write on reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists comments_write on comments;
create policy comments_write on comments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists votes_rw on votes;
create policy votes_rw on votes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists bookmarks_rw on bookmarks;
create policy bookmarks_rw on bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reference tables stay RLS-disabled (no public client writes; reads are public,
-- the crawler uses the service role which bypasses RLS).
