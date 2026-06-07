-- Contributor leaderboard fix.
--
-- getTopContributors() embeds `profiles -> reviews(count)` via PostgREST, but no
-- foreign key linked reviews.user_id to profiles.user_id (both only referenced
-- auth.users separately), so the embedded count was always 0 and every
-- contributor was filtered out — the 貢獻排行 board could never populate.
--
-- Add the FK so PostgREST can resolve the relationship. Every reviewer already
-- has a profile (requireUser creates one before writing), but backfill any
-- orphans first so the constraint can be added safely.

insert into profiles (user_id, display_name)
select distinct r.user_id, coalesce(nullif(r.display_name, ''), '匿名')
from reviews r
left join profiles p on p.user_id = r.user_id
where p.user_id is null
on conflict (user_id) do nothing;

alter table reviews drop constraint if exists reviews_user_id_profiles_fkey;
alter table reviews add constraint reviews_user_id_profiles_fkey
  foreign key (user_id) references profiles(user_id) on delete cascade;
