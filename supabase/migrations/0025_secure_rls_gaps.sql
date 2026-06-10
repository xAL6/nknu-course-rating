-- 0025_secure_rls_gaps.sql
-- Close two Broken Access Control gaps (OWASP A01) found by LIVE probing with
-- only the public anon key against PostgREST, and unbreak the vote-count trigger
-- under RLS. Every other table already enforces RLS (0018/0024) and was
-- confirmed blocked (anon writes return 42501).
--
-- Verified exploitable (2026-06) with the public NEXT_PUBLIC_SUPABASE_ANON_KEY:
--   • course_rating_summary — anon INSERT/UPDATE/DELETE succeeded. An attacker
--     could forge any course's ratings/review_count, wipe the leaderboard, and
--     poison the AI advisor's grounding (it reads this table).
--   • _migrations — anon INSERT/DELETE succeeded and the table was anon-readable.
--     Inserting a fake migration filename makes `npm run migrate` SKIP a real
--     (e.g. security) migration; deleting rows forces unintended re-runs.
--
-- Root cause: 0024 enabled RLS on the reference tables but intentionally left
-- course_rating_summary out (its maintenance trigger was SECURITY INVOKER, so
-- RLS would have blocked the trigger's own writes), and _migrations was never
-- covered at all.

-- 1) Make the aggregation triggers run as the table owner (DEFINER) so the
--    summary/vote tables can carry RLS without blocking their own maintenance
--    writes. This ALSO fixes a latent correctness bug: refresh_review_votes was
--    SECURITY INVOKER, so under the reviews RLS policy (auth.uid() = user_id) a
--    user voting on SOMEONE ELSE'S review updated 0 rows — like_count/useful_count
--    never incremented for the normal (cross-user) case. A pinned search_path
--    keeps the DEFINER functions safe from search_path hijacking.
alter function refresh_course_summary(text, text) security definer;
alter function refresh_course_summary(text, text) set search_path = public, pg_temp;
alter function refresh_review_votes(uuid) security definer;
alter function refresh_review_votes(uuid) set search_path = public, pg_temp;

-- 2) course_rating_summary: public SELECT stays (course pages, leaderboard, AI
--    grounding read it); NO write policy, so every INSERT/UPDATE/DELETE now
--    requires service_role or the (DEFINER) trigger. anon/authenticated blocked.
alter table course_rating_summary enable row level security;
drop policy if exists course_rating_summary_public_read on course_rating_summary;
create policy course_rating_summary_public_read
  on course_rating_summary for select using (true);

-- 3) _migrations: internal bookkeeping only ever touched by the migrate script
--    (direct pg as the table OWNER, which bypasses RLS) and service_role. The app
--    never reads it via PostgREST. RLS on with NO policy → anon/authenticated get
--    neither read nor write; the migrate script is unaffected.
alter table _migrations enable row level security;
