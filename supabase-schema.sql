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
