-- KitapArsiv kapak gorselleri icin Supabase Storage kurulumu.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'covers',
  'covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

drop policy if exists "covers_public_select" on storage.objects;

drop policy if exists "covers_user_select" on storage.objects;
create policy "covers_user_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "covers_user_insert" on storage.objects;
create policy "covers_user_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "covers_user_update" on storage.objects;
create policy "covers_user_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "covers_user_delete" on storage.objects;
create policy "covers_user_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);
