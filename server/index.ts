import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { aiRouter } from './routes/ai.js';
import { databaseRouter } from './routes/database.js';
import { apiKeysRouter } from './routes/api-keys.js';
import { deployRouter } from './routes/deploy.js';
import { exportRouter } from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Simple rate limiter (per IP, in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    entry.count++;
    if (entry.count > maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  };
}

// Rate limits: AI is expensive, be stricter
app.use('/api/ai', rateLimit(30, 60_000));
app.use('/api/db', rateLimit(60, 60_000));
app.use('/api/keys', rateLimit(20, 60_000));
app.use('/api/deploy', rateLimit(10, 60_000));
app.use('/api/export', rateLimit(10, 60_000));

// API routes
app.use('/api/ai', aiRouter);
app.use('/api/db', databaseRouter);
app.use('/api/keys', apiKeysRouter);
app.use('/api/deploy', deployRouter);
app.use('/api/export', exportRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      google: !!process.env.GOOGLE_AI_API_KEY,
    },
  });
});

// Subdomain serving: catch requests with subdomain host header
app.use((req, res, next) => {
  const host = req.hostname;
  const deployDomain = process.env.DEPLOY_DOMAIN;
  if (deployDomain && host !== deployDomain && host.endsWith(`.${deployDomain}`)) {
    const subdomain = host.replace(`.${deployDomain}`, '');
    req.url = `/api/deploy/site/${subdomain}`;
  }
  next();
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`VibeCraft API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.DEPLOY_DOMAIN) {
    console.log(`Subdomain serving: *.${process.env.DEPLOY_DOMAIN}`);
  }
});
