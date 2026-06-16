-- Adiciona coluna de status de pagamento na tabela de reservas
-- Execute este SQL no SQL Editor do painel Supabase

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

-- Atualiza reservas existentes (todas iniciam como "não pago")
UPDATE reservations SET payment_status = 'unpaid' WHERE payment_status IS NULL;
