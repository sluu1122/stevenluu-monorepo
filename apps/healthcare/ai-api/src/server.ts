import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { streamChat, completeChat, type ChatMessage } from './ollama';

const DEFAULT_SYSTEM =
  'You are a healthcare billing expert. When asked for an electronic payor ID, ' +
  'respond with ONLY the numeric payor ID — no text, punctuation, or explanation. ' +
  'Example: 60054';

interface CdsProcedure {
  id:    string;
  cpts:  string[];
  text?: string;
}

interface CdsDiagnosis {
  icds: string[];
  text?: string;
}

interface CdsInsurance {
  id:    string;
  payor: string;
  scope: string;
}

export interface MnResult {
  procId:    string;
  payorId:   string;
  pass:      boolean;
  rationale: string;
}

interface SuggestBody {
  prompt:  string;
  system?: string;
  think?:  boolean;
}

function isMnResult(v: unknown): v is MnResult {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['procId']    === 'string' &&
    typeof r['payorId']   === 'string' &&
    typeof r['pass']      === 'boolean' &&
    typeof r['rationale'] === 'string'
  );
}

// Sliding-window rate limiter: 10 req / 60 s per IP
const rateLimitWindow = 60_000;
const rateLimitMax    = 10;
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

// Behind a Cloudflare Tunnel the socket peer is always cloudflared, so req.ip is
// the same for every external caller. Prefer the real client IP from Cloudflare's
// forwarded headers so the limiter is per-visitor, not global.
function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? 'unknown';
}

function sendSse(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createServer(): express.Application {
  const app = express();

  app.use(cors({ origin: [...config.allowedOrigins] }));
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', model: config.model });
  });

  app.post('/api/suggest', async (req: Request, res: Response) => {
    if (isRateLimited(clientIp(req))) {
      res.status(429).json({ error: 'Too many requests — please wait before retrying' });
      return;
    }

    const { prompt, system, think = false } = req.body as SuggestBody;

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const messages: ChatMessage[] = [
      { role: 'system', content: system ?? DEFAULT_SYSTEM },
      { role: 'user',   content: prompt },
    ];

    try {
      for await (const chunk of streamChat(config.model, messages, think)) {
        sendSse(res, { text: chunk });
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      sendSse(res, { error: err instanceof Error ? err.message : 'Stream error' });
    } finally {
      res.end();
    }
  });

  app.post('/api/cds/medical-necessity', async (req: Request, res: Response) => {
    if (isRateLimited(clientIp(req))) {
      res.status(429).json({ error: 'Too many requests — please wait before retrying' });
      return;
    }

    const { procedures, diagnosis, insurances } = req.body as {
      procedures: CdsProcedure[];
      diagnosis:  CdsDiagnosis;
      insurances: CdsInsurance[];
    };

    if (!procedures?.length || !diagnosis?.icds?.length || !insurances?.length) {
      res.status(400).json({ error: 'procedures, diagnosis.icds, and insurances are required' });
      return;
    }

    const procList = procedures.map(p =>
      `- ID: ${p.id}, CPTs: ${p.cpts.join(', ')}${p.text ? `, Description: ${p.text}` : ''}`
    ).join('\n');

    const payorList = insurances.map(ins =>
      `- ID: ${ins.id}, Payor: ${ins.payor}, Scope: ${ins.scope}`
    ).join('\n');

    const prompt = `You are a clinical medical necessity reviewer. Evaluate the following procedures against each insurance payor.

DIAGNOSIS:
ICD-10 codes: ${diagnosis.icds.join(', ')}${diagnosis.text ? `\nClinical description: ${diagnosis.text}` : ''}

PROCEDURES:
${procList}

INSURANCE PAYORS:
${payorList}

For each combination of procedure ID and payor ID, return a JSON array with this exact shape:
[
  { "procId": "<procedure id>", "payorId": "<payor id>", "pass": true|false, "rationale": "<one sentence>" }
]

Rules:
- "pass" is true if the CPT codes are medically justified by the ICD-10 diagnosis codes
- "rationale" must be a single concise sentence explaining the determination
- Return ONLY the JSON array, no markdown, no explanation outside the array`;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a clinical decision support system. Respond only with valid JSON.' },
      { role: 'user',   content: prompt },
    ];

    try {
      const raw = await completeChat(config.model, messages);

      // Strip markdown code fences if present, then extract JSON array
      const stripped   = raw.replace(/```(?:json)?\n?/g, '').trim();
      const jsonMatch  = stripped.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        res.status(502).json({ error: 'Model did not return valid JSON array', raw });
        return;
      }

      const validPayorIds = new Set(insurances.map(i => i.id));
      const parsed: unknown[] = JSON.parse(jsonMatch[0]);
      const results = parsed
        .filter(isMnResult)
        .filter(r => validPayorIds.has(r.payorId));

      if (results.length === 0) {
        res.status(502).json({ error: 'Model returned no valid result entries' });
        return;
      }

      res.json({ results });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'CDS request failed' });
    }
  });

  return app;
}
