-- Store teachers denormalized as an array on each course (handles co-teaching
-- reliably; avoids the fragile M:N linking that dropped 97% of teacher links).

alter table courses add column if not exists teacher_names text[] default '{}';
create index if not exists courses_teacher_names_gin on courses using gin (teacher_names);

-- Teacher list with course counts (distinct logical course = code+name).
create or replace function teacher_list(p_q text)
returns table(name text, course_count bigint) language sql stable as $$
  select tn.name, count(distinct c.course_code || '|' || c.name)
  from courses c, unnest(c.teacher_names) as tn(name)
  where (p_q is null or tn.name ilike '%' || p_q || '%')
    and tn.name !~ '待聘|本系|未定|TBA|兼任教師$'
  group by tn.name
  order by tn.name;
$$;
grant execute on function teacher_list(text) to anon, authenticated;
