-- Remover a coluna 'download_count' (singular) da tabela 'music_sheets'
ALTER TABLE public.music_sheets
DROP COLUMN download_count; 