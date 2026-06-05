-- Per (course, teacher) ratings: the rateable unit becomes (course_key,
-- teacher_key). teacher_key = the sorted set of co-teachers (a co-taught course
-- is rated as one team). The DB trigger maintains both keys; the rating summary
-- is re-keyed by (course_key, teacher_key).

alter table courses add column if not exists teacher_key text;

create or replace function set_course_key() returns trigger language plpgsql as $$
begin
  new.course_key := coalesce(new.department_code, '') || ':' || nrm_name(new.name);
  new.teacher_key := coalesce(
    (select string_agg(u.t, '、' order by u.t)
     from unnest(new.teacher_names) as u(t)
     where u.t is not null and u.t <> ''),
    '');
  return new;
end; $$;

-- backfill (fires the trigger)
update courses set teacher_key = coalesce(
  (select string_agg(u.t, '、' order by u.t) from unnest(teacher_names) as u(t)
   where u.t is not null and u.t <> ''), '');
create index if not exists courses_course_teacher_idx on courses (course_key, teacher_key);

drop trigger if exists trg_review_summary on reviews;
drop function if exists on_review_change();
drop function if exists refresh_course_summary(text);
drop table if exists course_rating_summary;

create table course_rating_summary (
  course_key    text,
  teacher_key   text,
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
  updated_at    timestamptz default now(),
  primary key (course_key, teacher_key)
);

create or replace function refresh_course_summary(p_ck text, p_tk text) returns void language sql as $$
  insert into course_rating_summary as s (
    course_key, teacher_key, course_code, name, review_count, avg_sweetness,
    avg_coolness, avg_loading, avg_quality, avg_grading, updated_at)
  select c.course_key, c.teacher_key, max(c.course_code), max(c.name), count(r.id),
    avg(r.sweetness), avg(r.coolness), avg(r.loading), avg(r.quality), avg(r.grading), now()
  from courses c join reviews r on r.course_id = c.id
  where c.course_key = p_ck and c.teacher_key = p_tk
  group by c.course_key, c.teacher_key
  on conflict (course_key, teacher_key) do update set
    review_count = excluded.review_count, avg_sweetness = excluded.avg_sweetness,
    avg_coolness = excluded.avg_coolness, avg_loading = excluded.avg_loading,
    avg_quality = excluded.avg_quality, avg_grading = excluded.avg_grading,
    course_code = excluded.course_code, name = excluded.name, updated_at = now();
$$;

create or replace function on_review_change() returns trigger language plpgsql as $$
declare ck text; tk text;
begin
  select course_key, teacher_key into ck, tk from courses
    where id = coalesce(new.course_id, old.course_id);
  perform refresh_course_summary(ck, tk);
  return coalesce(new, old);
end; $$;

create trigger trg_review_summary after insert or update or delete on reviews
  for each row execute function on_review_change();
