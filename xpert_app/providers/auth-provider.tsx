import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type AppRole = 'teacher' | 'student';

type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  email: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (fullName: string, email: string, password: string, role: AppRole) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
    if (!currentUser) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('users')
      .select('id, full_name, role, email')
      .eq('id', currentUser.id)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    void refreshProfile().finally(() => setLoading(false));
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });
    return () => subscription.subscription.unsubscribe();
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    configured: isSupabaseConfigured,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error?.message ?? null;
    },
    signUp: async (fullName, email, password, role) => {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), role } },
      });
      return error?.message ?? null;
    },
    signOut: async () => { await supabase.auth.signOut(); },
    refreshProfile,
  }), [loading, profile, refreshProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
