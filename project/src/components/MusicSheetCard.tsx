import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  CardActions,
  IconButton,
  Box,
  Chip,
  Rating,
  alpha,
  Skeleton,
  Tooltip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  FormControlLabel,
  Checkbox,
  TextField,
  Switch,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  Download,
  MusicNote,
  PictureAsPdf,
  Delete,
  AddBoxOutlined,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '@mui/material/styles';
import { useLikeStore } from '../store/likeStore';

interface Playlist {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  sheets_count: number;
}

interface NewPlaylistFormData {
  title: string;
  description: string;
  is_public: boolean;
}

interface MusicSheetCardProps {
  sheetId: string;
  title: string;
  composer: string;
  instrument: string;
  difficulty: number;
  imageUrl: string;
  fileUrl?: string;
  likes: number;
  downloads: number;
  comments: number;
  isLiked: boolean;
  onLike: (sheetId: string) => void;
  onDownload: (sheetId: string) => void;
  onPlay: (sheetId: string) => void;
  onComment: (sheetId: string) => void;
  onClick: (sheetId: string) => void;
  isOwner?: boolean;
  onDelete?: (sheetId: string) => void;
}

const MotionCard = motion(Card);

export default function MusicSheetCard({
  sheetId,
  title,
  composer,
  instrument,
  difficulty,
  imageUrl,
  fileUrl,
  likes,
  downloads,
  comments,
  isLiked,
  onLike,
  onDownload,
  onPlay,
  onComment,
  onClick,
  isOwner,
  onDelete,
}: MusicSheetCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [openAddPlaylistDialog, setOpenAddPlaylistDialog] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [addPlaylistError, setAddPlaylistError] = useState('');
  const [addPlaylistSuccess, setAddPlaylistSuccess] = useState(false);

  const [openCreateNewPlaylistDialog, setOpenCreateNewPlaylistDialog] = useState(false);
  const [newPlaylistFormData, setNewPlaylistFormData] = useState<NewPlaylistFormData>({
    title: '',
    description: '',
    is_public: false,
  });
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(likes);
  const [likeLoading, setLikeLoading] = useState(false);
  const { userLikes, fetchUserLikes, likeSheet, unlikeSheet, isSheetLiked } = useLikeStore();

  const isPdf = fileUrl?.endsWith('.pdf');
  const isImage = fileUrl && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileUrl);
  
  const defaultImage = `https://source.unsplash.com/featured/?music,${instrument.toLowerCase()}`;
  const displayImage = imageUrl || defaultImage;

  const cardActionsRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (fileUrl) {
      const { data } = supabase.storage
        .from('music-sheets')
        .getPublicUrl(fileUrl);
      setPublicUrl(data.publicUrl);
    }
  }, [fileUrl]);

  useEffect(() => {
    if (!sheetId) return;
    const fetchLikes = async () => {
      // Buscar contador de likes
      const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('sheet_id', sheetId);
      setLikeCount(count || 0);
      // Atualizar likes do usuário globalmente
      await fetchUserLikes();
      setLiked(isSheetLiked(sheetId));
    };
    fetchLikes();
  }, [sheetId, user, fetchUserLikes, isSheetLiked]);

  const fetchUserPlaylists = async () => {
    if (!user) return;
    setLoadingPlaylists(true);
    setAddPlaylistError('');
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id, title, description, is_public, created_at, updated_at, sheets_count:playlist_sheets(count)')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const formattedPlaylists = (data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        title: p.title,
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

  const handleOpenAddPlaylistDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("handleOpenAddPlaylistDialog chamado, stopPropagation aplicado.");
    setOpenAddPlaylistDialog(true);
    if (user) {
      fetchUserPlaylists();
    } else {
      setAddPlaylistError('Faça login para adicionar à playlist.');
    }
  };

  const handleSelectPlaylist = (playlistId: string) => {
    setSelectedPlaylists(prev => 
      prev.includes(playlistId) 
        ? prev.filter(id => id !== playlistId) 
        : [...prev, playlistId]
    );
  };

  const handleCreateNewPlaylist = async () => {
    if (!user) {
      setAddPlaylistError('Sessão expirada. Por favor, faça login novamente.');
      return;
    }
    if (!newPlaylistFormData.title.trim()) {
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
          title: newPlaylistFormData.title.trim(),
          description: newPlaylistFormData.description.trim() || null,
          is_public: newPlaylistFormData.is_public,
        })
        .select();

      if (error) throw error;
      
      setOpenCreateNewPlaylistDialog(false);
      setNewPlaylistFormData({ title: '', description: '', is_public: false });
      fetchUserPlaylists();
      setAddPlaylistSuccess(true);
      setTimeout(() => setAddPlaylistSuccess(false), 3000);

    } catch (err: any) {
      console.error('Erro ao criar playlist:', err);
      setAddPlaylistError(`Erro ao criar playlist: ${err.message}`);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleAddSheetToPlaylists = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Início de handleAddSheetToPlaylists. selectedPlaylists:", selectedPlaylists, "sheetId:", sheetId);

    if (!user) {
      setAddPlaylistError('Sessão expirada. Por favor, faça login novamente.');
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
          sheet_id: sheetId,
          position: nextPosition,
        });
      }

      const { error } = await supabase
        .from('playlist_items')
        .insert(insertions);

      if (error) throw error;

      console.log("Documento adicionado à(s) playlist(s) com sucesso!");
      setOpenAddPlaylistDialog(false);
      setSelectedPlaylists([]);
      setAddPlaylistSuccess(true);
      setTimeout(() => setAddPlaylistSuccess(false), 3000);

    } catch (err: any) {
      console.error('Erro ao adicionar documento à playlist:', err);
      if (err.code === '23505') {
        setAddPlaylistError('Este documento já está em uma das playlists selecionadas.');
      } else {
        setAddPlaylistError(`Erro ao adicionar: ${err.message}`);
      }
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleDownload = async (sheetId: string) => {
    try {
      if (!user) {
        console.warn('Utilizador não autenticado. Não é possível registar download.');
        // Opcional: Redirecionar para login ou mostrar mensagem
        return;
      }

      // 1. Incrementar downloads_count no Supabase (agora com user_id)
      const { data: incrementData, error: incrementError } = await supabase
        .rpc('increment_sheet_downloads_with_user', { sheet_id_param: sheetId, user_id_param: user.id });

      if (incrementError) {
        console.error('Erro ao incrementar downloads:', incrementError);
        // Não vamos impedir o download mesmo se o incremento falhar
      } else {
        console.log('Downloads incrementado com sucesso:', incrementData);
        // Opcional: Atualizar o estado local se necessário para refletir a nova contagem
      }

      // 2. Iniciar o download do ficheiro como um Blob
      if (publicUrl) {
        try {
          const response = await fetch(publicUrl);
          if (!response.ok) {
            throw new Error(`Erro ao baixar o ficheiro: ${response.statusText}`);
          }
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = blobUrl;
          const filename = `${title}.${fileUrl?.split('.').pop() || 'pdf'}`;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          window.URL.revokeObjectURL(blobUrl); // Libera o URL do Blob

        } catch (downloadError) {
          console.error('Erro ao iniciar o download:', downloadError);
          // Opcional: mostrar uma mensagem de erro ao usuário
        }
      } else {
        console.warn('URL pública do ficheiro não disponível para download.');
        // Opcional: mostrar uma mensagem de erro ao usuário
      }

    } catch (error) {
      console.error('Erro ao baixar partitura/cifra:', error);
    }
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      alert('Necessita de iniciar sessão para adicionar aos favoritos.');
      return;
    }
    setLikeLoading(true);
    // Pequeno atraso para UX e evitar spam
    await new Promise(resolve => setTimeout(resolve, 400));
    if (!isSheetLiked(sheetId)) {
      await likeSheet(sheetId);
    } else {
      await unlikeSheet(sheetId);
    }
    // Buscar contador atualizado após operação
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('sheet_id', sheetId);
    setLikeCount(count || 0);
    setLiked(isSheetLiked(sheetId));
    setLikeLoading(false);
  };

  return (
    <MotionCard
      whileHover={{ 
        scale: 1.03, 
        y: -5,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      transition={{ 
        duration: 0.3,
        type: 'spring',
        stiffness: 300,
      }}
      sx={{
        maxWidth: 345,
        cursor: 'pointer',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: 'background.paper',
        position: 'relative',
        transition: 'all 0.3s ease',
      }}
      onClick={(e) => {
        if (cardActionsRef.current && cardActionsRef.current.contains(e.target as Node)) {
          console.log("Clique dentro das ações do cartão, não navegando.");
          return;
        }
        console.log("MotionCard onClick ativado. Navegando para SheetViewer.");
        onClick(sheetId);
      }}
      role="article"
      aria-label={`Partitura ${title} por ${composer} para ${instrument}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(sheetId);
        }
      }}
    >
      <Box sx={{ position: 'relative', overflow: 'hidden', height: 180 }}>
        {!imageLoaded && !isPdf && !isImage && (
          <Skeleton 
            variant="rectangular" 
            height={180} 
            animation="wave" 
            sx={{ 
              bgcolor: alpha('#9E77ED', 0.1),
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }} 
          />
        )}
        {isPdf && publicUrl ? (
          <Box
            component="iframe"
            src={`${publicUrl}#toolbar=0&navpanes=0&view=FitH`}
            title={`PDF: ${title}`}
            sx={{
              width: '100%',
              height: '100%',
              border: 'none',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        ) : isImage && publicUrl ? (
          <CardMedia
            component="img"
            height="180"
            image={publicUrl}
            alt={`Partitura: ${title} por ${composer}`}
            sx={{ 
              objectFit: 'cover',
              filter: 'brightness(0.9)',
              transition: 'all 0.5s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                filter: 'brightness(1)',
              }
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
        ) : (
          <CardMedia
            component="img"
            height="180"
            image={displayImage}
            alt={`Partitura: ${title} por ${composer}`}
            sx={{ 
              objectFit: 'cover',
              filter: 'brightness(0.9)',
              transition: 'all 0.5s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                filter: 'brightness(1)',
              }
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
        )}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '60px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            p: 1,
          }}
        >
          <Chip 
            icon={<MusicNote fontSize="small" />} 
            label={instrument} 
            size="small"
            color="primary"
            sx={{ 
              fontWeight: 600,
              backdropFilter: 'blur(4px)',
              bgcolor: alpha('#7F56D9', 0.8),
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              '& .MuiChip-icon': {
                color: 'white',
              }
            }}
          />
          <Tooltip title={`Dificuldade: ${difficulty}/5`}>
            <Rating
              value={difficulty}
              readOnly
              size="small"
              max={5}
              sx={{ 
                '& .MuiRating-icon': {
                  color: 'white',
                  filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))'
                }
              }}
            />
          </Tooltip>
        </Box>
        {isPdf && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: alpha('#7F56D9', 0.9),
              borderRadius: '50%',
              p: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PictureAsPdf sx={{ color: 'white', fontSize: 20 }} />
          </Box>
        )}
      </Box>

      <CardContent sx={{ pt: 2, pb: 1 }}>
        <Typography 
          gutterBottom 
          variant="h6" 
          component="div" 
          noWrap
          sx={{ 
            fontWeight: 600,
            fontSize: '1.1rem',
            lineHeight: 1.3,
            color: 'text.primary',
          }}
        >
          {title}
        </Typography>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          noWrap
          sx={{ 
            fontWeight: 500,
            mb: 1,
          }}
        >
          {composer}
        </Typography>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {user && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <Box ref={cardActionsRef}>
              <Tooltip title={liked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
                <span>
                  <IconButton
                    aria-label="like"
                    onClick={handleLikeClick}
                    color={liked ? 'primary' : 'default'}
                    disabled={likeLoading}
                    sx={{
                      bgcolor: liked ? 'primary.light' : 'background.paper',
                      borderRadius: '50%',
                      boxShadow: liked ? '0 2px 8px rgba(127,86,217,0.15)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {liked ? <Favorite /> : <FavoriteBorder />}
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton aria-label="download" onClick={(e) => {
                e.stopPropagation();
                handleDownload(sheetId);
              }}>
                <Download />
              </IconButton>
              {isOwner && (
                <IconButton aria-label="delete" onClick={(e) => {
                  e.stopPropagation();
                  if (onDelete) onDelete(sheetId);
                }}>
                  <Delete />
                </IconButton>
              )}
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenAddPlaylistDialog(e);
                }}
                sx={{
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
              >
                <AddBoxOutlined />
              </IconButton>
            </Box>
          </div>
        )}
      </CardActions>

      <Dialog 
        open={openAddPlaylistDialog} 
        onClose={() => setOpenAddPlaylistDialog(false)} 
        maxWidth="sm" 
        fullWidth
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle>Adicionar à Lista de Reprodução</DialogTitle>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          {addPlaylistError && <Alert severity="error" sx={{ mb: 2 }}>{addPlaylistError}</Alert>}
          {loadingPlaylists ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : userPlaylists.length === 0 ? (
            <Box textAlign="center" py={2}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Ainda não tem listas de reprodução.
              </Typography>
              <Button 
                variant="outlined" 
                startIcon={<AddBoxOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenCreateNewPlaylistDialog(true);
                }}
              >
                Criar Nova Lista de Reprodução
              </Button>
            </Box>
          ) : (
            <Stack spacing={1} mt={1}>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>Selecione uma ou mais listas de reprodução:</Typography>
              {userPlaylists.map(playlist => (
                <FormControlLabel
                  key={playlist.id}
                  control={
                    <Checkbox
                      checked={selectedPlaylists.includes(playlist.id.toString())}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectPlaylist(playlist.id.toString());
                      }}
                    />
                  }
                  label={playlist.title + (playlist.is_public ? ' (Pública)' : ' (Privada)')}
                />
              ))}
              <Button 
                variant="outlined" 
                startIcon={<AddBoxOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenCreateNewPlaylistDialog(true);
                }}
                sx={{ mt: 2 }}
              >
                Ou Crie Uma Nova Lista de Reprodução
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions onClick={(e) => e.stopPropagation()}>
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              setOpenAddPlaylistDialog(false);
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              handleAddSheetToPlaylists(e);
            }}
            variant="contained" 
            color="primary" 
            disabled={selectedPlaylists.length === 0 || loadingPlaylists}
          >
            Adicionar ({selectedPlaylists.length})
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={openCreateNewPlaylistDialog} 
        onClose={() => setOpenCreateNewPlaylistDialog(false)} 
        maxWidth="sm" 
        fullWidth
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle>Criar Nova Lista de Reprodução</DialogTitle>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          {addPlaylistError && <Alert severity="error" sx={{ mb: 2 }}>{addPlaylistError}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField
              label="Nome da Lista de Reprodução"
              fullWidth
              value={newPlaylistFormData.title}
              onChange={(e) => {
                e.stopPropagation();
                setNewPlaylistFormData(p => ({ ...p, title: e.target.value }));
              }}
              onClick={(e) => e.stopPropagation()}
              required
            />
            <TextField
              label="Descrição (opcional)"
              fullWidth
              multiline
              rows={3}
              value={newPlaylistFormData.description}
              onChange={(e) => {
                e.stopPropagation();
                setNewPlaylistFormData(p => ({ ...p, description: e.target.value }));
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={newPlaylistFormData.is_public}
                  onChange={(e) => {
                    e.stopPropagation();
                    setNewPlaylistFormData(p => ({ ...p, is_public: e.target.checked }));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  color="primary"
                />
              }
              label="Tornar Pública"
              onClick={(e) => e.stopPropagation()}
            />
          </Stack>
        </DialogContent>
        <DialogActions onClick={(e) => e.stopPropagation()}>
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              setOpenCreateNewPlaylistDialog(false);
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              handleCreateNewPlaylist();
            }}
            variant="contained" 
            color="primary" 
            disabled={creatingPlaylist}
          >
            {creatingPlaylist ? <CircularProgress size={24} /> : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={addPlaylistSuccess}
        autoHideDuration={3000}
        onClose={() => setAddPlaylistSuccess(false)}
        message="Partitura adicionada à(s) lista(s) de reprodução com sucesso!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </MotionCard>
  );
}