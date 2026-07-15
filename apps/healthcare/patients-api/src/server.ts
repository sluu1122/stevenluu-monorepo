import express from 'express';
import cors from 'cors';
import { ALL_PATIENTS, addPatient, assignPatient } from './data/patients.js';
import { DIRECTORY } from './data/directory.js';
import { REFERENCE_DATA } from './data/reference.js';
import { CURRENT_USER } from './data/current-user.js';
import { getIntakeCase, updateDemographics, addInsurance, updateInsurance, deleteInsurance, addNote, addCaseForPatient } from './data/intake-case.js';
import type { InsuranceInput, InsuranceRank } from './data/types.js';

const ALLOWED_ORIGINS = (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:4200,http://localhost:4300').split(',');
const VALID_RANKS: InsuranceRank[] = REFERENCE_DATA.insuranceRanks;

function buildNewPatientInsurances(payer: string, rawInsurances: unknown): InsuranceInput[] {
  const entries = Array.isArray(rawInsurances) ? rawInsurances : [];
  return entries.map((ins, i) => ({
    rank:           VALID_RANKS[i] ?? VALID_RANKS[VALID_RANKS.length - 1],
    provider:       (ins as { payer?: string })?.payer || payer,
    planType:       'PPO — Preferred',
    payerId:        '',
    groupNumber:    '',
    memberId:       '',
    authType:       'Inpatient',
    effectiveDate:  '',
    expirationDate: '',
  }));
}

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
    const { name, dob, sex, mrn, phone, email, payer, insurances } = req.body ?? {};
    if (!name || !dob) {
      return res.status(400).json({ error: 'name and dob are required' });
    }
    const resolvedPayer = payer || 'Aetna';
    const patient = addPatient({ name, dob, sex: sex || 'O', payer: resolvedPayer });
    addCaseForPatient(patient, {
      mrn:   mrn   || '',
      phone: phone || '',
      email: email || '',
      insurances: buildNewPatientInsurances(resolvedPayer, insurances),
    });
    res.status(201).json(patient);
  });

  app.put('/api/patients/:id/assignee', (req, res) => {
    const { assignee } = req.body ?? {};
    if (typeof assignee !== 'string' || !assignee.trim()) {
      return res.status(400).json({ error: 'assignee is required' });
    }
    if (!REFERENCE_DATA.providers.includes(assignee)) {
      return res.status(400).json({ error: `assignee must be one of ${REFERENCE_DATA.providers.join(', ')}` });
    }
    const updated = assignPatient(req.params.id, assignee);
    if (!updated) {
      return res.status(404).json({ error: `patient ${req.params.id} not found` });
    }
    res.json(updated);
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

  app.get('/api/intake-case/:patientId', (req, res) => {
    const intakeCase = getIntakeCase(req.params.patientId);
    if (!intakeCase) {
      return res.status(404).json({ error: `intake case for ${req.params.patientId} not found` });
    }
    res.json(intakeCase);
  });

  app.put('/api/intake-case/:patientId/demographics', (req, res) => {
    const { name, dob, sex, mrn, phone, email, address } = req.body ?? {};
    if (!name || !dob || !mrn) {
      return res.status(400).json({ error: 'name, dob, and mrn are required' });
    }
    const updated = updateDemographics(req.params.patientId, { name, dob, sex, mrn, phone, email, address });
    if (!updated) {
      return res.status(404).json({ error: `intake case for ${req.params.patientId} not found` });
    }
    res.json(updated);
  });

  app.post('/api/intake-case/:patientId/insurances', (req, res) => {
    const result = validateInsurancePayload(req.body);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    const updated = addInsurance(req.params.patientId, result.value);
    if (!updated) {
      return res.status(404).json({ error: `intake case for ${req.params.patientId} not found` });
    }
    res.status(201).json(updated);
  });

  app.put('/api/intake-case/:patientId/insurances/:id', (req, res) => {
    const result = validateInsurancePayload(req.body);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    const updated = updateInsurance(req.params.patientId, req.params.id, result.value);
    if (!updated) {
      return res.status(404).json({ error: `insurance ${req.params.id} not found` });
    }
    res.json(updated);
  });

  app.delete('/api/intake-case/:patientId/insurances/:id', (req, res) => {
    const updated = deleteInsurance(req.params.patientId, req.params.id);
    if (!updated) {
      return res.status(404).json({ error: `insurance ${req.params.id} not found` });
    }
    res.json(updated);
  });

  app.post('/api/intake-case/:patientId/notes', (req, res) => {
    const { category, text } = req.body ?? {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'note text is required' });
    }
    const updated = addNote(req.params.patientId, { category: category || 'Clinical', text: String(text).trim() });
    if (!updated) {
      return res.status(404).json({ error: `intake case for ${req.params.patientId} not found` });
    }
    res.status(201).json(updated);
  });

  return app;
}
