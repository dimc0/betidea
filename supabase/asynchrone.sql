-- TD2 partie 5 : une analyse existe avant d'être générée.
-- À exécuter dans Supabase (SQL Editor) APRÈS authentification.sql.

-- Statut de la génération : les analyses existantes reçoivent « prete »,
-- les nouvelles « en_attente » (valeur par défaut changée juste après).
alter table public.analyses
  add column statut text not null default 'prete'
    check (statut in ('en_attente', 'prete', 'erreur')),
  add column message_erreur text;

alter table public.analyses alter column statut set default 'en_attente';

-- Colonnes remplies par le worker : vides tant que l'analyse est en attente.
alter table public.analyses
  alter column statistiques drop not null,
  alter column "analyse" drop not null,
  alter column modele drop not null;
