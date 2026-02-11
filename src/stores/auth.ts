import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  plan: string;
  credits_remaining: number;
  credits_total: number;
  credits_reset_at: string;
}

interface AuthState {
  user: SupabaseUser | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: 'github' | 'google') => Promise<void>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateCredits: (amount: number) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, session, loading: false, initialized: true });
        await get().loadProfile();
      } else {
        set({ loading: false, initialized: true });
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ user: session?.user || null, session });
        if (session?.user) {
          await get().loadProfile();
        } else {
          set({ profile: null });
        }
      });
    } catch {
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    return { error: error?.message || null };
  },

  signUp: async (email, password, name) => {
    set({ loading: true });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || email.split('@')[0] } },
    });
    set({ loading: false });
    return { error: error?.message || null };
  },

  signInWithOAuth: async (provider) => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },

  loadProfile: async () => {
    const user = get().user;
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      set({ profile: data as Profile });
    }
  },

  updateCredits: (amount) => {
    set((state) => {
      if (!state.profile) return state;
      const newCredits = Math.max(0, state.profile.credits_remaining - amount);
      supabase
        .from('profiles')
        .update({ credits_remaining: newCredits })
        .eq('id', state.profile.id)
        .then(() => {});
      return {
        profile: { ...state.profile, credits_remaining: newCredits },
      };
    });
  },
}));
