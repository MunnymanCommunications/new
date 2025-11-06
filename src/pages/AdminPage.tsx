import { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabaseClient.ts';
import type { AppLog, Profile } from '../types.ts';
import { Icon } from '../components/Icon.tsx';
import { StatCard } from '../components/Admin/StatCard.tsx';
import { LogsTable } from '../components/Admin/LogsTable.tsx';

export default function AdminPage() {
    const [logs, setLogs] = useState<AppLog[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const supabase = getSupabase();
            
            const { data: logsData, error: logsError } = await supabase
                .from('app_logs')
                .select('*, profiles(email), assistants(name)')
                .order('created_at', { ascending: false })
                .limit(500);

            if (logsError) {
                console.error("Error fetching logs:", logsError);
                setError("Failed to fetch activity logs.");
            } else {
                setLogs(logsData as AppLog[]);
            }

            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('*');

            if (profilesError) {
                console.error("Error fetching profiles:", profilesError);
                setError("Failed to fetch user profiles.");
            } else {
                setProfiles(profilesData as Profile[]);
            }

            setLoading(false);
        };
        fetchData();
    }, []);
    
    const now = new Date();
    const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const sessionsToday = logs.filter(log => 
        log.event_type === 'SESSION_START' && new Date(log.created_at).getTime() >= today_start
    ).length;

    const errorsToday = logs.filter(log => 
        log.event_type === 'API_ERROR' && new Date(log.created_at).getTime() >= today_start
    ).length;
    
    const totalSessionTimeToday = logs.reduce((acc, log) => {
        if (log.event_type === 'SESSION_END' && new Date(log.created_at).getTime() >= today_start && log.metadata?.duration_ms) {
            return acc + log.metadata.duration_ms;
        }
        return acc;
    }, 0);
    const totalMinutes = Math.round(totalSessionTimeToday / 60000);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Icon name="loader" className="w-12 h-12 animate-spin text-brand-secondary-glow"/>
            </div>
        );
    }

    if (error) {
         return (
            <div className="flex flex-col items-center justify-center h-screen text-center">
                <Icon name="error" className="w-16 h-16 text-danger mb-4" />
                <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">{error}</h1>
                <a href="#/" className="mt-4 text-brand-secondary-glow hover:underline">Go to Dashboard</a>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full min-h-screen">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Icon name="admin" className="w-10 h-10 text-brand-secondary-glow"/>
                    <div>
                        <h1 className="text-4xl font-bold text-text-primary dark:text-dark-text-primary">Admin Dashboard</h1>
                        <p className="text-text-secondary dark:text-dark-text-secondary mt-1">Application usage and activity logs.</p>
                    </div>
                </div>
                <a href="#/" className="bg-base-light hover:bg-base-medium text-text-primary font-bold py-2 px-4 rounded-full dark:bg-dark-base-medium dark:hover:bg-dark-border-color dark:text-dark-text-primary">Your Dashboard</a>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard icon="users" label="Total Users" value={profiles.length} />
                <StatCard icon="chat" label="Sessions Today" value={sessionsToday} />
                <StatCard icon="history" label="Session Time Today" value={`${totalMinutes} min`} />
                <StatCard icon="error" label="Errors Today" value={errorsToday} />
            </div>

            {/* Logs Table */}
            <div className="glassmorphic p-4 sm:p-6 rounded-2xl">
                <h2 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary mb-4">Recent Activity</h2>
                <LogsTable logs={logs} />
            </div>

        </div>
    );
}
