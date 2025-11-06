import { useState, useEffect } from 'react';
import { getSupabase } from './lib/supabaseClient.ts';
import type { Session } from '@supabase/supabase-js';

import { useUser } from './contexts/UserContext.tsx';
import AuthPage from './pages/AuthPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import AssistantLayout from './layouts/AssistantLayout.tsx';
import CommunityPage from './pages/CommunityPage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import { Icon } from './components/Icon.tsx';
import SettingsPage from './pages/SettingsPage.tsx';

const parseHash = () => {
    const hash = window.location.hash;
    if (!hash || hash === '#/') return { path: 'dashboard' };
    if (hash === '#/auth') return { path: 'auth' };
    if (hash === '#/community') return { path: 'community' };
    if (hash === '#/admin') return { path: 'admin' };
    if (hash === '#/assistant/new') return { path: 'new_assistant' };
    
    const assistantMatch = hash.match(/^#\/assistant\/(.+)$/);
    if (assistantMatch && assistantMatch[1]) {
        return { path: 'assistant', id: assistantMatch[1] };
    }
    
    if (hash !== '#/') {
      window.location.hash = '#/';
    }
    return { path: 'dashboard' };
};

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [route, setRoute] = useState(parseHash());
    const [loading, setLoading] = useState(true);
    const { profile, loading: userLoading } = useUser();

    useEffect(() => {
        const supabase = getSupabase();
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        }).catch(err => {
            console.error("Error getting session:", err);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (_event === 'SIGNED_IN') {
                window.location.hash = '#/';
            }
            if (_event === 'SIGNED_OUT') {
                window.location.hash = '#/auth';
            }
            // Force a route parse on auth change to navigate correctly
            setRoute(parseHash());
        });

        const handleHashChange = () => {
            setRoute(parseHash());
        };

        window.addEventListener('hashchange', handleHashChange);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, []);

    if (loading || userLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-base-light dark:bg-dark-base-light">
                <Icon name="loader" className="w-16 h-16 animate-spin text-brand-secondary-glow"/>
            </div>
        );
    }
    
    if (!session) {
        return <AuthPage />;
    }

    // Admin guard
    if (route.path === 'admin' && profile?.role !== 'admin') {
        window.location.hash = '#/';
        return (
             <div className="flex items-center justify-center h-screen bg-base-light dark:bg-dark-base-light">
                <Icon name="loader" className="w-16 h-16 animate-spin text-brand-secondary-glow"/>
            </div>
        );
    }

    switch (route.path) {
        case 'dashboard':
            return <DashboardPage />;
        case 'assistant':
            if (route.id) {
                return <AssistantLayout assistantId={route.id} />;
            }
            window.location.hash = '#/';
            return <DashboardPage />;
        case 'new_assistant':
            return <SettingsPage onComplete={(assistantId) => window.location.hash = `#/assistant/${assistantId}`} />;
        case 'community':
            return <CommunityPage />;
        case 'admin':
            return <AdminPage />;
        default:
            window.location.hash = '#/';
            return <DashboardPage />;
    }
}
