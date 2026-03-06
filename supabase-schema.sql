-- ============================================
-- Personal Dashboard - Supabase Schema
-- Sicher wiederholbar (IF NOT EXISTS überall)
-- Im Supabase Dashboard > SQL Editor ausführen
-- ============================================

-- 1. TABELLEN

create table if not exists contacts (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  company text,
  tags text[] default '{}',
  avatar text,
  notes text,
  created_at bigint not null
);

create table if not exists notes (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text not null default '',
  pinned boolean default false,
  color text,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists bookmarks (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  url text not null,
  category text,
  favicon text,
  created_at bigint not null
);

create table if not exists calendar_events (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  date text not null,
  time text,
  color text,
  description text
);

create table if not exists todos (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  completed boolean default false,
  priority text not null default 'medium',
  due_date text,
  created_at bigint not null
);

create table if not exists sticky_notes (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null default '',
  color text not null,
  created_at bigint not null
);

create table if not exists finance_entries (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  amount numeric not null,
  type text not null,
  category text not null,
  date text not null,
  created_at bigint not null
);

create table if not exists world_clocks (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  timezone text not null
);

create table if not exists password_vaults (
  user_id uuid references auth.users(id) on delete cascade primary key,
  master_hash text not null default '',
  encrypted_data text not null default ''
);

create table if not exists files (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  size bigint not null,
  type text not null,
  storage_path text not null,
  created_at bigint not null
);

create table if not exists hardware_devices (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null,
  assigned_to text,
  manufacturer text,
  model text,
  imei text,
  serial_number text,
  purchase_date text,
  warranty_until text,
  notes text,
  photo_paths text[] default '{}',
  created_at bigint not null
);

create table if not exists user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  visible_widgets jsonb,
  widget_layouts jsonb
);

-- Falls assigned_to Spalte fehlt (bei bestehender Tabelle)
do $$ begin
  alter table hardware_devices add column if not exists assigned_to text;
exception when others then null;
end $$;

-- 2. ROW LEVEL SECURITY

alter table contacts enable row level security;
alter table notes enable row level security;
alter table bookmarks enable row level security;
alter table calendar_events enable row level security;
alter table todos enable row level security;
alter table sticky_notes enable row level security;
alter table finance_entries enable row level security;
alter table world_clocks enable row level security;
alter table password_vaults enable row level security;
alter table files enable row level security;
alter table hardware_devices enable row level security;
alter table user_settings enable row level security;

-- RLS Policies (DROP IF EXISTS + CREATE für Wiederholbarkeit)
do $$ begin
  drop policy if exists "contacts_user" on contacts;
  drop policy if exists "notes_user" on notes;
  drop policy if exists "bookmarks_user" on bookmarks;
  drop policy if exists "calendar_events_user" on calendar_events;
  drop policy if exists "todos_user" on todos;
  drop policy if exists "sticky_notes_user" on sticky_notes;
  drop policy if exists "finance_entries_user" on finance_entries;
  drop policy if exists "world_clocks_user" on world_clocks;
  drop policy if exists "password_vaults_user" on password_vaults;
  drop policy if exists "files_user" on files;
  drop policy if exists "hardware_devices_user" on hardware_devices;
  drop policy if exists "user_settings_user" on user_settings;
end $$;

create policy "contacts_user" on contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_user" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bookmarks_user" on bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calendar_events_user" on calendar_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "todos_user" on todos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sticky_notes_user" on sticky_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "finance_entries_user" on finance_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "world_clocks_user" on world_clocks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "password_vaults_user" on password_vaults for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "files_user" on files for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "hardware_devices_user" on hardware_devices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings_user" on user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. STORAGE BUCKETS (nur anlegen wenn nicht vorhanden)
insert into storage.buckets (id, name, public)
  values ('files', 'files', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('hardware-photos', 'hardware-photos', false)
  on conflict (id) do nothing;

-- Storage Policies (DROP IF EXISTS + CREATE)
do $$ begin
  drop policy if exists "files_select" on storage.objects;
  drop policy if exists "files_insert" on storage.objects;
  drop policy if exists "files_delete" on storage.objects;
  drop policy if exists "hw_photos_select" on storage.objects;
  drop policy if exists "hw_photos_insert" on storage.objects;
  drop policy if exists "hw_photos_delete" on storage.objects;
end $$;

create policy "files_select" on storage.objects for select using (bucket_id = 'files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "files_insert" on storage.objects for insert with check (bucket_id = 'files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "files_delete" on storage.objects for delete using (bucket_id = 'files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "hw_photos_select" on storage.objects for select using (bucket_id = 'hardware-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "hw_photos_insert" on storage.objects for insert with check (bucket_id = 'hardware-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "hw_photos_delete" on storage.objects for delete using (bucket_id = 'hardware-photos' and auth.uid()::text = (storage.foldername(name))[1]);
