import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { ICD_CODES } from './data/icd-codes.js';

// Sliding-window rate limiter: 60 req / 60 s per IP
const rateLimitWindow = 60_000;
const rateLimitMax    = 60;
const rateLimitMap    = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now  = Date.now();
  const hits  = (rateLimitMap.get(ip) ?? []).filter(t => now - t < rateLimitWindow);
  if (hits.length >= rateLimitMax) return true;
  hits.push(now);
  rateLimitMap.set(ip, hits);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of rateLimitMap) {
    if (!hits.some(t => now - t < rateLimitWindow)) rateLimitMap.delete(ip);
  }
}, rateLimitWindow).unref();

export function createServer() {
  const app = express();

  app.use(cors({ origin: [...config.allowedOrigins] }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/icd/search', (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (isRateLimited(ip)) { res.status(429).json({ error: 'Too many requests' }); return; }

    const q     = String(req.query['q'] ?? '').toLowerCase().trim();
    if (q.length > 100) { res.status(400).json({ error: 'Query too long' }); return; }
    const limit = Math.min(Number(req.query['limit'] ?? 8), 20);

    const results = q
      ? ICD_CODES.filter(c =>
          c.code.toLowerCase().startsWith(q) || c.description.toLowerCase().includes(q)
        ).slice(0, limit)
      : ICD_CODES.slice(0, limit);

    res.json(results);
  });

  return app;
}
