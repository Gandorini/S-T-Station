import React, { useState } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, InputAdornment } from '@mui/material';
import { useProfileStore } from '../store/profileStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const InitialSetup = () => {
  const { user } = useAuthStore();
  const { updateProfile } = useProfileStore();
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { success, error: supabaseError } = await updateProfile({ username, location });
      if (success) {
        // Força reload do perfil antes de navegar
        setTimeout(() => navigate('/app'), 500);
      } else {
        setError(supabaseError || 'Erro ao salvar perfil.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <Box sx={{ mt: 8, maxWidth: 400, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Bem-vindo!</Typography>
      <Typography sx={{ mb: 2 }}>Complete seu perfil para começar a usar o app.</Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nome do utilizador"
          value={username}
          onChange={e => setUsername(e.target.value)}
          fullWidth
          required
          sx={{ mb: 2 }}
        />
        <TextField
          label="Localização"
          value={location}
          onChange={e => setLocation(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
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
                          setLocation([city, country].filter(Boolean).join(', '));
                        } catch (err) {
                          setError('Erro ao buscar localização.');
                        }
                      }, () => {
                        setError('Não foi possível obter a sua localização.');
                      });
                    } else {
                      setError('Geolocalização não suportada pelo navegador.');
                    }
                  }}
                >
                  Usar minha localização
                </Button>
              </InputAdornment>
            ),
          }}
        />
        <Button type="submit" variant="contained" fullWidth disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Salvar e continuar'}
        </Button>
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      </form>
    </Box>
  );
};

export default InitialSetup;