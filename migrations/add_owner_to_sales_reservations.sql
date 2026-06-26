-- Migration: adicionar coluna owner nas tabelas sales e reservations
-- Execute no SQL Editor do Supabase

-- Coluna owner na tabela de vendas
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT 'julio'
    CHECK (owner IN ('julio', 'justino'));

-- Coluna owner na tabela de reservas
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT 'julio'
    CHECK (owner IN ('julio', 'justino'));
