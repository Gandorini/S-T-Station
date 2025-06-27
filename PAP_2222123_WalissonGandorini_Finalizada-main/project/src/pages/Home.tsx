import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MusicSheet } from '../types/database';
import {
  Box,
  Container,
  Stack,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Pagination,
  CircularProgress,
  Alert,
  Button,
  Paper,
  Grid,
  useTheme,
  alpha,
} from '@mui/material';
import { Search as SearchIcon, LibraryMusic, MusicNote, TrendingUp } from '@mui/icons-material';
import MusicSheetCard from '../components/MusicSheetCard';
import { motion } from 'framer-motion';

const ITEMS_PER_PAGE = 12;

interface FilterOptions {
  instrument: string;
  difficulty: string;
  sortBy: string;
}

export default function Home() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterOptions>({
    instrument: '',
    difficulty: '',
    sortBy: 'recent',
  });
  const [sheets, setSheets] = useState<MusicSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [instrumentCount, setInstrumentCount] = useState<number | null>(null);
  const [totalDownloads, setTotalDownloads] = useState<number | null>(null);

  // Função auxiliar para mapear dificuldade de string para número (adicionada para consistência)
  const mapDifficultyToNumber = (difficulty: 'beginner' | 'intermediate' | 'advanced' | string): number => {
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

  // Buscar partituras destacadas do Supabase
  useEffect(() => {
    const fetchFeaturedSheets = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('music_sheets')
          .select('*', { count: 'exact' });

        // Aplicar filtros de busca
        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,composer.ilike.%${searchQuery}%`);
        }

        // Filtrar por instrumento
        if (filters.instrument) {
          query = query.eq('instrument', filters.instrument);
        }

        // Filtrar por dificuldade
        if (filters.difficulty) {
          query = query.eq('difficulty', filters.difficulty);
        }

        // Ordenação
        switch (filters.sortBy) {
          case 'popular':
            query = query.order('likes', { ascending: false });
            break;
          case 'downloads':
            query = query.order('downloads', { ascending: false });
            break;
          case 'recent':
          default:
            query = query.order('created_at', { ascending: false });
            break;
        }

        // Paginação
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data, error: fetchError, count } = await query;

        if (fetchError) throw fetchError;
        
        setSheets(data || []);
        setTotalCount(count || 0);
      } catch (err) {
        console.error('Erro ao buscar partituras/cifras:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedSheets();
  }, [searchQuery, filters, page]);

  // Buscar estatísticas globais (instrumentos e downloads)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Buscar a soma total de downloads de todas as partituras
        const { data: totalDownloadsData, error: totalDownloadsError } = await supabase
          .from('music_sheets')
          .select('downloads_count');

        if (totalDownloadsError) throw totalDownloadsError;

        const sumDownloads = (totalDownloadsData || []).reduce((sum, sheet) => sum + (sheet.downloads_count || 0), 0);
        setTotalDownloads(sumDownloads);

        // instrumentCount: buscar número de instrumentos distintos
        const { data: instrumentData, error: instrumentError } = await supabase
          .from('music_sheets')
          .select('instrument');

        if (instrumentError) throw instrumentError;

        const uniqueInstruments = new Set((instrumentData || []).map(sheet => sheet.instrument));
        setInstrumentCount(uniqueInstruments.size);

      } catch (err) {
        console.error('Erro ao buscar estatísticas:', err);
        setInstrumentCount(null); // Resetar em caso de erro
        setTotalDownloads(null);  // Resetar em caso de erro
      }
    };
    fetchStats();

    // Opcional: Escutar mudanças em tempo real para as estatísticas globais
    // Isso pode ser intenso para um grande número de mudanças, mas garante atualização imediata
    const channel = supabase
      .channel('public:music_sheets_stats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'music_sheets', filter: 'downloads_count' }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleFilterChange = (field: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Variantes de animação
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 12
      }
    }
  };

  return (
    <Box>
      {/* Hero Section com Gradiente */}
      <Box 
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          py: { xs: 8, md: 12 },
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)',
            pointerEvents: 'none'
          }
        }}
      >
        {/* Elementos decorativos flutuantes */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 }}>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [Math.random() * 30, Math.random() * -30],
                x: [Math.random() * 30, Math.random() * -30],
                opacity: [0.2, 0.5, 0.2]
              }}
              transition={{
                repeat: Infinity,
                duration: 6 + Math.random() * 6,
                repeatType: 'reverse'
              }}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                width: 30 + Math.random() * 60,
                height: 30 + Math.random() * 60,
              }}
            />
          ))}
        </Box>

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                <Typography 
                  variant="h2" 
                  component="h1" 
                  fontWeight="bold" 
                  gutterBottom
                  sx={{ 
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    mb: 2
                  }}
                >
                  Descubra e Partilhe Partituras e Cifras
                </Typography>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    mb: 4, 
                    opacity: 0.9,
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                >
                  Uma comunidade para músicos aprenderem, partilharem e explorarem cifras e partituras de todos os géneros.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button 
                    variant="contained" 
                    size="large"
                    onClick={() => navigate('/explore')}
                    sx={{ 
                      py: 1.5, 
                      px: 4,
                      backgroundColor: 'white',
                      color: theme.palette.primary.main,
                      borderRadius: '30px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.contrastText, 0.9),
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.2)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Explorar
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="large"
                    onClick={() => navigate('/upload')}
                    sx={{ 
                      py: 1.5, 
                      px: 4,
                      borderColor: 'white',
                      color: 'white',
                      borderRadius: '30px',
                      borderWidth: 2,
                      '&:hover': {
                        borderColor: alpha(theme.palette.primary.contrastText, 0.9),
                        backgroundColor: alpha(theme.palette.primary.contrastText, 0.1),
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.2)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Contribuir
                  </Button>
                </Stack>
              </motion.div>
            </Grid>
            <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, delay: 0.3 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'center' }}>
                  <img
                    src="/logoPP.png"
                    alt="Logo"
                    style={{
                      height: 350,
                      maxWidth: 350,
                      width: 'auto',
                      display: 'block',
                      filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.2))'
                    }}
                  />
                </Box>
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 12 }}>
        {/* Estatísticas */}
        <Box sx={{ mb: 8 }}>
          <Grid container spacing={4} justifyContent="center" alignItems="stretch">
            {/* Estatística: Partituras */}
            <Grid item xs={12} sm={6} md={4}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 4, 
                    textAlign: 'center', 
                    borderRadius: 4, 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    bgcolor: theme.palette.mode === 'light' 
                      ? alpha(theme.palette.primary.main, 0.05) 
                      : alpha(theme.palette.primary.main, 0.1), 
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                      borderColor: alpha(theme.palette.primary.main, 0.2)
                    }
                  }}
                >
                  <Box sx={{ color: theme.palette.primary.main, mb: 2 }}>{<LibraryMusic sx={{ fontSize: 40 }} />}</Box>
                  <Typography variant="h3" fontWeight="bold" color="primary">{totalCount}</Typography>
                  <Typography variant="body1" color="text.secondary">Documentos Musicais</Typography>
                </Paper>
              </motion.div>
            </Grid>
            {/* Estatística: Instrumentos */}
            <Grid item xs={12} sm={6} md={4}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 4, 
                    textAlign: 'center', 
                    borderRadius: 4, 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    bgcolor: theme.palette.mode === 'light' 
                      ? alpha(theme.palette.primary.main, 0.05) 
                      : alpha(theme.palette.primary.main, 0.1), 
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                      borderColor: alpha(theme.palette.primary.main, 0.2)
                    }
                  }}
                >
                  <Box sx={{ color: theme.palette.primary.main, mb: 2 }}>{<MusicNote sx={{ fontSize: 40 }} />}</Box>
                  <Typography variant="h3" fontWeight="bold" color="primary">12</Typography>
                  <Typography variant="body1" color="text.secondary">Instrumentos</Typography>
                </Paper>
              </motion.div>
            </Grid>
            {/* Estatística: Downloads */}
            <Grid item xs={12} sm={6} md={4}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 4, 
                    textAlign: 'center', 
                    borderRadius: 4, 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    bgcolor: theme.palette.mode === 'light' 
                      ? alpha(theme.palette.primary.main, 0.05) 
                      : alpha(theme.palette.primary.main, 0.1), 
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                      borderColor: alpha(theme.palette.primary.main, 0.2)
                    }
                  }}
                >
                  <Box sx={{ color: theme.palette.primary.main, mb: 2 }}>{<TrendingUp sx={{ fontSize: 40 }} />}</Box>
                  <Typography variant="h3" fontWeight="bold" color="primary">{totalDownloads ?? '...'}</Typography>
                  <Typography variant="body1" color="text.secondary">Transferências</Typography>
                </Paper>
              </motion.div>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mb: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h3" 
              gutterBottom
              sx={{ 
                fontWeight: 600,
                background: 'linear-gradient(45deg, #7F56D9 30%, #9F7AEA 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 2
              }}
            >
              Biblioteca de Documentos Musicais
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4, fontSize: '1.1rem' }}>
              Explore a nossa coleção de partituras e cifras partilhadas pela comunidade
            </Typography>
          </motion.div>
        </Box>

        <Paper 
          elevation={0}
          sx={{ 
            p: 4, 
            mb: 6, 
            borderRadius: 4, 
            bgcolor: theme.palette.mode === 'light' 
              ? alpha(theme.palette.primary.main, 0.02) 
              : alpha(theme.palette.primary.main, 0.05),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
          }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'primary.main' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  bgcolor: theme.palette.background.paper, 
                  borderRadius: 3,
                  '& .MuiOutlinedInput-root': {
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                      boxShadow: '0 0 0 4px rgba(127, 86, 217, 0.1)'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                      boxShadow: '0 0 0 4px rgba(127, 86, 217, 0.2)'
                    }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2.5}>
              <FormControl fullWidth sx={{ bgcolor: theme.palette.background.paper, borderRadius: 3 }}>
                <InputLabel>Instrumento</InputLabel>
                <Select
                  value={filters.instrument}
                  label="Instrumento"
                  onChange={(e) => handleFilterChange('instrument', e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: filters.instrument ? 'primary.main' : undefined
                    }
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="Piano">Piano</MenuItem>
                  <MenuItem value="Violino">Violino</MenuItem>
                  <MenuItem value="Violoncelo">Violoncelo</MenuItem>
                  <MenuItem value="Guitarra">Guitarra</MenuItem>
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
            <Grid item xs={12} sm={4} md={2.5}>
              <FormControl fullWidth sx={{ bgcolor: theme.palette.background.paper, borderRadius: 3 }}>
                <InputLabel>Dificuldade</InputLabel>
                <Select
                  value={filters.difficulty}
                  label="Dificuldade"
                  onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: filters.difficulty ? 'primary.main' : undefined
                    }
                  }}
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="beginner">Iniciante</MenuItem>
                  <MenuItem value="intermediate">Intermediário</MenuItem>
                  <MenuItem value="advanced">Avançado</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth sx={{ bgcolor: theme.palette.background.paper, borderRadius: 3 }}>
                <InputLabel>Ordenar por</InputLabel>
                <Select
                  value={filters.sortBy}
                  label="Ordenar por"
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: filters.sortBy ? 'primary.main' : undefined
                    }
                  }}
                >
                  <MenuItem value="recent">Mais recentes</MenuItem>
                  <MenuItem value="popular">Mais populares</MenuItem>
                  <MenuItem value="downloads">Mais transferidos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 4,
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress 
              size={80} 
              thickness={4}
              sx={{ 
                color: 'primary.main',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                }
              }}
            />
          </Box>
        ) : sheets.length === 0 ? (
          <Paper
            sx={{
              p: 8,
              textAlign: 'center',
              borderRadius: 4,
              bgcolor: theme.palette.mode === 'light' 
                ? alpha(theme.palette.primary.main, 0.05) 
                : alpha(theme.palette.primary.main, 0.1),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}
          >
            <MusicNote sx={{ fontSize: 80, color: 'primary.main', mb: 3, opacity: 0.8 }} />
            <Typography variant="h4" gutterBottom fontWeight="600">
              Nenhum Documento Musical Encontrado
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4, opacity: 0.8 }}>
              Tente outros filtros ou adicione os seus próprios documentos musicais
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/upload')}
              sx={{ 
                py: 1.5,
                px: 4,
                borderRadius: '30px',
                background: 'linear-gradient(45deg, #7F56D9 30%, #9F7AEA 90%)',
                boxShadow: '0 4px 12px rgba(127, 86, 217, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #6B46C1 30%, #805AD5 90%)',
                  boxShadow: '0 6px 16px rgba(127, 86, 217, 0.4)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Carregar Documento Musical
            </Button>
          </Paper>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <Grid container spacing={4}>
              {sheets.map((sheet) => (
                <Grid item xs={12} sm={6} md={4} key={sheet.id}>
                  <motion.div variants={itemVariants}>
                    <MusicSheetCard
                      sheetId={sheet.id}
                      title={sheet.title}
                      composer={sheet.composer}
                      instrument={sheet.instrument}
                      difficulty={mapDifficultyToNumber(sheet.difficulty)}
                      imageUrl={`https://source.unsplash.com/featured/?music,${sheet.instrument.toLowerCase()}`}
                      fileUrl={sheet.file_url}
                      likes={sheet.likes || 0}
                      downloads={sheet.downloads_count || 0}
                      comments={sheet.comments || 0}
                      isLiked={sheet.isLiked || false}
                      onLike={() => {}}
                      onDownload={() => {}}
                      onPlay={() => {}}
                      onComment={() => {}}
                      onClick={() => navigate(`/sheet/${sheet.id}`)}
                    />
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        )}

        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, p) => setPage(p)}
              color="primary"
              size="large"
              variant="outlined"
              shape="rounded"
              sx={{
                '& .MuiPaginationItem-root': {
                  borderRadius: 2,
                  margin: '0 4px',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    transform: 'translateY(-2px)'
                  },
                },
                '& .Mui-selected': {
                  fontWeight: 'bold',
                  background: 'linear-gradient(45deg, #7F56D9 30%, #9F7AEA 90%)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(127, 86, 217, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #6B46C1 30%, #805AD5 90%)',
                    boxShadow: '0 6px 16px rgba(127, 86, 217, 0.4)'
                  }
                }
              }}
            />
          </Box>
        )}
      </Container>
    </Box>
  );
}