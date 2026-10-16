-- Table des analyses générées par Betidea.
-- À exécuter une fois dans Supabase : SQL Editor → New query → Run.

create table public.analyses (
  id              uuid primary key default gen_random_uuid(),
  competition_id  integer not null,
  saison          integer not null,
  match_id        integer not null,
  match           jsonb not null,
  perspective     text not null check (perspective in ('retrospective', 'avant_match')),
  question        text not null,
  analyse         jsonb not null,
  modele          text not null,
  created_at      timestamptz not null default now()
);

-- RLS activée sans règle : seule la clé secrète (côté serveur) peut lire et écrire.
alter table public.analyses enable row level security;
