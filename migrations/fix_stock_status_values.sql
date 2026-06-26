-- Correção de dados existentes com valor incorreto de stock_status
-- Execute no SQL Editor do Supabase ANTES de tentar editar qualquer produto

-- 1. Verificar registros com valor incorreto
SELECT id, name, stock_status
FROM inventory
WHERE stock_status NOT IN ('em_estoque', 'aguardando', 'incerto');

-- 2. Corrigir registros com 'estoque' para 'em_estoque'
UPDATE inventory
SET stock_status = 'em_estoque'
WHERE stock_status = 'estoque' OR stock_status IS NULL OR stock_status = '';
