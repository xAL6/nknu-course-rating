-- Items 5 & 7: a logical course must match the school's 開課代號 granularity.
-- Previously course_key = department_code + name, which merged different
-- 開課代號 that share a name (EN201/EN202 英文寫作Ⅱ → one card; EN303/EN304
-- 英語會話 same teacher → fully merged). Redefine course_key to be based on the
-- 開課代號 (course_code) + normalized name, so each distinct code is its own
-- course — exactly like 高師大開課系統.
--
-- Trade-off (accepted): if a course changes its 開課代號 across years, its
-- multi-year history splits. Reused-code-for-different-course is still separated
-- by the name component. The in-semester separation the user wants takes
-- priority over cross-year code-change merging (rare).

create or replace function set_course_key() returns trigger language plpgsql as $$
begin
  new.course_key := coalesce(nullif(new.course_code, ''), 'NA') || ':' || nrm_name(new.name);
  new.teacher_key := coalesce(
    (select string_agg(u.t, '、' order by u.t)
     from unnest(new.teacher_names) as u(t)
     where u.t is not null and u.t <> ''),
    '');
  return new;
end; $$;

-- Recompute course_key for every row (BEFORE trigger overrides with new logic).
update courses set course_key = course_code;

-- course_key values changed, so the per-(course_key, teacher_key) summary rows
-- are stale. No real reviews exist yet, so clear and let the trigger rebuild.
delete from course_rating_summary;
