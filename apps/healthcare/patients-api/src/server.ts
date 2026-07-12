import express from 'express';
import cors from 'cors';
import { ALL_PATIENTS, addPatient } from './data/patients.js';
import { DIRECTORY } from './data/directory.js';
import { REFERENCE_DATA } from './data/reference.js';
import { CURRENT_USER } from './data/current-user.js';
import { getIntakeCase, updateDemographics, addInsurance, updateInsurance, deleteInsurance, addNote } from './data/intake-case.js';
import type { InsuranceInput, InsuranceRank } from './data/types.js';

const ALLOWED_ORIGINS = ['http://localhost:4200', 'http://localhost:4300'];
const VALID_RANKS: InsuranceRank[] = REFERENCE_DATA.insuranceRanks;

function validateInsurancePayload(body: unknown): { error: string } | { value: InsuranceInput } {
  const { rank, provider, planType, payerId, groupNumber, memberId, authType, effectiveDate, expirationDate } =
    (body ?? {}) as Record<string, unknown>;
  if (!provider || !payerId) {
    return { error: 'provider and payerId are required' };
  }
  if (!VALID_RANKS.includes(rank as InsuranceRank)) {
    return { error: `rank must be one of ${VALID_RANKS.join(', ')}` };
  }
  return { value: { rank, provider, planType, payerId, groupNumber, memberId, authType, effectiveDate, expirationDate } as InsuranceInput };
}

export function createServer() {
  const app = express();
  app.use(cors({ origin: ALLOWED_ORIGINS }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api/patients', (_req, res) => {
    res.json(ALL_PATIENTS);
  });

  app.post('/api/patients', (req, res) => {
    const { name, dob, sex, payer } = req.body ?? {};
    if (!name || !dob) {
      return res.status(400).json({ error: 'name and dob are required' });
    }
    res.status(201).json(addPatient({ name, dob, sex: sex || 'O', payer: payer || 'Aetna' }));
  });

  app.get('/api/me', (_req, res) => {
    res.json(CURRENT_USER);
  });

  app.get('/api/reference', (_req, res) => {
    res.json(REFERENCE_DATA);
  });

  app.get('/api/directory', (_req, res) => {
    res.json(DIRECTORY);
  });

  app.get('/api/intake-case', (_req, res) => {
    res.json(getIntakeCase());
  });

  app.put('/api/intake-case/demographics', (req, res) => {
    const { name, dob, sex, mrn, phone, email, address } = req.body ?? {};
    if (!name || !dob || !mrn) {
      return res.status(400).json({ error: 'name, dob, and mrn are required' });
    }
    res.json(updateDemographics({ name, dob, sex, mrn, phone, email, address }));
  });

  app.post('/api/intake-case/insurances', (req, res) => {
    const result = validateInsurancePayload(req.body);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json(addInsurance(result.value));
  });

  app.put('/api/intake-case/insurances/:id', (req, res) => {
    const result = validateInsurancePayload(req.body);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    const updated = updateInsurance(req.params.id, result.value);
    if (!updated) {
      return res.status(404).json({ error: `insurance ${req.params.id} not found` });
    }
    res.json(updated);
  });

  app.delete('/api/intake-case/insurances/:id', (req, res) => {
    const updated = deleteInsurance(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: `insurance ${req.params.id} not found` });
    }
    res.json(updated);
  });

  app.post('/api/intake-case/notes', (req, res) => {
    const { category, text } = req.body ?? {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'note text is required' });
    }
    res.status(201).json(addNote({ category: category || 'Clinical', text: String(text).trim() }));
  });

  return app;
}
