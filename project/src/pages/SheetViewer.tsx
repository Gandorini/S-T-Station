import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Music, Star, Download, Share2, FileText, Image } from 'lucide-react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Download as DownloadIcon, Add as AddIcon } from '@mui/icons-material';
import type { MusicSheet, Rating } from '../types/database';
import { 
  Box, 
  Typography, 
  Stack, 
  Chip, 
  TextField,
  Button,
  Avatar,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Divider,
  Badge,
  Paper,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Container,
  Grid,
  FormControlLabel,
  Checkbox,
  Switch,
  Snackbar,
} from '@mui/material';
import SheetMusicViewer from '../components/SheetMusicViewer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AddBoxOutlined,
  Download as DownloadIconComponent,
  Share as ShareIcon,
  MusicNote as MusicNoteIconComponent,
  Favorite,
  FavoriteBorder,
} from '@mui/icons-material';
import { useLikeStore } from '../store/likeStore';

// Novas interfaces para Playlist e NewPlaylistFormData (copiadas de MusicSheetCard.tsx ou Library.tsx)
interface Playlist {
  id: string; // UUID do Supabase
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  sheets_count: number; // Para exibir quantas partituras estão na playlist
}

interface NewPlaylistFormData {
  name: string;
  description: string;
  is_public: boolean;
}

// Opções de exportação
interface ExportOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  action: () => void;
}

const SheetViewer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [sheet, setSheet] = useState<MusicSheet | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [userRating, setUserRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const theme = useTheme();
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Estado para Adicionar à Playlist
  const [openAddPlaylistDialog, setOpenAddPlaylistDialog] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [addPlaylistError, setAddPlaylistError] = useState('');
  const [addPlaylistSuccess, setAddPlaylistSuccess] = useState(false);

  const [openCreateNewPlaylistDialog, setOpenCreateNewPlaylistDialog] = useState(false);
  const [newPlaylistFormData, setNewPlaylistFormData] = useState<NewPlaylistFormData>({
    name: '',
    description: '',
    is_public: false,
  });
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const { userLikes, fetchUserLikes, likeSheet, unlikeSheet, isSheetLiked } = useLikeStore();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchSheetData = async () => {
      try {
        if (!id) return;

        const { data: sheetData, error: sheetError } = await supabase
          .from('music_sheets')
          .select('*')
          .eq('id', id)
          .single();

        if (sheetError) throw sheetError;
        setSheet(sheetData);

        const { data: ratingsData, error: ratingsError } = await supabase
          .from('ratings')
          .select('*')
          .eq('sheet_id', id);

        if (ratingsError) throw ratingsError;
        setRatings(ratingsData);

        if (user) {
          const userRating = ratingsData.find((r: Rating) => r.user_id === user.id);
          if (userRating) setUserRating(userRating.score);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro');
      } finally {
        setLoading(false);
      }
    };

    fetchSheetData();

    // Realtime: escuta mudanças na partitura específica
    const channel = supabase
      .channel('sheet:music_sheets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_sheets', filter: `id=eq.${id}` }, fetchSheetData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  useEffect(() => {
    if (sheet?.file_url) {
      const { data } = supabase.storage.from('music-sheets').getPublicUrl(sheet.file_url);
      setPublicUrl(data.publicUrl);
    } else {
      setPublicUrl(null);
    }
  }, [sheet?.file_url]);

  // Função para buscar playlists do usuário
  const fetchUserPlaylists = async () => {
    if (!user) return;
    setLoadingPlaylists(true);
    setAddPlaylistError('');
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id, name, description, is_public, created_at, updated_at, sheets_count:playlist_sheets(count)')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const formattedPlaylists = (data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        name: p.name,
        description: p.description,
        is_public: p.is_public,
        created_at: p.created_at,
        updated_at: p.updated_at,
        sheets_count: p.sheets_count[0]?.count || 0,
      }));
      setUserPlaylists(formattedPlaylists);
    } catch (err: any) {
      console.error('Erro ao buscar playlists:', err);
      setAddPlaylistError('Não foi possível carregar as playlists.');
    } finally {
      setLoadingPlaylists(false);
    }
  };

  // Abrir diálogo de adicionar à playlist e carregar playlists
  const handleOpenAddPlaylistDialog = () => {
    setOpenAddPlaylistDialog(true);
    if (user) {
      fetchUserPlaylists();
    } else {
      setAddPlaylistError('Faça login para adicionar à playlist.');
    }
  };

  // Lidar com a seleção de playlists
  const handleSelectPlaylist = (playlistId: string) => {
    setSelectedPlaylists(prev => 
      prev.includes(playlistId) 
        ? prev.filter(id => id !== playlistId) 
        : [...prev, playlistId]
    );
  };

  // Lidar com a criação de uma nova playlist
  const handleCreateNewPlaylist = async () => {
    if (!user) {
      setAddPlaylistError('Sessão expirada. Por favor, faça login novamente.');
      return;
    }
    if (!newPlaylistFormData.name.trim()) {
      setAddPlaylistError('O nome da playlist é obrigatório.');
      return;
    }

    setCreatingPlaylist(true);
    setAddPlaylistError('');

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          name: newPlaylistFormData.name.trim(),
          description: newPlaylistFormData.description.trim() || null,
          is_public: newPlaylistFormData.is_public,
        })
        .select();

      if (error) throw error;
      
      setOpenCreateNewPlaylistDialog(false);
      setNewPlaylistFormData({ name: '', description: '', is_public: false });
      fetchUserPlaylists(); // Re-fetch playlists to include the new one
      setAddPlaylistSuccess(true);
      setTimeout(() => setAddPlaylistSuccess(false), 3000);

    } catch (err: any) {
      console.error('Erro ao criar playlist:', err);
      setAddPlaylistError(`Erro ao criar playlist: ${err.message}`);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Lidar com a adição da partitura às playlists selecionadas
  const handleAddSheetToPlaylists = async () => {
    if (!user || !sheet) {
      setAddPlaylistError('Sessão expirada ou partitura/cifra não disponível.');
      return;
    }
    if (selectedPlaylists.length === 0) {
      setAddPlaylistError('Selecione pelo menos uma playlist.');
      return;
    }

    setLoadingPlaylists(true);
    setAddPlaylistError('');

    try {
      const insertions = [];
      for (const playlistId of selectedPlaylists) {
        // Buscar a posição atual máxima para esta playlist
        const { data: existingItems, error: fetchError } = await supabase
          .from('playlist_items')
          .select('position')
          .eq('playlist_id', Number(playlistId))
          .order('position', { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        const nextPosition = (existingItems && existingItems.length > 0)
          ? existingItems[0].position + 1
          : 1;

        insertions.push({
          playlist_id: Number(playlistId),
          sheet_id: sheet.id,
          position: nextPosition,
        });
      }

      const { error } = await supabase
        .from('playlist_items')
        .insert(insertions);

      if (error) throw error;

      setOpenAddPlaylistDialog(false);
      setSelectedPlaylists([]);
      setAddPlaylistSuccess(true);
      setTimeout(() => setAddPlaylistSuccess(false), 3000);

    } catch (err: any) {
      console.error('Erro ao adicionar partitura/cifra à playlist:', err);
      if (err.code === '23505') {
        setAddPlaylistError('Esta partitura/cifra já está em uma das playlists selecionadas.');
      } else {
        setAddPlaylistError(`Erro ao adicionar: ${err.message}`);
      }
    } finally {
      setLoadingPlaylists(false);
    }
  };

  // Função para gerenciar avaliações da partitura
  const handleRating = async (score: number) => {
    if (!user || !sheet) return;
    
    try {
      setUserRating(score);
      
      // Verificar se o usuário já avaliou essa partitura
      const existingRating = ratings.find(r => r.user_id === user.id);
      
      if (existingRating) {
        // Atualizar avaliação existente
        await supabase
          .from('ratings')
          .update({ score })
          .match({ 
            user_id: user.id,
            sheet_id: sheet.id
          });
          
        // Atualizar state local
        setRatings(ratings.map(r => 
          r.user_id === user.id && r.sheet_id === sheet.id ? { ...r, score } : r
        ));
      } else {
        // Criar nova avaliação
        const { data, error } = await supabase
          .from('ratings')
          .insert([{
            user_id: user.id,
            sheet_id: sheet.id,
            score
          }])
          .select()
          .single();
          
        if (error) throw error;
        
        // Adicionar ao state local
        setRatings([...ratings, data]);
      }
    } catch (err) {
      console.error('Erro ao avaliar partitura/cifra:', err);
      // Reverter a classificação local em caso de erro
      const currentRating = ratings.find(r => r.user_id === user.id);
      setUserRating(currentRating?.score || 0);
    }
  };

  // Função para exportar partitura
  const handleExportSheet = async (format: string) => {
    if (!sheet?.file_url || !sheet?.id) {
      setExportError('Arquivo de partitura/cifra não disponível para exportação');
      return;
    }
    if (!user) {
      setExportError('Faça login para registar o download.');
      return;
    }

    setExportLoading(true);
    setExportError('');

    try {
      // 1. Incrementar downloads_count no Supabase (agora com user_id)
      const { data: incrementData, error: incrementError } = await supabase
        .rpc('increment_sheet_downloads_with_user', { sheet_id_param: sheet.id, user_id_param: user.id });

      if (incrementError) {
        console.error('Erro ao incrementar downloads:', incrementError);
        // Não vamos impedir o download mesmo se o incremento falhar
      } else {
        console.log('Downloads incrementado com sucesso:', incrementData);
      }

      // 2. Obter o ficheiro como um Blob e iniciar o download
      const { data: publicUrlData } = supabase.storage
        .from('music-sheets')
        .getPublicUrl(sheet.file_url);

      if (!publicUrlData.publicUrl) {
        throw new Error('Não foi possível gerar URL pública para o ficheiro');
      }

      const response = await fetch(publicUrlData.publicUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar o ficheiro: ${response.statusText}`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      const filename = `${sheet.title}.${sheet.file_url.split('.').pop() || 'pdf'}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(blobUrl); // Libera o URL do Blob

      setExportLoading(false);
    } catch (err) {
      console.error('Erro na exportação:', err);
      setExportError('Falha ao exportar o ficheiro. Por favor, tente novamente.');
    } finally {
      setExportLoading(false);
    }
  };

  // Opções de exportação disponíveis
  const exportOptions: ExportOption[] = [
    {
      id: 'pdf',
      label: 'PDF',
      icon: <FileText size={24} />,
      description: 'Exportar no formato PDF original',
      action: () => handleExportSheet('pdf'),
    },
    {
      id: 'png',
      label: 'Imagem PNG',
      icon: <Image size={24} />,
      description: 'Exportar como imagem de alta qualidade',
      action: () => handleExportSheet('png'),
    },
    {
      id: 'musicxml',
      label: 'MusicXML',
      icon: <Music size={24} />,
      description: 'Formato compatível com editores de partituras',
      action: () => handleExportSheet('musicxml'),
    }
  ];

  // Buscar likes ao montar e quando mudar sheet/user
  useEffect(() => {
    if (!sheet) return;
    const fetchLikes = async () => {
      // Buscar contador de likes
      const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('sheet_id', sheet.id);
      setLikeCount(count || 0);
      // Atualizar likes do usuário globalmente
      await fetchUserLikes();
      setLiked(isSheetLiked(sheet.id));
    };
    fetchLikes();
  }, [sheet, user, fetchUserLikes, isSheetLiked]);

  const handleLikeClick = async () => {
    if (!user || !sheet) {
      alert('Precisa de iniciar sessão para favoritar.');
      return;
    }
    setLikeLoading(true);
    // Pequeno delay para UX e evitar spam
    await new Promise(resolve => setTimeout(resolve, 400));
    if (!isSheetLiked(sheet.id)) {
      await likeSheet(sheet.id);
    } else {
      await unlikeSheet(sheet.id);
    }
    // Buscar contador atualizado após operação
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('sheet_id', sheet.id);
    setLikeCount(count || 0);
    setLiked(isSheetLiked(sheet.id));
    setLikeLoading(false);
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <Box 
        sx={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: theme.palette.mode === 'light' ? '#FAFAFA' : '#121212'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={60} thickness={4} />
            <Typography variant="h6" color="text.secondary">
              Carregando...
            </Typography>
          </Stack>
        </motion.div>
      </Box>
    );
  }

  if (!sheet) {
    return (
      <Box 
        sx={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: theme.palette.mode === 'light' ? '#FAFAFA' : '#121212'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper 
            elevation={0}
            sx={{ 
              p: 4, 
              textAlign: 'center',
              borderRadius: 3,
              background: theme.palette.mode === 'light' 
                ? alpha(theme.palette.primary.main, 0.05) 
                : alpha(theme.palette.primary.main, 0.1),
            }}
          >
            <Music size={48} color={theme.palette.primary.main} />
            <Typography variant="h5" color="text.secondary" sx={{ mt: 2 }}>
              Partitura/Cifra não encontrada
            </Typography>
          </Paper>
        </motion.div>
      </Box>
    );
  }

  const averageRating = ratings.length
    ? ratings.reduce((acc, curr) => acc + curr.score, 0) / ratings.length
    : 0;

  const isOwner = user && sheet.user_id === user.id;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, height: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >

        <Box
          sx={{
            position: 'relative',
            mb: 4,
            p: 4,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: 'white',
            overflow: 'hidden',
          }}
        >
          <IconButton
            sx={{ position: 'absolute', top: 16, left: 16, color: 'white' }}
            onClick={() => navigate(-1)}
          >
            <ArrowBackIcon />
          </IconButton>
          
          <Typography variant="h4" component="h1" sx={{ mt: 2, textAlign: 'center', fontWeight: 'bold' }}>
            {sheet?.title || 'Carregando...'}
          </Typography>
          
          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            alignItems="center"
            sx={{ mt: 2 }}
          >
            <Chip
              icon={<Music size={16} />}
              label={sheet?.instrument || 'Instrumento'}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
            <Chip
              icon={<Star size={16} />}
              label={`${sheet?.difficulty || 'Fácil'}`}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          </Stack>

          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            sx={{ mt: 3 }}
          >
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => {
                const fileExtension = sheet?.file_url ? sheet.file_url.split('.').pop() || 'pdf' : 'pdf';
                handleExportSheet(fileExtension);
              }}
              sx={{
                background: 'linear-gradient(90deg, #f357a8 0%, #7b2ff2 100%)',
                color: 'white',
                borderRadius: 999,
                px: 4,
                py: 1.5,
                fontWeight: 600,
                fontSize: 18,
                boxShadow: '0 4px 16px 0 rgba(123,47,242,0.15)',
                textTransform: 'none',
                minWidth: 220,
                justifyContent: 'center',
                '&:hover': {
                  background: 'linear-gradient(90deg, #7b2ff2 0%, #f357a8 100%)',
                  color: 'white',
                },
              }}
              size="large"
            >
              Download
            </Button>
          </Stack>
        </Box>

        <Grid container spacing={4} alignItems="stretch" sx={{ minHeight: { md: 600 }, height: '100%' }}>
          <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', height: { md: '100%' } }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <Paper
                elevation={3}
                sx={{
                  p: { xs: 1, sm: 2, md: 3 },
                  borderRadius: { xs: 1, sm: 2 },
                  bgcolor: theme.palette.background.paper,
                  boxShadow: { xs: 1, md: 3 },
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    flex: 1,
                    minHeight: { xs: 220, sm: 300, md: 400 },
                    maxHeight: { xs: 320, sm: 500, md: 'none' },
                    overflow: 'auto',
                    borderRadius: { xs: 1, sm: 2 },
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220 }}>
                      <CircularProgress />
                    </Box>
                  ) : error ? (
                    <Alert severity="error">{error}</Alert>
                  ) : sheet ? (
                    (() => {
                      const fileUrl = sheet.file_url;
                      const isPdf = fileUrl && fileUrl.endsWith('.pdf');
                      const isImage = fileUrl && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileUrl);
                      const isXml = fileUrl && /\.(xml|musicxml)$/i.test(fileUrl);
                      if ((isPdf || isImage) && publicUrl) {
                        return (
                          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {/* Visualização do PDF ou imagem */}
                            {isPdf ? (
                              <iframe
                                src={`${publicUrl}#toolbar=0&navpanes=0&view=FitH`}
                                title="PDF da partitura/cifra"
                                style={{ width: '100%', height: '70vh', minHeight: 400, border: 'none', background: '#fff', borderRadius: 8 }}
                              />
                            ) : (
                              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fff', height: '100%' }}>
                                <img
                                  src={publicUrl}
                                  alt={sheet.title}
                                  style={{ width: '100%', maxWidth: 600, maxHeight: '65vh', objectFit: 'contain', borderRadius: 8 }}
                                />
                              </Box>
                            )}
                          </Box>
                        );
                      } else if (isXml && publicUrl) {
                        return (
                          <SheetMusicViewer xmlUrl={publicUrl} title={sheet.title} />
                        );
                      } else {
                        return (
                          <Alert severity="info">Arquivo de partitura/cifra não suportado para visualização.</Alert>
                        );
                      }
                    })()
                  ) : null}
                </Box>
              </Paper>
            </motion.div>
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', height: { md: '100%' } }}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <Stack spacing={3} sx={{ height: '100%' }}>
                <Paper
                  elevation={3}
                  sx={{
                    p: { xs: 1.5, sm: 2, md: 3 },
                    borderRadius: { xs: 1, sm: 2 },
                    bgcolor: theme.palette.background.paper,
                    boxShadow: { xs: 1, md: 3 },
                  }}
                >
                  <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: 18, sm: 20 } }}>
                    Detalhes
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: 13, sm: 15 } }}>
                        Compositor
                      </Typography>
                      <Typography sx={{ fontSize: { xs: 15, sm: 17 } }}>{sheet?.composer || 'Não especificado'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: 13, sm: 15 } }}>
                        Publicado em
                      </Typography>
                      <Typography sx={{ fontSize: { xs: 15, sm: 17 } }}>
                        {sheet?.created_at
                          ? format(new Date(sheet.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : 'Data não disponível'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
                {/* Avaliações */}
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: { xs: 1.5, sm: 2, md: 3 },
                    borderRadius: { xs: 1.5, sm: 3 },
                    background: theme.palette.mode === 'light' 
                      ? alpha(theme.palette.primary.main, 0.02) 
                      : alpha(theme.palette.primary.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                    <Box sx={{ color: 'warning.main' }}>
                      <Star />
                    </Box>
                    <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: 17, sm: 19 } }}>
                      Avaliações
                    </Typography>
                  </Stack>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h4" fontWeight="bold" color="primary" sx={{ fontSize: { xs: 24, sm: 32 } }}>
                        {averageRating.toFixed(1)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 13, sm: 15 } }}>
                        {ratings.length} {ratings.length === 1 ? 'avaliação' : 'avaliações'}
                      </Typography>
                    </Box>
                    {user && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontSize: { xs: 13, sm: 15 } }}>
                          A sua avaliação
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          {[1, 2, 3, 4, 5].map((score) => (
                            <IconButton
                              key={score}
                              onClick={() => handleRating(score)}
                              sx={{
                                color: score <= userRating ? 'warning.main' : 'action.disabled',
                                '&:hover': {
                                  color: 'warning.main',
                                  transform: 'scale(1.1)',
                                },
                                transition: 'all 0.2s ease',
                                p: { xs: 0.5, sm: 1 },
                              }}
                            >
                              <Star />
                            </IconButton>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </Paper>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: { xs: 1.5, sm: 2, md: 3 },
                    borderRadius: { xs: 1.5, sm: 3 },
                    background: theme.palette.mode === 'light' 
                      ? alpha(theme.palette.primary.main, 0.02) 
                      : alpha(theme.palette.primary.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Tooltip title={liked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
                      <span>
                        <IconButton aria-label="like" onClick={handleLikeClick} color={liked ? "primary" : "default"} disabled={likeLoading}>
                          {liked ? <Favorite /> : <FavoriteBorder />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Paper>
              </Stack>
            </motion.div>
          </Grid>
        </Grid>
      </motion.div>

      {/* Diálogos */}
      {/* REMOVIDO: Diálogo para Exportar Partitura/Cifra */}

      {/* Diálogo para Adicionar à Playlist (copiado de MusicSheetCard.tsx) */}
      <Dialog open={openAddPlaylistDialog} onClose={() => setOpenAddPlaylistDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar à Playlist</DialogTitle>
        <DialogContent>
          {addPlaylistError && <Alert severity="error" sx={{ mb: 2 }}>{addPlaylistError}</Alert>}
          {loadingPlaylists ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : userPlaylists.length === 0 ? (
            <Box textAlign="center" py={2}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Você ainda não tem playlists.
              </Typography>
              <Button 
                variant="outlined" 
                startIcon={<AddIcon />} 
                onClick={() => setOpenCreateNewPlaylistDialog(true)}
              >
                Criar Nova Playlist
              </Button>
            </Box>
          ) : (
            <Stack spacing={1} mt={1}>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>Selecione uma ou mais playlists:</Typography>
              {userPlaylists.map(playlist => (
                <FormControlLabel
                  key={playlist.id}
                  control={
                    <Checkbox
                      checked={selectedPlaylists.includes(playlist.id)}
                      onChange={() => handleSelectPlaylist(playlist.id)}
                    />
                  }
                  label={playlist.name + (playlist.is_public ? ' (Pública)' : ' (Privada)')}
                />
              ))}
              <Button 
                variant="outlined" 
                startIcon={<AddIcon />} 
                onClick={() => setOpenCreateNewPlaylistDialog(true)}
                sx={{ mt: 2 }}
              >
                Ou Crie Uma Nova Playlist
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddPlaylistDialog(false)}>Cancelar</Button>
          <Button 
            onClick={handleAddSheetToPlaylists} 
            variant="contained" 
            color="primary" 
            disabled={selectedPlaylists.length === 0 || loadingPlaylists}
          >
            Adicionar ({selectedPlaylists.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para Criar Nova Playlist (aninhado, copiado de MusicSheetCard.tsx) */}
      <Dialog open={openCreateNewPlaylistDialog} onClose={() => setOpenCreateNewPlaylistDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Criar Nova Playlist</DialogTitle>
        <DialogContent>
          {addPlaylistError && <Alert severity="error" sx={{ mb: 2 }}>{addPlaylistError}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField
              label="Nome da Playlist"
              fullWidth
              value={newPlaylistFormData.name}
              onChange={e => setNewPlaylistFormData(p => ({ ...p, name: e.target.value }))}
              required
            />
            <TextField
              label="Descrição (opcional)"
              fullWidth
              multiline
              rows={3}
              value={newPlaylistFormData.description}
              onChange={e => setNewPlaylistFormData(p => ({ ...p, description: e.target.value }))}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={newPlaylistFormData.is_public}
                  onChange={e => setNewPlaylistFormData(p => ({ ...p, is_public: e.target.checked }))}
                  color="primary"
                />
              }
              label="Tornar Pública"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateNewPlaylistDialog(false)}>Cancelar</Button>
          <Button onClick={handleCreateNewPlaylist} variant="contained" color="primary" disabled={creatingPlaylist}>
            {creatingPlaylist ? <CircularProgress size={24} /> : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar de Sucesso para Adicionar à Playlist */}
      <Snackbar
        open={addPlaylistSuccess}
        autoHideDuration={3000}
        onClose={() => setAddPlaylistSuccess(false)}
        message="Partitura/cifra adicionada à(s) playlist(s) com sucesso!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

export default SheetViewer;