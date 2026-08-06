import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/table';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import type { LedgerYearRow } from '../../engine/types';

interface SummaryPrintableTableProps {
  rows: LedgerYearRow[];
  money: MoneyFormatter;
}

export function SummaryPrintableTable({ rows, money }: SummaryPrintableTableProps) {
  return (
    <div className="border border-edge rounded-[14px] overflow-hidden">
      <Table className="text-[13px]">
        <TableHeader className="bg-surface-raised">
          <TableRow className="hover:bg-transparent">
            <TableHead>Year</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Nominal Spending</TableHead>
            <TableHead className="text-right">Taxes Paid</TableHead>
            <TableHead className="text-right">Total Net Worth</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.year}>
              <TableCell className="font-mono">{row.year}</TableCell>
              <TableCell>{row.age}</TableCell>
              <TableCell className="text-dim">{row.isRetired ? 'Retired' : 'Working'}</TableCell>
              <TableCell className="text-right font-mono">{money.format(row.spendingNominal)}</TableCell>
              <TableCell className="text-right font-mono">{money.format(row.taxesPaid.total)}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{money.format(row.totalNetWorth)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
