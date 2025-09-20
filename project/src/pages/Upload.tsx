import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Grid, 
  Paper, 
  Stack, 
  Container,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
  Tabs,
  Tab,
  LinearProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Switch,
} from '@mui/material';
import { 
  CloudUpload as UploadIcon, 
  CloudUpload,
  CloudDone as CloudDoneIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  LibraryMusic,
  AddBoxOutlined,
  Add as AddIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

// Novas interfaces para Playlist e NewPlaylistFormData (copiadas de Library.tsx)
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

interface NewPlaylistFormData {
  title: string; // Alterado de 'name' para 'title'
  description: string;
  is_public: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const Upload = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    composer: '',
    instrument: '',
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    tags: [] as string[],
    scales: [] as string[],
    file: null as File | null,
  });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isValidFile, setIsValidFile] = useState<boolean | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  
  // Estado para a pré-visualização
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Estado para Adicionar à Playlist pós-upload
  const [openPostUploadPlaylistDialog, setOpenPostUploadPlaylistDialog] = useState(false);
  const [uploadedSheetId, setUploadedSheetId] = useState<string | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [addPlaylistError, setAddPlaylistError] = useState('');
  const [addPlaylistSuccess, setAddPlaylistSuccess] = useState(false);

  const [openCreateNewPlaylistDialog, setOpenCreateNewPlaylistDialog] = useState(false);
  const [newPlaylistFormData, setNewPlaylistFormData] = useState<NewPlaylistFormData>({
    title: '', // Alterado de 'name' para 'title'
    description: '',
    is_public: false,
  });
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const scales = [
    'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
    'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
    'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'E#m',
    'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm', 'Dbm', 'Gbm', 'Cbm'
  ];

  const instruments = [
    'Piano', 'Violino', 'Violoncelo', 'Guitarra', 'Baixo', 
    'Flauta', 'Saxofone', 'Clarinete', 'Trompete', 
    'Bateria', 'Voz', 'Outro'
  ];

  // Gerar URL de pré-visualização quando o arquivo mudar
  useEffect(() => {
    if (formData.file) {
      setIsLoading(true);
      if (formData.file.size > MAX_FILE_SIZE) {
        setError(`O ficheiro excede o tamanho máximo permitido (5MB).`);
        setIsValidFile(false);
        setValidationMessage('Ficheiro muito grande. O limite é 5MB.');
        setIsLoading(false);
        return;
      }
      // Aceitar apenas tipos válidos
      const validTypes = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
      if (!validTypes.includes(formData.file.type)) {
        setError('Tipo de ficheiro não suportado. Aceites: PDF, PNG, JPG, JPEG.');
        setIsValidFile(false);
        setValidationMessage('Tipo de ficheiro não suportado.');
        setIsLoading(false);
        return;
      }
      setIsValidFile(true);
      setValidationMessage('Ficheiro aceito para upload.');
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const fileUrl = URL.createObjectURL(formData.file);
      setPreviewUrl(fileUrl);
      setTabValue(1);
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
      return () => {
        URL.revokeObjectURL(fileUrl);
      };
    } else {
      setPreviewUrl(null);
      setTabValue(0);
      setIsValidFile(null);
      setValidationMessage('');
      setIsLoading(false);
    }
  }, [formData.file]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const validFileTypes = ['pdf', 'png', 'jpg', 'jpeg'];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!ext || !validFileTypes.includes(ext)) {
        setError('Tipo de ficheiro não suportado. Aceites: PDF, PNG, JPG, JPEG.');
        setFormData({ ...formData, file: null });
        setIsValidFile(false);
        setValidationMessage('Tipo de ficheiro não suportado.');
        return;
      }
      setFormData({ ...formData, file: selectedFile });
      setIsLoading(true);
      setValidationMessage('Validando ficheiro no backend...');
      setIsValidFile(null);
      setError('');
      try {
        const formDataBackend = new FormData();
        formDataBackend.append('file', selectedFile);
        const response = await axios.post('http://localhost:8000/validate-deep', formDataBackend, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000
        });
        if (response.data && response.data.valid !== undefined) {
          if (response.data.valid) {
            setValidationMessage(response.data.message || 'Ficheiro validado como partitura/cifra!');
            setIsValidFile(true);
          } else {
            // Bloqueia o upload caso não seja reconhecido como partitura/cifra
            setValidationMessage(response.data.message || 'Ficheiro não é uma partitura/cifra reconhecida. O upload não será permitido.');
            setIsValidFile(false); // Bloqueia o upload
          }
        } else {
          setValidationMessage('Resposta inesperada do backend.');
          setIsValidFile(false);
        }
      } catch (err: any) {
        setValidationMessage(
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          'Erro ao validar ficheiro no backend.'
        );
        setIsValidFile(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
    setFormData({ ...formData, tags });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const simulateProgress = () => {
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 200);
    
    return () => clearInterval(interval);
  };

  // Função para buscar playlists do usuário (adaptada de SheetCard/SheetViewer)
  const fetchUserPlaylists = async () => {
    if (!user) return;
    setLoadingPlaylists(true);
    setAddPlaylistError('');
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id, title, description, is_public, created_at, updated_at, sheets_count:playlist_sheets(count)') // Alterado de 'name' para 'title'
        .eq('user_id', user.id);

      if (error) throw error;
      
      const formattedPlaylists = (data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        title: p.title, // Alterado de 'name' para 'title'
        description: p.description,
        is_public: p.is_public,
        created_at: p.created_at,
        updated_at: p.updated_at,
        sheets_count: p.sheets_count[0]?.count || 0,
      }));
      setUserPlaylists(formattedPlaylists);
    } catch (err: any) {
      console.error('Erro ao buscar playlists (Upload.tsx):', err);
      setAddPlaylistError('Não foi possível carregar as playlists.');
    } finally {
      setLoadingPlaylists(false);
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

  // Lidar com a criação de uma nova playlist (adaptada de SheetCard/SheetViewer)
  const handleCreateNewPlaylist = async () => {
    if (!user) {
      setAddPlaylistError('Sessão expirada. Por favor, faça login novamente.');
      return;
    }
    if (!newPlaylistFormData.title.trim()) { 
      setAddPlaylistError('O título da playlist é obrigatório.');
      return;
    }

    setCreatingPlaylist(true);
    setAddPlaylistError('');

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          title: newPlaylistFormData.title.trim(), // Alterado de name para title
          description: newPlaylistFormData.description.trim() || null,
          is_public: newPlaylistFormData.is_public,
        })
        .select();

      if (error) throw error;
      
      setOpenCreateNewPlaylistDialog(false);
      setNewPlaylistFormData({ title: '', description: '', is_public: false }); // Alterado de name para title
      fetchUserPlaylists(); // Re-fetch playlists to include the new one
      setAddPlaylistSuccess(true);
      setTimeout(() => setAddPlaylistSuccess(false), 3000);

    } catch (err: any) {
      console.error('Erro ao criar playlist (Upload.tsx):', err);
      setAddPlaylistError(`Erro ao criar playlist: ${err.message}`);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Lidar com a adição da partitura recém-enviada às playlists selecionadas
  const handleAddUploadedSheetToPlaylists = async () => {
    if (!user || !uploadedSheetId) {
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
        // Fetch the current max position for this playlist
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
          sheet_id: uploadedSheetId,
          position: nextPosition,
        });
      }

      const { error } = await supabase
        .from('playlist_items')
        .insert(insertions);

      if (error) throw error;

      setOpenPostUploadPlaylistDialog(false);
      setSelectedPlaylists([]);
      setAddPlaylistSuccess(true);
      setTimeout(() => navigate('/library'), 1500); // Redirecionar após sucesso e snackbar

    } catch (err: any) {
      console.error('Erro ao adicionar partitura à playlist (Upload.tsx):', err);
      if (err.code === '23505') { // Código de erro para violação de chave primária/única
        setAddPlaylistError('Esta partitura/cifra já está em uma das playlists selecionadas.');
      } else {
        setAddPlaylistError(`Erro ao adicionar: ${err.message}`);
      }
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) {
      setError('Sessão expirada. Por favor, faça login novamente.');
      return;
    }
    try {
      // Validação do formulário
      if (!formData.title || !formData.composer || !formData.instrument) {
        setError('Por favor, preencha todos os campos obrigatórios.');
        return;
      }
      if (!formData.file) {
        setError('Por favor, selecione um ficheiro de partitura/cifra para upload.');
        return;
      }
      if (isValidFile === false) {
        setError('O ficheiro selecionado não é válido. Por favor, selecione outro ficheiro.');
        return;
      }
      setLoading(true);
      setError('');
      setUploadProgress(0);
      
      // Iniciar animação de progresso
      const cleanupProgress = simulateProgress();

      console.log('Iniciando processo de upload...');
      
      // Upload do ficheiro de partitura
      const fileExt = formData.file.name.split('.').pop()?.toLowerCase() || '';
      // Remove caracteres especiais do nome do ficheiro
      const cleanFileName = formData.file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const fileName = `${Date.now()}-${cleanFileName}`;
      // Opcional: prefixo para organização
      const filePath = `uploads/${fileName}`;

      console.log('Enviando para o Storage:', filePath);
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('music-sheets')
        .upload(filePath, formData.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Erro no upload do ficheiro:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }
      
      console.log('Upload concluído com sucesso:', uploadData);

      // Determinar o tipo de ficheiro
      let fileType: 'pdf' | 'png' | 'jpg' | 'jpeg' | null = null;
      if (fileExt === 'pdf') {
        fileType = 'pdf';
      } else if (fileExt === 'png') {
        fileType = 'png';
      } else if (fileExt === 'jpg') {
        fileType = 'jpg';
      } else if (fileExt === 'jpeg') {
        fileType = 'jpeg';
      }
      // Se não for um tipo aceito, bloqueia o upload
      if (!fileType) {
        setError('Tipo de ficheiro não suportado. Aceites: PDF, PNG, JPG, JPEG.');
        setLoading(false);
        return;
      }

      console.log('Tipo de ficheiro determinado:', fileType);

      // Preparar dados para inserção no banco
      const dataToInsert = {
        title: formData.title,
        composer: formData.composer,
        instrument: formData.instrument,
        difficulty: formData.difficulty,
        tags: formData.tags,
        scales: formData.scales,
        file_url: uploadData.path,
        midi_url: null,
        file_type: fileType, // agora pode ser null, nunca string vazia
        user_id: user.id,
        mei_url: null
      };
      
      console.log('Dados a serem inseridos na tabela:', dataToInsert);

      // Criar registro no banco de dados
      const { error: insertError, data: insertData } = await supabase
        .from('music_sheets')
        .insert(dataToInsert)
        .select('id') // Selecionar apenas o ID da partitura recém-criada
        .single();

      if (insertError) {
        console.error('Erro ao inserir no banco:', insertError);
        throw new Error(`Erro ao salvar no banco: ${insertError.message}`);
      }
      
      console.log('Registro criado com sucesso no banco de dados. ID:', insertData.id);

      setUploadedSheetId(insertData.id); // Armazenar o ID da partitura recém-enviada
      setUploadProgress(100);
      setSuccess(true);
      
      // Abrir diálogo para adicionar à playlist em vez de redirecionar imediatamente
      setTimeout(() => {
        setOpenPostUploadPlaylistDialog(true);
        fetchUserPlaylists(); // Carregar playlists quando o diálogo abrir
      }, 1000); // Pequeno atraso para o sucesso ser visível

    } catch (err) {
      console.error('Erro completo durante o processo de upload:', err);
      setError(err instanceof Error ? err.message : 'Ocorreu um erro durante o upload. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  const removeFile = () => {
    setFormData({ ...formData, file: null, difficulty: formData.difficulty });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsValidFile(null);
    setValidationMessage('');
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper 
          elevation={3}
          sx={{
            borderRadius: 4, 
            overflow: 'hidden', 
            mb: { xs: 2, md: 4 },
            boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
            border: theme => `1px solid ${theme.palette.divider}`,
            p: { xs: 2, md: 4 }
          }}
        >
          <Box 
            sx={{
              position: 'absolute', 
              top: -20, 
              right: -20, 
              width: 180, 
              height: 180, 
              borderRadius: '50%', 
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.3)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
              zIndex: 0 
            }} 
          />
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={2}>
              <LibraryMusic fontSize="large" color="primary" />
              <Typography variant="h4" component="h1" fontWeight="bold" color="primary.main">
                Compartilhe suas Partituras e Cifras
              </Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary" mb={2}>
              Faça upload de partituras ou cifras nos formatos PDF, PNG, JPG, JPEG para compartilhar com a comunidade.
            </Typography>
          </Box>
        </Paper>

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert 
              severity="success" 
              sx={{ mb: 3, borderRadius: 2 }}
              onClose={() => setSuccess(false)}
            >
              Documento enviado com sucesso!
            </Alert>
          </motion.div>
        )}

        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 3, 
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography variant="h6" fontWeight="medium" mb={3} color="primary">
                        Informações da Partitura/Cifra
                      </Typography>
                
                <form onSubmit={handleSubmit}>
                  <Stack spacing={3} sx={{ p: { xs: 2, md: 4 } }}>
                    <TextField
                      label="Título da Partitura/Cifra"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      fullWidth
                      required
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'box-shadow 0.3s ease',
                          '&:hover fieldset': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}`,
                          },
                        },
                      }}
                    />
                    <TextField
                      label="Compositor ou Artista"
                      value={formData.composer}
                      onChange={e => setFormData({ ...formData, composer: e.target.value })}
                      fullWidth
                      required
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'box-shadow 0.3s ease',
                          '&:hover fieldset': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}`,
                          },
                        },
                      }}
                    />
                    <FormControl fullWidth required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                      <InputLabel id="instrument-label">Instrumento</InputLabel>
                      <Select
                        labelId="instrument-label"
                        value={formData.instrument}
                        label="Instrumento"
                        onChange={e => setFormData({ ...formData, instrument: e.target.value })}
                        sx={{
                          '&:hover fieldset': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}`,
                          },
                        }}
                      >
                        {instruments.map(instrument => (
                          <MenuItem key={instrument} value={instrument}>
                            {instrument}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                      <InputLabel id="difficulty-label">Dificuldade</InputLabel>
                      <Select
                        labelId="difficulty-label"
                        value={formData.difficulty}
                        label="Dificuldade"
                        onChange={e => setFormData({ ...formData, difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}
                        sx={{
                          '&:hover fieldset': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}`,
                          },
                        }}
                      >
                        <MenuItem value="beginner">Iniciante</MenuItem>
                        <MenuItem value="intermediate">Intermédio</MenuItem>
                        <MenuItem value="advanced">Avançado</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                      <InputLabel id="tags-label">Tags</InputLabel>
                      <Select
                        labelId="tags-label"
                        multiple
                        value={formData.tags}
                        onChange={e => setFormData(p => ({ ...p, tags: e.target.value as string[] }))}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
                              <Chip key={value} label={value} size="small" color="primary" variant="outlined" sx={{ borderRadius: '8px', bgcolor: alpha(theme.palette.primary.main, 0.1) }} />
                            ))}
                          </Box>
                        )}
                        label="Tags"
                        sx={{
                          '&:hover fieldset': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}`,
                          },
                        }}
                      >
                        {/* Aqui você pode adicionar as opções de tags pré-definidas se tiver, ou deixar o usuário digitar e selecionar o que quiser */}
                        {/* Por enquanto, vou usar um exemplo simples */}
                        <MenuItem value="Rock">Rock</MenuItem>
                        <MenuItem value="Pop">Pop</MenuItem>
                        <MenuItem value="Jazz">Jazz</MenuItem>
                        <MenuItem value="Clássico">Clássico</MenuItem>
                        <MenuItem value="Blues">Blues</MenuItem>
                        <MenuItem value="Hip Hop">Hip Hop</MenuItem>
                        <MenuItem value="Eletrónica">Eletrónica</MenuItem>
                        <MenuItem value="R&B">R&B</MenuItem>
                        <MenuItem value="Country">Country</MenuItem>
                        <MenuItem value="Folk">Folk</MenuItem>
                        <MenuItem value="Reggae">Reggae</MenuItem>
                        <MenuItem value="Metal">Metal</MenuItem>
                        <MenuItem value="Soul">Soul</MenuItem>
                        <MenuItem value="Gospel">Gospel</MenuItem>
                        <MenuItem value="Indie">Indie</MenuItem>
                        <MenuItem value="Funk">Funk</MenuItem>
                        <MenuItem value="Samba">Samba</MenuItem>
                        <MenuItem value="Sertanejo">Sertanejo</MenuItem>
                        <MenuItem value="Pagode">Pagode</MenuItem>
                        <MenuItem value="Instrumental">Instrumental</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                      <InputLabel id="scales-label">Escalas</InputLabel>
                      <Select
                        labelId="scales-label"
                        multiple
                        value={formData.scales}
                        onChange={e => setFormData(p => ({ ...p, scales: e.target.value as string[] }))}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
                              <Chip key={value} label={value} size="small" color="secondary" variant="outlined" sx={{ borderRadius: '8px', bgcolor: alpha(theme.palette.secondary.main, 0.1) }} />
                            ))}
                          </Box>
                        )}
                        label="Escalas"
                        sx={{
                          '&:hover fieldset': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}`,
                          },
                        }}
                      >
                        {scales.map(scale => (
                          <MenuItem key={scale} value={scale}>
                            {scale}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={loading || isLoading || !isValidFile}
                      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                      sx={{
                        borderRadius: '20px',
                        px: 3,
                        py: 1.5,
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        background: 'linear-gradient(90deg, #7b2ff2 0%, #f357a8 100%)',
                        color: '#fff',
                        boxShadow: '0 4px 16px rgba(123,47,242,0.2)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(90deg, #f357a8 0%, #7b2ff2 100%)',
                          boxShadow: '0 6px 24px rgba(123,47,242,0.3)',
                          transform: 'translateY(-2px)'
                        },
                        '&:disabled': {
                          opacity: 0.6,
                          cursor: 'not-allowed',
                          background: theme.palette.action.disabledBackground,
                          color: theme.palette.action.disabled
                        }
                      }}
                    >
                      {loading ? 'A Enviar...' : 'Fazer Upload'}
                    </Button>
                  </Stack>
                </form>
              </Paper>
            </motion.div>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Paper 
                elevation={2}
                sx={{ 
                  p: 3, 
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Box>
                  <Tabs 
                    value={tabValue} 
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{
                      mb: 3, 
                      borderBottom: 1, 
                      borderColor: 'divider',
                      '& .MuiTabs-indicator': {
                        height: 3,
                        borderRadius: '3px 3px 0 0',
                        bgcolor: theme.palette.primary.main
                      },
                      '& .MuiTab-root': {
                        py: 1.5,
                        fontWeight: 600,
                        fontSize: '1rem',
                        transition: 'all 0.2s ease',
                        '&.Mui-selected': {
                          color: theme.palette.primary.main,
                        },
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08)
                        }
                      }
                    }}
                  >
                    <Tab 
                      label="Upload" 
                      icon={<CloudUpload />} 
                      iconPosition="start" 
                    />
                    <Tab 
                      label="Pré-visualização" 
                      icon={<VisibilityIcon />} 
                      iconPosition="start"
                      disabled={!formData.file} 
                    />
                  </Tabs>
                </Box>

                {tabValue === 0 && (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      sx={{
                        border: `2px dashed ${dragActive ? theme.palette.primary.main : theme.palette.divider}`,
                        borderRadius: 4,
                        p: 4,
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        bgcolor: dragActive ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.background.paper, 0.7),
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          borderColor: theme.palette.primary.light,
                        }
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <Stack spacing={2} alignItems="center">
                        <UploadIcon sx={{ fontSize: 60, color: theme.palette.text.secondary }} />
                        <Typography variant="h6" color="text.primary">
                          Arraste e largue a sua partitura/cifra aqui
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ou
                        </Typography>
                        <Button
                          variant="contained"
                          component="span"
                          startIcon={<CloudUpload />}
                          onClick={() => fileInputRef.current?.click()}
                          sx={{ borderRadius: '20px', px: 3, py: 1, fontWeight: 600 }}
                        >
                          Selecionar Ficheiro
                        </Button>
                        {formData.file && (
                          <Stack direction="row" alignItems="center" spacing={1} mt={2}>
                            {isValidFile === true && <CloudDoneIcon color="success" />}
                            {isValidFile === false && <DeleteIcon color="error" />}
                            <Typography variant="body2" color="text.primary" fontWeight={600}>
                              {formData.file.name}
                            </Typography>
                            <Chip label={validationMessage} color={isValidFile === true ? 'success' : isValidFile === false ? 'error' : 'info'} size="small" sx={{ ml: 1 }} />
                            <Button onClick={removeFile} size="small" color="error">
                              Remover
                            </Button>
                            {previewUrl && (
                              <Button 
                                onClick={() => setTabValue(1)} 
                                size="small" 
                                variant="outlined" 
                                startIcon={<VisibilityIcon />} 
                                sx={{ borderRadius: '8px' }}
                              >
                                Pré-visualizar
                              </Button>
                            )}
                          </Stack>
                        )}
                        {isLoading && (
                          <Box sx={{ width: '100%', mt: 2 }}>
                            <LinearProgress 
                              variant="indeterminate"
                              sx={{
                                height: 10, 
                                borderRadius: 5,
                                bgcolor: alpha(theme.palette.primary.main, 0.2),
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: '#7b2ff2',
                                  transition: 'transform 0.5s linear'
                                }
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" mt={1}>
                              A validar ficheiro...
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  </Box>
                )}
                
                {tabValue === 1 && (
                  <Box 
                    sx={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      overflow: 'hidden',
                      position: 'relative',
                      height: 'calc(100vh - 300px)',
                      minHeight: 600,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      mt: 2
                    }}
                  >
                    {isLoading ? (
                      <Box 
                        sx={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          right: 0, 
                          bottom: 0, 
                          display: 'flex', 
                          flexDirection: 'column',
                          justifyContent: 'center', 
                          alignItems: 'center',
                          zIndex: 10,
                          bgcolor: alpha(theme.palette.background.paper, 0.7)
                        }}
                      >
                        <CircularProgress size={40} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                          Carregando visualização...
                        </Typography>
                      </Box>
                    ) : formData.file && previewUrl ? (
                      formData.file.type === 'application/pdf' ? (
                        <Box sx={{ 
                            width: '100%',
                            height: '100%',
                          minHeight: '600px',
                          minWidth: 0,
                          flex: 1,
                          position: 'relative',
                          overflow: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          p: 0,
                          m: 0,
                        }}>
                          <iframe
                            src={previewUrl}
                            title="PDF Preview"
                            style={{
                              width: '100%',
                              height: '100%',
                              minHeight: '600px',
                              border: 'none',
                              display: 'block',
                              margin: 0,
                              padding: 0,
                              background: '#222'
                            }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{
                          width: '100%',
                          height: '100%',
                          minHeight: '600px',
                          minWidth: 0,
                            flex: 1, 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#222',
                          p: 0,
                          m: 0,
                        }}>
                          <img
                            src={previewUrl}
                            alt="Pré-visualização"
                            style={{
                              width: 'auto',
                              height: '100%',
                              maxWidth: '100%',
                              objectFit: 'contain',
                              borderRadius: 8,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                              margin: 0,
                              padding: 0
                          }}
                        />
                        </Box>
                      )
                    ) : (
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          alignItems: 'center',
                          height: '100%'
                        }}
                      >
                        <Typography color="text.secondary">
                          Nenhum ficheiro selecionado para visualização
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Paper>
            </motion.div>
          </Grid>
        </Grid>
      </motion.div>

      {/* Snackbar de Sucesso */}
      <Snackbar
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        message="Partitura/Cifra enviada com sucesso!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Diálogo para Adicionar à Playlist Pós-Upload */}
      <Dialog open={openPostUploadPlaylistDialog} onClose={() => { 
        setOpenPostUploadPlaylistDialog(false);
        navigate('/library'); // Redirecionar para a biblioteca se o usuário fechar
      }} maxWidth="sm" fullWidth>
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
              <Typography variant="subtitle2" color="text.secondary" mb={1}>Selecione uma ou mais playlists para adicionar a partitura:</Typography>
              {userPlaylists.map(playlist => (
                <FormControlLabel
                  key={playlist.id}
                  control={
                    <Checkbox
                      checked={selectedPlaylists.includes(playlist.id.toString())} // Convertido id para string
                      onChange={() => handleSelectPlaylist(playlist.id.toString())} // Convertido id para string
                    />
                  }
                  label={playlist.title + (playlist.is_public ? ' (Pública)' : ' (Privada)')} // Alterado de name para title
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
          <Button onClick={() => {
            setOpenPostUploadPlaylistDialog(false);
            navigate('/library'); // Redirecionar para a biblioteca ao pular
          }}>Pular</Button>
          <Button 
            onClick={handleAddUploadedSheetToPlaylists} 
            variant="contained" 
            color="primary" 
            disabled={selectedPlaylists.length === 0 || loadingPlaylists}
          >
            Adicionar ({selectedPlaylists.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para Criar Nova Playlist (aninhado) */}
      <Dialog open={openCreateNewPlaylistDialog} onClose={() => setOpenCreateNewPlaylistDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Criar Nova Playlist</DialogTitle>
        <DialogContent>
          {addPlaylistError && <Alert severity="error" sx={{ mb: 2 }}>{addPlaylistError}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField
              label="Nome da Playlist"
              fullWidth
              value={newPlaylistFormData.title} // Alterado de name para title
              onChange={e => setNewPlaylistFormData(p => ({ ...p, title: e.target.value }))} // Alterado de name para title
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

      {/* Pré-visualização do PDF/Imagem */}
      <Dialog open={tabValue === 1 && !!previewUrl} onClose={() => setTabValue(0)} maxWidth="md" fullWidth>
        <DialogTitle>Pré-visualização do Ficheiro</DialogTitle>
        <DialogContent sx={{ p: 0, height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          {previewUrl && formData.file?.type === 'application/pdf' ? (
            <embed src={previewUrl} type="application/pdf" width="100%" height="100%" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Pré-visualização" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <Typography color="text.secondary">Nenhuma pré-visualização disponível.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTabValue(0)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Upload;