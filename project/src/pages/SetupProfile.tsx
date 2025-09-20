import React, { useState } from 'react';
import {
  Box, Button, TextField, Typography, CircularProgress, Stack, Alert,
  InputAdornment
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const defaultProfile = {
  username: '',
  full_name: '',
  bio: '',
  avatar_url: '',
  location: '',
  musical_genres: [],
  is_public: true,
};

export default function SetupProfile() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState({ ...defaultProfile, email: user?.email || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Só permite acesso se o usuário acabou de se registar (primeiro login, perfil incompleto)
  React.useEffect(() => {
    if (!user) {
      // Se não está autenticado, força logout e vai para /auth
      supabase.auth.signOut();
      navigate('/auth', { replace: true });
      return;
    }
    // Busca perfil e redireciona se já estiver completo
    const checkProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (data && data.username && data.username.trim() !== '') {
        navigate('/app', { replace: true });
      }
    };
    checkProfile();
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setProfile({ ...profile, [name]: checked });
    } else {
      setProfile({ ...profile, [name]: value });
    }
  };

  // Handlers para arrays (chips)
  const handleArrayChange = (name: string, values: string[]) => {
    setProfile({ ...profile, [name]: values });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // Garante que a sessão está válida antes de qualquer operação
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setError('Sessão expirada. Faça login novamente.');
        await supabase.auth.signOut();
        navigate('/auth', { replace: true });
        setLoading(false);
        return;
      }
      // Verificar se o email já existe em perfis
      const { data: emailExists, error: emailCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', profile.email.trim());
      if (emailCheckError) throw emailCheckError;
      if (emailExists && emailExists.length > 0 && emailExists[0].id !== user?.id) {
        setError('Este email já está associado a outro utilizador. Por favor utilize outro email.');
        setLoading(false);
        return;
      }
      // Verificar se o nome de utilizador já existe (case-insensitive)
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', profile.username.trim())
        .neq('id', user?.id);
      if (checkError) throw checkError;
      if (existing && existing.length > 0) {
        setError('Este nome de utilizador já está em uso. Por favor escolha outro.');
        setLoading(false);
        return;
      }
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user?.id,
        ...profile,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) {
        setError(upsertError.message || 'Erro ao criar perfil.');
        setLoading(false);
        return;
      }
      // Aguarda a trigger do Supabase criar/atualizar o perfil e faz fetch atualizado antes de redirecionar
      let tentativas = 0;
      let perfilCompleto = false;
      while (tentativas < 10 && !perfilCompleto) {
        const { data: perfilAtualizado } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user?.id)
          .single();
        if (perfilAtualizado && perfilAtualizado.username && perfilAtualizado.username.trim() !== '') {
          perfilCompleto = true;
          break;
        }
        await new Promise(res => setTimeout(res, 400));
        tentativas++;
      }
      setSuccess('Perfil criado/atualizado com sucesso!');
      setTimeout(() => navigate('/'), 1200);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', mt: 8, p: 3 }}>
      <Typography variant="h4" gutterBottom>Configuração de Perfil</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Complete o seu perfil para começar a usar a plataforma.
      </Typography>
      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField label="Nome de utilizador" name="username" value={profile.username} onChange={handleChange} required />
          <TextField label="Nome completo" name="full_name" value={profile.full_name} onChange={handleChange} />
          <TextField label="Biografia" name="bio" value={profile.bio} onChange={handleChange} multiline rows={2} />
          <TextField
            label="Localização"
            name="location"
            value={profile.location}
            onChange={handleChange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={async () => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(async (position) => {
                          const { latitude, longitude } = position.coords;
                          try {
                            const response = await fetch(
                              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                            );
                            const data = await response.json();
                            const city = data.address.city || data.address.town || data.address.village || '';
                            const country = data.address.country || '';
                            setProfile(p => ({
                              ...p,
                              location: [city, country].filter(Boolean).join(', ')
                            }));
                          } catch (err) {
                            alert('Erro ao buscar localização.');
                          }
                        }, () => {
                          alert('Não foi possível obter sua localização.');
                        });
                      } else {
                        alert('Geolocalização não suportada pelo navegador.');
                      }
                    }}
                  >
                    Usar minha localização
                  </Button>
                </InputAdornment>
              ),
            }}
          />
          <TextField label="Gêneros musicais (separados por vírgula)" name="musical_genres" value={profile.musical_genres?.join(', ') || ''} onChange={e => handleArrayChange('musical_genres', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
          <label>
            <input type="checkbox" name="is_public" checked={!!profile.is_public} onChange={handleChange} /> Perfil público
          </label>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Guardar Perfil'}
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>
      </form>
    </Box>
  );
}
