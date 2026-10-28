-- Projet : seconde table, liée aux analyses par une clé étrangère.
-- Une analyse contient plusieurs points clés (relation 1 → n), rangés jusqu'ici
-- dans la colonne jsonb « analyse ». À exécuter dans Supabase (SQL Editor) APRÈS temps-reel.sql.

-- 1. Table des points clés, à exécuter avant de déployer le nouveau code.
create table public.points_cles (
  id          uuid primary key default gen_random_uuid(),
  analyse_id  uuid not null references public.analyses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  position    integer not null,
  texte       text not null,
  created_at  timestamptz not null default now(),
  unique (analyse_id, position)
);

-- L'index créé par la contrainte unique commence par analyse_id : il accélère la lecture
-- des points d'une analyse. Celui-ci accélère le filtre de la Row Level Security.
create index points_cles_user_id_idx on public.points_cles (user_id);

-- Row Level Security : chacun ne lit que ses propres points clés.
-- Aucune règle d'écriture : seul le worker (clé secrète, sans utilisateur) les enregistre.
alter table public.points_cles enable row level security;

create policy "Chacun lit ses propres points clés"
  on public.points_cles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 2. Reprise des analyses existantes, à exécuter APRÈS le déploiement du nouveau code
-- (l'ancien code lit encore les points clés dans la colonne jsonb).
-- Copie chaque point clé dans la nouvelle table, avec sa position dans la liste…
insert into public.points_cles (analyse_id, user_id, position, texte)
select a.id, a.user_id, p.position, p.texte
from public.analyses a,
  jsonb_array_elements_text(a."analyse" -> 'points_cles') with ordinality as p (texte, position)
where a."analyse" ? 'points_cles'
on conflict (analyse_id, position) do nothing;

-- … puis les retire de la colonne jsonb, pour ne pas les stocker deux fois.
update public.analyses
set "analyse" = "analyse" - 'points_cles'
where "analyse" ? 'points_cles';
