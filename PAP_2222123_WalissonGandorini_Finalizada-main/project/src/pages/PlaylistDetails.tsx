import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MusicSheet } from '../types/database';
import {
  Container,
  Box,
  Typography,
  IconButton,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  Chip,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  DragIndicator as DragIndicatorIcon,
  MusicNote as MusicNote,
} from '@mui/icons-material';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import MusicSheetCard from '../components/MusicSheetCard';
import { useAuthStore } from '../store/authStore';

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface PlaylistItem {
  id: string;
  position: number;
  sheet: MusicSheet;
}

export default function PlaylistDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    is_public: true,
  });
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [openRemoveItemConfirm, setOpenRemoveItemConfirm] = useState(false);
  const [itemToRemoveId, setItemToRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      console.log('ID da Playlist (useParams):', id);
      fetchPlaylistDetails();
    }
  }, [id]);

  const fetchPlaylistDetails = async () => {
    try {
      // Buscar detalhes da playlist
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', id)
        .single();

      if (playlistError) throw playlistError;
      setPlaylist(playlistData);
      setEditForm({
        title: playlistData.title,
        description: playlistData.description || '',
        is_public: playlistData.is_public,
      });

      // Buscar itens da playlist
      const { data: itemsData, error: itemsError } = await supabase
        .from('playlist_items')
        .select(`
          id,
          position,
          sheet:music_sheets (
            id,
            title,
            composer,
            instrument,
            difficulty,
            file_url,
            likes_count,
            downloads_count
          )
        `)
        .eq('playlist_id', id)
        .order('position');

      console.log('Dados dos itens da playlist:', itemsData);
      console.log('Erro dos itens da playlist:', itemsError);

      if (itemsError) throw itemsError;
      
      const formattedItems = (itemsData || []).map((item: any) => ({
        ...item,
        sheet: {
          ...item.sheet,
          likes: item.sheet.likes_count || 0,
          downloads: item.sheet.downloads_count || 0,
          comments: 0,
          isLiked: false,
        }
      }));
      setItems(formattedItems);
    } catch (error: any) { // Capturar o erro como 'any' para acessar .message
      console.error('Erro ao carregar detalhes da playlist:', error);
      setError(`Não foi possível carregar os detalhes da playlist: ${error.message || 'Erro desconhecido'}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlaylist = async () => {
    try {
      const { error } = await supabase
        .from('playlists')
        .update({
          title: editForm.title,
          description: editForm.description || null,
          is_public: editForm.is_public,
        })
        .eq('id', id);

      if (error) throw error;

      setPlaylist(prev => prev ? {
        ...prev,
        title: editForm.title,
        description: editForm.description || null,
        is_public: editForm.is_public,
      } : null);
      setOpenEditDialog(false);
    } catch (error) {
      console.error('Erro ao atualizar playlist:', error);
      setError('Não foi possível atualizar a playlist. Tente novamente mais tarde.');
    }
  };

  const handleDeletePlaylist = async () => {
    setOpenDeleteConfirm(true);
  };

  const handleConfirmDeletePlaylist = async () => {
    setOpenDeleteConfirm(false);
    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      navigate('/playlists');
    } catch (error) {
      console.error('Erro ao excluir playlist:', error);
      setError('Não foi possível excluir a playlist. Tente novamente mais tarde.');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setItemToRemoveId(itemId);
    setOpenRemoveItemConfirm(true);
  };

  const handleConfirmRemoveItem = async () => {
    if (!itemToRemoveId) return;

    setOpenRemoveItemConfirm(false);
    try {
      const { error } = await supabase
        .from('playlist_items')
        .delete()
        .eq('id', itemToRemoveId);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== itemToRemoveId));
      setItemToRemoveId(null);
    } catch (error) {
      console.error('Erro ao remover item da playlist:', error);
      setError('Não foi possível remover o item da playlist. Tente novamente mais tarde.');
    }
  };

  const handleReorderItems = async (reorderedItems: PlaylistItem[]) => {
    if (!user || playlist?.user_id !== user.id) {
      setError("Você não tem permissão para reordenar esta playlist.");
      return;
    }

    setItems(reorderedItems);

    try {
      // Atualizar posições no banco de dados
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        position: index + 1,
      }));

      const { error } = await supabase
        .from('playlist_items')
        .upsert(updates);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao reordenar itens:', error);
      setError('Não foi possível salvar a nova ordem dos itens. Tente novamente mais tarde.');
    }
  };

  const handleSheetLike = async (sheetId: string) => {
    console.log(`Partitura ${sheetId} curtida/descurtida.`);
  };

  const handleSheetDownload = async (sheetId: string) => {
    console.log(`Download da partitura ${sheetId}.`);
  };

  const handleSheetPlay = (sheetId: string) => {
    console.log(`Tocar partitura ${sheetId}.`);
    navigate(`/sheet/${sheetId}`);
  };

  const handleSheetComment = (sheetId: string) => {
    console.log(`Comentar na partitura ${sheetId}.`);
    navigate(`/sheet/${sheetId}#comments`);
  };

  const handleSheetClick = (sheetId: string) => {
    console.log(`Clique na partitura ${sheetId}.`);
    navigate(`/sheet/${sheetId}`);
  };

  const handleSheetDelete = async (sheetId: string) => {
    console.log(`Excluir partitura ${sheetId}.`);
    if (!window.confirm('Tem certeza que deseja excluir esta partitura da playlist?')) return;

    try {
      const { error } = await supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', id)
        .eq('sheet_id', sheetId);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.sheet.id !== sheetId));
    } catch (error: any) {
      console.error('Erro ao remover partitura da playlist:', error);
      setError(`Não foi possível remover a partitura da playlist: ${error.message}`);
    }
  };

  const mapDifficultyToNumber = (difficulty: 'beginner' | 'intermediate' | 'advanced'): number => {
    switch (difficulty) {
      case 'beginner':
        return 1;
      case 'intermediate':
        return 3;
      case 'advanced':
        return 5;
      default:
        return 1;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!playlist) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Playlist não encontrada
        </Alert>
      </Container>
    );
  }

  const isOwner = user?.id === playlist.user_id;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  {playlist.title}
                </Typography>
                {playlist.description && (
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    {playlist.description}
                  </Typography>
                )}
                <Chip
                  icon={playlist.is_public ? <PublicIcon /> : <LockIcon />}
                  label={playlist.is_public ? 'Pública' : 'Privada'}
                  color={playlist.is_public ? 'success' : 'default'}
                  sx={{ mr: 1 }}
                />
                <Chip
                  icon={<MusicNote />}
                  label={`${items.length} Documentos`}
                  color="info"
                />
              </Box>
              {isOwner && (
                <Box>
                  <IconButton color="primary" onClick={() => setOpenEditDialog(true)} aria-label="Editar playlist">
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={handleDeletePlaylist} aria-label="Excluir playlist">
                    <DeleteIcon />
                  </IconButton>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate(`/upload?add_to_playlist=${playlist.id}`)}
                    sx={{ ml: 2 }}
                  >
                    Adicionar Documentos
                  </Button>
                </Box>
              )}
            </Box>
          </Stack>
        </Paper>

        <Typography variant="h5" component="h2" sx={{ mt: 4, mb: 2 }}>
          Documentos Musicas na Playlist
        </Typography>
              
        {items.length === 0 ? (
          <Alert severity="info">Esta playlist ainda não tem Documentos Musicais. {isOwner && "Adicione alguns!"}</Alert>
        ) : (
          <Reorder.Group axis="y" values={items} onReorder={handleReorderItems}>
            <Grid container spacing={3}>
              {items.map((item) => (
                <Reorder.Item key={item.id} value={item} style={{ listStyle: 'none' }}>
                  <Grid item xs={12}>
                    <Paper elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 2, borderRadius: 2 }}>
                      {isOwner && (
                        <Box sx={{ mr: 2, cursor: 'grab' }}>
                          <DragIndicatorIcon color="action" />
                        </Box>
                      )}
                      <MusicSheetCard
                        sheetId={item.sheet.id}
                        title={item.sheet.title}
                        composer={item.sheet.composer}
                        instrument={item.sheet.instrument}
                        difficulty={mapDifficultyToNumber(item.sheet.difficulty)}
                        imageUrl={item.sheet.file_url}
                        fileUrl={item.sheet.file_url}
                        likes={item.sheet.likes || 0}
                        downloads={item.sheet.downloads || 0}
                        comments={item.sheet.comments || 0}
                        isLiked={item.sheet.isLiked || false}
                        onLike={handleSheetLike}
                        onDownload={handleSheetDownload}
                        onPlay={handleSheetPlay}
                        onComment={handleSheetComment}
                        onClick={handleSheetClick}
                        isOwner={item.sheet.user_id === user?.id}
                        onDelete={handleSheetDelete}
                      />
                      {isOwner && (
                        <IconButton
                          color="error"
                          onClick={() => handleRemoveItem(item.id)}
                          sx={{ ml: 'auto' }}
                          aria-label="Remover partitura da playlist"
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Paper>
                  </Grid>
                </Reorder.Item>
              ))}
            </Grid>
          </Reorder.Group>
        )}

        <Dialog
          open={openEditDialog}
          onClose={() => setOpenEditDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Editar Playlist</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} mt={1}>
              <TextField
                label="Título da Playlist"
                fullWidth
                value={editForm.title}
                onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                required
              />
              <TextField
                label="Descrição (opcional)"
                fullWidth
                multiline
                rows={3}
                value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.is_public}
                    onChange={e => setEditForm(p => ({ ...p, is_public: e.target.checked }))}
                    color="primary"
                  />
                }
                label="Tornar Pública"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleUpdatePlaylist} variant="contained" color="primary">
              Salvar Alterações
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de confirmação para exclusão de playlist */}
        <Dialog
          open={openDeleteConfirm}
          onClose={() => setOpenDeleteConfirm(false)}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            {"Confirmar Exclusão de Playlist"}
          </DialogTitle>
          <DialogContent>
            <Typography id="alert-dialog-description">
              Tem certeza que deseja excluir esta playlist? Esta ação não pode ser desfeita.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteConfirm(false)}>Cancelar</Button>
            <Button onClick={handleConfirmDeletePlaylist} autoFocus color="error" variant="contained">
              Excluir
            </Button>
          </DialogActions>
        </Dialog>

        {/* Novo Modal de confirmação para remover item da playlist */}
        <Dialog
          open={openRemoveItemConfirm}
          onClose={() => setOpenRemoveItemConfirm(false)}
          aria-labelledby="remove-item-dialog-title"
          aria-describedby="remove-item-dialog-description"
        >
          <DialogTitle id="remove-item-dialog-title">
            {"Confirmar Remoção"}
          </DialogTitle>
          <DialogContent>
            <Typography id="remove-item-dialog-description">
              Tem certeza que deseja remover este documento da playlist? Esta ação não removerá o item permanentemente da sua biblioteca.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenRemoveItemConfirm(false)}>Cancelar</Button>
            <Button onClick={handleConfirmRemoveItem} autoFocus color="error" variant="contained">
              Remover
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
} 