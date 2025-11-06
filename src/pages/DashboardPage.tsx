import { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabaseClient.ts';
import type { Assistant } from '../types.ts';
import { Icon } from '../components/Icon.tsx';
import { AssistantCard } from '../components/AssistantCard.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { Navigation } from '../components/Navigation.tsx';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';

export default function DashboardPage() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useUser();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useLocalStorage('is_nav_collapsed', false);

  useEffect(() => {
    const supabase = getSupabase();
    const fetchAssistants = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('assistants')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching assistants:', error);
        } else if (data) {
          setAssistants(data as Assistant[]);
        }
      }
      setLoading(false);
    };

    fetchAssistants();
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Icon name="loader" className="w-12 h-12 animate-spin text-brand-secondary-glow"/>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-base-light dark:bg-dark-base-light overflow-hidden">
        <Navigation
            currentPage="dashboard"
            onNavigate={() => {}}
            isMobileOpen={isMobileNavOpen}
            onMobileClose={() => setIsMobileNavOpen(false)}
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(prev => !prev)}
            mode="dashboard"
        />
        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto relative">
             <button 
                className="md:hidden absolute top-4 left-4 z-50 p-2 bg-white/70 rounded-full shadow-md dark:bg-dark-base-medium/70"
                onClick={() => setIsMobileNavOpen(true)}
            >
                <Icon name="dashboard" className="w-6 h-6 text-text-primary dark:text-dark-text-primary"/>
            </button>
            <div className="max-w-6xl mx-auto w-full">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-text-primary dark:text-dark-text-primary">Your Assistants</h1>
                    <div className="flex items-center gap-4">
                        {profile?.role === 'admin' && (
                            <a href="#/admin" className="bg-brand-secondary-glow/80 hover:bg-brand-secondary-glow text-on-brand font-bold py-2 px-4 rounded-full flex items-center transition-all duration-300">
                                <Icon name="admin" className="w-5 h-5 mr-2" />
                                Admin Panel
                            </a>
                        )}
                        <button onClick={handleLogout} className="bg-base-light hover:bg-base-medium text-text-primary font-bold py-2 px-4 rounded-full dark:bg-dark-base-medium dark:hover:bg-dark-border-color dark:text-dark-text-primary">Logout</button>
                    </div>
                </header>
            
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <a href="#/assistant/new" className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-base-medium rounded-2xl text-text-secondary hover:bg-base-light hover:border-brand-secondary-glow transition-all duration-300 min-h-[200px] dark:border-dark-border-color dark:text-dark-text-secondary dark:hover:bg-dark-base-medium">
                        <Icon name="plus" className="w-10 h-10 mb-2"/>
                        <span className="font-semibold">Create New Assistant</span>
                    </a>

                    {assistants.map(assistant => (
                        <AssistantCard key={assistant.id} assistant={assistant} />
                    ))}
                </div>
            </div>
        </main>
    </div>
  );
}