import React, { useState, useEffect } from 'react';
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
  Loader2,
  ExternalLink,
  Download,
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
import { publishProject, unpublishProject, getDeployStatus, getExportUrl, type DeployStatus } from '@/lib/deploy-service';

interface HeaderProps {
  onNavigate: (page: string) => void;
  onSignOut: () => void;
}

export function Header({ onNavigate, onSignOut }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showDeploy, setShowDeploy] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<DeployStatus | null>(null);
  const [deployError, setDeployError] = useState('');

  const { projects, currentProjectId, createProject, setCurrentProject } =
    useProjectStore();
  const { profile, user } = useAuthStore();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  useEffect(() => {
    if (showDeploy && currentProjectId) {
      getDeployStatus(currentProjectId).then((status) => {
        setDeployStatus(status);
        if (status?.subdomain) setSubdomain(status.subdomain);
      });
    }
  }, [showDeploy, currentProjectId]);

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

  const handlePublish = async () => {
    if (!currentProjectId || !subdomain.trim()) return;
    setDeploying(true);
    setDeployError('');
    const result = await publishProject(currentProjectId, subdomain.trim());
    setDeploying(false);
    if (result.success) {
      const status = await getDeployStatus(currentProjectId);
      setDeployStatus(status);
    } else {
      setDeployError(result.error || 'Failed to publish');
    }
  };

  const handleUnpublish = async () => {
    if (!currentProjectId) return;
    setDeploying(true);
    await unpublishProject(currentProjectId);
    setDeploying(false);
    setDeployStatus(null);
    setSubdomain('');
  };

  const handleExport = () => {
    if (!currentProjectId) return;
    window.open(getExportUrl(currentProjectId), '_blank');
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
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowDeploy(true)}>
                <Rocket className="w-4 h-4" />
                <span className="hidden md:inline">Deploy</span>
                {deployStatus?.published && <span className="w-2 h-2 rounded-full bg-green-400" />}
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

      {/* Deploy Dialog */}
      <Dialog open={showDeploy} onOpenChange={setShowDeploy}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Project</DialogTitle>
            <DialogDescription>
              Publish your project to a live subdomain or export it as a bundle.
            </DialogDescription>
          </DialogHeader>

          {!currentProjectId ? (
            <p className="text-sm text-muted-foreground">Select a project first.</p>
          ) : (
            <div className="space-y-4">
              {deployStatus?.published ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-sm font-medium text-green-400">Live</span>
                    <a
                      href={`https://${deployStatus.subdomain}.${deployStatus.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {deployStatus.subdomain}.{deployStatus.domain}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {deployStatus.lastPublished && (
                    <p className="text-xs text-muted-foreground">
                      Last published: {new Date(deployStatus.lastPublished).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handlePublish} disabled={deploying} className="flex-1">
                      {deploying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                      Republish
                    </Button>
                    <Button variant="destructive" onClick={handleUnpublish} disabled={deploying}>
                      Unpublish
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Subdomain</label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="my-app"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handlePublish()}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        .{deployStatus?.domain || 'yourdomain.com'}
                      </span>
                    </div>
                  </div>
                  {deployError && (
                    <p className="text-sm text-destructive">{deployError}</p>
                  )}
                  <Button onClick={handlePublish} disabled={deploying || subdomain.length < 3} className="w-full">
                    {deploying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                    Publish
                  </Button>
                </div>
              )}

              <div className="border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={handleExport} className="w-full gap-2">
                  <Download className="w-4 h-4" />
                  Export Project as JSON
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
