-- Revert auth from Clerk back to Supabase Auth: user ids become uuid again
-- (FK auth.users), restore the auth.uid() RLS write policies. UGC tables are
-- emptied first (no real reviews yet; Clerk text ids can't cast to uuid).

truncate table reviews, comments, votes, bookmarks, profiles, course_rating_summary
  restart identity cascade;

alter table profiles  alter column user_id type uuid using user_id::uuid;
alter table reviews   alter column user_id type uuid using user_id::uuid;
alter table comments  alter column user_id type uuid using user_id::uuid;
alter table votes     alter column user_id type uuid using user_id::uuid;
alter table bookmarks alter column user_id type uuid using user_id::uuid;

alter table profiles  add constraint profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table reviews   add constraint reviews_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table comments  add constraint comments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table votes     add constraint votes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table bookmarks add constraint bookmarks_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

drop policy if exists reviews_write on reviews;
create policy reviews_write on reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists comments_write on comments;
create policy comments_write on comments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists votes_rw on votes;
create policy votes_rw on votes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists bookmarks_rw on bookmarks;
create policy bookmarks_rw on bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
