import React, { Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Navigation from './components/Navigation';
import { supabase } from './lib/supabase';

// Lazy load components
const Landing = React.lazy(() => import('./pages/Landing'));
const Home = React.lazy(() => import('./pages/Home'));
const Auth = React.lazy(() => import('./pages/Auth'));
const Upload = React.lazy(() => import('./pages/Upload'));
const SheetViewer = React.lazy(() => import('./pages/SheetViewer'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Explore = React.lazy(() => import('./pages/Explore'));
const Library = React.lazy(() => import('./pages/Library'));
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'));
const Playlists = React.lazy(() => import('./pages/Playlists'));
const PlaylistDetails = React.lazy(() => import('./pages/PlaylistDetails'));
const EmailConfirmation = React.lazy(() => import('./pages/EmailConfirmation'));
const InitialSetup = React.lazy(() => import('./pages/InitialSetup'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));

const LoadingFallback = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}
  >
    <CircularProgress />
  </Box>
);

// Helper para buscar o perfil do user (com atualização forçada)
const useProfile = (userId: string | undefined) => {
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    let ativo = true;
    const fetchProfile = async () => {
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (ativo) {
        setProfile(data);
        setLoadingProfile(false);
      }
    };
    
    fetchProfile();

    // Força atualização a cada 1s por 3 tentativas (para evitar race condition com trigger)
    let tentativas = 0;
    const interval = setInterval(() => {
      if (tentativas >= 3) { clearInterval(interval); return; }
      if (ativo && !loadingProfile) {
        fetchProfile();
      }
      tentativas++;
    }, 1000);

    return () => { ativo = false; clearInterval(interval); };
  }, [userId]);
  
  return { profile, loadingProfile };
};

// Rotas que requerem autenticação
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  const { profile, loadingProfile } = useProfile(user?.id);

  if (!user) return <Navigate to="/auth" replace />;
  if (!user.email_confirmed_at) return <Navigate to="/email-confirmation" replace />;
  
  if (loadingProfile) return <LoadingFallback />;

  if (profile && (!profile.username || profile.username.trim() === '')) {
    return <Navigate to="/setup" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Rotas públicas que não devem mostrar o Layout
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  return !user ? children : <Navigate to="/app" replace />;
};

// Rota para setup inicial (após confirmação de email)
const SetupRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  const { profile, loadingProfile } = useProfile(user?.id);

  if (!user) return <Navigate to="/auth" replace />;
  if (!user.email_confirmed_at) return <Navigate to="/email-confirmation" replace />;
  
  if (loadingProfile) return <LoadingFallback />;

  if (profile && profile.username && profile.username.trim() !== '') {
    return <Navigate to="/app" replace />;
  }

  return children;
};

// Rota para confirmação de email
const EmailConfirmationRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/auth" replace />;
  if (user.email_confirmed_at) return <Navigate to="/setup" replace />;
  return children;
};

// Rota para redefinição de senha
const ResetPasswordRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  const [isValidResetLink, setIsValidResetLink] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkResetLink = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsValidResetLink(false);
        } else {
          setIsValidResetLink(true);
        }
      } catch (error) {
        setIsValidResetLink(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkResetLink();
  }, []);

  if (isChecking) {
    return <LoadingFallback />;
  }

  if (!isValidResetLink) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default function AppRoutes() {
  const { user } = useAuthStore();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/email-confirmation" element={<EmailConfirmationRoute><EmailConfirmation /></EmailConfirmationRoute>} />
        <Route path="/setup" element={<SetupRoute><InitialSetup /></SetupRoute>} />
        <Route path="/reset-password" element={<ResetPasswordRoute><ResetPassword /></ResetPasswordRoute>} />

        {/* Rotas Privadas (com Layout) */}
        <Route path="/app" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/library" element={<PrivateRoute><Library /></PrivateRoute>} />
        <Route path="/playlists" element={<PrivateRoute><Playlists /></PrivateRoute>} />
        <Route path="/playlists/:id" element={<PrivateRoute><PlaylistDetails /></PrivateRoute>} />
        {/* Rotas Semi-Públicas (com Layout, mas não requerem autenticação) */}
        <Route 
          path="/explore" 
          element={
            user ? (
              <Layout><Explore /></Layout>
            ) : (
              <Box sx={{ display: 'flex' }}>
                <Navigation />
                <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
                  <Explore />
                </Box>
              </Box>
            )
          } 
        />
        <Route 
          path="/sheet/:id" 
          element={
            user ? (
              <Layout><SheetViewer /></Layout>
            ) : (
              <Box sx={{ display: 'flex' }}>
                <Navigation />
                <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
                  <SheetViewer />
                </Box>
              </Box>
            )
          } 
        />

        {/* Redirecionar rotas não encontradas para a página inicial apropriada */}
        <Route path="*" element={<Navigate to={user ? "/app" : "/"} replace />} />
      </Routes>
    </Suspense>
  );
}