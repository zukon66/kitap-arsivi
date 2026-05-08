-- KitapArsiv kitap katalog / set / fasikul alanlari.

alter table public.books
  add column if not exists catalog text not null default 'Genel',
  add column if not exists book_format text not null default 'Tek Kitap',
  add column if not exists set_name text not null default '',
  add column if not exists parent_set_id text not null default '';
