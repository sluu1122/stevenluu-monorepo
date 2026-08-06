import { describe, expect, it } from 'vitest';
import { buildGridCsv } from './exportGridCsv';
import type { AccountBucket } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

const bucket: AccountBucket = {
  id: 'b1',
  label: 'Brokerage, Joint',
  country: 'CA',
  kind: 'CA_NON_REGISTERED',
  taxTreatment: 'taxable',
  startingBalance: 0,
};

function row(overrides: Partial<LedgerYearRow> = {}): LedgerYearRow {
  return {
    year: 2030,
    age: 50,
    yearsToOrInRetirement: 0,
    isRetired: true,
    spendingNominal: 1000,
    spendingReal: 1000,
    incomes: [],
    benefits: [],
    accountStart: { b1: 100 },
    withdrawals: {},
    contributions: {},
    growth: {},
    accountEnd: { b1: 100 },
    cashBufferReplenishment: 0,
    meltdownWithdrawalTotal: 0,
    requiredDistributionTotal: 0,
    taxesPaid: { federal: 0, stateOrProvincial: 0, total: 0 },
    totalNetWorth: 100,
    overriddenFields: [],
    audit: { steps: [] },
    ...overrides,
  };
}

/** Reads the file the way a spreadsheet would, so quoted labels survive the round trip. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { cells.push(cur); cur = ''; }
    else cur += char;
  }
  cells.push(cur);
  return cells;
}

function parse(csv: string) {
  const [headerLine, ...dataLines] = csv.split('\n');
  return { header: parseCsvLine(headerLine), rows: dataLines.map(parseCsvLine) };
}

// The default: displaying in the scenario's own currency, so nothing converts.
const identityMoney = { currency: 'CAD' as const, convert: (n: number) => n };

describe('buildGridCsv', () => {
  it('prints a tax total that equals its own printed components', () => {
    // Half-cent components: rounding each independently sends the printed
    // federal and state up while the true total rounds down, so a reader
    // summing the columns disagrees with the total column by a cent.
    const federal = 100.005;
    const stateOrProvincial = 200.005;
    const rows = [row({ taxesPaid: { federal, stateOrProvincial, total: federal + stateOrProvincial } })];

    const { header, rows: parsed } = parse(buildGridCsv(rows, { buckets: [bucket], viewLabel: 'Person 1', money: identityMoney }));
    const at = (name: string) => Number(parsed[0][header.indexOf(name)]);

    expect(at('FederalTax') + at('StateOrProvincialTax')).toBe(at('TotalTax'));
  });

  it('quotes a label containing a comma so the column count survives', () => {
    const csv = buildGridCsv([row()], { buckets: [bucket], viewLabel: 'Person 1', money: identityMoney });
    // The raw line must quote it...
    expect(csv.split('\n')[0]).toContain('"Brokerage, Joint Start"');
    // ...and a correct reader must recover the label and the column alignment.
    const { header, rows: parsed } = parse(csv);
    expect(header).toContain('Brokerage, Joint Start');
    expect(parsed[0].length).toBe(header.length);
  });

  it('labels a jointly-held account even when no owner labels are supplied', () => {
    // A single person's export still has to say which accounts are joint:
    // those carry household Start/End but only this person's flows.
    const csv = buildGridCsv([row()], { buckets: [bucket], viewLabel: 'Person 1', money: identityMoney, sharedBucketIds: new Set(['b1']) });
    expect(csv.split('\n')[0]).toContain('Shared · Brokerage, Joint Start');
  });

  it('exports all five legs of the year so a reader can reconcile a balance', () => {
    const csv = buildGridCsv([row()], { buckets: [bucket], viewLabel: 'Person 1', money: identityMoney });
    const header = csv.split('\n')[0];
    for (const leg of ['Start', 'Withdrawal', 'Contribution', 'Growth', 'End']) {
      expect(header).toContain(`Brokerage, Joint ${leg}`);
    }
  });
});
