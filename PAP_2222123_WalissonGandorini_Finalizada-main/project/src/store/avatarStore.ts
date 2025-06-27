import { create } from 'zustand';

interface AvatarStore {
  avatarUrl: string | undefined;
  setAvatarUrl: (url: string | undefined) => void;
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  avatarUrl: undefined,
  setAvatarUrl: (url) => set({ avatarUrl: url }),
}));
