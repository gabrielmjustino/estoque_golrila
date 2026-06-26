-- Migration: add qtd_julio and qtd_justino columns to inventory table
-- Run this in the Supabase SQL Editor

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS qtd_julio   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qtd_justino integer NOT NULL DEFAULT 0;
