import { useState, type ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/table';
import { Pencil } from 'lucide-react';
import { LedgerColumnGroupHeader } from './LedgerColumnGroupHeader';
import { RetirementStartRadioGroup, RetirementStartRadioItem } from './RetirementStartRadio';
import { CellOverrideBadge } from './CellOverrideBadge';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/format';
import type { AccountBucket, GridOverride, Scenario } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

interface LedgerColumn {
  id: string;
  header: ReactNode;
  render: (row: LedgerYearRow) => ReactNode;
}

interface LedgerColumnGroup {
  key: string;
  label: string;
  columns: LedgerColumn[];
}

const ASSET_GROUP_LABEL: Record<AccountBucket['taxTreatment'], string> = {
  taxable: 'Taxable Assets',
  taxDeferred: 'Tax-Deferred Assets',
  taxFree: 'Tax-Free Assets',
};

interface LedgerTableProps {
  scenario: Scenario;
  rows: LedgerYearRow[];
  overrides: GridOverride[];
  onSelectRetirementYear: (year: number) => void;
  onOpenAudit: (row: LedgerYearRow) => void;
  onEditOverride: (row: LedgerYearRow) => void;
}

export function LedgerTable({ scenario, rows, overrides, onSelectRetirementYear, onOpenAudit, onEditOverride }: LedgerTableProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const currency = scenario.currency;

  function toggle(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function findOverride(year: number, field: string) {
    return overrides.find((o) => o.year === year && o.field === field);
  }

  const bucketsByTreatment: Partial<Record<AccountBucket['taxTreatment'], AccountBucket[]>> = {};
  for (const bucket of scenario.accountBuckets) {
    (bucketsByTreatment[bucket.taxTreatment] ??= []).push(bucket);
  }

  const groups: LedgerColumnGroup[] = [
    {
      key: 'expenses',
      label: 'Expenses',
      columns: [
        {
          id: 'spendingNominal',
          header: 'Nominal',
          render: (row) => {
            const override = findOverride(row.year, 'spendingNominal');
            return (
              <button
                type="button"
                className="flex items-center hover:underline decoration-dotted underline-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditOverride(row);
                }}
              >
                {formatCurrency(row.spendingNominal, currency)}
                <Pencil className="ml-1 size-2.5 text-dim" />
                {override && <CellOverrideBadge />}
              </button>
            );
          },
        },
        { id: 'spendingReal', header: 'Real', render: (row) => formatCurrency(row.spendingReal, currency) },
      ],
    },
    {
      key: 'income',
      label: 'Income & Benefits',
      columns: [
        {
          id: 'incomes',
          header: 'Incomes',
          render: (row) => formatCurrency(row.incomes.reduce((sum, i) => sum + i.amount, 0), currency),
        },
        {
          id: 'benefits',
          header: 'Benefits',
          render: (row) => formatCurrency(row.benefits.reduce((sum, b) => sum + b.amount, 0), currency),
        },
      ],
    },
    ...((['taxable', 'taxDeferred', 'taxFree'] as const)
      .map((treatment): LedgerColumnGroup | null => {
        const buckets = bucketsByTreatment[treatment];
        if (!buckets || buckets.length === 0) return null;
        return {
          key: treatment,
          label: ASSET_GROUP_LABEL[treatment],
          columns: buckets.flatMap((bucket): LedgerColumn[] => [
            {
              id: `${bucket.id}-start`,
              header: (
                <span className="flex flex-col">
                  <span>{bucket.label}</span>
                  <span className="text-[10px] font-normal normal-case text-dim">Start</span>
                </span>
              ),
              render: (row) => formatCurrency(row.accountStart[bucket.id] ?? 0, currency),
            },
            {
              id: `${bucket.id}-withdrawal`,
              header: (
                <span className="flex flex-col">
                  <span>{bucket.label}</span>
                  <span className="text-[10px] font-normal normal-case text-dim">Withdrawal</span>
                </span>
              ),
              render: (row) => {
                const amount = row.withdrawals[bucket.id] ?? 0;
                const highlight = row.isRetired && amount > 0;
                return (
                  <span className={cn(highlight && 'inline-block px-1.5 py-0.5 rounded-[6px] font-semibold bg-[#FEF3C7] text-[#92400E]')}>
                    {amount > 0 ? formatCurrency(amount, currency) : '—'}
                  </span>
                );
              },
            },
            {
              id: `${bucket.id}-end`,
              header: (
                <span className="flex flex-col">
                  <span>{bucket.label}</span>
                  <span className="text-[10px] font-normal normal-case text-dim">End</span>
                </span>
              ),
              render: (row) => formatCurrency(row.accountEnd[bucket.id] ?? 0, currency),
            },
          ]),
        };
      })
      .filter((g): g is LedgerColumnGroup => g !== null)),
    {
      key: 'cashBuffer',
      label: 'Cash Buffer',
      columns: [{ id: 'cashBufferReplenishment', header: 'Replenishment', render: (row) => (row.cashBufferReplenishment > 0 ? formatCurrency(row.cashBufferReplenishment, currency) : '—') }],
    },
    {
      key: 'taxes',
      label: 'Taxes',
      columns: [
        { id: 'taxFederal', header: 'Federal', render: (row) => formatCurrency(row.taxesPaid.federal, currency) },
        { id: 'taxState', header: 'State/Prov.', render: (row) => formatCurrency(row.taxesPaid.stateOrProvincial, currency) },
        { id: 'taxTotal', header: 'Total', render: (row) => formatCurrency(row.taxesPaid.total, currency) },
      ],
    },
  ];

  const visibleColumnsByGroup = groups.map((group) => (collapsed[group.key] ? [] : group.columns));

  return (
    <div className="border border-edge rounded-[14px] overflow-hidden bg-surface">
      <RetirementStartRadioGroup value={scenario.retirementStartYear} onChange={onSelectRetirementYear}>
        <Table className="text-[12.5px]">
          <TableHeader className="bg-surface-raised">
            <TableRow className="hover:bg-transparent">
              <TableHead rowSpan={2} className="whitespace-nowrap text-center">
                Retire
              </TableHead>
              <TableHead rowSpan={2} className="whitespace-nowrap">
                Age
              </TableHead>
              <TableHead rowSpan={2} className="whitespace-nowrap">
                Year
              </TableHead>
              <TableHead rowSpan={2} className="whitespace-nowrap">
                Yrs to/in Ret.
              </TableHead>
              {groups.map((group, i) => (
                <LedgerColumnGroupHeader
                  key={group.key}
                  label={group.label}
                  colSpan={Math.max(1, visibleColumnsByGroup[i].length)}
                  collapsed={!!collapsed[group.key]}
                  onToggle={() => toggle(group.key)}
                />
              ))}
              <TableHead rowSpan={2} className="whitespace-nowrap text-right">
                Total Net Worth
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              {groups.flatMap((group, i) =>
                collapsed[group.key]
                  ? [
                      <TableHead key={`${group.key}-collapsed`} className="whitespace-nowrap border-l border-edge text-dim">
                        …
                      </TableHead>,
                    ]
                  : visibleColumnsByGroup[i].map((col) => (
                      <TableHead key={col.id} className="whitespace-nowrap border-l border-edge first:border-l-0">
                        {col.header}
                      </TableHead>
                    )),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.year} className="cursor-pointer" onClick={() => onOpenAudit(row)}>
                <TableCell className="text-center">
                  <RetirementStartRadioItem year={row.year} />
                </TableCell>
                <TableCell>{row.age}</TableCell>
                <TableCell className="font-mono">{row.year}</TableCell>
                <TableCell className="font-mono text-dim">{Number.isNaN(row.yearsToOrInRetirement) ? '—' : row.yearsToOrInRetirement}</TableCell>
                {groups.flatMap((group, i) =>
                  collapsed[group.key]
                    ? [<TableCell key={`${group.key}-collapsed`} className="border-l border-edge text-dim">
                        …
                      </TableCell>]
                    : visibleColumnsByGroup[i].map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap border-l border-edge first:border-l-0 font-mono">
                          {col.render(row)}
                        </TableCell>
                      )),
                )}
                <TableCell className="text-right font-mono font-semibold">{formatCurrency(row.totalNetWorth, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </RetirementStartRadioGroup>
    </div>
  );
}
