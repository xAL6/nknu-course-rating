-- Cross-semester course search with trigram ranking.
-- Returns ranked course_keys (one row per logical course across all semesters);
-- the app then hydrates full offerings for the matched keys.

create extension if not exists pg_trgm;

create index if not exists courses_name_trgm on courses using gin (name gin_trgm_ops);
create index if not exists courses_code_trgm on courses using gin (course_code gin_trgm_ops);
create index if not exists courses_name_en_trgm on courses using gin (name_en gin_trgm_ops);

create or replace function search_courses(p_q text, p_limit int default 90)
returns table (course_key text, rank real, latest_semester text)
language sql stable as $$
  with term as (select trim(p_q) as t)
  select c.course_key,
         greatest(
           max(similarity(c.name, (select t from term))),
           max(similarity(coalesce(c.course_code, ''), (select t from term))),
           max(similarity(coalesce(c.name_en, ''), (select t from term)))
         ) as rank,
         max(c.semester_id) as latest_semester
  from courses c, term
  where c.course_key is not null and (
       c.name ilike '%' || term.t || '%'
    or c.course_code ilike '%' || term.t || '%'
    or coalesce(c.name_en, '') ilike '%' || term.t || '%'
    or exists (
         select 1 from unnest(c.teacher_names) tn where tn ilike '%' || term.t || '%'
       )
  )
  group by c.course_key
  order by rank desc, latest_semester desc
  limit p_limit;
$$;

grant execute on function search_courses(text, int) to anon, authenticated;
