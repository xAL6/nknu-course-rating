-- Cascading filter facets: departments locked to 學制/日夜/校區/學期; classes
-- locked to the selected 系所. SQL DISTINCT server-side (fast, avoids 1000-row cap).

create or replace function facet_departments(p_sem text, p_level text, p_dn text, p_campus text)
returns table(code text, name text) language sql stable as $$
  select distinct c.department_code, d.name
  from courses c join departments d on d.code = c.department_code
  where c.semester_id = p_sem
    and (p_level  is null or c.degree_level_code = p_level)
    and (p_dn     is null or c.day_night = p_dn)
    and (p_campus is null or c.campus = p_campus)
  order by c.department_code;
$$;

create or replace function facet_classes(p_sem text, p_level text, p_dn text, p_campus text, p_dept text)
returns table(code text, name text) language sql stable as $$
  select distinct c.class_code, c.class_name
  from courses c
  where c.semester_id = p_sem
    and c.class_code is not null
    and (p_dept   is null or c.department_code = p_dept)
    and (p_level  is null or c.degree_level_code = p_level)
    and (p_dn     is null or c.day_night = p_dn)
    and (p_campus is null or c.campus = p_campus)
  order by c.class_code;
$$;

grant execute on function facet_departments(text, text, text, text) to anon, authenticated;
grant execute on function facet_classes(text, text, text, text, text) to anon, authenticated;
