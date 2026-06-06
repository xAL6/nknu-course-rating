-- Enforce the NKNU email-domain restriction at the DATABASE layer (RLS), not
-- just in the app. The anon key is public and PostgREST is a public HTTP API, so
-- a non-NKNU Google account could otherwise sign in with its own client and
-- write directly (RLS only checked auth.uid() = user_id, not the domain).
-- is_nknu() reads the verified email from the request's JWT; service_role
-- bypasses RLS entirely so the crawler is unaffected.

create or replace function is_nknu() returns boolean
  language sql stable
  as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@mail.nknu.edu.tw' $$;

-- Writes now require: own row AND an NKNU mailbox.
drop policy if exists reviews_write on reviews;
create policy reviews_write on reviews for all
  using (auth.uid() = user_id and is_nknu())
  with check (auth.uid() = user_id and is_nknu());

drop policy if exists comments_write on comments;
create policy comments_write on comments for all
  using (auth.uid() = user_id and is_nknu())
  with check (auth.uid() = user_id and is_nknu());

drop policy if exists votes_rw on votes;
create policy votes_rw on votes for all
  using (auth.uid() = user_id and is_nknu())
  with check (auth.uid() = user_id and is_nknu());

drop policy if exists bookmarks_rw on bookmarks;
create policy bookmarks_rw on bookmarks for all
  using (auth.uid() = user_id and is_nknu())
  with check (auth.uid() = user_id and is_nknu());

-- profiles too (the callback bootstraps it via the user's own session).
drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles for all
  using (auth.uid() = user_id and is_nknu())
  with check (auth.uid() = user_id and is_nknu());

-- timetables (added in 0013) — same guard.
drop policy if exists timetables_rw on timetables;
create policy timetables_rw on timetables for all
  using (auth.uid() = user_id and is_nknu())
  with check (auth.uid() = user_id and is_nknu());
