import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../middleware/auth.js';

const router = Router();

function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(url, key);
}

// POST /api/deploy/publish - Publish a project to a subdomain
router.post('/publish', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { projectId, subdomain } = req.body;

  if (!projectId) {
    res.status(400).json({ error: 'projectId is required' });
    return;
  }

  // Validate subdomain format
  const cleanSub = (subdomain || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63);
  if (!cleanSub || cleanSub.length < 3) {
    res.status(400).json({ error: 'Subdomain must be at least 3 characters (letters, numbers, hyphens)' });
    return;
  }

  try {
    const supabase = getServiceClient();

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projErr || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Check subdomain availability
    const { data: existing } = await supabase
      .from('published_sites')
      .select('id, user_id')
      .eq('subdomain', cleanSub)
      .single();

    if (existing && existing.user_id !== userId) {
      res.status(409).json({ error: 'Subdomain is already taken' });
      return;
    }

    // Load project files
    const { data: files } = await supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', projectId);

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Project has no files to deploy' });
      return;
    }

    // Generate a self-contained HTML build from the project files
    const indexHtml = buildStaticSite(files, project.name);

    // Upsert the published site
    const { error: upsertErr } = await supabase.from('published_sites').upsert({
      project_id: projectId,
      user_id: userId,
      subdomain: cleanSub,
      index_html: indexHtml,
      build_output: JSON.stringify(files.map((f: { path: string }) => f.path)),
      is_active: true,
      last_published_at: new Date().toISOString(),
    }, { onConflict: 'project_id' });

    if (upsertErr) {
      res.status(500).json({ error: upsertErr.message });
      return;
    }

    // Update project with subdomain
    await supabase.from('projects').update({ subdomain: cleanSub }).eq('id', projectId);

    // Record deployment
    await supabase.from('deployments').insert({
      project_id: projectId,
      provider: 'subdomain',
      status: 'live',
      subdomain: cleanSub,
      url: `https://${cleanSub}.${process.env.DEPLOY_DOMAIN || 'localhost'}`,
      completed_at: new Date().toISOString(),
    });

    const deployUrl = `https://${cleanSub}.${process.env.DEPLOY_DOMAIN || 'localhost'}`;

    res.json({
      success: true,
      url: deployUrl,
      subdomain: cleanSub,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/deploy/site/:subdomain - Serve a published site (used by reverse proxy)
router.get('/site/:subdomain', async (req: Request, res: Response) => {
  const { subdomain } = req.params;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('published_sites')
      .select('index_html, project_id')
      .eq('subdomain', subdomain.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      res.status(404).send('<!DOCTYPE html><html><body><h1>Site not found</h1><p>This subdomain has not been published yet.</p></body></html>');
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data.index_html);
  } catch {
    res.status(500).send('Internal server error');
  }
});

// DELETE /api/deploy/unpublish/:projectId - Unpublish a site
router.delete('/unpublish/:projectId', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { projectId } = req.params;

  try {
    const supabase = getServiceClient();
    await supabase.from('published_sites')
      .update({ is_active: false })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    await supabase.from('projects').update({ subdomain: null }).eq('id', projectId).eq('user_id', userId);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/deploy/status/:projectId - Get deployment status
router.get('/status/:projectId', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { projectId } = req.params;

  try {
    const supabase = getServiceClient();

    const { data: site } = await supabase
      .from('published_sites')
      .select('subdomain, is_active, last_published_at')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    const { data: deployments } = await supabase
      .from('deployments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      published: site?.is_active || false,
      subdomain: site?.subdomain || null,
      lastPublished: site?.last_published_at || null,
      domain: process.env.DEPLOY_DOMAIN || 'localhost',
      deployments: deployments || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

function buildStaticSite(files: Array<{ path: string; content: string }>, projectName: string): string {
  const appFile = files.find((f) => f.path === 'src/App.tsx') || files.find((f) => f.path.endsWith('App.tsx'));
  const cssFile = files.find((f) => f.path === 'src/index.css') || files.find((f) => f.path.endsWith('.css'));

  const appContent = appFile?.content || '<div>No App component found</div>';
  const cssContent = cssFile?.content || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${cssContent.replace(/@tailwind\s+\w+;/g, '')}</style>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
${appContent}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(typeof App !== 'undefined' ? App : (typeof default_1 !== 'undefined' ? default_1 : () => React.createElement('div', null, 'App loaded')), null));
  </script>
</body>
</html>`;
}

export { router as deployRouter };
