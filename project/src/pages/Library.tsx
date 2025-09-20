import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { MusicSheet } from '../types/database';
import {
  Container,
  Box,
  Typography,
  Tab,
  Tabs,
  Stack,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Pagination,
  CircularProgress,
  Alert,
  Select,
  InputLabel,
  FormControl,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Folder as FolderIcon,
  Star as StarIcon,
  Download as DownloadIcon,
  Collections as CollectionsIcon,
  MusicNote as MusicNoteIcon,
  Favorite as FavoriteIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import MusicSheetCard from '../components/MusicSheetCard';
import { useLikeStore } from '../store/likeStore';

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
      id={`library-tabpanel-${index}`}
      aria-labelledby={`library-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface Collection {
  id: number;
  name: string;
  description: string;
  sheets: number;
  isPublic: boolean;
}

// Nova interface para Playlists (agora dinâmicas)
interface Playlist {
  id: number; // Alterado para number para corresponder ao bigint do Supabase
  user_id: string;
  title: string; // Alterado de 'name' para 'title'
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  sheets_count: number; // Para exibir quantas partituras estão na playlist
}

// Interface para o diálogo de nova playlist
interface NewPlaylistFormData {
  title: string; // Alterado de 'name' para 'title'
  description: string;
  is_public: boolean;
}

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    instrument: '',
    difficulty: '',
    sortBy: 'recent'
  });
  const [playlists, setPlaylists] = useState<Playlist[]>([]); // Alterado de collections para playlists
  const [sheets, setSheets] = useState<MusicSheet[]>([]);
  const { userLikes, fetchUserLikes, likeSheet, unlikeSheet, isSheetLiked } = useLikeStore();
  console.log('userLikes:', userLikes);
  const [likedSheets, setLikedSheets] = useState<MusicSheet[]>([]);
  const [downloadedSheets, setDownloadedSheets] = useState<MusicSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [openNewPlaylistDialog, setOpenNewPlaylistDialog] = useState(false);
  const [newPlaylistData, setNewPlaylistData] = useState<NewPlaylistFormData>({
    title: '',
    description: '',
    is_public: false,
  });

  // Função auxiliar para mapear dificuldade de string para número
  const mapDifficultyToNumber = (difficulty: 'beginner' | 'intermediate' | 'advanced'): number => {
    switch (difficulty) {
      case 'beginner':
        return 1;
      case 'intermediate':
        return 3;
      case 'advanced':
        return 5;
      default:
        return 1; // Default para iniciante
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    if (!user) {
      navigate('/auth');
      return () => { isMounted = false; };
    }

    const fetchSheets = async () => {
      if (!isMounted) return;
      setLoading(true);
      setError('');
      
      try {
        console.log('Fetching sheets for user ID:', user?.id);
        const { data, error } = await supabase
          .from('music_sheets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!isMounted) return;
        
        if (error) {
          console.error('Erro ao buscar partituras/cifras:', error);
          setError('Ocorreu um erro ao carregar as suas partituras e cifras. Por favor, tente novamente.');
          return;
        }
        
        console.log('Fetched sheets data:', data);
        
        const sheetsWithDefaults = (data || []).map(sheet => ({
          ...sheet,
          likes: sheet.likes || 0,
          downloads: sheet.downloads || 0,
          comments: sheet.comments || 0,
          isLiked: false
        }));
        
        setSheets(sheetsWithDefaults);
        console.log('Sheets after setting state:', sheetsWithDefaults);

        // Buscar Playlists do usuário
        const { data: playlistsData, error: playlistsError } = await supabase
          .from('playlists')
          .select('id, title, description, is_public, created_at, updated_at, sheets_count:playlist_items(count)') // Alterado de playlist_sheets para playlist_items
          .eq('user_id', user.id);

        if (!isMounted) return;

        if (playlistsError) {
          console.error('Erro ao buscar playlists:', playlistsError);
          setError('Ocorreu um erro ao carregar as suas playlists. Por favor, tente novamente.');
          return;
        }

        const formattedPlaylists = (playlistsData || []).map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          title: p.title, // Alterado de 'name' para 'title'
          description: p.description,
          is_public: p.is_public,
          created_at: p.created_at,
          updated_at: p.updated_at,
          sheets_count: p.sheets_count[0]?.count || 0,
        }));
        setPlaylists(formattedPlaylists);

        setLikedSheets([]);
        setDownloadedSheets([]);
        
      } catch (err) {
        if (!isMounted) return;
        console.error('Erro ao buscar dados da biblioteca:', err);
        setError('Ocorreu um erro ao carregar as suas partituras e cifras. Por favor, tente novamente.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSheets();

    // Realtime: escuta mudanças na tabela (e agora nas playlists também)
    const channelSheets = supabase
      .channel('public:music_sheets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_sheets' }, fetchSheets)
      .subscribe();
    
    const channelPlaylists = supabase
      .channel('public:playlists')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, fetchSheets) // Re-fetch all on playlist change
      .subscribe();

    return () => {
      supabase.removeChannel(channelSheets);
      supabase.removeChannel(channelPlaylists);
      isMounted = false;
    };
  }, [user, navigate]);

  useEffect(() => {
    if (!user || tabValue !== 2) return;
    let isMounted = true;
    const fetchFavorites = async () => {
      try {
        console.log('A buscar favoritos para o utilizador:', user.id);
        const ids = await fetchUserLikes();
        console.log('IDs recebidos do fetchUserLikes:', ids);
        
        if (!isMounted) return;
        
        if (!ids || !Array.isArray(ids)) {
          console.error('IDs inválidos recebidos:', ids);
          setLikedSheets([]);
          return;
        }

        const validIds = ids.filter(id => {
          const isValid = !!id && typeof id === 'string' && id.length > 0;
          if (!isValid) {
            console.warn('ID inválido encontrado:', id);
          }
          return isValid;
        });

        console.log('IDs válidos após filtro:', validIds);

        if (validIds.length === 0) {
          console.log('Nenhum ID válido encontrado, limpando likedSheets');
          setLikedSheets([]);
          return;
        }

        console.log('Fazendo query ao Supabase com IDs:', validIds);
        const { data, error } = await supabase
          .from('music_sheets')
          .select('id, title, composer, instrument, file_url, user_id, created_at, difficulty')
          .in('id', validIds);

        if (error) {
          console.error('Erro ao buscar partituras:', error);
          return;
        }

        if (!isMounted) return;

        console.log('Dados recebidos do Supabase:', data);
        setLikedSheets((data || []).map(sheet => ({ 
          ...sheet, 
          tags: [],
          likes: 0,
          downloads: 0,
          comments: 0
        })));
      } catch (err) {
        console.error('Erro ao buscar favoritos:', err);
      }
    };
    fetchFavorites();
    return () => { isMounted = false; };
  }, [user, tabValue, fetchUserLikes]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Filtrar partituras/cifras com todos os filtros (busca, instrumento, dificuldade, ordenação)
  const filteredSheets = (sheets: MusicSheet[]) => {
    let result = [...sheets];
    
    // Filtro por texto de busca
    if (searchQuery) {
      result = result.filter(
        (sheet) =>
          sheet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sheet.composer.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filtro por instrumento
    if (filters.instrument) {
      result = result.filter(sheet => sheet.instrument === filters.instrument);
    }
    
    // Filtro por dificuldade
    if (filters.difficulty) {
      result = result.filter(sheet => sheet.difficulty === filters.difficulty);
    }
    
    // Ordenação
    result = result.sort((a, b) => {
      if (filters.sortBy === 'recent') {
        // Mais recentes primeiro (assumindo que created_at é string ISO)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (filters.sortBy === 'popular') {
        // Mais curtidas primeiro
        return (b.likes || 0) - (a.likes || 0);
      } else if (filters.sortBy === 'downloads') {
        // Mais baixadas primeiro
        return (b.downloads || 0) - (a.downloads || 0);
      }
      return 0;
    });
    
    return result;
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const CollectionCard = ({ collection }: { collection: Playlist }) => ( // Alterado o tipo para Playlist
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Box
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1,
          cursor: 'pointer',
          '&:hover': { boxShadow: 3 },
        }}
        onClick={() => {
          const targetPath = `/playlists/${collection.id}`;
          console.log(`CollectionCard clicado. Navegando para: ${targetPath}`);
          console.log(`ID da playlist: ${collection.id}`);
          navigate(targetPath); // Navegar para a página da playlist
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderIcon color="primary" />
            <Typography variant="h6" noWrap>
              {collection.title} {/* Alterado de collection.name para collection.title */}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1, height: 40, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {collection.description || 'Sem descrição.'}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MusicNoteIcon color="action" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {collection.sheets_count} partitura/cifra{collection.sheets_count !== 1 ? 's' : ''}
            </Typography>
            {collection.is_public ? (
              <Chip label="Pública" size="small" color="success" sx={{ ml: 'auto' }} />
            ) : (
              <Chip label="Privada" size="small" color="warning" sx={{ ml: 'auto' }} />
            )}
          </Stack>
        </Stack>
      </Box>
    </motion.div>
  );

  // Funções para as ações do MusicSheetCard
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
        .select('id, title, composer, instrument, file_url, user_id, created_at, likes, downloads, comments, difficulty')
        .in('id', ids);
      if (!error) setLikedSheets((data || []).map(sheet => ({ ...sheet, tags: [] })));
    }
  };

  const handleDownload = async (sheetId: string) => {
    try {
      // Lógica para baixar uma partitura/cifra
      console.log('Transfira partitura/cifra:', sheetId);
      // Implementar a chamada ao Supabase e lógica de download aqui
    } catch (error) {
      console.error('Erro ao baixar partitura/cifra:', error);
    }
  };

  const handlePlay = (sheetId: string) => {
    // Lógica para reproduzir uma partitura
    console.log('Reproduzir partitura/cifra:', sheetId);
    // Implementar a lógica para reproduzir a partitura aqui
  };

  const handleComment = (sheetId: string) => {
    // Lógica para comentar em uma partitura
    console.log('Comentar na partitura/cifra:', sheetId);
    // Navegar para a página de detalhes com a seção de comentários aberta
    navigate(`/sheet/${sheetId}?showComments=true`);
  };

  const handleSheetClick = (sheetId: string) => {
    // Navegar para a página de detalhes da partitura
    navigate(`/sheet/${sheetId}`);
  };

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
      // Remove do estado local
      setSheets(prev => prev.filter(sheet => sheet.id !== deleteId));
      setLikedSheets(prev => prev.filter(sheet => sheet.id !== deleteId));
      setDownloadedSheets(prev => prev.filter(sheet => sheet.id !== deleteId));
      setErrorMsg('Partitura/cifra excluída com sucesso!');
    }
    setDeleteId(null);
  };

  const handleCreateNewPlaylist = async () => {
    if (!user) {
      setError('Sessão expirada. Por favor, faça login novamente.');
      return;
    }
    if (!newPlaylistData.title.trim()) {
      setError('O nome da playlist é obrigatório.');
      return;
    }

    setLoading(true);
    setError('');

    console.log("ID do usuário autenticado (auth.uid()):", user.id);
    console.log("Dados da nova playlist a serem inseridos:", {
      user_id: user.id,
      title: newPlaylistData.title.trim(),
      description: newPlaylistData.description.trim() || null,
      is_public: newPlaylistData.is_public,
    });

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          title: newPlaylistData.title.trim(), // Alterado de 'name' para 'title'
          description: newPlaylistData.description.trim() || null,
          is_public: newPlaylistData.is_public,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      
      setOpenNewPlaylistDialog(false);
      setNewPlaylistData({ title: '', description: '', is_public: false }); // Alterado de 'name' para 'title'
      // Re-fetch playlists to update the list
      const { data: updatedPlaylistsData, error: updatedPlaylistsError } = await supabase
        .from('playlists')
        .select('id, title, description, is_public, created_at, updated_at, sheets_count:playlist_items(count)') // Alterado de playlist_sheets para playlist_items
        .eq('user_id', user.id);

      if (updatedPlaylistsError) {
        console.error('Erro ao re-buscar playlists após criação:', updatedPlaylistsError);
        setError('Playlist criada, mas erro ao atualizar a lista.');
      } else {
        const formattedUpdatedPlaylists = (updatedPlaylistsData || []).map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          title: p.title, // Alterado de 'name' para 'title'
          description: p.description,
          is_public: p.is_public,
          created_at: p.created_at,
          updated_at: p.updated_at,
          sheets_count: p.sheets_count[0]?.count || 0,
        }));
        setPlaylists(formattedUpdatedPlaylists);
      }

    } catch (err: any) {
      console.error('Erro ao criar playlist:', err);
      setError(`Erro ao criar playlist: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header Section - Melhorado */}
        <Box
          sx={{
            background: 'linear-gradient(90deg, #7b2ff2 0%, #f357a8 100%)',
            borderRadius: 4,
            p: { xs: 3, md: 5 },
            mb: { xs: 2, md: 4 },
            color: 'white',
            textAlign: 'center',
            boxShadow: '0 8px 25px rgba(123,47,242,0.4)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -50,
              left: -50,
              width: 150,
              height: 150,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              filter: 'blur(30px)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -50,
              right: -50,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              filter: 'blur(30px)',
            }}
          />
          <Stack alignItems="center" spacing={2} position="relative" zIndex={1}>
            <CollectionsIcon sx={{ fontSize: { xs: 50, md: 70 }, color: 'white' }} />
            <Typography variant="h3" component="h1" fontWeight="bold" sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
              Sua Biblioteca de Partituras e Cifras
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 600, opacity: 0.9 }}>
              Explore suas partituras e cifras, organize-as em coleções e descubra novos conteúdos.
            </Typography>
          </Stack>
        </Box>

        {/* Search and Filter Section */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={4} alignItems="center">
          <TextField
            label="Buscar partituras/cifras..."
            variant="outlined"
            fullWidth
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 4,
                transition: 'box-shadow 0.3s ease',
                '&:hover fieldset': {
                  borderColor: 'primary.main',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                  boxShadow: `0 0 0 4px rgba(123,47,242,0.2)`,
                },
              },
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(prev => !prev)}
            sx={{
              borderRadius: 4,
              px: 3,
              py: 1.5,
              minWidth: { xs: '100%', md: 'auto' },
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.light',
                color: 'white',
                borderColor: 'primary.light',
              },
            }}
          >
            {showFilters ? 'Esconder Filtros' : 'Mostrar Filtros'}
          </Button>
        </Stack>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden', marginBottom: '16px' }}
            >
              <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 4 }}>
                <Typography variant="h6" fontWeight="medium" mb={2}>Opções de Filtro</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                      <InputLabel id="instrument-filter-label">Instrumento</InputLabel>
                      <Select
                        labelId="instrument-filter-label"
                        value={filters.instrument}
                        label="Instrumento"
                        onChange={e => handleFilterChange('instrument', e.target.value as string)}
                      >
                        <MenuItem value="">Todos</MenuItem>
                        <MenuItem value="Piano">Piano</MenuItem>
                        <MenuItem value="Guitarra">Guitarra</MenuItem>
                        <MenuItem value="Violino">Violino</MenuItem>
                        <MenuItem value="Violoncelo">Violoncelo</MenuItem>
                        <MenuItem value="Baixo">Baixo</MenuItem>
                        <MenuItem value="Flauta">Flauta</MenuItem>
                        <MenuItem value="Saxofone">Saxofone</MenuItem>
                        <MenuItem value="Clarinete">Clarinete</MenuItem>
                        <MenuItem value="Trompete">Trompete</MenuItem>
                        <MenuItem value="Bateria">Bateria</MenuItem>
                        <MenuItem value="Voz">Voz</MenuItem>
                        <MenuItem value="Outro">Outro</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                      <InputLabel id="difficulty-filter-label">Dificuldade</InputLabel>
                      <Select
                        labelId="difficulty-filter-label"
                        value={filters.difficulty}
                        label="Dificuldade"
                        onChange={e => handleFilterChange('difficulty', e.target.value as string)}
                      >
                        <MenuItem value="">Todas</MenuItem>
                        <MenuItem value="beginner">Iniciante</MenuItem>
                        <MenuItem value="intermediate">Intermédio</MenuItem>
                        <MenuItem value="advanced">Avançado</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                      <InputLabel id="sort-by-label">Ordenar Por</InputLabel>
                      <Select
                        labelId="sort-by-label"
                        value={filters.sortBy}
                        label="Ordenar Por"
                        onChange={e => handleFilterChange('sortBy', e.target.value as string)}
                      >
                        <MenuItem value="recent">Mais Recentes</MenuItem>
                        <MenuItem value="popular">Mais Populares</MenuItem>
                        <MenuItem value="downloads">Mais Baixadas</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs for My Sheets, Collections, Liked */}
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{
            mb: 3,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTabs-indicator': {
              height: 4,
              borderRadius: '4px 4px 0 0',
              background: 'linear-gradient(90deg, #7b2ff2 0%, #f357a8 100%)',
            },
            '& .MuiTab-root': {
              py: 1.5,
              fontWeight: 600,
              fontSize: '1.05rem',
              transition: 'all 0.2s ease',
              textTransform: 'none',
              '&.Mui-selected': {
                color: 'primary.main',
              },
              '&:hover': {
                bgcolor: 'action.hover',
              },
            },
          }}
        >
          <Tab label="Minhas Partituras/Cifras" icon={<MusicNoteIcon />} iconPosition="start" />
          <Tab label="Coleções" icon={<FolderIcon />} iconPosition="start" />
          <Tab label="Favoritos" icon={<FavoriteIcon />} iconPosition="start" />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
          {/* Content for Minhas Partituras */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <Grid container spacing={3}>
              {filteredSheets(sheets).length === 0 ? (
                <Typography variant="body1" color="text.secondary" textAlign="center" py={5} width="100%">
                  Nenhuma partitura/cifra sua encontrada. Que tal carregar uma nova?
                </Typography>
              ) : (
                filteredSheets(sheets).map((sheet) => (
                  <Grid item key={sheet.id} xs={12} sm={6} md={4} lg={3}>
                    <MusicSheetCard
                      sheetId={sheet.id}
                      title={sheet.title}
                      composer={sheet.composer}
                      instrument={sheet.instrument}
                      difficulty={mapDifficultyToNumber(sheet.difficulty)}
                      imageUrl={sheet.file_url}
                      fileUrl={sheet.file_url}
                      likes={sheet.likes || 0}
                      downloads={sheet.downloads || 0}
                      comments={sheet.comments || 0}
                      isLiked={sheet.isLiked || false}
                      onLike={handleLike}
                      onDownload={handleDownload}
                      onPlay={handlePlay}
                      onComment={handleComment}
                      onClick={handleSheetClick}
                      isOwner={sheet.user_id === user?.id}
                      onDelete={handleRequestDelete}
                    />
                  </Grid>
                ))
              )}
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Content for Coleções */}
          <Stack direction="row" justifyContent="flex-end" mb={3}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenNewPlaylistDialog(true)} // Abre o diálogo de nova playlist
              sx={{
                borderRadius: 4,
                px: 3,
                py: 1.2,
                fontWeight: 600,
                background: 'linear-gradient(90deg, #f357a8 0%, #7b2ff2 100%)',
                '&:hover': {
                  background: 'linear-gradient(90deg, #7b2ff2 0%, #f357a8 100%)',
                },
              }}
            >
              Criar Nova Playlist
            </Button>
          </Stack>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : playlists.length === 0 ? (
            <Typography variant="body1" color="text.secondary" textAlign="center" py={5}>
              Nenhuma playlist encontrada. Comece a criar suas coleções de partituras/cifras!
            </Typography>
          ) : (
            <Grid container spacing={3}>
              {playlists.map((playlist) => (
                <Grid item key={playlist.id} xs={12} sm={6} md={4} lg={3}>
                  <CollectionCard collection={playlist} /> {/* Usando a nova interface Playlist */}
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {/* Content for Curtidas */}
          {likedSheets.length === 0 ? (
            <Typography variant="body1" color="text.secondary" textAlign="center" py={5}>
              Nenhuma partitura/cifra como favorita.
            </Typography>
          ) : (
            <Grid container spacing={3}>
              {filteredSheets(likedSheets).map((sheet) => (
                <Grid item key={sheet.id} xs={12} sm={6} md={4} lg={3}>
                  <MusicSheetCard
                    sheetId={sheet.id}
                    title={sheet.title}
                    composer={sheet.composer}
                    instrument={sheet.instrument}
                    difficulty={mapDifficultyToNumber(sheet.difficulty)}
                    imageUrl={sheet.file_url}
                    fileUrl={sheet.file_url}
                    likes={sheet.likes || 0}
                    downloads={sheet.downloads || 0}
                    comments={sheet.comments || 0}
                    isLiked={sheet.isLiked || false}
                    onLike={handleLike}
                    onDownload={handleDownload}
                    onPlay={handlePlay}
                    onComment={handleComment}
                    onClick={handleSheetClick}
                    isOwner={sheet.user_id === user?.id}
                    onDelete={handleRequestDelete}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <DialogTitle id="delete-dialog-title">Confirmar Exclusão</DialogTitle>
          <DialogContent>
            <Typography id="delete-dialog-description">
              Tem certeza que deseja excluir esta partitura? Esta ação não pode ser desfeita.
            </Typography>
            {errorMsg && <Alert severity="error" sx={{ mt: 2 }}>{errorMsg}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteId(null)} color="primary">
              Cancelar
            </Button>
            <Button onClick={handleDeleteSheet} color="error" autoFocus>
              Excluir
            </Button>
          </DialogActions>
        </Dialog>

        {/* New Playlist Dialog */}
        <Dialog open={openNewPlaylistDialog} onClose={() => setOpenNewPlaylistDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Criar Nova Playlist</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Nome da Playlist"
                fullWidth
                value={newPlaylistData.title} // Alterado de newPlaylistData.name para newPlaylistData.title
                onChange={e => setNewPlaylistData(p => ({ ...p, title: e.target.value }))} // Alterado de name para title
                required
              />
              <TextField
                label="Descrição (opcional)"
                fullWidth
                multiline
                rows={3}
                value={newPlaylistData.description}
                onChange={e => setNewPlaylistData(p => ({ ...p, description: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={newPlaylistData.is_public}
                    onChange={e => setNewPlaylistData(p => ({ ...p, is_public: e.target.checked }))}
                    color="primary"
                  />
                }
                label="Tornar Pública"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenNewPlaylistDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateNewPlaylist} variant="contained" color="primary" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Criar'}
            </Button>
          </DialogActions>
        </Dialog>
      </motion.div>
    </Container>
  );
} 