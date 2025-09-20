import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Divider,
  Alert,
  IconButton,
  InputAdornment,
  useTheme,
  useMediaQuery,
  Link as MuiLink,
  Dialog,
} from '@mui/material';
import { Visibility, VisibilityOff, Email, HelpOutline } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

interface AuthFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export default function Auth() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp, signIn } = useAuthStore();

  const [isSignUp, setIsSignUp] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('signup') === 'true';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  // Estados de erro para cada campo
  const [fieldErrors, setFieldErrors] = useState<{
    email: string | null;
    password: string | null;
    confirmPassword: string | null;
  }>({
    email: null,
    password: null,
    confirmPassword: null,
  });

  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showPasswordInfo, setShowPasswordInfo] = useState(false);

  // Memoizar handlers para evitar recriações desnecessárias
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    let loadingMessage: HTMLDivElement | null = null;

    try {
      if (isSignUp) {
        try {
          await signUp(formData.email, formData.password);
          setIsSignUp(false);
          setFormData(prev => ({...prev, confirmPassword: ''}));
          setError('Registo realizado com sucesso!');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.';
          // Adaptação: tratar todos os casos de email duplicado, conforme Supabase pode retornar
          if (
            errorMessage.toLowerCase().includes('already registered') ||
            errorMessage.toLowerCase().includes('already in use') ||
            errorMessage.toLowerCase().includes('email exists') ||
            errorMessage.toLowerCase().includes('user already exists') ||
            errorMessage.toLowerCase().includes('duplicate key value') ||
            errorMessage.toLowerCase().includes('unique constraint') ||
            errorMessage.toLowerCase().includes('email must be unique')
          ) {
            setError('Este email já está registado. Por favor, faça login ou utilize outro email.');
          } else {
            setError(errorMessage);
          }
          setLoading(false);
          return;
        }
      } else {
        // Feedback imediato
        loadingMessage = document.createElement('div');
        loadingMessage.style.position = 'fixed';
        loadingMessage.style.top = '50%';
        loadingMessage.style.left = '50%';
        loadingMessage.style.transform = 'translate(-50%, -50%)';
        loadingMessage.style.background = 'rgba(0, 0, 0, 0.8)';
        loadingMessage.style.color = 'white';
        loadingMessage.style.padding = '20px';
        loadingMessage.style.borderRadius = '8px';
        loadingMessage.style.zIndex = '9999';
        loadingMessage.textContent = 'Entrando...';
        document.body.appendChild(loadingMessage);

        await signIn(formData.email, formData.password);
        navigate('/');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.';
      setError(errorMessage);
      
      if (errorMessage.includes('email não foi verificado') || 
          errorMessage.includes('email ainda não foi verificado')) {
        setShowResetPassword(true);
        setResetEmail(formData.email);
      }
    } finally {
      setLoading(false);
      // Garantir que a mensagem de loading seja sempre removida
      if (loadingMessage && document.body.contains(loadingMessage)) {
        document.body.removeChild(loadingMessage);
      }
    }
  }, [formData, isSignUp, signIn, signUp, navigate]);

  // Função para validar campos individuais
  const validateField = (name: string, value: string) => {
    const newErrors = { ...fieldErrors };
    
    switch (name) {
      case 'email':
        if (!value) {
          newErrors.email = 'O email é obrigatório';
        } else if (!value.includes('@')) {
          newErrors.email = 'Email inválido';
        } else {
          newErrors.email = null;
        }
        break;
        
      case 'password':
        if (!value) {
          newErrors.password = 'A palavra-passe é obrigatória';
        } else if (value.length < 8) {
          newErrors.password = 'A palavra-passe deve ter pelo menos 8 caracteres';
        } else {
          newErrors.password = null;
        }
        
        // Revalidar confirmação de senha quando a senha é alterada
        if (isSignUp && formData.confirmPassword) {
          if (value !== formData.confirmPassword) {
            newErrors.confirmPassword = 'As palavras-passe não coincidem';
          } else {
            newErrors.confirmPassword = null;
          }
        }
        break;
        
      case 'confirmPassword':
        if (isSignUp) {
          if (!value) {
            newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
          } else if (value !== formData.password) {
            newErrors.confirmPassword = 'As palavras-passe não coincidem';
          } else {
            newErrors.confirmPassword = null;
          }
        }
        break;
    }
    
    setFieldErrors(newErrors);
  };

  const validateForm = () => {
    // Validar todos os campos
    validateField('email', formData.email);
    validateField('password', formData.password);
    if (isSignUp) {
      validateField('confirmPassword', formData.confirmPassword);
    }
    
    // Verificar se há erros
    const hasErrors = 
      fieldErrors.email || 
      fieldErrors.password || 
      (isSignUp && fieldErrors.confirmPassword);
      
    if (hasErrors) {
      setError('Por favor, corrija os erros no formulário.');
      return false;
    }
    
    return true;
  };

  // Limpar erros quando mudar entre login e registro
  useEffect(() => {
    setError(null);
    setFieldErrors({
      email: null,
      password: null,
      confirmPassword: null
    });
  }, [isSignUp]);

  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetStatus({ error: 'Por favor, informe seu email' });
      return;
    }
    
    setIsResetting(true);
    setResetStatus(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetStatus({
        success: 'Email de recuperação enviado. Por favor, verifique sua caixa de entrada.'
      });
    } catch (err) {
      setResetStatus({
        error: err instanceof Error ? err.message : 'Erro ao enviar email de recuperação'
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ height: '100%' }}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%' }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom align="center">
              {isSignUp ? 'Criar Conta' : 'Entrar'}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {showResetPassword ? (
              <Box component="form" onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }}>
                <Typography variant="body1" gutterBottom>
                  Digite seu email para receber as instruções de recuperação de senha:
                </Typography>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  margin="normal"
                  required
                />
                {resetStatus?.error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {resetStatus.error}
                  </Alert>
                )}
                {resetStatus?.success && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    {resetStatus.success}
                  </Alert>
                )}
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleResetPassword}
                    disabled={isResetting}
                  >
                    {isResetting ? 'Enviando...' : 'Enviar Email de Recuperação'}
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setShowResetPassword(false)}
                  >
                    Voltar
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  margin="normal"
                  required
                  error={!!fieldErrors.email}
                  helperText={fieldErrors.email}
                />
                {/* Ícone de ajuda acima do campo palavra-passe */}
                {isSignUp && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, mt: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => setShowPasswordInfo(true)}
                      sx={{ p: 0, mr: 1 }}
                    >
                      <HelpOutline fontSize="small" color="primary" />
                    </IconButton>
                  </Box>
                )}
                <TextField
                  fullWidth
                  label="Palavra-passe"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  margin="normal"
                  required
                  error={!!fieldErrors.password}
                  helperText={fieldErrors.password}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                {/* Modal de requisitos da palavra-passe */}
                <Dialog open={showPasswordInfo} onClose={() => setShowPasswordInfo(false)}>
                  <Box sx={{ p: 3, maxWidth: 350 }}>
                    <Typography variant="h6" gutterBottom>Requisitos da palavra-passe</Typography>
                    <Typography variant="body2" color="text.secondary">
                    ♪ - A palavra-passe deve ter pelo menos 8 caracteres,{<br/>}♫ - pelo menos uma letra maiúscula,{<br/>}♩ - pelo menos uma letra minúscula, {<br/>}♬ - pelo menos um número,{<br/>}♭ - um caractere especial.
                    </Typography>
                    <Button onClick={() => setShowPasswordInfo(false)} sx={{ mt: 2 }} variant="contained" fullWidth>Fechar</Button>
                  </Box>
                </Dialog>
                {isSignUp && (
                  <TextField
                    fullWidth
                    label="Confirmar Palavra-passe"
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    margin="normal"
                    required
                    error={!!fieldErrors.confirmPassword}
                    helperText={fieldErrors.confirmPassword}
                  />
                )}
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  disabled={loading}
                  sx={{ mt: 3, mb: 2 }}
                >
                  {loading ? 'A processar...' : isSignUp ? 'Registar' : 'Entrar'}
                </Button>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    fullWidth
                    variant="text"
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? 'Já tem conta? Entre' : 'Não tem conta? Registe-se'}
                  </Button>
                  {!isSignUp && (
                    <Button
                      fullWidth
                      variant="text"
                      onClick={() => setShowResetPassword(true)}
                    >
                      Esqueceu a senha?
                    </Button>
                  )}
                </Stack>
              </Box>
            )}
          </Paper>
        </motion.div>
      </Box>
    </Container>
  );
}