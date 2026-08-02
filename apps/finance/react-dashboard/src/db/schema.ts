import { pgTable, text, integer, numeric, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * Phase 2 scaffolding only - no live connection, no drizzle-kit migration
 * run against a real database. Field shapes mirror engine/schema.ts's Zod
 * schemas closely enough that a future Postgres-backed ScenarioRepository
 * is a thin mapping layer, not a redesign.
 */

export const scenarios = pgTable('scenarios', {
  id: text('id').primaryKey(),
  userId: text('user_id'), // nullable - forward-looking for future auth
  name: text('name').notNull(),
  country: text('country').notNull(), // 'US' | 'CA'
  currency: text('currency').notNull(), // 'USD' | 'CAD'
  exchangeRateUsdToCad: numeric('exchange_rate_usd_to_cad').notNull(),
  birthYear: integer('birth_year').notNull(),
  planningEndAge: integer('planning_end_age').notNull(),
  retirementStartYear: integer('retirement_start_year'),
  annualSpendingRealAtRetirement: numeric('annual_spending_real_at_retirement').notNull(),
  taxConfig: jsonb('tax_config').notNull(),
  inflation: jsonb('inflation').notNull(),
  incomeSources: jsonb('income_sources').notNull(),
  benefits: jsonb('benefits').notNull(),
  schemaVersion: integer('schema_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const accountBuckets = pgTable('account_buckets', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id')
    .notNull()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  country: text('country').notNull(),
  kind: text('kind').notNull(),
  taxTreatment: text('tax_treatment').notNull(),
  startingBalance: numeric('starting_balance').notNull(),
  preRetirementReturnPct: numeric('pre_retirement_return_pct').notNull(),
  postRetirementReturnPct: numeric('post_retirement_return_pct').notNull(),
  annualContributionWhileWorking: numeric('annual_contribution_while_working'),
  isCashBuffer: boolean('is_cash_buffer').notNull().default(false),
});

/**
 * Waterfall order and the cash-buffer rule are modeled as swappable rule
 * rows (ruleType + jsonb config) rather than hardcoded columns, so future
 * rule types don't need another migration.
 */
export const ruleConfigs = pgTable('rule_configs', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id')
    .notNull()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  ruleType: text('rule_type').notNull(), // 'waterfall' | 'cashBuffer'
  config: jsonb('config').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const gridOverrides = pgTable('grid_overrides', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id')
    .notNull()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  field: text('field').notNull(),
  value: numeric('value').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
