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

// GET /api/export/:projectId - Download project as a JSON bundle
router.get('/:projectId', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { projectId } = req.params;

  try {
    const supabase = getServiceClient();

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projErr || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const { data: files } = await supabase
      .from('project_files')
      .select('path, content, language')
      .eq('project_id', projectId);

    const bundle = {
      name: project.name,
      description: project.description,
      exportedAt: new Date().toISOString(),
      settings: project.settings,
      files: (files || []).map((f: { path: string; content: string; language: string }) => ({
        path: f.path,
        content: f.content,
        language: f.language,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '-')}.json"`);
    res.json(bundle);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export { router as exportRouter };
