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

// POST /api/keys/save - Save an encrypted API key
router.post('/save', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { provider, apiKey } = req.body;

  if (!provider || !apiKey) {
    res.status(400).json({ error: 'provider and apiKey are required' });
    return;
  }

  if (!['anthropic', 'openai', 'google'].includes(provider)) {
    res.status(400).json({ error: 'Invalid provider. Must be anthropic, openai, or google' });
    return;
  }

  // Validate key format
  const validations: Record<string, (k: string) => boolean> = {
    anthropic: (k) => k.startsWith('sk-ant-'),
    openai: (k) => k.startsWith('sk-'),
    google: (k) => k.length > 20,
  };

  if (!validations[provider](apiKey)) {
    res.status(400).json({ error: `Invalid API key format for ${provider}` });
    return;
  }

  // Create a hint (first 8 chars + last 4 chars)
  const keyHint = apiKey.slice(0, 8) + '...' + apiKey.slice(-4);

  // Encrypt key with platform secret before storing
  const encryptionKey = process.env.API_KEY_ENCRYPTION_SECRET || 'vibecraft-default-key';
  const encrypted = Buffer.from(
    apiKey.split('').map((c: string, i: number) =>
      String.fromCharCode(c.charCodeAt(0) ^ encryptionKey.charCodeAt(i % encryptionKey.length))
    ).join('')
  ).toString('base64');

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from('user_api_keys').upsert({
      user_id: userId,
      provider,
      encrypted_key: encrypted,
      key_hint: keyHint,
      is_valid: true,
    }, { onConflict: 'user_id,provider' });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, hint: keyHint });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/keys/list - List user's saved API keys (hints only)
router.get('/list', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('provider, key_hint, is_valid, updated_at')
      .eq('user_id', userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ keys: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/keys/:provider - Delete an API key
router.delete('/:provider', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { provider } = req.params;

  try {
    const supabase = getServiceClient();
    await supabase.from('user_api_keys').delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Internal: decrypt a user's API key for a provider
export async function decryptUserApiKey(userId: string, provider: string): Promise<string | null> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_valid', true)
      .single();

    if (!data?.encrypted_key) return null;

    const encryptionKey = process.env.API_KEY_ENCRYPTION_SECRET || 'vibecraft-default-key';
    const decoded = Buffer.from(data.encrypted_key, 'base64').toString();
    return decoded.split('').map((c: string, i: number) =>
      String.fromCharCode(c.charCodeAt(0) ^ encryptionKey.charCodeAt(i % encryptionKey.length))
    ).join('');
  } catch {
    return null;
  }
}

export { router as apiKeysRouter };
