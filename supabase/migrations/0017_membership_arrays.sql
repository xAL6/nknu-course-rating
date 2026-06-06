-- Items 1,4,6,8,9,10,11: a single offering (one syllabus_no) can be listed under
-- MANY (學制, 系所, 班級) contexts — 合班 必修, 全年級/跨班 選修, 學院開課
-- cross-listings. The crawler used to dedup by syllabus_no keeping only the FIRST
-- context, so filtering by the other 班級/系所/學制 hid the course. We now store
-- every membership as an array and filter by array-containment.

alter table courses
  add column if not exists class_codes        text[],
  add column if not exists class_names        text[],
  add column if not exists department_codes   text[],
  add column if not exists degree_level_codes text[];

-- Backfill existing rows from their scalar columns (single-element arrays) so
-- filters keep working for semesters not yet re-crawled.
update courses set
  class_codes = case when coalesce(class_code,'') <> '' then array[class_code] else '{}' end,
  class_names = case when coalesce(class_name,'') <> '' then array[class_name] else '{}' end,
  department_codes = case when department_code is not null then array[department_code] else '{}' end,
  degree_level_codes = case when degree_level_code is not null then array[degree_level_code] else '{}' end
where class_codes is null;

create index if not exists courses_class_codes_gin on courses using gin (class_codes);
create index if not exists courses_dept_codes_gin  on courses using gin (department_codes);
create index if not exists courses_level_codes_gin on courses using gin (degree_level_codes);

-- Facets now unnest the membership arrays.
create or replace function facet_departments(p_sem text, p_level text, p_dn text, p_campus text)
returns table(code text, name text) language sql stable as $$
  select distinct dc as code, coalesce(d.name, dc) as name
  from courses c
  cross join lateral unnest(
    case when coalesce(array_length(c.department_codes,1),0) > 0
         then c.department_codes else array[c.department_code] end
  ) as dc
  left join departments d on d.code = dc
  where c.semester_id = p_sem
    and (p_level is null or c.degree_level_codes @> array[p_level])
    and (p_dn is null or c.day_night = p_dn)
    and (p_campus is null or c.campus = p_campus)
    and dc is not null
  order by code;
$$;

create or replace function facet_classes(p_sem text, p_level text, p_dn text, p_campus text, p_dept text)
returns table(code text, name text) language sql stable as $$
  select distinct t.code, t.name
  from courses c
  cross join lateral unnest(
    case when coalesce(array_length(c.class_codes,1),0) > 0 then c.class_codes else '{}'::text[] end,
    case when coalesce(array_length(c.class_names,1),0) > 0 then c.class_names else '{}'::text[] end
  ) as t(code, name)
  where c.semester_id = p_sem
    and (p_dept is null or c.department_codes @> array[p_dept])
    and (p_level is null or c.degree_level_codes @> array[p_level])
    and (p_dn is null or c.day_night = p_dn)
    and (p_campus is null or c.campus = p_campus)
    and coalesce(t.code,'') <> ''
  order by code;
$$;

grant execute on function facet_departments(text, text, text, text) to anon, authenticated;
grant execute on function facet_classes(text, text, text, text, text) to anon, authenticated;
