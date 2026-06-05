-- Snapshot the anonymized display name on each comment (mirrors reviews),
-- so the comments list needs no FK embed of profiles.
alter table comments add column if not exists display_name text;

-- Backfill existing comments from the author's current profile name.
update comments c set display_name = p.display_name
  from profiles p where p.user_id = c.user_id and c.display_name is null;
