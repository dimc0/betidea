-- TD2 partie 6 : diffusion en temps réel des changements de la table des analyses.
-- À exécuter dans Supabase (SQL Editor) APRÈS asynchrone.sql.

-- La publication supabase_realtime liste les tables dont Supabase Realtime lit les changements
-- dans le journal de PostgreSQL (WAL). La règle de lecture de la Row Level Security
-- (authentification.sql) s'applique aussi : chacun ne reçoit que les changements de ses analyses.
alter publication supabase_realtime add table public.analyses;
