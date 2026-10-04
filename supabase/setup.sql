-- Projects CMS: run this ONCE in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: every statement is idempotent.

-- 0) Who may edit?  ⚠️ CHANGE THE EMAIL BELOW to the account you create in
--    Supabase → Authentication → Users → Add user. Only that account can write;
--    everyone else (including anyone who manages to sign up) can only read.
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sunrui714142436@gmail.com')
$$;

-- 1) Table ------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title_en    text not null default '',
  title_zh    text not null default '',
  tag_en      text not null default '',
  tag_zh      text not null default '',
  desc_en     text not null default '',
  desc_zh     text not null default '',
  cover_url   text,                       -- first image (kept for older rows / quick thumbnails)
  images      text[] not null default '{}',   -- ordered public URLs, first = cover, max 12
  video_url   text,                       -- YouTube / Bilibili / Vimeo / direct .mp4 link
  link_url    text,                       -- where "View project" goes (optional)
  sort_order  int  not null default 0,    -- smaller = earlier on the page
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Upgrade path: if you ran an earlier version of this file, the table already exists without `images`.
alter table public.projects add column if not exists images text[] not null default '{}';
update public.projects set images = array[cover_url] where cover_url is not null and cardinality(images) = 0;
alter table public.projects drop constraint if exists projects_images_max;
alter table public.projects add constraint projects_images_max check (cardinality(images) <= 12);

alter table public.projects enable row level security;

-- Visitors: read published rows only.  Admin: everything.
drop policy if exists "public read published" on public.projects;
create policy "public read published" on public.projects
  for select using (published = true);

drop policy if exists "admin all" on public.projects;
create policy "admin all" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Image storage ----------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-media', 'project-media', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select using (bucket_id = 'project-media');

drop policy if exists "admin insert media" on storage.objects;
create policy "admin insert media" on storage.objects
  for insert to authenticated with check (bucket_id = 'project-media' and public.is_admin());

drop policy if exists "admin update media" on storage.objects;
create policy "admin update media" on storage.objects
  for update to authenticated using (bucket_id = 'project-media' and public.is_admin());

drop policy if exists "admin delete media" on storage.objects;
create policy "admin delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'project-media' and public.is_admin());
