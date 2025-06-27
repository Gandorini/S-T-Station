-- Criar função para incrementar downloads_count
CREATE OR REPLACE FUNCTION increment_sheet_downloads(sheet_id_param UUID, user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Incrementar o downloads_count da partitura e Cifra
  UPDATE music_sheets
  SET downloads_count = COALESCE(downloads_count, 0) + 1
  WHERE id = sheet_id_param;

  -- Opcional: Registrar o download em uma tabela de histórico
  INSERT INTO user_sheet_downloads (sheet_id, user_id, downloaded_at)
  VALUES (sheet_id_param, user_id_param, NOW());
END;
$$;

-- Dar permissão para usuários autenticados executarem a função
GRANT EXECUTE ON FUNCTION increment_sheet_downloads TO authenticated; 