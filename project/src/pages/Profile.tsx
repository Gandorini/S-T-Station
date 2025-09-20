import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Music, Upload as UploadIcon } from 'lucide-react';
import type { MusicSheet } from '../types/database';
import type { User } from '@supabase/supabase-js';
import {
  Container,
  Box,
  Avatar,
  Typography,
  Tab,
  Tabs,
  Grid,
  Paper,
  Button,
  Stack,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  FormControlLabel,
  Switch,
  InputAdornment,
  IconButton,
  InputLabel,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import {
  Edit as EditIcon,
  MusicNote as MusicNoteIcon,
  Favorite as FavoriteIcon,
  Download as DownloadIcon,
  LocationOn,
  CalendarToday,
  Notifications,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import MusicSheetCard from '../components/MusicSheetCard';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAvatarStore } from '../store/avatarStore';
import { useLikeStore } from '../store/likeStore';

// OBS: Todas as requisições para o Supabase feitas via 'supabase-js' já usam o header Accept: application/json automaticamente.
// Só adicione manualmente se usar fetch/axios direto na REST API do Supabase.

// Interface que estende o User do Supabase
interface UserProfile extends User {
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  musical_genres?: string[];
  instruments?: string[];
  professional?: boolean;
  teaching?: boolean;
  created_at: string;
  updated_at: string;
  email: string;
  username: string;
  // stats, joinDate, etc. podem ser derivados
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const Profile = () => {
  const { user: authUser } = useAuthStore();
  const navigate = useNavigate();
  const { setAvatarUrl } = useAvatarStore();
  const { userLikes, fetchUserLikes, likeSheet, unlikeSheet, isSheetLiked } = useLikeStore();
  console.log('userLikes:', userLikes);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sheets, setSheets] = useState<MusicSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrlLocal] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editProfile, setEditProfile] = useState({
    username: '',
    full_name: '',
    location: '',
    bio: '',
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(undefined);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [likedSheets, setLikedSheets] = useState<MusicSheet[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!authUser) return;
      try {
        // Buscar o perfil completo da tabela 'profiles'
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        if (error) throw error;
        setUser(profile);
        if (profile.avatar_url) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('avatar')
            .getPublicUrl(profile.avatar_url);
          setAvatarUrlLocal(publicUrl + `?t=${Date.now()}`); // sempre cache-busting
          setAvatarUrl(publicUrl + `?t=${Date.now()}`); // Atualiza o store global
        } else {
          setAvatarUrlLocal(undefined);
          setAvatarUrl(undefined);
        }
        if (profile.banner_url) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('banner')
            .getPublicUrl(profile.banner_url);
          setBannerUrl(publicUrl + `?t=${Date.now()}`); // sempre cache-busting
        } else {
          setBannerUrl(undefined);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    const fetchSheets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('music_sheets')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });
      if (!error) setSheets(data || []);
      else console.error('Erro ao buscar partituras/cifras:', error);
      setLoading(false);
    };

    fetchSheets();

    // Realtime: escuta mudanças só do utilizador logado
    const channel = supabase
      .channel('profile:music_sheets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_sheets', filter: `user_id=eq.${authUser.id}` }, fetchSheets)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    const fetchFavorites = async () => {
      const ids = await fetchUserLikes();
      if (ids.length === 0) {
        setLikedSheets([]);
        return;
      }
      // Buscar as partituras favoritas completas
      const { data, error } = await supabase
        .from('music_sheets')
        .select('*')
        .in('id', ids);
      if (!error) setLikedSheets(data || []);
    };
    fetchFavorites();
  }, [authUser, userLikes, fetchUserLikes]);

  // Fetch notifications for the logged-in user
  useEffect(() => {
    if (!authUser) return;
    const fetchNotifications = async () => {
      setNotificationsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });
      if (!error) setNotifications(data || []);
      else console.error('Erro ao buscar notificações:', error);
      setNotificationsLoading(false);
    };
    fetchNotifications();
    // Realtime: escuta mudanças nas notificações do utilizador
    const channel = supabase
      .channel('profile:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` }, fetchNotifications)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    try {
      setUploading(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `profiles/${user.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      await new Promise(res => setTimeout(res, 1000));
      const { data: { publicUrl } } = supabase
        .storage
        .from('avatar')
        .getPublicUrl(fileName);
      setAvatarUrlLocal(publicUrl + `?t=${Date.now()}`);
      setAvatarUrl(publicUrl + `?t=${Date.now()}`); // Atualiza o store global

      // Atualizar o avatar_url na tabela profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: fileName })
        .eq('id', user.id);
      if (updateError) throw updateError;
      setEditSuccess(true);
    } catch (err) {
      console.error('Erro ao enviar avatar:', err);
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao enviar a imagem de perfil.');
    } finally {
      setUploading(false);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    try {
      setBannerUploading(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('banner')
        .upload(fileName, file, { upsert: true });
      if (uploadError) {
        setErrorMsg('Erro ao enviar banner: ' + (uploadError.message || 'Erro desconhecido'));
        throw uploadError; // Re-throw para o catch externo
      }
      const { data: { publicUrl } } = supabase
        .storage
        .from('banner')
        .getPublicUrl(fileName);
      setBannerUrl(publicUrl + `?t=${Date.now()}`);

      await new Promise(res => setTimeout(res, 1000)); // Pequeno delay para a UI reagir

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ banner_url: fileName })
        .eq('id', user.id);
      if (updateError) throw updateError;
      setEditSuccess(true);
    } catch (err: any) {
      console.error('Erro ao enviar banner:', err);
      setEditError(err.message || 'Ocorreu um erro ao enviar o banner.');
    } finally {
      setBannerUploading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : '---';

  const handleRequestDelete = (sheetId: string) => {
    setDeleteId(sheetId);
  };

const handleDeleteSheet = async () => {
  if (!deleteId) return;
  const { error } = await supabase
    .from('music_sheets')
    .delete()
    .eq('id', deleteId);
  if (error) {
    setErrorMsg('Erro ao excluir partitura/cifra: ' + (error.message || 'Tente novamente.'));
  } else {
    setSheets(prev => prev.filter(sheet => sheet.id !== deleteId));
    setErrorMsg('Partitura/cifra excluída com sucesso!');
  }
  setDeleteId(null);
};

  const handleMarkNotificationRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Função para curtir/descurtir e atualizar favoritos instantaneamente
  const handleLike = async (sheetId: string) => {
    if (!isSheetLiked(sheetId)) {
      await likeSheet(sheetId);
    } else {
      await unlikeSheet(sheetId);
    }
    await fetchUserLikes();
    const ids = await fetchUserLikes();
    if (ids.length === 0) {
      setLikedSheets([]);
    } else {
      const { data, error } = await supabase
        .from('music_sheets')
        .select('*')
        .in('id', ids);
      if (!error) setLikedSheets(data || []);
    }
  };

  if (!user) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', background: theme => theme.palette.mode === 'light' ? '#FAFAFA' : '#121212', pt: 2, pb: 8 }}>
      <Container maxWidth="md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', mb: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.07)', border: theme => `1px solid ${theme.palette.divider}` }}>
            {/* Header com banner ou gradiente */}
            <Box sx={{ height: 220, position: 'relative', background: bannerUrl ? undefined : theme => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)` }}>
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : null}
              {/* Botão lápis para editar banner */}
              <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 20 }}>
                <label htmlFor="banner-upload">
                  <input
                    id="banner-upload"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleBannerChange}
                    disabled={bannerUploading}
                  />
                  <Button
                    component="span"
                    variant="contained"
                    color="secondary"
                    size="small"
                    sx={{ minWidth: 0, p: 1, borderRadius: '50%' }}
                    disabled={bannerUploading}
                  >
                    <EditIcon fontSize="small" />
                  </Button>
                </label>
              </Box>
              {/* Avatar centralizado, destacado acima do card de conteúdo, sem sobrepor o nome */}
              <Box sx={{ position: 'absolute', left: { xs: '50%', md: 56 }, transform: { xs: 'translateX(-50%)', md: 'none' }, bottom: -70, zIndex: 10 }}>
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar 
                    src={avatarUrl} 
                    alt={user?.username || ''} 
                    sx={{ 
                      width: 140, 
                      height: 140, 
                      border: '6px solid #fff', 
                      boxShadow: '0 8px 32px rgba(0,0,0,0.18)', 
                      fontSize: 48, 
                      bgcolor: '#b6c6e6', 
                      color: '#fff',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'scale(1.04)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.22)'
                      }
                    }}
                  >
                    {!avatarUrl && (user?.username?.[0] || '')}
                  </Avatar>
                  {/* Lápis sobre avatar */}
                  <Box sx={{ position: 'absolute', bottom: 8, right: 8, zIndex: 11 }}>
                    <label htmlFor="avatar-upload">
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                        disabled={uploading}
                      />
                      <Button
                        variant="contained"
                        component="span"
                        size="small"
                        sx={{ minWidth: 0, p: 1, borderRadius: '50%' }}
                        disabled={uploading}
                      >
                        <EditIcon fontSize="small" />
                      </Button>
                    </label>
                  </Box>
                </Box>
              </Box>
            </Box>
            {/* Card de dados do utilizador */}
            <Box sx={{ p: { xs: 3, md: 5 }, pt: { xs: 12, md: 14 }, display: 'flex', flexDirection: 'column', alignItems: { xs: 'center', md: 'flex-start' } }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems={{ xs: 'center', md: 'flex-start' }} width="100%">
                <Box sx={{ flex: 1, minWidth: 260 }}>
                  <Typography variant="h4" fontWeight={800} gutterBottom textAlign={{ xs: 'center', md: 'left' }} color="primary">
                    {user.full_name || user.username}
                  </Typography>
                  <Typography variant="subtitle1" color="#b6c6e6" sx={{ mb: 1, textAlign: { xs: 'center', md: 'left' }, fontWeight: 600 }}>
                    @{user.username}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textAlign: { xs: 'center', md: 'left' } }}>
                    {user.email}
                  </Typography>
                  {user.location && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}>
                      <LocationOn fontSize="small" color="primary" />
                      <Typography variant="body2" color="text.secondary">{user.location}</Typography>
                    </Stack>
                  )}
                  {user.bio && (
                    <Typography variant="body1" color="text.primary" sx={{ mb: 1, textAlign: { xs: 'center', md: 'left' }, maxWidth: 500 }}>
                      {user.bio}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2, mb: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}>
                    <Chip 
                      icon={<CalendarToday fontSize="small" />} 
                      label={`Membro desde ${new Date(user.created_at).toLocaleDateString()}`} 
                      size="small" 
                      sx={{ bgcolor: '#7b2ff2', color: '#fff', fontWeight: 500, px: 1.5 }}
                    />
                  </Stack>
                </Box>
                <Stack direction="column" spacing={2.5} alignItems="center" justifyContent="center">
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => setEditOpen(true)} 
                    sx={{ 
                      borderRadius: 8, 
                      px: 4, 
                      fontWeight: 700, 
                      width: 180, 
                      boxShadow: '0 2px 8px rgba(80,0,200,0.10)',
                      background: 'linear-gradient(90deg, #7b2ff2 0%, #f357a8 100%)',
                      color: '#fff',
                      letterSpacing: 1,
                      mb: 1,
                      '&:hover': {
                        background: 'linear-gradient(90deg, #f357a8 0%, #7b2ff2 100%)',
                        boxShadow: '0 4px 16px rgba(80,0,200,0.18)'
                      }
                    }} 
                    startIcon={<EditIcon />}
                  >
                    Editar Perfil
                  </Button>
                </Stack>
              </Stack>
              {/* Estatísticas do utilizador */}
              <Paper elevation={0} sx={{ mt: 4, p: 3, borderRadius: 2, bgcolor: theme => alpha(theme.palette.primary.main, 0.04), display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: 2, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(80,0,200,0.10)' } }}>
                <Box sx={{ textAlign: 'center', px: 2 }}>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">{sheets.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Partituras</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{ textAlign: 'center', px: 2 }}>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">{likedSheets.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Favoritos</Typography>
                </Box>
              </Paper>
            </Box>
          </Paper>

          {/* Abas de conteúdo */}
          <Paper 
            elevation={0} 
            sx={{ 
              borderRadius: 3,
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              border: theme => `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
              p: { xs: 2, md: 4 }
            }}
          >
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ 
                borderBottom: 1, 
                borderColor: 'divider',
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: '3px 3px 0 0'
                },
                '& .MuiTab-root': {
                  py: 2,
                  fontWeight: 600,
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                  '&.Mui-selected': {
                    color: 'primary.main'
                  },
                  '&:hover': {
                    background: 'rgba(123,47,242,0.08)'
                  }
                }
              }}
            >
              <Tab label="Meus Documentos" icon={<MusicNoteIcon />} iconPosition="start" />
              <Tab label="Favoritos" icon={<FavoriteIcon />} iconPosition="start" />
              <Tab label="Notificações" icon={<Notifications/>} iconPosition="start" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ m: 2 }}>
                  {error}
                </Alert>
              ) : sheets.length === 0 ? (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    py: 6,
                    px: 3,
                    textAlign: 'center'
                  }}
                >
                  <Music size={60} color="#ccc" />
                  <Typography variant="h6" gutterBottom>
                    Você ainda não possui nenhum documento musical
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Compartilhe suas "artes" para que outros músicos possam acessá-la.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<UploadIcon />}
                    onClick={() => {
                      navigate('/upload');
                    }}
                    sx={{ 
                      borderRadius: '20px', 
                      px: 3,
                      py: 1,
                      fontWeight: 600
                    }}
                  >
                    Contribuir
                  </Button>
                </Box>
              ) : (
                <Box sx={{ p: { xs: 2, md: 4 } }}>
                  <Grid container spacing={3}>
                    <AnimatePresence>
                      {sheets.map((sheet, index) => (
                        <Grid item xs={12} sm={6} md={4} key={sheet.id}>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ 
                              duration: 0.4, 
                              delay: index * 0.05,
                              ease: "easeOut" 
                            }}
                          >
                            <MusicSheetCard
                              sheetId={sheet.id}
                              title={sheet.title}
                              composer={sheet.composer}
                              instrument={sheet.instrument}
                              difficulty={
                                sheet.difficulty === 'beginner' ? 1 :
                                sheet.difficulty === 'intermediate' ? 2 : 3
                              }
                              imageUrl=""
                              fileUrl={sheet.file_url}
                              likes={sheet.likes || 0}
                              downloads={sheet.downloads || 0}
                              comments={sheet.comments || 0}
                              isLiked={false}
                              onLike={() => {}}
                              onDownload={() => {}}
                              onPlay={() => {}}
                              onComment={() => {}}
                              onClick={() => {}}
                              isOwner={user?.id === sheet.user_id}
                              onDelete={() => handleRequestDelete(sheet.id)}
                            />
                          </motion.div>
                        </Grid>
                      ))}
                    </AnimatePresence>
                  </Grid>
                </Box>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {likedSheets.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, textAlign: 'center' }}>
                  <FavoriteIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Sem favoritos ainda
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Os Documentos que colocou como favoritos aparecerão aqui
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={3}>
                  {likedSheets.map((sheet) => (
                    <Grid item key={sheet.id} xs={12} sm={6} md={4} lg={3}>
                      <MusicSheetCard
                        sheetId={sheet.id}
                        title={sheet.title}
                        composer={sheet.composer}
                        instrument={sheet.instrument}
                        difficulty={sheet.difficulty === 'beginner' ? 1 : sheet.difficulty === 'intermediate' ? 2 : 3}
                        imageUrl={sheet.file_url}
                        fileUrl={sheet.file_url}
                        likes={sheet.likes || 0}
                        downloads={sheet.downloads || 0}
                        comments={sheet.comments || 0}
                        isLiked={true}
                        onLike={() => {}}
                        onDownload={() => {}}
                        onPlay={() => {}}
                        onComment={() => {}}
                        onClick={() => {}}
                        isOwner={authUser?.id === sheet.user_id}
                        onDelete={() => {}}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {notificationsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : notifications.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, textAlign: 'center' }}>
                  <Notifications sx={{ fontSize: 60, color: '#ccc', mb: 2 }}/>
                  <Typography variant="h6" gutterBottom>Sem notificações</Typography>
                  <Typography variant="body2" color="text.secondary">Ainda não recebeste notificações.</Typography>
                </Box>
              ) : (
                <Box sx={{ p: { xs: 2, md: 4 } }}>
                  {notifications.map((n) => (
                    <Paper key={n.id} sx={{ mb: 2, p: 2, bgcolor: n.read ? 'background.paper' : 'primary.light', opacity: n.read ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="subtitle2" color={n.read ? 'text.secondary' : 'primary.main'}>
                          {n.type === 'download' ? 'A tua partitura/cifra foi descarregada!' : n.type === 'rating' ? 'A tua partitura/cifra foi avaliada!' : n.type}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">{n.content || ''}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(n.created_at).toLocaleString('pt-PT')}</Typography>
                      </Box>
                      {!n.read && (
                        <Button size="small" onClick={() => handleMarkNotificationRead(n.id)}>
                          Marcar como lida
                        </Button>
                      )}
                    </Paper>
                  ))}
                </Box>
              )}
            </TabPanel>
          </Paper>
        </motion.div>
      </Container>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Excluir partitura</DialogTitle>
        <DialogContent>
          Tem certeza que deseja excluir esta partitura?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button onClick={handleDeleteSheet} color="error" variant="contained">Excluir</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Editar Perfil</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome completo"
            value={editProfile.full_name}
            onChange={e => setEditProfile(p => ({ ...p, full_name: e.target.value }))}
            fullWidth
            margin="normal"
            autoComplete="name"
          />
          <TextField
            label="Nome de utilizador"
            value={editProfile.username}
            onChange={e => setEditProfile(p => ({ ...p, username: e.target.value }))}
            fullWidth
            margin="normal"
            autoComplete="username"
          />
          <TextField
            label="Data de Criação"
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
            fullWidth
            margin="normal"
            disabled
            helperText="Data em que se juntou à plataforma"
          />
          <TextField
            label="Localização"
            value={editProfile.location}
            onChange={e => setEditProfile(p => ({ ...p, location: e.target.value }))}
            fullWidth
            margin="normal"
            autoComplete="address-level2"
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
                            setEditProfile(p => ({
                              ...p,
                              location: [city, country].filter(Boolean).join(', ')
                            }));
                          } catch (err) {
                            alert('Erro ao buscar localização.');
                          }
                        }, () => {
                          alert('Não foi possível obter a sua localização.');
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
          <TextField
            label="Biografia"
            value={editProfile.bio}
            onChange={e => setEditProfile(p => ({ ...p, bio: e.target.value }))}
            fullWidth
            margin="normal"
            multiline
            rows={3}
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={async () => {
            const { error } = await supabase
              .from('profiles')
              .update(editProfile)
              .eq('id', user.id);
            if (!error) {
              setEditOpen(false);
              setEditSuccess(true);
            } else {
              setEditError('Erro ao salvar perfil.');
            }
          }} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!editError}
        autoHideDuration={4000}
        onClose={() => setEditError('')}
        message={editError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />

      <Snackbar
        open={editSuccess}
        autoHideDuration={3000}
        onClose={() => setEditSuccess(false)}
        message="Perfil atualizado com sucesso!"
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />

      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ mt: 2 }}>
          {errorMsg}
        </Alert>
      )}
    </Box>
  );
};

export default Profile;