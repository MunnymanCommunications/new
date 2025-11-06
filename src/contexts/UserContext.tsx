import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabase } from '../lib/supabaseClient.ts';
import type { Profile } from '../types.ts';
import type { User } from '@supabase/supabase-js';

interface UserContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    const fetchUserAndProfile = async () => {
        setLoading(true);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);

        if (authUser) {
            const { data: userProfile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();
            
            if (error) {
                console.error("Error fetching profile:", error);
            } else {
                setProfile(userProfile as Profile);
            }
        }
        setLoading(false);
    };

    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            fetchUserAndProfile();
        }
        if (event === 'SIGNED_OUT') {
            setProfile(null);
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = { user, profile, loading };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
