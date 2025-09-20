-- Adicionar coluna downloads_count à tabela music_sheets
ALTER TABLE public.music_sheets
ADD COLUMN downloads_count INTEGER DEFAULT 0;

-- Opcional: Criar uma política RLS para permitir que qualquer pessoa incremente o downloads_count
-- (Geralmente, o incremento é feito por a RLS via função ou trigger seguro, mas para simplificar, permitiremos update se tiver política adequada para o download)
CREATE POLICY "Enable downloads count update for authenticated users"
ON public.music_sheets
FOR UPDATE
TO authenticated
USING (true) -- Permitir que qualquer user autenticado incremente o downloads_count
WITH CHECK (true);

-- Se quiser controlar quem pode dar download, seria uma política mais restritiva. 