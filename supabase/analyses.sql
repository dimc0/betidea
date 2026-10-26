-- Table des analyses de Betidea.
-- À exécuter dans Supabase : SQL Editor → New query → Run.

-- Supprime l'ancienne version de la table si tu l'avais déjà créée
-- (attention : efface les analyses déjà enregistrées).
drop table if exists public.analyses;

create table public.analyses (
  id            uuid primary key default gen_random_uuid(),
  match_id      integer not null unique,
  saison        integer not null,
  match         jsonb not null,
  statistiques  jsonb not null,
  "analyse"     jsonb not null,  -- entre guillemets : « analyse » est un mot réservé de PostgreSQL
  modele        text not null,
  created_at    timestamptz not null default now()
);

-- RLS activée sans règle : seule la clé secrète (côté serveur) peut lire et écrire.
alter table public.analyses enable row level security;
