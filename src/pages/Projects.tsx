import React, { useState } from 'react';
import {
  Plus,
  FolderOpen,
  Clock,
  MoreHorizontal,
  Trash2,
  ArrowRight,
  Zap,
  Sparkles,
  Layout,
  ShoppingCart,
  BarChart3,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/project';

interface ProjectsPageProps {
  onOpenProject: (id: string) => void;
}

const TEMPLATES = [
  {
    name: 'Landing Page',
    description: 'Beautiful landing page with hero, features, and CTA',
    icon: Layout,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'E-Commerce',
    description: 'Product catalog with cart and checkout flow',
    icon: ShoppingCart,
    color: 'from-green-500 to-emerald-500',
  },
  {
    name: 'Dashboard',
    description: 'Admin dashboard with charts and data tables',
    icon: BarChart3,
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Social App',
    description: 'Social platform with profiles and feeds',
    icon: Users,
    color: 'from-orange-500 to-red-500',
  },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProjectsPage({ onOpenProject }: ProjectsPageProps) {
  const { projects, createProject, deleteProject, setCurrentProject } = useProjectStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const handleCreate = async () => {
    if (newProjectName.trim()) {
      const id = await createProject(newProjectName.trim(), newProjectDesc);
      setNewProjectName('');
      setNewProjectDesc('');
      setShowNewProject(false);
      if (id) onOpenProject(id);
    }
  };

  const handleTemplateCreate = async (name: string, description: string) => {
    const id = await createProject(name, description);
    if (id) onOpenProject(id);
  };

  const handleOpenProject = (id: string) => {
    setCurrentProject(id);
    onOpenProject(id);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            AI-Powered App Builder
          </div>
          <h1 className="text-4xl font-bold mb-3">
            What would you like to <span className="gradient-text">build</span> today?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Describe your app in plain English and watch it come to life. Build full-stack
            applications 20x faster with AI.
          </p>
        </div>

        {/* Quick Start Templates */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Start from a template</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => handleTemplateCreate(template.name, template.description)}
                className="group relative p-6 rounded-xl border border-border bg-card hover:border-primary/50 transition-all text-left overflow-hidden"
              >
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center mb-3`}
                >
                  <template.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold mb-1">{template.name}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
                <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </button>
            ))}
          </div>
        </div>

        {/* Projects List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Projects</h2>
            <Button onClick={() => setShowNewProject(true)} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-1">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first project or start from a template above
              </p>
              <Button onClick={() => setShowNewProject(true)} size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => handleOpenProject(project.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(project.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-semibold mb-1">{project.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(project.updated_at)}
                    </span>
                    <Badge
                      variant={project.status === 'active' ? 'secondary' : 'default'}
                      className="text-[10px]"
                    >
                      {project.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Start with a name and description. You can always change these later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                placeholder="My Awesome App"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                placeholder="A brief description of your project"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newProjectName.trim()}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
