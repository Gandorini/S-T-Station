import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, AuthError, Session } from '@supabase/supabase-js';
import { useProfileStore } from './profileStore';

// Interfaces e tipos
interface ValidationResult {
  isValid: boolean;
  message?: string;
}

interface Profile {
  id: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  checkEmailExists: (email: string) => Promise<boolean>;
  handleGoogleCallback: () => Promise<void>;
}

// Funções de validação
const validatePassword = (password: string): ValidationResult => {
  if (password.length < 8) {
    return { isValid: false, message: 'A senha deve ter pelo menos 8 caracteres' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'A senha deve conter pelo menos uma letra maiúscula' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'A senha deve conter pelo menos uma letra minúscula' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'A senha deve conter pelo menos um número' };
  }
  // Aceita qualquer caractere especial
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { isValid: false, message: 'A senha deve conter pelo menos um caractere especial' };
  }
  return { isValid: true };
};

const validateEmail = (email: string): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, message: 'Email inválido' };
  }
  return { isValid: true };
};

// Função melhorada de tratamento de erros
const handleAuthError = (error: AuthError) => {
  const errorMessages: Record<string, string> = {
    'Invalid login credentials': 'Credenciais inválidas. Verifique seu email e senha.',
    'User already registered': 'Este email já está registrado. Por favor, faça login ou use outro email.',
    'Email not confirmed': 'Por favor, confirme seu email antes de fazer login.',
    'Invalid email': 'O email fornecido é inválido.',
    'Weak password': 'A senha fornecida é muito fraca.',
    'Email rate limit exceeded': 'Muitas tentativas. Tente novamente em alguns minutos.',
    'Network request failed': 'Erro de conexão. Verifique sua internet e tente novamente.',
    'Server error': 'Erro no servidor. Por favor, tente novamente mais tarde.',
    'Invalid user': 'Usuário não encontrado.',
    'Email link is invalid or has expired': 'O link de confirmação é inválido ou expirou.',
    'Email already confirmed': 'Este email já foi confirmado.',
    'New email is not allowed to be same as your old email': 'O novo email deve ser diferente do atual.',
    'Auth session missing!': 'Sessão expirada. Por favor, faça login novamente.',
    'Email already in use': 'Este email já está sendo usado por outra conta.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'User not found': 'Usuário não encontrado.',
    'JWT expired': 'Sua sessão expirou. Por favor, faça login novamente.',
    'Invalid JWT': 'Token inválido. Por favor, faça login novamente.',
    '422': 'Não foi possível processar a solicitação. Verifique os dados e tente novamente.'
  };

  let message = (error.message && errorMessages[error.message]) || 
                (error.status && errorMessages[error.status.toString()]) || 
                'Ocorreu um erro inesperado. Por favor, tente novamente.';

  // Adicionar mais contexto para erros de rede
  if (error.message?.includes('network') || error.message?.includes('failed to fetch')) {
    message = 'Erro de conexão. Verifique sua internet e tente novamente.';
  }

  throw new Error(message);
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  checkEmailExists: async (email: string) => {
    try {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.message);
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false
        }
      });

      if (error?.message?.includes('user not found')) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao verificar email:', error);
      return false;
    }
  },
  signUp: async (email: string, password: string) => {
    try {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.message);
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.message);
      }

      // Tenta registrar normalmente, Supabase Auth garante unicidade
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes('already registered') ||
          msg.includes('already in use') ||
          msg.includes('email exists') ||
          msg.includes('user already exists') ||
          msg.includes('duplicate key value') ||
          msg.includes('unique constraint') ||
          msg.includes('email must be unique')
        ) {
          throw new Error('Este email já está registrado. Por favor, faça login ou use outro email.');
        }
        throw error;
      }

      if (data?.user) {
        set({ user: data.user });
        // Não insere mais manualmente em profiles aqui!
        return;
      }

      throw new Error('Não foi possível completar o cadastro. Tente novamente.');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      handleAuthError(error as AuthError);
    }
  },
  signIn: async (email: string, password: string) => {
    try {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.message);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        handleAuthError(error);
      }

      if (data?.user) {
        set({ user: data.user });
      } else {
        throw new Error('Erro ao fazer login. Por favor, tente novamente.');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      handleAuthError(error as AuthError);
    }
  },
  signInWithGoogle: async () => {
    try {
      await supabase.auth.signOut();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      if (error) {
        console.error('Erro no login com Google:', error);
        handleAuthError(error);
      }
      if (!data?.url) {
        throw new Error('Não foi possível iniciar o login com Google');
      }
      window.location.href = data.url;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      handleAuthError(error as AuthError);
    }
  },
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        handleAuthError(error);
      }
      set({ user: null });
    } catch (error) {
      handleAuthError(error as AuthError);
    }
  },
  setUser: (user) => set({ user }),
  handleGoogleCallback: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      set({ user });

      // Polling para aguardar o perfil ser criado pelo trigger
      let profile = null;
      const maxAttempts = 10;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        profile = data;
        if (profile) break;
        await new Promise(res => setTimeout(res, 400));
        attempts++;
      }
      if (!profile) {
        alert('Ocorreu um erro ao criar o seu perfil. Por favor, tente novamente em alguns instantes.');
        window.location.replace('/auth');
        return;
      }
      // Se o email não estiver confirmado, vai para confirmação
      if (!user.email_confirmed_at) {
        window.location.replace('/email-confirmation');
        return;
      }
      // Se não tem username, precisa fazer setup
      if (!profile.username || profile.username.trim() === '') {
        window.location.replace('/setup');
        return;
      }
      // Se perfil está completo, vai para o app
      window.location.replace('/app');
    } catch (error) {
      window.location.replace('/auth');
    }
  }
}));

// Inicializa o estado de autenticação
let sessionCheckPromise: Promise<void> | null = null;

const initializeAuth = async () => {
  if (sessionCheckPromise) return sessionCheckPromise;

  sessionCheckPromise = supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      useAuthStore.getState().setUser(session.user);
    }
    useAuthStore.setState({ loading: false });
  }).catch(error => {
    console.error('Erro ao verificar sessão:', error);
    useAuthStore.setState({ loading: false });
  });

  return sessionCheckPromise;
};

// Inicializa a autenticação
initializeAuth();

// Monitora mudanças no estado de autenticação
supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
  if (session?.user) {
    useAuthStore.getState().setUser(session.user);
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.getState().setUser(null);
  }
});

export default useAuthStore;