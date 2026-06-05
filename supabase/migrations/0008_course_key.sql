-- Course normalization: a stable per-course identity that survives code reuse,
-- year-to-year code changes, and full/half-width name variants.
--   course_key = department_code + ':' + normalized(name)
-- A trigger keeps it in sync, so crawler upserts and backfill share one rule.

create or replace function nrm_name(p text) returns text language sql immutable as $$
  select regexp_replace(
    translate(coalesce(p, ''), '０１２３４５６７８９（）　', '0123456789() '),
    '[[:space:]‧·．・･]', '', 'g');
$$;

alter table courses add column if not exists course_key text;

create or replace function set_course_key() returns trigger language plpgsql as $$
begin
  new.course_key := coalesce(new.department_code, '') || ':' || nrm_name(new.name);
  return new;
end; $$;

drop trigger if exists trg_course_key on courses;
create trigger trg_course_key before insert or update on courses
  for each row execute function set_course_key();

-- backfill existing rows (fires the trigger)
update courses set course_key = coalesce(department_code, '') || ':' || nrm_name(name);
create index if not exists courses_course_key_idx on courses (course_key);

-- Re-key the rating summary by course_key (was course_code). Empty today, so
-- recreate. Store a representative course_code + name for display.
drop trigger if exists trg_review_summary on reviews;
drop function if exists on_review_change();
drop function if exists refresh_course_summary(text);
drop table if exists course_rating_summary;

create table course_rating_summary (
  course_key    text primary key,
  course_code   text,
  name          text,
  review_count  int not null default 0,
  avg_sweetness numeric(3,2),
  avg_coolness  numeric(3,2),
  avg_loading   numeric(3,2),
  avg_quality   numeric(3,2),
  avg_grading   numeric(3,2),
  ai_summary    text,
  ai_summary_at timestamptz,
  updated_at    timestamptz default now()
);

create or replace function refresh_course_summary(p_key text) returns void language sql as $$
  insert into course_rating_summary as s (
    course_key, course_code, name, review_count, avg_sweetness, avg_coolness,
    avg_loading, avg_quality, avg_grading, updated_at)
  select c.course_key, max(c.course_code), max(c.name), count(r.id),
    avg(r.sweetness), avg(r.coolness), avg(r.loading), avg(r.quality), avg(r.grading), now()
  from courses c join reviews r on r.course_id = c.id
  where c.course_key = p_key
  group by c.course_key
  on conflict (course_key) do update set
    review_count = excluded.review_count, avg_sweetness = excluded.avg_sweetness,
    avg_coolness = excluded.avg_coolness, avg_loading = excluded.avg_loading,
    avg_quality = excluded.avg_quality, avg_grading = excluded.avg_grading,
    course_code = excluded.course_code, name = excluded.name, updated_at = now();
$$;

create or replace function on_review_change() returns trigger language plpgsql as $$
declare k text;
begin
  select course_key into k from courses where id = coalesce(new.course_id, old.course_id);
  perform refresh_course_summary(k);
  return coalesce(new, old);
end; $$;

create trigger trg_review_summary after insert or update or delete on reviews
  for each row execute function on_review_change();
