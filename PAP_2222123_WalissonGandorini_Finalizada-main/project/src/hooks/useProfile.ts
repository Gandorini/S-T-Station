import { useProfileStore } from '../store/profileStore';

export const useProfile = () => {
  const { 
    profile, 
    profileLoading, 
    fetchProfile,
    updateProfile,
    resetStore
  } = useProfileStore();

  return {
    profile,
    profileLoading,
    fetchProfile,
    updateProfile,
    resetStore
  };
};