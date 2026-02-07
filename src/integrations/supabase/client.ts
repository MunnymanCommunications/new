// Supabase client configuration
// In production, this would use @supabase/supabase-js

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function createSupabaseClient(config: SupabaseConfig) {
  return {
    url: config.url,
    anonKey: config.anonKey,
    auth: {
      signIn: async (email: string, _password: string) => {
        console.log('Supabase auth: signing in', email);
        return { user: { id: 'demo', email }, error: null };
      },
      signUp: async (email: string, _password: string) => {
        console.log('Supabase auth: signing up', email);
        return { user: { id: 'demo', email }, error: null };
      },
      signOut: async () => {
        console.log('Supabase auth: signing out');
        return { error: null };
      },
    },
    from: (table: string) => ({
      select: () => ({
        data: [],
        error: null,
        then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [], error: null }),
      }),
      insert: (data: unknown) => {
        console.log(`Supabase: inserting into ${table}`, data);
        return { data, error: null };
      },
      update: (data: unknown) => ({
        eq: (_col: string, _val: string) => {
          console.log(`Supabase: updating ${table}`, data);
          return { data, error: null };
        },
      }),
      delete: () => ({
        eq: (_col: string, _val: string) => {
          console.log(`Supabase: deleting from ${table}`);
          return { data: null, error: null };
        },
      }),
    }),
  };
}

// Placeholder client for demo mode
export const supabase = createSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key',
});
