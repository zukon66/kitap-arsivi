-- KitapArsiv haftalik koc programi gecmisi.

create table if not exists public.program_archives (
  id              text        not null,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  title           text        not null default '',
  program_date    date,
  meeting_no      text        not null default '',
  advisor         text        not null default '',
  student_name    text        not null default '',
  source          text        not null default 'ders_programi',
  item_count      integer     not null default 0,
  unmatched_count integer     not null default 0,
  imported_at     timestamptz not null default now(),
  items           jsonb       not null default '[]'::jsonb,
  raw_export      jsonb       not null default '{}'::jsonb,
  primary key (id, user_id)
);

alter table public.program_archives enable row level security;

drop policy if exists "program_archives_select" on public.program_archives;
create policy "program_archives_select"
on public.program_archives for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "program_archives_insert" on public.program_archives;
create policy "program_archives_insert"
on public.program_archives for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "program_archives_update" on public.program_archives;
create policy "program_archives_update"
on public.program_archives for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "program_archives_delete" on public.program_archives;
create policy "program_archives_delete"
on public.program_archives for delete
to authenticated
using (auth.uid() = user_id);
