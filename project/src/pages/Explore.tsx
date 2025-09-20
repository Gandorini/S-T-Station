import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Container,
  Grid,
  Box,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Pagination,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Drawer,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Badge,
  Divider,
  alpha,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
  MusicNote,
  ClearAll,
  SortRounded,
  LibraryMusic,
  FilterAlt,
  Tune,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import MusicSheetCard from '../components/MusicSheetCard';
import type { MusicSheet } from '../types/database';

const ITEMS_PER_PAGE = 12;

const instruments = [
  'Piano',
  'Violino',
  'Violoncelo',
  'Guitarra',
  'Baixo',
  'Flauta',
  'Saxofone',
  'Clarinete',
  'Trompete',
  'Bateria',
  'Voz',
  'Outro'
];


const scales = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'E#m',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm', 'Dbm', 'Gbm', 'Cbm'
];

interface FilterOptions {
  instruments: string[];
  genres: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | '';
  scales: string[];
  sortBy: string;
}

export default function Explore() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    instruments: [],
    genres: [],
    difficulty: '',
    scales: [],
    sortBy: 'recent',
  });
  const [sheets, setSheets] = useState<MusicSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Buscar tags únicas do Supabase para preencher o filtro de gêneros
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const { data, error } = await supabase
          .from('music_sheets')
          .select('tags'); // Selecionar apenas a coluna de tags

        if (error) throw error;

        const allTags: string[] = [];
        data.forEach(sheet => {
          if (sheet.tags && Array.isArray(sheet.tags)) {
            allTags.push(...sheet.tags);
          }
        });
        const uniqueTags = Array.from(new Set(allTags));
        setAvailableTags(uniqueTags);
      } catch (err) {
        console.error('Erro ao buscar tags:', err);
      }
    };
    fetchTags();
  }, []);

  // Verifica se há uma query de busca na URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [location.search]);

  // Busca partituras do Supabase
  useEffect(() => {
    const fetchSheets = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('music_sheets')
          .select('*', { count: 'exact' })
          .eq('is_public', true); // Garante que só partituras/cifras públicas aparecem

        // Aplicar filtros de busca
        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,composer.ilike.%${searchQuery}%`);
        }

        // Filtrar por instrumento
        if (filters.instruments.length > 0) {
          query = query.in('instrument', filters.instruments);
        }

        // Filtrar por dificuldade
        if (filters.difficulty) {
          query = query.eq('difficulty', filters.difficulty);
        }

        // Filtrar por gêneros (usando tags da base de dados)
        if (filters.genres.length > 0) {
          query = query.overlaps('tags', filters.genres); // Usar a coluna 'tags'
        }

        // Filtrar por escalas
        if (filters.scales.length > 0) {
          query = query.overlaps('scales', filters.scales);
        }

        // Ordenação
        switch (filters.sortBy) {
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

    fetchSheets();
  }, [searchQuery, filters, page]);

  const handleFilterChange = (
    field: keyof FilterOptions,
    value: string | string[]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPage(1);
  };

  const toggleFilter = (field: 'instruments' | 'genres' | 'scales', value: string) => {
    const currentFilters = filters[field];
    const newFilters = currentFilters.includes(value)
      ? currentFilters.filter((f: string) => f !== value)
      : [...currentFilters, value];
    handleFilterChange(field, newFilters);
  };

  const clearFilters = () => {
    setFilters({
      instruments: [],
      genres: [],
      difficulty: '',
      scales: [],
      sortBy: 'recent',
    });
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  
  const hasActiveFilters = 
    filters.instruments.length > 0 || 
    filters.genres.length > 0 || 
    filters.difficulty || 
    filters.scales.length > 0;

  // Função para mapear dificuldade (copiada de PlaylistDetails.tsx para consistência)
  const mapDifficultyToNumber = (difficulty: 'beginner' | 'intermediate' | 'advanced'): number => {
    switch (difficulty) {
      case 'beginner':
        return 1;
      case 'intermediate':
        return 3; // Nível 2 na enumeração, mas 3 em escala de 1-5
      case 'advanced':
        return 5; 
      default:
        return 1;
    }
  };

  const FilterPanel = () => (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight="600" color="primary.main">
          <FilterAlt fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Filtros
        </Typography>
        {hasActiveFilters && (
          <Button 
            startIcon={<ClearAll />} 
            onClick={clearFilters}
            size="small" 
            color="primary"
            variant="outlined"
            sx={{ 
              borderRadius: '20px',
              fontSize: '0.75rem',
              py: 0.5
            }}
          >
            Limpar
          </Button>
        )}
      </Stack>
      
    <Stack spacing={2}>
      <Accordion defaultExpanded elevation={0} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
        <AccordionSummary
          expandIcon={<FilterListIcon />}
          aria-controls="panel1a-content"
          id="panel1a-header"
          sx={{ 
            paddingLeft: 0,
            fontWeight: 600,
            bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[100], 0.5) : alpha(theme.palette.grey[900], 0.5),
            borderRadius: '8px',
            marginBottom: '8px',
            '& .MuiAccordionSummary-content': { margin: '8px 0' },
            '& .MuiSvgIcon-root': { color: theme.palette.text.secondary },
          }}
        >
          <Typography variant="subtitle1" fontWeight="600" sx={{ color: theme.palette.text.primary, display: 'flex', alignItems: 'center' }}>
            <MusicNote fontSize="small" sx={{ mr: 0.5 }} />
            Instrumentos
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ padding: '0 0 16px 0' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {instruments.map((instrument) => (
              <Chip
                key={instrument}
                label={instrument}
                onClick={() => toggleFilter('instruments', instrument)}
                color={filters.instruments.includes(instrument) ? 'primary' : 'default'}
                variant={filters.instruments.includes(instrument) ? 'filled' : 'outlined'}
                sx={{ 
                  borderRadius: '16px',
                  transition: 'all 0.2s',
                  fontWeight: filters.instruments.includes(instrument) ? 600 : 400,
                  '&:hover': {
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    transform: 'translateY(-2px)'
                  }
                }}
              />
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded elevation={0} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
        <AccordionSummary
          expandIcon={<FilterListIcon />}
          aria-controls="panel2a-content"
          id="panel2a-header"
          sx={{ 
            paddingLeft: 0,
            fontWeight: 600,
            bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[100], 0.5) : alpha(theme.palette.grey[900], 0.5),
            borderRadius: '8px',
            marginBottom: '8px',
            '& .MuiAccordionSummary-content': { margin: '8px 0' },
            '& .MuiSvgIcon-root': { color: theme.palette.text.secondary },
          }}
        >
          <Typography variant="subtitle1" fontWeight="600" sx={{ color: theme.palette.text.primary, display: 'flex', alignItems: 'center' }}>
            <LibraryMusic fontSize="small" sx={{ mr: 0.5 }} />
            Gêneros
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ padding: '0 0 16px 0' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {availableTags.length > 0 ? (
              availableTags.map((genre) => (
                <Chip
                  key={genre}
                  label={genre}
                  onClick={() => toggleFilter('genres', genre)}
                  color={filters.genres.includes(genre) ? 'primary' : 'default'}
                  variant={filters.genres.includes(genre) ? 'filled' : 'outlined'}
                  sx={{ 
                    borderRadius: '16px',
                    transition: 'all 0.2s',
                    fontWeight: filters.genres.includes(genre) ? 600 : 400,
                    '&:hover': {
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">Nenhum gênero disponível.</Typography>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded elevation={0} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
        <AccordionSummary
          expandIcon={<FilterListIcon />}
          aria-controls="panel3a-content"
          id="panel3a-header"
          sx={{ 
            paddingLeft: 0,
            fontWeight: 600,
            bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[100], 0.5) : alpha(theme.palette.grey[900], 0.5),
            borderRadius: '8px',
            marginBottom: '8px',
            '& .MuiAccordionSummary-content': { margin: '8px 0' },
            '& .MuiSvgIcon-root': { color: theme.palette.text.secondary },
          }}
        >
          <Typography variant="subtitle1" fontWeight="600" sx={{ color: theme.palette.text.primary }}>Dificuldade</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ padding: '0 0 16px 0' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Dificuldade</InputLabel>
            <Select
              value={filters.difficulty}
              label="Dificuldade"
              onChange={(e) => handleFilterChange('difficulty', e.target.value as 'beginner' | 'intermediate' | 'advanced' | '')}
              sx={{ 
                borderRadius: '10px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: filters.difficulty ? theme.palette.primary.main : undefined
                }
              }}
            >
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="beginner">Iniciante</MenuItem>
              <MenuItem value="intermediate">Intermediário</MenuItem>
              <MenuItem value="advanced">Avançado</MenuItem>
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded elevation={0} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
        <AccordionSummary
          expandIcon={<FilterListIcon />}
          aria-controls="panel4a-content"
          id="panel4a-header"
          sx={{ 
            paddingLeft: 0,
            fontWeight: 600,
            bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[100], 0.5) : alpha(theme.palette.grey[900], 0.5),
            borderRadius: '8px',
            marginBottom: '8px',
            '& .MuiAccordionSummary-content': { margin: '8px 0' },
            '& .MuiSvgIcon-root': { color: theme.palette.text.secondary },
          }}
        >
          <Typography variant="subtitle1" fontWeight="600" sx={{ color: theme.palette.text.primary }}>Escalas</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ padding: '0 0 16px 0' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Escalas</InputLabel>
            <Select
              multiple
              value={filters.scales}
              onChange={(e) => handleFilterChange('scales', e.target.value as string[])}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip 
                      key={value} 
                      label={value} 
                      size="small" 
                      sx={{ 
                        borderRadius: '12px',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        fontWeight: 600,
                        fontSize: '0.7rem'
                      }}
                    />
                  ))}
                </Box>
              )}
              sx={{ 
                borderRadius: '10px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: filters.scales.length > 0 ? theme.palette.primary.main : undefined
                }
              }}
            >
              {scales.map((scale) => (
                <MenuItem key={scale} value={scale}>
                  {scale}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ mt: 2 }}>
        <Divider sx={{ my: 1 }} />
        <Stack direction="row" alignItems="center" spacing={1} mt={1}>
          <SortRounded fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight="600" color="text.secondary">
            Ordenar por:
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} mt={1}>
          {[
            { value: 'recent', label: 'Recentes' },
            { value: 'downloads', label: 'Downloads' }
          ].map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              color={filters.sortBy === option.value ? 'primary' : 'default'}
              variant={filters.sortBy === option.value ? 'filled' : 'outlined'}
              onClick={() => handleFilterChange('sortBy', option.value)}
              size="small"
              sx={{ 
                fontWeight: filters.sortBy === option.value ? 600 : 400,
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }
              }}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
    </Box>
  );

  // Animation variants
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
        type: "spring",
        stiffness: 100
      }
    }
  };

  const filterVariants = {
    collapsed: { 
      height: 0, 
      opacity: 0,
      transition: { 
        duration: 0.3 
      } 
    },
    expanded: { 
      height: "auto", 
      opacity: 1,
      transition: { 
        duration: 0.3 
      } 
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: theme.palette.mode === 'light' 
          ? 'linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%)'
          : 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        pt: 2,
        pb: 8
      }}
    >
      {/* Header section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`,
          py: 8,
          mb: 6,
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
        <Container maxWidth="xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h2" 
              component="h1" 
              fontWeight="bold"   
              align="center" 
              gutterBottom
              sx={{ 
                background: 'linear-gradient(45deg, #7F56D9 30%, #9F7AEA 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                mb: 2
              }}
            >
              Explorar Partituras e Cifras
            </Typography>
            <Typography 
              variant="h6" 
              color="text.secondary" 
              align="center" 
              sx={{ 
                maxWidth: 800, 
                mx: 'auto',
                opacity: 0.8,
                textShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              Descubra novas partituras e cifras, filtre por instrumento, dificuldade e muito mais
            </Typography>
          </motion.div>
        </Container>
      </Box>
      
      <Container maxWidth="xl">
        <Paper 
          elevation={4} 
          sx={{ 
            p: 4, 
            mb: 6,
            borderRadius: 4,
            background: theme.palette.mode === 'light' 
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(30, 30, 30, 0.9)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <TextField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              label="Buscar por título ou compositor"
              variant="outlined"
              fullWidth
              sx={{ 
                maxWidth: { xs: '100%', sm: '60%' },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  transition: 'all 0.3s ease',
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'primary.main' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                onClick={() => setDrawerOpen(true)}
                startIcon={<Tune />}
                variant="contained"
                color="primary"
                sx={{ 
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  background: 'linear-gradient(45deg, #7F56D9 30%, #9F7AEA 90%)',
                  boxShadow: '0 4px 12px rgba(127, 86, 217, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #6B46C1 30%, #805AD5 90%)',
                    boxShadow: '0 6px 16px rgba(127, 86, 217, 0.4)'
                  }
                }}
              >
                Filtros
              </Button>
              {hasActiveFilters && (
                <Button 
                  onClick={clearFilters} 
                  startIcon={<ClearAll />} 
                  variant="outlined"
                  color="secondary"
                  sx={{ 
                    borderRadius: 3,
                    px: 3,
                    py: 1.5,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      backgroundColor: alpha(theme.palette.secondary.main, 0.1)
                    }
                  }}
                >
                  Limpar
                </Button>
              )}
            </Box>
          </Box>

          <motion.div
            variants={filterVariants}
            initial="collapsed"
            animate={drawerOpen ? "expanded" : "collapsed"}
          >
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Instrumento</InputLabel>
                  <Select
                    value={filters.instruments.join(',')}
                    onChange={(e) => handleFilterChange('instruments', e.target.value.split(','))}
                    label="Instrumento"
                    sx={{ 
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: filters.instruments.length > 0 ? theme.palette.primary.main : undefined
                      }
                    }}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {instruments.map((inst) => (
                      <MenuItem key={inst} value={inst}>{inst}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Dificuldade</InputLabel>
                  <Select
                    value={filters.difficulty}
                    onChange={(e) => handleFilterChange('difficulty', e.target.value as 'beginner' | 'intermediate' | 'advanced' | '')}
                    label="Dificuldade"
                    sx={{ 
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: filters.difficulty ? theme.palette.primary.main : undefined
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
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Escalas</InputLabel>
                  <Select
                    multiple
                    value={filters.scales}
                    onChange={(e) => handleFilterChange('scales', e.target.value as string[])}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip 
                            key={value} 
                            label={value} 
                            size="small" 
                            sx={{ 
                              borderRadius: '12px',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              fontWeight: 600,
                              fontSize: '0.7rem'
                            }}
                          />
                        ))}
                      </Box>
                    )}
                    sx={{ 
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: filters.scales.length > 0 ? theme.palette.primary.main : undefined
                      }
                    }}
                  >
                    {scales.map((scale) => (
                      <MenuItem key={scale} value={scale}>
                        {scale}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Gênero</InputLabel>
                  <Select<string[]>
                    value={filters.genres}
                    onChange={(e) => handleFilterChange('genres', e.target.value as string[])}
                    label="Gênero"
                    multiple
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip 
                            key={value} 
                            label={value} 
                            size="small" 
                            sx={{ 
                              borderRadius: '12px',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              fontWeight: 600,
                              fontSize: '0.7rem'
                            }}
                          />
                        ))}
                      </Box>
                    )}
                    sx={{ 
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: filters.genres.length > 0 ? theme.palette.primary.main : undefined
                      }
                    }}
                  >
                    {availableTags.length > 0 ? (
                      availableTags.map((genre) => (
                        <MenuItem key={genre} value={genre}>
                          {genre}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>Nenhum gênero disponível</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </motion.div>
        </Paper>

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
        ) : error ? (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 2,
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {error}
          </Alert>
        ) : sheets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Paper 
              elevation={4} 
              sx={{ 
                p: 6, 
                textAlign: 'center', 
                my: 6,
                borderRadius: 4,
                background: theme.palette.mode === 'light' 
                  ? 'rgba(255, 255, 255, 0.9)'
                  : 'rgba(30, 30, 30, 0.9)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <MusicNote sx={{ fontSize: 80, color: 'primary.main', mb: 3, opacity: 0.8 }} />
              <Typography variant="h4" gutterBottom fontWeight="600">
                Nenhum Documento Encontrado
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4, opacity: 0.8 }}>
                Tente modificar os seus filtros para encontrar mais resultados.
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={clearFilters}
                startIcon={<ClearAll />}
                sx={{ 
                  borderRadius: 3,
                  px: 4,
                  py: 1.5,
                  background: 'linear-gradient(45deg, #7F56D9 30%, #9F7AEA 90%)',
                  boxShadow: '0 4px 12px rgba(127, 86, 217, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #6B46C1 30%, #805AD5 90%)',
                    boxShadow: '0 6px 16px rgba(127, 86, 217, 0.4)'
                  }
                }}
              >
                Limpar Filtros
              </Button>
            </Paper>
          </motion.div>
        ) : (
          <>
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Typography 
                variant="h6" 
                sx={{ 
                  mb: 4,
                  color: 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontWeight: 600
                }}
              >
                <LibraryMusic sx={{ color: 'primary.main' }} />
                A mostrar {sheets.length} resultados
              </Typography>
              
              <Grid container spacing={4}>
                {sheets.map((sheet, index) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={sheet.id}>
                    <motion.div variants={itemVariants}>
                      <MusicSheetCard
                        {...sheet}
                        sheetId={sheet.id}
                        difficulty={mapDifficultyToNumber(sheet.difficulty)}
                        imageUrl={sheet.file_url}
                        fileUrl={sheet.file_url}
                        likes={sheet.likes_count || 0}
                        downloads={sheet.downloads_count || 0}
                        comments={0}
                        isLiked={false}
                        onLike={() => console.log(`Curtir partitura ${sheet.id}`)}
                        onDownload={() => console.log(`Download partitura ${sheet.id}`)}
                        onPlay={() => navigate(`/sheet/${sheet.id}`)}
                        onComment={() => navigate(`/sheet/${sheet.id}#comments`)}
                        onClick={() => navigate(`/sheet/${sheet.id}`)}
                      />
                    </motion.div>
                  </Grid>
                ))}
              </Grid>

              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(e, value) => setPage(value)}
                    color="primary"
                    size="large"
                    showFirstButton
                    showLastButton
                    sx={{
                      '& .MuiPaginationItem-root': {
                        borderRadius: 2,
                        margin: '0 4px',
                        '&.Mui-selected': {
                          background: 'linear-gradient(45deg, #7F56D9 30%, #9F7AEA 90%)',
                          boxShadow: '0 4px 12px rgba(127, 86, 217, 0.3)',
                          '&:hover': {
                            background: 'linear-gradient(45deg, #6B46C1 30%, #805AD5 90%)'
                          }
                        }
                      }
                    }}
                  />
                </Box>
              )}
            </motion.div>
          </>
        )}
      </Container>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { 
            width: '90%', 
            maxWidth: 400, 
            p: 4,
            borderTopLeftRadius: '24px',
            borderBottomLeftRadius: '24px',
            background: theme.palette.mode === 'light' 
              ? 'rgba(255, 255, 255, 0.95)'
              : 'rgba(30, 30, 30, 0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
            border: '1px solid rgba(255,255,255,0.1)'
          },
        }}
      >
        <Stack spacing={4}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h5" fontWeight="600" sx={{ color: 'primary.main' }}>
              Filtros
            </Typography>
            <IconButton 
              onClick={() => setDrawerOpen(false)} 
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Ajuste os filtros para refinar sua busca por partituras e cifras.
          </Typography>
          <FilterPanel />
        </Stack>
      </Drawer>
    </Box>
  );
}