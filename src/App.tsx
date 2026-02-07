import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { IndexPage } from '@/pages/Index';
import { ProjectsPage } from '@/pages/Projects';
import { AuthPage } from '@/pages/Auth';
import { SettingsPage } from '@/pages/Settings';
import { Toaster } from '@/components/ui/toaster';

type Page = 'auth' | 'projects' | 'editor' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('editor');
  const [isAuthenticated, setIsAuthenticated] = useState(true); // demo mode

  const handleAuth = () => {
    setIsAuthenticated(true);
    setCurrentPage('projects');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  const handleOpenProject = (_id: string) => {
    setCurrentPage('editor');
  };

  if (!isAuthenticated) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header onNavigate={handleNavigate} />
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
  );
}
