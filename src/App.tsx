import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { IndexPage } from '@/pages/Index';
import { ProjectsPage } from '@/pages/Projects';
import { AuthPage } from '@/pages/Auth';
import { SettingsPage } from '@/pages/Settings';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import { useChatStore } from '@/stores/chat';
import { Loader2 } from 'lucide-react';

type Page = 'auth' | 'projects' | 'editor' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('editor');
  const { user, loading, initialized, initialize, signOut } = useAuthStore();
  const { loadProjects, currentProjectId } = useProjectStore();
  const { loadMessages } = useChatStore();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  useEffect(() => {
    if (currentProjectId) {
      loadMessages(currentProjectId);
    }
  }, [currentProjectId]);

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  const handleOpenProject = (id: string) => {
    useProjectStore.getState().setCurrentProject(id);
    setCurrentPage('editor');
  };

  const handleSignOut = async () => {
    await signOut();
    setCurrentPage('auth');
  };

  // Show loading spinner while auth initializes
  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage />;
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col overflow-hidden">
        <Header onNavigate={handleNavigate} onSignOut={handleSignOut} />
        <main className="flex-1 overflow-hidden">
          {currentPage === 'projects' && (
            <ProjectsPage onOpenProject={handleOpenProject} />
          )}
          {currentPage === 'editor' && <IndexPage />}
          {currentPage === 'settings' && (
            <SettingsPage onBack={() => setCurrentPage('editor')} />
          )}
        </main>
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}
