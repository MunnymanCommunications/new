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
import { useAuthStore } from '@/stores/auth';

interface HeaderProps {
  onNavigate: (page: string) => void;
  onSignOut: () => void;
}

export function Header({ onNavigate, onSignOut }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const { projects, currentProjectId, createProject, setCurrentProject } =
    useProjectStore();
  const { profile, user } = useAuthStore();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleCreateProject = async () => {
    if (newProjectName.trim()) {
      await createProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  const creditsRemaining = profile?.credits_remaining ?? 0;
  const creditsTotal = profile?.credits_total ?? 100;
  const creditPercent = creditsTotal > 0 ? (creditsRemaining / creditsTotal) * 100 : 0;
  const plan = profile?.plan ?? 'free';

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
              <Button variant="outline" size="sm" className="gap-1.5">
                <Database className="w-4 h-4" />
                <span className="hidden md:inline">Database</span>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Project database (auto-managed)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <GitBranch className="w-4 h-4" />
                <span className="hidden md:inline">GitHub</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Connect GitHub</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
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
                <span className="text-sm font-medium">{creditsRemaining}</span>
                <Progress value={creditPercent} className="w-16 h-1.5" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {creditsRemaining} of {creditsTotal} credits remaining ({plan} plan)
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
                  <div className="font-medium">{profile?.name || 'User'}</div>
                  <div className="text-xs text-muted-foreground">
                    {user?.email || ''}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <CreditCard className="w-4 h-4 mr-2" />
                Billing
                <Badge variant="secondary" className="ml-auto text-xs">
                  {plan}
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate('settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onSignOut}>
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
    </TooltipProvider>
  );
}
