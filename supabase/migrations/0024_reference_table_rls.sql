-- 0024_reference_table_rls.sql
-- Defense-in-depth (OWASP A01 Broken Access Control). The public reference
-- tables had RLS *disabled*, so the only thing preventing an anonymous write
-- through PostgREST was the default role grants — not asserted anywhere in code.
-- Enable RLS with a public-SELECT policy and NO write policy: reads stay public,
-- but every INSERT/UPDATE/DELETE now requires service_role (the crawler bypasses
-- RLS), regardless of any future grant drift.
--
-- course_rating_summary is intentionally EXCLUDED. It is mutated by the
-- on_review_change trigger, which runs as the (authenticated) review author and
-- is SECURITY INVOKER — turning on RLS there would block the trigger's own
-- writes and break rating aggregation. Leave it under grant-based control until
-- that trigger is reworked as SECURITY DEFINER.

do $$
declare
  t text;
begin
  foreach t in array array['courses', 'course_teachers', 'departments', 'rooms', 'semesters', 'teachers']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_public_read', t);
    execute format('create policy %I on %I for select using (true)', t || '_public_read', t);
  end loop;
end $$;
