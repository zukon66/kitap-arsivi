-- KitapArsiv ders programi -> kitap eslestirme hafizasi.

alter table public.program_items
  add column if not exists match_score integer not null default 0,
  add column if not exists match_reason text not null default '';

create table if not exists public.program_match_rules (
  id                 text        not null,
  user_id            uuid        not null references auth.users(id) on delete cascade,
  pattern            text        not null default '',
  normalized_pattern text        not null default '',
  book_id            text        not null default '',
  book_name          text        not null default '',
  created_at         timestamptz not null default now(),
  primary key (id, user_id)
);

alter table public.program_match_rules enable row level security;

drop policy if exists "program_match_rules_select" on public.program_match_rules;
create policy "program_match_rules_select"
on public.program_match_rules for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "program_match_rules_insert" on public.program_match_rules;
create policy "program_match_rules_insert"
on public.program_match_rules for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "program_match_rules_update" on public.program_match_rules;
create policy "program_match_rules_update"
on public.program_match_rules for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "program_match_rules_delete" on public.program_match_rules;
create policy "program_match_rules_delete"
on public.program_match_rules for delete
to authenticated
using (auth.uid() = user_id);
