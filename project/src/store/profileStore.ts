import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User } from '../types/database';

interface ProfileState {
  profile: User | null;
  profileLoading: boolean;
  profileError: string | null;
  
  // Ações
  fetchProfile: (userId: string) => Promise<User | null>;
  updateProfile: (profileData: Partial<User>) => Promise<{ success: boolean; error: string | null }>;
  resetStore: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  profileLoading: false,
  profileError: null,
  
  fetchProfile: async (userId: string) => {
    set({ profileLoading: true, profileError: null });
    try {
      // Buscar perfil do utilizador
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      set({ profile: data as User, profileLoading: false });
      return data as User;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar perfil';
      console.error('Erro ao buscar perfil:', error);
      set({ profileError: errorMessage, profileLoading: false });
      return null;
    }
  },
  
  updateProfile: async (profileData: Partial<User>) => {
    try {
      // Verificar se temos o ID do utilizador
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        return { success: false, error: 'Usuário não autenticado' };
      }
      // Atualizar perfil no banco de dados
      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', userId);
      if (error) {
        return { success: false, error: error.message || 'Erro ao atualizar perfil' };
      }
      // Atualizar estado local
      set(state => ({
        profile: state.profile ? { ...state.profile, ...profileData } : null
      }));
      return { success: true, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      console.error('Erro ao atualizar perfil:', error);
      return { success: false, error: errorMessage };
    }
  },
  
  resetStore: () => {
    set({
      profile: null,
      profileLoading: false,
      profileError: null
    });
  }
}));