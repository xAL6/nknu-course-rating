-- Profile avatars + a public storage bucket.
--
-- Uploads go through a server action using the service-role client (bypasses
-- storage RLS), writing to avatars/<uid>/…; reads are public (bucket public),
-- so no storage.objects policies are required here.

alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
