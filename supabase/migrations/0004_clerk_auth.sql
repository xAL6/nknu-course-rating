-- Switch auth from Supabase Auth to Clerk: user ids become text (e.g. user_xxx),
-- drop FKs to auth.users. Writes go through service-role server actions guarded
-- by Clerk + domain check, so the old auth.uid() write policies are dropped
-- (public read policies stay; no client write path). Order matters: drop the
-- policies that reference user_id BEFORE altering the column type.

drop policy if exists reviews_write on reviews;
drop policy if exists comments_write on comments;
drop policy if exists votes_rw on votes;
drop policy if exists bookmarks_rw on bookmarks;
drop policy if exists profiles_write on profiles;

alter table reviews   drop constraint if exists reviews_user_id_fkey;
alter table comments  drop constraint if exists comments_user_id_fkey;
alter table votes     drop constraint if exists votes_user_id_fkey;
alter table bookmarks drop constraint if exists bookmarks_user_id_fkey;
alter table profiles  drop constraint if exists profiles_user_id_fkey;

alter table profiles  alter column user_id type text using user_id::text;
alter table reviews   alter column user_id type text using user_id::text;
alter table comments  alter column user_id type text using user_id::text;
alter table votes     alter column user_id type text using user_id::text;
alter table bookmarks alter column user_id type text using user_id::text;
