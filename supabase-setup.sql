create extension if not exists pgcrypto;

create table if not exists public.wedding_media (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  caption text,
  file_path text not null,
  public_url text,
  backup_file_path text,
  media_type text not null check (media_type in ('photo', 'video')),
  is_public boolean not null default true,
  device_id text,
  device_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.wedding_messages (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  message text not null,
  device_id text,
  device_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.wedding_media_engagement (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.wedding_media(id) on delete cascade,
  action text not null check (action in ('like', 'share', 'download', 'comment', 'comment_like')),
  device_id text not null,
  device_name text,
  value text,
  created_at timestamptz not null default now()
);

create unique index if not exists wedding_media_one_like_per_device
on public.wedding_media_engagement (media_id, device_id)
where action = 'like';

alter table public.wedding_media add column if not exists backup_file_path text;
alter table public.wedding_media add column if not exists device_id text;
alter table public.wedding_media add column if not exists device_name text;
alter table public.wedding_media alter column public_url drop not null;
alter table public.wedding_messages add column if not exists device_id text;
alter table public.wedding_messages add column if not exists device_name text;

alter table public.wedding_media enable row level security;
alter table public.wedding_messages enable row level security;
alter table public.wedding_media_engagement enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('wedding-media', 'wedding-media', true, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('wedding-media-backup', 'wedding-media-backup', false, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_wedding_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select auth.jwt() ->> 'email'), '') in ('SEU_EMAIL_ADMIN_AQUI');
$$;

drop policy if exists "Anyone can view public wedding media" on public.wedding_media;
create policy "Anyone can view public wedding media" on public.wedding_media for select to anon, authenticated using (is_public = true);

drop policy if exists "Anyone can add wedding media" on public.wedding_media;
create policy "Anyone can add wedding media" on public.wedding_media for insert to anon, authenticated with check (length(trim(guest_name)) > 0 and media_type in ('photo', 'video') and is_public = true);

drop policy if exists "Admin can view all wedding media" on public.wedding_media;
create policy "Admin can view all wedding media" on public.wedding_media for select to authenticated using (public.is_wedding_admin());

drop policy if exists "Admin can hide wedding media" on public.wedding_media;
create policy "Admin can hide wedding media" on public.wedding_media for update to authenticated using (public.is_wedding_admin()) with check (public.is_wedding_admin());

drop policy if exists "Anyone can view wedding messages" on public.wedding_messages;
create policy "Anyone can view wedding messages" on public.wedding_messages for select to anon, authenticated using (true);

drop policy if exists "Anyone can add wedding messages" on public.wedding_messages;
create policy "Anyone can add wedding messages" on public.wedding_messages for insert to anon, authenticated with check (length(trim(guest_name)) > 0 and length(trim(message)) > 0);

drop policy if exists "Admin can delete wedding messages" on public.wedding_messages;
create policy "Admin can delete wedding messages" on public.wedding_messages for delete to authenticated using (public.is_wedding_admin());

drop policy if exists "Anyone can view media engagement" on public.wedding_media_engagement;
create policy "Anyone can view media engagement" on public.wedding_media_engagement for select to anon, authenticated using (true);

drop policy if exists "Anyone can add media engagement" on public.wedding_media_engagement;
create policy "Anyone can add media engagement" on public.wedding_media_engagement for insert to anon, authenticated with check (device_id is not null and action in ('like', 'share', 'download', 'comment', 'comment_like'));

drop policy if exists "Device can remove own media like" on public.wedding_media_engagement;
create policy "Device can remove own media like" on public.wedding_media_engagement for delete to anon, authenticated using (action = 'like');

drop policy if exists "Anyone can upload wedding files" on storage.objects;
create policy "Anyone can upload wedding files" on storage.objects for insert to anon, authenticated with check (bucket_id = 'wedding-media');

drop policy if exists "Anyone can upload wedding backup files" on storage.objects;
create policy "Anyone can upload wedding backup files" on storage.objects for insert to anon, authenticated with check (bucket_id = 'wedding-media-backup');

drop policy if exists "Anyone can read wedding files" on storage.objects;
create policy "Anyone can read wedding files" on storage.objects for select to anon, authenticated using (bucket_id = 'wedding-media');

drop policy if exists "Admin can delete public wedding files" on storage.objects;
create policy "Admin can delete public wedding files" on storage.objects for delete to authenticated using (bucket_id = 'wedding-media' and public.is_wedding_admin());

drop policy if exists "Admin can delete wedding backup files" on storage.objects;
create policy "Admin can delete wedding backup files" on storage.objects for delete to authenticated using (bucket_id = 'wedding-media-backup' and public.is_wedding_admin());

drop policy if exists "Uploader can hide own public wedding media" on public.wedding_media;
drop policy if exists "Uploader can delete own public wedding files" on storage.objects;

create table if not exists public.wedding_message_engagement (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.wedding_messages(id) on delete cascade,
  action text not null check (action in ('like', 'share', 'comment', 'comment_like')),
  device_id text not null,
  device_name text,
  value text,
  created_at timestamptz not null default now()
);

create unique index if not exists wedding_message_one_like_per_device
on public.wedding_message_engagement (message_id, device_id)
where action = 'like';

alter table public.wedding_message_engagement enable row level security;

drop policy if exists "Anyone can view message engagement" on public.wedding_message_engagement;
create policy "Anyone can view message engagement" on public.wedding_message_engagement for select to anon, authenticated using (true);

drop policy if exists "Anyone can add message engagement" on public.wedding_message_engagement;
create policy "Anyone can add message engagement" on public.wedding_message_engagement for insert to anon, authenticated with check (device_id is not null and action in ('like', 'share', 'comment', 'comment_like'));

drop policy if exists "Device can remove own message like" on public.wedding_message_engagement;
create policy "Device can remove own message like" on public.wedding_message_engagement for delete to anon, authenticated using (action = 'like');

