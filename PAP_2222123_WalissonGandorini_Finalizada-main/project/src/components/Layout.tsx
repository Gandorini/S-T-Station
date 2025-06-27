import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Button,
  Container,
  Avatar,
  Tooltip,
  Stack,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  alpha,
  Badge,
  InputBase,
  Paper,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home,
  LibraryMusic,
  Explore,
  CloudUpload,
  Person,
  Search as SearchIcon,
  Close,
  Notifications as NotificationsIcon,
  DarkModeOutlined as DarkModeIcon,
  LightModeOutlined as LightModeIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeContext } from '../context/ThemeContext';
import Logo from './Logo';
import { supabase } from '../lib/supabase';
import SettingsSidebar from './SettingsSidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { text: 'Início', icon: <Home />, path: '/app' },
  { text: 'Explorar', icon: <Explore />, path: '/explore' },
  { text: 'Biblioteca', icon: <LibraryMusic />, path: '/library' },
  { text: 'Upload', icon: <CloudUpload />, path: '/upload' },
];

export default function Layout({ children }: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [anchorElNotif, setAnchorElNotif] = useState<null | HTMLElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode } = useThemeContext();
  const unreadCount = notifications.filter(n => !n.read).length;

  // Detecta rolagem para mudar o estilo da AppBar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      setNotificationsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error) setNotifications(data || []);
      setNotificationsLoading(false);
    };
    fetchNotifications();
    const channel = supabase
      .channel('layout:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchNotifications)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // --- AJUSTE PARA O PROBLEMA DE PLAYLISTS ---
  // Se você usar playlists em Layout, garanta que item_count é sempre número
  // Exemplo de uso (ajuste no Playlists.tsx, mas pode ser útil aqui se necessário):
  // setPlaylists((data || []).map((playlist: any) => ({
  //   ...playlist,
  //   item_count: Array.isArray(playlist.item_count) && playlist.item_count[0]
  //     ? playlist.item_count[0].count
  //     : 0,
  // })))

  useEffect(() => {
    if (user && user.id) {
      const fetchAvatar = async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        if (profile?.avatar_url) {
          const { data } = supabase.storage.from('avatar').getPublicUrl(profile.avatar_url);
          setAvatarUrl(data?.publicUrl ? data.publicUrl + `?t=${Date.now()}` : undefined);
        } else {
          setAvatarUrl(undefined);
        }
      };

      // Buscar avatar inicial
      fetchAvatar();

      // Escutar mudanças no perfil
      const channel = supabase
        .channel('layout:profile')
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles',
            filter: `id=eq.${user.id}`
          }, 
          () => {
            fetchAvatar();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setAvatarUrl(undefined);
    }
  }, [user]);

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSignOut = async () => {
    await signOut();
    handleCloseUserMenu();
    navigate('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/explore?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    if (anchorElNotif && anchorElNotif === event.currentTarget) {
      setAnchorElNotif(null);
    } else {
      setAnchorElNotif(event.currentTarget);
    }
  };
  const handleNotificationClose = () => {
    setAnchorElNotif(null);
  };
  const handleMarkNotificationRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const drawer = (
    <Box sx={{ width: 270 }}>
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}
        component={motion.div}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Logo size="small" />
        <IconButton 
          onClick={handleDrawerToggle}
          component={motion.button}
          whileTap={{ scale: 0.9 }}
        >
          <Close />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <List>
        {navItems.map((item, index) => (
          <motion.div
            key={item.text}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <ListItem disablePadding sx={{ px: 1, mb: 1 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={location.pathname === item.path}
                onClick={handleDrawerToggle}
                sx={{
                  borderRadius: '10px',
                  transition: 'all 0.2s ease-in-out',
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                  },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    transform: 'translateX(5px)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.path 
                      ? 'primary.main' 
                      : 'text.secondary',
                    transition: 'color 0.2s',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{
                    fontWeight: location.pathname === item.path ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          </motion.div>
        ))}
      </List>
      
      {/* Botão para alternar tema */}
      <List>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <ListItem disablePadding sx={{ px: 1, mb: 1 }}>
            <ListItemButton
              onClick={toggleColorMode}
              sx={{
                borderRadius: '10px',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  transform: 'translateX(5px)',
                },
              }}
            >
              <ListItemIcon
                sx={{ color: 'text.secondary', transition: 'color 0.2s' }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </ListItemIcon>
              <ListItemText 
                primary={mode === 'dark' ? "Modo Claro" : "Modo Escuro"} 
              />
            </ListItemButton>
          </ListItem>
        </motion.div>
      </List>
      
      {!user && (
        <Box sx={{ p: 2, mt: 2 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <Stack spacing={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  navigate('/auth');
                  handleDrawerToggle();
                }}
                sx={{
                  borderRadius: '8px',
                  py: 1,
                  fontWeight: 500
                }}
              >
                Entrar
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={() => {
                  navigate('/auth?signup=true');
                  handleDrawerToggle();
                }}
                sx={{
                  borderRadius: '8px',
                  py: 1,
                  fontWeight: 500
                }}
              >
                Registrar
              </Button>
            </Stack>
          </motion.div>
        </Box>
      )}
      
      {user && (
        <Box sx={{ p: 2, mt: 4 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar 
                  alt={user?.email}
                  src={avatarUrl}
                  sx={{ 
                    width: 40, 
                    height: 40,
                    border: '2px solid',
                    borderColor: 'primary.main',
                  }}
                />
                <Box>
                  {/* Lógica para exibir nome de usuário e nome completo, se pelo menos um existir */}
                  {(() => {
                    // username e full_name podem estar em user diretamente ou em user.user_metadata
                    const username = (user as any).username || user?.user_metadata?.username || '';
                    const fullName = (user as any).full_name || user?.user_metadata?.full_name || '';
                    let primary = '';
                    let secondary = '';
                    if (username && fullName && username !== fullName) {
                      primary = username;
                      secondary = fullName;
                    } else if (username) {
                      primary = username;
                    } else if (fullName) {
                      primary = fullName;
                    }
                    // Se não houver nenhum, mostra "Usuário"
                    if (!primary) {
                      return (
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }} noWrap>
                          Utilizador
                        </Typography>
                      );
                    }
                    return (
                      <>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                          {primary}
                        </Typography>
                        {secondary && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {secondary}
                          </Typography>
                        )}
                      </>
                    );
                  })()}
                </Box>
              </Stack>
            </Paper>
          </motion.div>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar 
        position="fixed"
        elevation={scrolled ? 2 : 0}
        component={motion.div}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        sx={{
          bgcolor: scrolled ? 'background.paper' : 'transparent',
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          color: scrolled 
            ? 'text.primary' 
            : mode === 'dark' 
              ? 'white' 
              : theme.palette.primary.main,
          borderBottom: scrolled ? 1 : 0,
          borderColor: 'divider',
          boxShadow: scrolled ? 1 : 0,
          transition: 'all 0.3s',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {/* Mobile Logo & Menu Icon */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
              <IconButton
                size="large"
                aria-label="menu"
                onClick={handleDrawerToggle}
                color="inherit"
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
              <Logo size="small" />
            </Box>

            {/* Desktop Logo */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, flexGrow: 0, mr: 4 }}>
              <Logo size="small" />
            </Box>

            {/* Links de navegação para desktop */}
            <Stack
              direction="row"
              spacing={2}
              sx={{
                flexGrow: 1,
                display: { xs: 'none', md: 'flex' },
                ml: 4,
              }}
            >
              {navItems.map((item, index) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Button
                    component={Link}
                    to={item.path}
                    startIcon={item.icon}
                    sx={{
                      color: 'inherit',
                      fontWeight: 500,
                      borderRadius: '8px',
                      px: 2,
                      py: 1,
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      },
                      ...(location.pathname === item.path && {
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          bottom: 0,
                          left: '50%',
                          width: '30%',
                          height: '3px',
                          backgroundColor: 'primary.main',
                          transform: 'translateX(-50%)',
                          borderRadius: '3px 3px 0 0',
                        },
                      }),
                    }}
                  >
                    {item.text}
                  </Button>
                </motion.div>
              ))}
            </Stack>

            {/* Barra de pesquisa */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <form onSubmit={handleSearch}>
                <Paper
                  sx={{
                    p: '2px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    width: { xs: 'auto', sm: 200 },
                    borderRadius: '20px',
                    mr: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 'none',
                    '&:hover': {
                      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.1)',
                    },
                  }}
                >
                  <IconButton type="submit" sx={{ p: '5px' }} aria-label="search">
                    <SearchIcon fontSize="small" />
                  </IconButton>
                  <InputBase
                    sx={{ ml: 1, flex: 1 }}
                    placeholder="Pesquisar..."
                    inputProps={{ 'aria-label': 'pesquisar' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </Paper>
              </form>
            </motion.div>

            {/* Ícones e menu do utilizador */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Notificações">
                <span>
                  <IconButton
                    color="inherit"
                    component={motion.button}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={notifications.length > 0 ? handleNotificationClick : undefined}
                    disabled={notifications.length === 0}
                    aria-label="Notificações"
                  >
                    <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="secondary">
                      <NotificationsIcon />
                    </Badge>
                  </IconButton>
                </span>
              </Tooltip>
              
              <Tooltip title="Alternar tema">
                <IconButton
                  color="inherit"
                  component={motion.button}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleColorMode}
                >
                  {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>

              {/* Menu do usuário se estiver autenticado */}
              {user ? (
                <Box sx={{ flexGrow: 0, ml: 1 }}>
                  <Tooltip title="Configurações de utilizador">
                    <IconButton 
                      onClick={handleOpenUserMenu} 
                      sx={{ p: 0 }}
                      component={motion.button}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Avatar 
                        alt={user?.email}
                        src={avatarUrl}
                        sx={{ 
                          width: 38, 
                          height: 38,
                          border: '2px solid',
                          borderColor: 'primary.main',
                        }} 
                      />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    sx={{ mt: '45px' }}
                    id="menu-appbar"
                    anchorEl={anchorElUser}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    open={Boolean(anchorElUser)}
                    onClose={handleCloseUserMenu}
                    PaperProps={{
                      elevation: 3,
                      sx: {
                        borderRadius: '12px',
                        mt: 1.5,
                        '& .MuiMenuItem-root': {
                          px: 2,
                          py: 1.5,
                          borderRadius: '8px',
                          mx: 1,
                          my: 0.5,
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem onClick={() => {
                      navigate('/profile');
                      handleCloseUserMenu();
                    }}>
                      <ListItemIcon>
                        <Person fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Perfil" />
                    </MenuItem>
                    <MenuItem onClick={() => {
                      setSettingsSidebarOpen(true);
                      handleCloseUserMenu();
                    }}>
                      <ListItemIcon>
                        <SettingsIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Configurações" />
                    </MenuItem>
                    <Divider sx={{ my: 1 }} />
                    <MenuItem onClick={handleSignOut}>
                      <ListItemIcon>
                        <LogoutIcon fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Sair" 
                        primaryTypographyProps={{ color: 'error.main' }} 
                      />
                    </MenuItem>
                  </Menu>
                </Box>
              ) : (
                // Botões de autenticação quando usuário não está logado
                <Stack direction="row" spacing={1} sx={{ ml: 1 }}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/auth')}
                      sx={{
                        borderRadius: '8px',
                        fontWeight: 500,
                        px: 2,
                        borderColor: scrolled 
                          ? 'primary.main' 
                          : mode === 'dark'
                            ? 'white'
                            : 'primary.main',
                        color: scrolled 
                          ? 'primary.main' 
                          : mode === 'dark'
                            ? 'white'
                            : 'primary.main',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                        }
                      }}
                    >
                      Entrar
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => navigate('/auth?signup=true')}
                      sx={{
                        borderRadius: '8px',
                        fontWeight: 500,
                        px: 2,
                      }}
                    >
                      Registrar
                    </Button>
                  </motion.div>
                </Stack>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 270,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <AnimatePresence>{drawer}</AnimatePresence>
      </Drawer>

      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 2, sm: 3, md: 4 },
          mt: { xs: 7, sm: 8 },
          transition: 'all 0.3s ease',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ height: '100%' }}
        >
          <Container maxWidth="xl" sx={{ height: '100%' }}>
            {children}
          </Container>
        </motion.div>
      </Box>

      {notifications.length > 0 && (
        <Menu
          anchorEl={anchorElNotif}
          open={Boolean(anchorElNotif)}
          onClose={handleNotificationClose}
          PaperProps={{ sx: { minWidth: 320, maxHeight: 400 } }}
        >
          <Typography sx={{ px: 2, pt: 1, fontWeight: 600 }}>Notificações</Typography>
          {notificationsLoading ? (
            <MenuItem disabled>Carregando...</MenuItem>
          ) : notifications.slice(0, 10).map((n) => (
            <MenuItem
              key={n.id}
              onClick={async () => {
                await handleMarkNotificationRead(n.id);
                handleNotificationClose();
                if (n.sheet_id) window.location.href = `/sheet/${n.sheet_id}`;
              }}
              sx={{
                fontWeight: n.read ? 400 : 700,
                bgcolor: !n.read ? 'rgba(25, 118, 210, 0.08)' : undefined,
                whiteSpace: 'normal',
                alignItems: 'flex-start',
                py: 1.2
              }}
            >
              {n.type === 'download' && (
                <span>O seu documento foi descarregado.</span>
              )}
              {n.type === 'rating' && (
                <span>O documento que publicou foi avaliado.</span>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {new Date(n.created_at).toLocaleString('pt-PT')}
              </Typography>
            </MenuItem>
          ))}
        </Menu>
      )}

      <SettingsSidebar
        open={settingsSidebarOpen}
        onClose={() => setSettingsSidebarOpen(false)}
      />
    </Box>
  );
}