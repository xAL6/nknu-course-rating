-- Quick tags on reviews.
--
-- A controlled vocabulary of *categorical* course facts that the five numeric
-- dimensions (甜度/涼度/負擔/品質/給分) can't express — 點名 / 加簽 / 考試型態 /
-- 作業 / 授課形式. Students pick a few when reviewing; tags are aggregated per
-- (course_key, teacher_key), shown as one-glance chips, used for filtering, and
-- fed to the AI advisor as grounded evidence (RAG).
--
-- ⚠️ The allowed set below is duplicated in src/lib/config.ts (REVIEW_TAG_GROUPS).
--    If you change the vocabulary, update BOTH this CHECK and that file together.

-- 1) Per-review tags: controlled set, capped at 5 per review. -----------------
alter table reviews add column if not exists tags text[] not null default '{}';

alter table reviews drop constraint if exists reviews_tags_allowed;
alter table reviews add constraint reviews_tags_allowed check (
  tags <@ array[
    '會點名','不點名','點名抽人',
    '好加簽','難加簽',
    '不考試','重期末','有期中考','重報告','作業偏多','需分組',
    '佛心給分','容易被當',
    '全英授課','遠距居多'
  ]::text[]
  and coalesce(array_length(tags, 1), 0) <= 5
);

-- 2) Aggregated tag → count per (course, teacher), maintained by the trigger. --
alter table course_rating_summary
  add column if not exists tag_counts jsonb not null default '{}'::jsonb;

-- 3) Recompute the summary INCLUDING tag_counts. Supersedes 0015's version and
--    keeps its n=0 cleanup (drop the row when the last review is deleted).
create or replace function refresh_course_summary(p_ck text, p_tk text)
  returns void language plpgsql as $$
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
    avg_coolness, avg_loading, avg_quality, avg_grading, tag_counts, updated_at)
  select
    c.course_key, c.teacher_key, max(c.course_code), max(c.name), count(r.id),
    avg(r.sweetness), avg(r.coolness), avg(r.loading), avg(r.quality), avg(r.grading),
    coalesce((
      select jsonb_object_agg(z.tag, z.cnt)
      from (
        select t.tag, count(*)::int as cnt
        from courses c2 join reviews r2 on r2.course_id = c2.id
             cross join lateral unnest(r2.tags) as t(tag)
        where c2.course_key = p_ck and c2.teacher_key = p_tk
        group by t.tag
      ) z
    ), '{}'::jsonb),
    now()
  from courses c join reviews r on r.course_id = c.id
  where c.course_key = p_ck and c.teacher_key = p_tk
  group by c.course_key, c.teacher_key
  on conflict (course_key, teacher_key) do update set
    review_count = excluded.review_count, avg_sweetness = excluded.avg_sweetness,
    avg_coolness = excluded.avg_coolness, avg_loading = excluded.avg_loading,
    avg_quality = excluded.avg_quality, avg_grading = excluded.avg_grading,
    tag_counts = excluded.tag_counts,
    course_code = excluded.course_code, name = excluded.name, updated_at = now();
end; $$;

-- 4) Backfill tag_counts for existing summary rows (all '{}' until tags exist).
do $$
declare rec record;
begin
  for rec in select course_key, teacher_key from course_rating_summary loop
    perform refresh_course_summary(rec.course_key, rec.teacher_key);
  end loop;
end $$;
