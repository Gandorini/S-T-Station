import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CircularProgress, Box, Typography } from '@mui/material';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Aguarda a sessão do Supabase
        await new Promise(res => setTimeout(res, 1000));
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/auth');
          return;
        }

        // Polling para aguardar o perfil ser criado pelo trigger
        let profile = null;
        const maxAttempts = 10;
        let attempts = 0;
        while (attempts < maxAttempts) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          profile = data;
          if (profile) break;
          await new Promise(res => setTimeout(res, 400));
          attempts++;
        }
        if (!profile) {
          navigate('/email-confirmation');
          return;
        }
        // Se o email não estiver confirmado, vai para confirmação
        if (!session.user.email_confirmed_at) {
          navigate('/email-confirmation');
          return;
        }
        // Se não tem username, precisa fazer setup
        if (!profile.username || profile.username.trim() === '') {
          navigate('/setup');
          return;
        }
        // Se perfil está completo, vai para o app
        navigate('/app');
      } catch (error) {
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" sx={{ mt: 3 }}>
        Processando autenticação...
      </Typography>
    </Box>
  );
}