-- Two-level course identity.
--
-- Problem: course_code+name (0016) fixed same-semester different-code separation
-- (EN201/EN202) but SHATTERED cross-year history, because NKNU changes the
-- 開課代號 almost every year — 吳明倫's 演算法 became MA231/232/233/234/238, i.e.
-- 5 separate "courses".
--
-- Fix: the LOGICAL course (used for the course page, history, and rating
-- aggregation) is keyed by department + normalized name + teacher — stable
-- across years even when the code changes, while still separating different
-- teachers (so EN201 周雋 ≠ EN202 張淑君). The browse LIST still shows one card
-- per 開課代號 (handled in app code), each linking to its logical course.

create or replace function set_course_key() returns trigger language plpgsql as $$
begin
  new.teacher_key := coalesce(
    (select string_agg(u.t, '、' order by u.t)
     from unnest(new.teacher_names) as u(t)
     where u.t is not null and u.t <> ''),
    '');
  new.course_key := coalesce(new.department_code, '') || ':' || nrm_name(new.name)
                    || ':' || new.teacher_key;
  return new;
end; $$;

-- Recompute course_key/teacher_key for every row (BEFORE trigger applies new logic).
update courses set course_code = course_code;

-- course_key values changed → clear stale summary rows (rebuilt by trigger on review writes).
delete from course_rating_summary;
