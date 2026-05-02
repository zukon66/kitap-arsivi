create table if not exists public.app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_states enable row level security;

drop policy if exists "Users can read own app state" on public.app_states;
create policy "Users can read own app state"
on public.app_states
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own app state" on public.app_states;
create policy "Users can insert own app state"
on public.app_states
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own app state" on public.app_states;
create policy "Users can update own app state"
on public.app_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own app state" on public.app_states;
create policy "Users can delete own app state"
on public.app_states
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_states_set_updated_at on public.app_states;
create trigger app_states_set_updated_at
before update on public.app_states
for each row
execute function public.set_updated_at();
