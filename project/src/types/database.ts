export interface MusicSheet {
  id: string;
  title: string;
  composer: string;
  instrument: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  file_url: string;
  file_type?: string;
  created_at: string;
  user_id: string;
  midi_url?: string;
  mei_url?: string;
  mei_public_url?: string;
  conversion_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  conversion_error?: string;
  scales?: string[];
  likes?: number;
  downloads?: number;
  comments?: number;
  is_public?: boolean;
  isLiked?: boolean;
  likes_count?: number;
  downloads_count?: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  musical_genres?: string[];
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  email_confirmed: boolean;
  last_sign_in?: string;
  last_sign_out?: string;
  last_activity?: string;
  is_active?: boolean;
  login_count?: number;
  display_name?: string;
  preferences?: {
    theme?: 'light' | 'dark';
    notifications?: boolean;
    language?: string;
  };
}

export interface Comment {
  id: string;
  sheet_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id?: string;
  profiles?: {
    username: string;
    avatar_url: string;
  };
}

export interface Rating {
  sheet_id: string;
  user_id: string;
  score: number;
  created_at: string;
}

export interface Like {
  sheet_id: string;
  user_id: string;
  created_at: string;
}

export interface Follower {
  user_id: string;
  follower_id: string;
  created_at: string;
}

export interface CommentLike {
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface Profile extends User {}