-- KitapArsiv normalize tablolar
-- app_states tablosu JSON yedek olarak korunuyor (fallback / migration için)

-- ── books ────────────────────────────────────────────────────────────
create table if not exists public.books (
  id            text        not null,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,
  publisher     text        not null default '',
  exam_type     text        not null default 'TYT',
  subject       text        not null default 'Matematik',
  catalog       text        not null default 'Genel',
  book_format   text        not null default 'Tek Kitap',
  set_name      text        not null default '',
  parent_set_id text        not null default '',
  status        text        not null default 'aktif',
  is_active_rotation boolean not null default false,
  total_tests   integer     not null default 0,
  solved_tests  integer     not null default 0,
  cover_image   text        not null default '',
  notes         text        not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (id, user_id)
);

alter table public.books enable row level security;

alter table public.books
  add column if not exists catalog text not null default 'Genel',
  add column if not exists book_format text not null default 'Tek Kitap',
  add column if not exists set_name text not null default '',
  add column if not exists parent_set_id text not null default '';

drop policy if exists "books_select" on public.books;
create policy "books_select" on public.books for select to authenticated using (auth.uid() = user_id);
drop policy if exists "books_insert" on public.books;
create policy "books_insert" on public.books for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "books_update" on public.books;
create policy "books_update" on public.books for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "books_delete" on public.books;
create policy "books_delete" on public.books for delete to authenticated using (auth.uid() = user_id);

-- ── topics ───────────────────────────────────────────────────────────
create table if not exists public.topics (
  id                    text    not null,
  book_id               text    not null,
  user_id               uuid    not null references auth.users(id) on delete cascade,
  name                  text    not null,
  total_tests           integer not null default 0,
  solved_tests          integer not null default 0,
  initial_solved_tests  integer not null default 0,
  tracked_solved_tests  integer not null default 0,
  status                text    not null default 'baslanmadi',
  detail                text    not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (id, user_id)
);

alter table public.topics enable row level security;

drop policy if exists "topics_select" on public.topics;
create policy "topics_select" on public.topics for select to authenticated using (auth.uid() = user_id);
drop policy if exists "topics_insert" on public.topics;
create policy "topics_insert" on public.topics for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "topics_update" on public.topics;
create policy "topics_update" on public.topics for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "topics_delete" on public.topics;
create policy "topics_delete" on public.topics for delete to authenticated using (auth.uid() = user_id);

-- ── test_results ─────────────────────────────────────────────────────
create table if not exists public.test_results (
  id                text    not null,
  book_id           text    not null,
  topic_id          text    not null,
  user_id           uuid    not null references auth.users(id) on delete cascade,
  test_no           text    not null default '',
  solved_test_count integer not null default 0,
  test_entry_type   text    not null default 'single',
  correct           integer not null default 0,
  wrong             integer not null default 0,
  empty             integer not null default 0,
  status            text    not null default 'cozuldu',
  ask_coach         boolean not null default false,
  coach_note        text    not null default '',
  solved_at         date    not null default current_date,
  created_at        timestamptz not null default now(),
  primary key (id, user_id)
);

alter table public.test_results enable row level security;

drop policy if exists "test_results_select" on public.test_results;
create policy "test_results_select" on public.test_results for select to authenticated using (auth.uid() = user_id);
drop policy if exists "test_results_insert" on public.test_results;
create policy "test_results_insert" on public.test_results for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "test_results_update" on public.test_results;
create policy "test_results_update" on public.test_results for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "test_results_delete" on public.test_results;
create policy "test_results_delete" on public.test_results for delete to authenticated using (auth.uid() = user_id);

-- ── program_items ────────────────────────────────────────────────────
create table if not exists public.program_items (
  id                text not null,
  user_id           uuid not null references auth.users(id) on delete cascade,
  source            text not null default 'ders_programi',
  day               text not null default '',
  raw_text          text not null default '',
  book_name         text not null default '',
  matched_book_id   text not null default '',
  matched_book_name text not null default '',
  match_type        text not null default 'none',
  match_score       integer not null default 0,
  match_reason      text not null default '',
  subject           text not null default '',
  topic_name        text not null default '',
  test_range        text not null default '',
  is_required       boolean not null default true,
  created_at        timestamptz not null default now(),
  primary key (id, user_id)
);

alter table public.program_items enable row level security;

drop policy if exists "program_items_select" on public.program_items;
create policy "program_items_select" on public.program_items for select to authenticated using (auth.uid() = user_id);
drop policy if exists "program_items_insert" on public.program_items;
create policy "program_items_insert" on public.program_items for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "program_items_update" on public.program_items;
create policy "program_items_update" on public.program_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "program_items_delete" on public.program_items;
create policy "program_items_delete" on public.program_items for delete to authenticated using (auth.uid() = user_id);

alter table public.program_items
  add column if not exists match_score integer not null default 0,
  add column if not exists match_reason text not null default '';

-- ── program_archives ─────────────────────────────────────────────────────────
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
create policy "program_archives_select" on public.program_archives for select to authenticated using (auth.uid() = user_id);
drop policy if exists "program_archives_insert" on public.program_archives;
create policy "program_archives_insert" on public.program_archives for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "program_archives_update" on public.program_archives;
create policy "program_archives_update" on public.program_archives for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "program_archives_delete" on public.program_archives;
create policy "program_archives_delete" on public.program_archives for delete to authenticated using (auth.uid() = user_id);

-- ── program_match_rules ──────────────────────────────────────────────────────
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
create policy "program_match_rules_select" on public.program_match_rules for select to authenticated using (auth.uid() = user_id);
drop policy if exists "program_match_rules_insert" on public.program_match_rules;
create policy "program_match_rules_insert" on public.program_match_rules for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "program_match_rules_update" on public.program_match_rules;
create policy "program_match_rules_update" on public.program_match_rules for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "program_match_rules_delete" on public.program_match_rules;
create policy "program_match_rules_delete" on public.program_match_rules for delete to authenticated using (auth.uid() = user_id);
