-- ═══════════════════════════════════════════════════════════════
-- Entropy Breakers — Supabase séma a haladás (progress) szinkronhoz
-- ───────────────────────────────────────────────────────────────
-- Futtasd le egyszer a Supabase SQL editorban:
--   Dashboard → SQL Editor → New query → ide bemásolod → Run
--
-- Egy sor / felhasználó. A teljes haladási állapot (szintek,
-- kategóriák, modulok, streak, heatmap) egyetlen jsonb mezőben él.
-- A hozzáférést Row Level Security védi: mindenki csak a saját
-- sorát látja és írja.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.eb_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.eb_progress enable row level security;

drop policy if exists "eb_progress own select" on public.eb_progress;
create policy "eb_progress own select" on public.eb_progress
  for select using (auth.uid() = user_id);

drop policy if exists "eb_progress own insert" on public.eb_progress;
create policy "eb_progress own insert" on public.eb_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "eb_progress own update" on public.eb_progress;
create policy "eb_progress own update" on public.eb_progress
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────
-- Auth beállítás (Dashboard → Authentication):
--   • Email provider engedélyezve (magic link / OTP).
--   • URL Configuration → Site URL: https://academy.entropybreakers.com
--   • Redirect URLs közé vedd fel ugyanezt (és teszthez a localhost-ot).
-- ───────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════
-- Beiratkozott tanulók — hozzáférési névlista
-- ───────────────────────────────────────────────────────────────
-- A belépés továbbra is név + közös jelszó, DE a névnek rajta kell
-- lennie ezen a listán. Aki lekerül róla, nem tud belépni.
--
-- Kezelés: Supabase → Table Editor → eb_students. Egy sor = egy
-- tanuló. Új sor = új tanuló; sor törlése = hozzáférés visszavonva.
-- A névegyezés kis/nagybetűt nem néz, és levágja a szóközöket.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.eb_students (
  name       text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.eb_students enable row level security;
-- Szándékosan NINCS anon olvasási policy: a kliens nem tudja
-- lekérni a teljes névsort, csak az alábbi függvényen keresztül
-- kérdezheti meg, hogy egy adott név engedélyezett-e.

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
