// delete_user_service.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

app.post('/delete-user', async (req, res) => {
  const { user_id } = req.body;
  console.log('Recebido pedido para apagar user_id:', user_id);
  if (!user_id) return res.status(400).json({ error: 'Falta o user_id.' });

  // Tenta apagar o utilizador de auth.users
  const { error } = await supabase.auth.admin.deleteUser(user_id);
  if (error) {
    console.error('Erro ao apagar utilizador:', error.message);
    return res.status(500).json({ error: 'Erro ao apagar utilizador do auth.users: ' + error.message });
  }
  console.log('Utilizador apagado de auth.users:', user_id);
  return res.json({ ok: true, message: 'Utilizador removido de auth.users.' });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Microserviço a correr em http://localhost:${PORT}`);
});