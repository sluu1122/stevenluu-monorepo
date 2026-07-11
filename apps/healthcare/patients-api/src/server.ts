import express from 'express';
import cors from 'cors';
import { ALL_PATIENTS } from './data/patients.js';

const ALLOWED_ORIGINS = ['http://localhost:4200', 'http://localhost:4300'];

export function createServer() {
  const app = express();
  app.use(cors({ origin: ALLOWED_ORIGINS }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api/patients', (_req, res) => {
    res.json(ALL_PATIENTS);
  });

  return app;
}
