import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { aiRouter } from './routes/ai.js';
import { databaseRouter } from './routes/database.js';
import { apiKeysRouter } from './routes/api-keys.js';
import { deployRouter } from './routes/deploy.js';
import { exportRouter } from './routes/export.js';
import { initLogger, logger, getRecentLogs, getErrorSummary } from './lib/error-logger.js';
import { toolTracker } from './lib/tool-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize logger early
initLogger({ persist: process.env.NODE_ENV === 'production' });

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
      logger.warn('rate_limit', `Rate limit exceeded for ${ip}`, {
        details: { ip, count: entry.count, maxRequests },
      });
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  };
}

// Rate limits
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

// Health check with diagnostics
app.get('/api/health', (_req, res) => {
  const errorSummary = getErrorSummary();
  const toolSummary = toolTracker.getSummary();

  res.json({
    status: errorSummary.recentErrors.length > 5 ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    providers: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      google: !!process.env.GOOGLE_AI_API_KEY,
    },
    errors: {
      recent: errorSummary.total,
      byCategory: errorSummary.byCategory,
    },
    tools: {
      active: toolSummary.active,
      totalExecuted: toolSummary.totalExecuted,
      successRate: toolSummary.successRate,
    },
  });
});

// Diagnostics endpoint (admin only in production — for now open in dev)
app.get('/api/diagnostics/logs', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.API_KEY_ENCRYPTION_SECRET) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  const level = req.query.level as string | undefined;
  const category = req.query.category as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  res.json({
    logs: getRecentLogs({
      level: level as any,
      category: category as any,
      limit: Math.min(limit, 200),
    }),
    summary: getErrorSummary(),
    tools: toolTracker.getSummary(),
  });
});

// Subdomain serving
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

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.fatal('system', `Unhandled express error: ${err.message}`, { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// Catch unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.fatal('system', 'Unhandled promise rejection', { error: reason });
});

process.on('uncaughtException', (err) => {
  logger.fatal('system', `Uncaught exception: ${err.message}`, { error: err });
  // Give time for the log to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

app.listen(PORT, () => {
  logger.info('system', `VibeCraft API server running on port ${PORT}`);
  logger.info('system', `Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.DEPLOY_DOMAIN) {
    logger.info('system', `Subdomain serving: *.${process.env.DEPLOY_DOMAIN}`);
  }

  // Log available providers at startup
  const providers = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    google: !!process.env.GOOGLE_AI_API_KEY,
  };
  const available = Object.entries(providers).filter(([, v]) => v).map(([k]) => k);
  const missing = Object.entries(providers).filter(([, v]) => !v).map(([k]) => k);

  if (available.length > 0) {
    logger.info('system', `AI providers ready: ${available.join(', ')}`);
  }
  if (missing.length > 0) {
    logger.warn('system', `AI providers without platform keys: ${missing.join(', ')} (users can still provide their own keys)`);
  }
  if (!process.env.API_KEY_ENCRYPTION_SECRET) {
    logger.warn('system', 'API_KEY_ENCRYPTION_SECRET not set — user API key storage will not work');
  }
});
