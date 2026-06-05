-- Per-user saved timetable (one per user, scoped to a semester).
create table if not exists timetables (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  semester_id text,
  courses     jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table timetables enable row level security;

drop policy if exists timetables_rw on timetables;
create policy timetables_rw on timetables for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
