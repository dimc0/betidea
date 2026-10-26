-- TD2 partie 2 : chaque analyse appartient à un utilisateur.
-- À exécuter dans Supabase (SQL Editor) APRÈS analyses.sql.

-- Les analyses de test du TD1 n'ont pas d'auteur : on les supprime.
delete from public.analyses;

-- Auteur de l'analyse : rempli par la base avec l'utilisateur de la session.
alter table public.analyses
  add column user_id uuid not null
  default auth.uid()
  references auth.users (id) on delete cascade;

-- Un même match peut être analysé par plusieurs utilisateurs, mais une seule fois par chacun.
-- L'index créé par cette contrainte commence par user_id : il accélère aussi
-- la recherche des analyses d'un utilisateur (pas besoin d'un second index).
alter table public.analyses drop constraint analyses_match_id_key;
alter table public.analyses add constraint analyses_user_id_match_id_key unique (user_id, match_id);

-- Row Level Security : chacun ne lit et ne crée que ses propres analyses.
create policy "Chacun lit ses propres analyses"
  on public.analyses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Chacun crée ses propres analyses"
  on public.analyses
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
