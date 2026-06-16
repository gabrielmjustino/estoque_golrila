-- Adiciona coluna de status de pagamento na tabela de reservas
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

-- Adiciona coluna de status de disponibilidade na tabela de inventário
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS stock_status TEXT NOT NULL DEFAULT 'em_estoque'
    CHECK (stock_status IN ('em_estoque', 'aguardando', 'incerto'));
