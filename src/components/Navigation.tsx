import React from 'react';
import { Icon } from './Icon.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import { useUser } from '../contexts/UserContext.tsx';

type Page = 'conversation' | 'memory' | 'history' | 'settings' | 'dashboard' | 'community' | 'admin';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mode: 'assistant' | 'dashboard';
  assistantName?: string;
  assistantAvatar?: string;
}

const NavItem: React.FC<{
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}> = ({ icon, label, isActive, onClick, isCollapsed }) => (
  <li>
    <button
      onClick={onClick}
      className={`flex items-center w-full text-left p-3 rounded-lg transition-all duration-300 group ${
        isActive
          ? 'bg-white/80 shadow-sm dark:bg-dark-base-medium'
          : 'text-text-secondary hover:bg-white/70 hover:text-text-primary dark:text-dark-text-secondary dark:hover:bg-dark-base-medium/70 dark:hover:text-dark-text-primary'
      } ${isCollapsed ? 'justify-center' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className={`p-2 rounded-lg transition-all duration-300 ${isActive ? 'bg-gradient-to-br from-brand-secondary-glow to-brand-tertiary-glow text-on-brand shadow-md' : 'bg-base-light text-text-secondary group-hover:bg-white dark:bg-dark-base-light dark:text-dark-text-secondary dark:group-hover:bg-dark-base-medium'}`}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <span className={`font-semibold whitespace-nowrap pl-4 transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>{label}</span>
    </button>
  </li>
);

export const Navigation: React.FC<NavigationProps> = ({ 
    currentPage, 
    onNavigate, 
    isMobileOpen, 
    onMobileClose,
    isCollapsed,
    onToggleCollapse,
    mode,
    assistantName, 
    assistantAvatar, 
}) => {
  const { user } = useUser();

  const getInitials = (email?: string) => {
    if (!email) return '?';
    return email[0].toUpperCase();
  };
    
  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        onClick={onMobileClose}
        className={`fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      
      <nav className={`fixed md:relative top-0 left-0 h-full z-50 bg-gradient-to-b from-white/80 to-white/60 backdrop-blur-xl border-r border-border-color p-4 flex flex-col transition-all duration-300 ease-in-out 
        dark:from-dark-base-medium/80 dark:to-dark-base-medium/60 dark:border-dark-border-color
        md:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        ${isCollapsed ? 'md:w-24' : 'md:w-72'}`}>
        
        <header className="flex items-center gap-3 p-2 mb-8 relative">
          {mode === 'assistant' ? (
              <>
                <img src={assistantAvatar} alt="Assistant Avatar" className={`flex-shrink-0 w-12 h-12 rounded-full object-cover shadow-md transition-transform duration-300 ${isCollapsed ? 'scale-90' : 'scale-100'}`}/>
                <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
                    <h1 className="text-xl font-bold text-text-primary dark:text-dark-text-primary whitespace-nowrap">{assistantName}</h1>
                    <p className="text-sm text-text-secondary dark:text-dark-text-secondary whitespace-nowrap">Personal Assistant</p>
                </div>
              </>
          ) : (
              <>
                {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="User Avatar" className={`flex-shrink-0 w-12 h-12 rounded-full object-cover shadow-md transition-transform duration-300 ${isCollapsed ? 'scale-90' : 'scale-100'}`}/>
                ) : (
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full shadow-md transition-transform duration-300 ${isCollapsed ? 'scale-90' : 'scale-100'} bg-brand-secondary-glow flex items-center justify-center`}>
                        <span className="text-2xl font-bold text-on-brand">{getInitials(user?.email)}</span>
                    </div>
                )}
                <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
                    <h1 className="text-lg font-bold text-text-primary dark:text-dark-text-primary whitespace-nowrap truncate" title={user?.email}>{user?.email}</h1>
                    <p className="text-sm text-text-secondary dark:text-dark-text-secondary whitespace-nowrap">Main Dashboard</p>
                </div>
              </>
          )}

          <button onClick={onMobileClose} className="md:hidden absolute top-0 right-0 p-2 text-text-secondary hover:text-text-primary dark:text-dark-text-secondary dark:hover:text-dark-text-primary">
            <Icon name="close" className="w-6 h-6"/>
          </button>
        </header>

        <ul className="space-y-2 flex-grow">
            <NavItem icon="dashboard" label="Dashboard" isActive={currentPage === 'dashboard'} onClick={() => window.location.hash = '#/'} isCollapsed={isCollapsed} />
            <NavItem icon="users" label="Community" isActive={currentPage === 'community'} onClick={() => window.location.hash = '#/community'} isCollapsed={isCollapsed} />
            {mode === 'assistant' && (
              <>
                <NavItem icon="chat" label="Conversation" isActive={currentPage === 'conversation'} onClick={() => onNavigate('conversation' as Page)} isCollapsed={isCollapsed} />
                <NavItem icon="brain" label="Memory" isActive={currentPage === 'memory'} onClick={() => onNavigate('memory' as Page)} isCollapsed={isCollapsed} />
                <NavItem icon="history" label="History" isActive={currentPage === 'history'} onClick={() => onNavigate('history' as Page)} isCollapsed={isCollapsed} />
                <NavItem icon="settings" label="Settings" isActive={currentPage === 'settings'} onClick={() => onNavigate('settings' as Page)} isCollapsed={isCollapsed} />
              </>
            )}
        </ul>

        <div className="pt-4 border-t border-border-color/50 dark:border-dark-border-color/50">
          <ThemeToggle />
          <button 
              onClick={onToggleCollapse} 
              className="hidden md:flex items-center w-full p-3 rounded-lg text-text-secondary hover:bg-white/70 hover:text-text-primary dark:text-dark-text-secondary dark:hover:bg-dark-base-medium/70 dark:hover:text-dark-text-primary justify-center"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
              <Icon name={isCollapsed ? 'chevronRight' : 'chevronLeft'} className="w-5 h-5" />
          </button>
          <div className={`text-center text-xs text-text-tertiary dark:text-dark-text-tertiary pt-4 transition-all duration-300 overflow-hidden ${isCollapsed ? 'h-0 opacity-0' : 'h-auto opacity-100'}`}>
              <p>AI Assistant v1.0</p>
              <p>
                Powered by{' '}
                <a
                  href="https://harveyio.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-secondary-glow hover:underline"
                >
                  Harvey iO
                </a>
              </p>
          </div>
        </div>
      </nav>
    </>
  );
};