-- ═══════════════════════════════════════════════════════════════
-- Entropy Breakers — Supabase séma
-- ───────────────────────────────────────────────────────────────
-- Futtasd le a Supabase SQL editorban (Dashboard → SQL Editor).
--
-- Két táblát hoz létre:
--   1) eb_students  — beiratkozott tanulók névlistája (hozzáférés)
--   2) eb_progress  — tanulók haladása, NÉV alapján szinkronizálva
--
-- Egyik táblát sem lehet közvetlenül olvasni/írni az anon kulccsal:
-- minden hozzáférés a lenti security-definer függvényeken át megy.
--
-- Megjegyzés: ha korábban a régi, auth-alapú eb_progress táblát
-- hoztad létre, előbb futtasd le egyszer:  drop table if exists
-- public.eb_progress cascade;
-- ═══════════════════════════════════════════════════════════════


-- ── 1. Hozzáférési névlista ──────────────────────────────────────
-- Kezelés: Supabase → Table Editor → eb_students.
-- Egy sor = egy tanuló. Új sor = új tanuló; sor törlése = a
-- hozzáférés visszavonva. A névegyezés kis/nagybetűt nem néz.

create table if not exists public.eb_students (
  name       text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.eb_students enable row level security;

create or replace function public.eb_check_student(p_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.eb_students
    where lower(trim(name)) = lower(trim(p_name))
  );
$$;

grant execute on function public.eb_check_student(text) to anon, authenticated;


-- ── 2. Haladás-szinkron (név alapú) ──────────────────────────────
-- A haladás a tanuló neve alapján tárolódik, egy sor / tanuló.
-- Nincs külön bejelentkezés — aki belép, annak a haladása
-- automatikusan szinkronizál minden eszközön.

create table if not exists public.eb_progress (
  name       text primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.eb_progress enable row level security;

create or replace function public.eb_progress_load(p_name text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.eb_progress
  where name = lower(trim(p_name));
$$;

grant execute on function public.eb_progress_load(text) to anon, authenticated;

create or replace function public.eb_progress_save(p_name text, p_data jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.eb_progress (name, data, updated_at)
  values (lower(trim(p_name)), p_data, now())
  on conflict (name) do update
    set data = excluded.data, updated_at = excluded.updated_at;
$$;

grant execute on function public.eb_progress_save(text, jsonb) to anon, authenticated;
