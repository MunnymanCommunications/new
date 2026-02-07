import React, { useState } from 'react';
import {
  Database,
  GitBranch,
  Rocket,
  Zap,
  ChevronDown,
  Settings,
  FolderOpen,
  Plus,
  Moon,
  Sun,
  User,
  LogOut,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { useProjectStore } from '@/stores/project';
import { useChatStore } from '@/stores/chat';

interface HeaderProps {
  onNavigate: (page: string) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showSupabaseDialog, setShowSupabaseDialog] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);

  const { projects, currentProjectId, createProject, setCurrentProject, integrations } =
    useProjectStore();
  const { credits } = useChatStore();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  const creditPercent = (credits.remaining / credits.total) * 100;

  return (
    <TooltipProvider>
      <header className="h-14 border-b border-border glass-strong flex items-center justify-between px-4 z-50">
        {/* Left section: Logo + Project */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('projects')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text hidden sm:inline">VibeCraft</span>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 max-w-[200px]">
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="truncate">{currentProject?.name || 'Select Project'}</span>
                <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => setCurrentProject(project.id)}
                  className={project.id === currentProjectId ? 'bg-accent' : ''}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  {project.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowNewProject(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center section: Integration buttons */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={integrations.supabase.connected ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => setShowSupabaseDialog(true)}
              >
                <Database className="w-4 h-4" />
                <span className="hidden md:inline">Supabase</span>
                {integrations.supabase.connected && (
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {integrations.supabase.connected
                ? `Connected to ${integrations.supabase.projectName}`
                : 'Connect Supabase'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={integrations.github.connected ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => setShowGitHubDialog(true)}
              >
                <GitBranch className="w-4 h-4" />
                <span className="hidden md:inline">GitHub</span>
                {integrations.github.connected && (
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {integrations.github.connected
                ? `Synced with ${integrations.github.branch}`
                : 'Connect GitHub'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowDeployDialog(true)}
              >
                <Rocket className="w-4 h-4" />
                <span className="hidden md:inline">Deploy</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deploy your app</TooltipContent>
          </Tooltip>
        </div>

        {/* Right section: Credits + User */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 cursor-pointer">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium">{credits.remaining}</span>
                <Progress value={creditPercent} className="w-16 h-1.5" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {credits.remaining} of {credits.total} credits remaining ({credits.plan} plan)
            </TooltipContent>
          </Tooltip>

          <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <div className="font-medium">Demo User</div>
                  <div className="text-xs text-muted-foreground">demo@vibecraft.dev</div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <CreditCard className="w-4 h-4 mr-2" />
                Billing
                <Badge variant="secondary" className="ml-auto text-xs">
                  {credits.plan}
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate('settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Give your project a name to get started. You can always change this later.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="My Awesome App"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supabase Connect Dialog */}
      <Dialog open={showSupabaseDialog} onOpenChange={setShowSupabaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-500" />
                Connect Supabase
              </div>
            </DialogTitle>
            <DialogDescription>
              Connect your Supabase project to enable database, auth, storage, and edge functions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {integrations.supabase.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-green-500">
                    Connected to {integrations.supabase.projectName}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    useProjectStore.getState().disconnectSupabase();
                    setShowSupabaseDialog(false);
                  }}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Click the button below to authenticate with Supabase and select your project.
                </p>
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    useProjectStore.getState().connectSupabase('demo-id', 'my-project');
                    setShowSupabaseDialog(false);
                  }}
                >
                  <Database className="w-4 h-4" />
                  Connect with Supabase
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* GitHub Connect Dialog */}
      <Dialog open={showGitHubDialog} onOpenChange={setShowGitHubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Connect GitHub
              </div>
            </DialogTitle>
            <DialogDescription>
              Two-way sync with GitHub. Changes auto-commit and you can pull external updates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {integrations.github.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-green-500">
                    Synced with {integrations.github.branch}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    useProjectStore.getState().disconnectGitHub();
                    setShowGitHubDialog(false);
                  }}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  useProjectStore.getState().connectGitHub('https://github.com/user/repo', 'main');
                  setShowGitHubDialog(false);
                }}
              >
                <GitBranch className="w-4 h-4" />
                Connect with GitHub
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deploy Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                Deploy Your App
              </div>
            </DialogTitle>
            <DialogDescription>
              Choose a deployment provider to publish your app to production.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <button className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left group">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Vercel</div>
                  <div className="text-sm text-muted-foreground">
                    Automatic deployments with preview URLs
                  </div>
                </div>
                <Badge variant="secondary">Recommended</Badge>
              </div>
            </button>
            <button className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left group">
              <div>
                <div className="font-medium">Netlify</div>
                <div className="text-sm text-muted-foreground">
                  Deploy with continuous delivery
                </div>
              </div>
            </button>
            <button className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left group">
              <div>
                <div className="font-medium">Custom Domain</div>
                <div className="text-sm text-muted-foreground">
                  Configure a custom domain for your app
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
