-- Lightweight feeds for the sitemap: distinct logical courses and teachers.

create or replace function sitemap_courses()
returns table (course_key text, latest_semester text)
language sql stable as $$
  select course_key, max(semester_id) as latest_semester
  from courses
  where course_key is not null and course_key <> ''
  group by course_key;
$$;

grant execute on function sitemap_courses() to anon, authenticated;
