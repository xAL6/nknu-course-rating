-- Fix: deleting the LAST review for a (course_key, teacher_key) left a stale
-- summary row. The old refresh did INSERT...SELECT FROM reviews, which returns
-- no rows when the count is 0, so ON CONFLICT never fired and the row persisted
-- (showing review_count = 1 forever, polluting trending). Now we delete the
-- summary row when no reviews remain.

create or replace function refresh_course_summary(p_ck text, p_tk text) returns void language plpgsql as $$
declare n int;
begin
  select count(r.id) into n
  from courses c join reviews r on r.course_id = c.id
  where c.course_key = p_ck and c.teacher_key = p_tk;

  if n = 0 then
    delete from course_rating_summary where course_key = p_ck and teacher_key = p_tk;
    return;
  end if;

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
end; $$;

-- One-time cleanup of any summary rows that no longer have backing reviews.
delete from course_rating_summary s
where not exists (
  select 1 from courses c join reviews r on r.course_id = c.id
  where c.course_key = s.course_key and c.teacher_key = s.teacher_key
);
