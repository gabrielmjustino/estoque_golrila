-- Correção: Garantir que a RLS permite UPDATE nas colunas qtd_julio e qtd_justino
-- Execute no SQL Editor do Supabase caso o update esteja sendo bloqueado

-- Opção 1: Verificar as políticas existentes
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'inventory';

-- Opção 2: Se não há política de UPDATE, criar uma permissiva (ajuste conforme sua auth)
-- Descomente e ajuste se necessário:
-- CREATE POLICY "Allow all updates on inventory"
--   ON inventory FOR UPDATE
--   USING (true)
--   WITH CHECK (true);

-- Opção 3: Se RLS está habilitada mas sem política de UPDATE, desabilitar temporariamente:
-- ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;

-- Opção 4 (recomendada): Adicionar as colunas à política existente
-- As colunas novas herdam automaticamente as políticas da tabela,
-- então se havia uma política que permite UPDATE, já deve funcionar.
-- Se não funcionar, execute:
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to update inventory" ON inventory;
CREATE POLICY "Allow authenticated users to update inventory"
  ON inventory FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
