create extension if not exists pgcrypto;

create table if not exists public.wedding_media (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  caption text,
  file_path text not null,
  public_url text not null,
  media_type text not null check (media_type in ('photo', 'video')),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wedding_messages (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.wedding_media enable row level security;
alter table public.wedding_messages enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-media',
  'wedding-media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view public wedding media" on public.wedding_media;
create policy "Anyone can view public wedding media"
on public.wedding_media
for select
to anon, authenticated
using (is_public = true);

drop policy if exists "Anyone can add wedding media" on public.wedding_media;
create policy "Anyone can add wedding media"
on public.wedding_media
for insert
to anon, authenticated
with check (
  length(trim(guest_name)) > 0
  and media_type in ('photo', 'video')
);

drop policy if exists "Anyone can view wedding messages" on public.wedding_messages;
create policy "Anyone can view wedding messages"
on public.wedding_messages
for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can add wedding messages" on public.wedding_messages;
create policy "Anyone can add wedding messages"
on public.wedding_messages
for insert
to anon, authenticated
with check (
  length(trim(guest_name)) > 0
  and length(trim(message)) > 0
);

drop policy if exists "Anyone can upload wedding files" on storage.objects;
create policy "Anyone can upload wedding files"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'wedding-media');

drop policy if exists "Anyone can read wedding files" on storage.objects;
create policy "Anyone can read wedding files"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'wedding-media');
