import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { CANADIAN_TAX_TABLES, US_STATE_TAX_TABLES } from '../../engine/regionalTaxTables';
import type { Scenario } from '../../engine/schema';

interface BracketRateInputProps {
  value: number;
  onChange: (value: number) => void;
}

// Holds a raw text draft while focused so mid-edit keystrokes aren't
// immediately reformatted back through toFixed(2) - reformatting on every
// keystroke (as a plain `value={(value * 100).toFixed(2)}` binding would)
// resets the native input's value string, which snaps the cursor to the end
// even when the edit happened in the middle of the number. Same pattern as
// MoneyInput.
function BracketRateInput({ value, onChange }: BracketRateInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      type="number"
      step="0.1"
      className="w-[80px]"
      value={draft ?? (value * 100).toFixed(2)}
      onFocus={() => setDraft((value * 100).toFixed(2))}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = Number(e.target.value);
        if (!Number.isNaN(parsed)) onChange(parsed / 100);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function TaxAssumptionsForm() {
  const { control, watch, setValue } = useFormContext<Scenario>();
  const country = watch('country');
  const brackets = watch('taxConfig.federalTable.brackets');
  const provincial = watch('taxConfig.stateOrProvincialTable');

  const regionNoun = country === 'US' ? 'State' : 'Provincial';
  // The picker only ever offers tables for the scenario's OWN tax residency -
  // a Canadian scenario has no business showing California's brackets, and
  // switching country used to leave whichever country's table was already
  // selected in place, silently mismatched against the new residency.
  const tablesForCountry = country === 'US' ? US_STATE_TAX_TABLES : CANADIAN_TAX_TABLES;
  // A migrated scenario carries its old flat rate as a one-bracket table, and
  // switching residency leaves the OTHER country's table in place until the
  // user picks a new one - both match no preset, shown as-is so it's obvious
  // a real table still needs picking.
  const presetKey = Object.keys(tablesForCountry).find((key) => tablesForCountry[key].label === provincial?.label) ?? '';

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Tax Assumptions</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Federal brackets seeded from {country === 'US' ? 'Tax Foundation' : 'CRA'} 2026 figures - rates are editable. {regionNoun} tax uses that
        region's own progressive table, with its basic personal amount granted as a credit.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 max-w-[420px]">
        {country === 'US' && (
          <div className="space-y-1.5">
            <Label>Filing status</Label>
            <Controller
              control={control}
              name="taxConfig.filingStatus"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="marriedFilingJointly">Married Filing Jointly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{regionNoun} table</Label>
          <Select
            value={presetKey}
            onValueChange={(key: string) => {
              // Radix's Select fires a phantom onValueChange("") of its own
              // accord when the item list changes out from under a controlled
              // value - exactly what happens here the instant residency
              // switches this list from provinces to states. Nothing in
              // `tablesForCountry` is ever keyed by "", so this is never a
              // real user pick; forwarding it would spread undefined into `{}`
              // and blank out the table this same switch just set.
              const table = tablesForCountry[key];
              if (table) setValue('taxConfig.stateOrProvincialTable', { ...table }, { shouldDirty: true });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={provincial?.label ?? 'Choose one'} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(tablesForCountry).map(([key, table]) => (
                <SelectItem key={key} value={key}>
                  {table.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {provincial?.brackets && provincial.brackets.length > 0 && (
        <div className="mb-5 rounded-[9px] bg-surface-muted px-3 py-2.5 text-[12.5px] text-dim">
          <span className="text-ink font-medium">{provincial.label}</span>: {provincial.brackets.length} bracket
          {provincial.brackets.length === 1 ? '' : 's'} from {(provincial.brackets[0].rate * 100).toFixed(2)}% to{' '}
          {(provincial.brackets[provincial.brackets.length - 1].rate * 100).toFixed(2)}%, basic personal amount $
          {Math.round(provincial.basicPersonalAmount).toLocaleString()} credited at {(provincial.creditRate * 100).toFixed(2)}%
          {provincial.surtax.length > 0 ? `, plus ${provincial.surtax.length} surtax bands` : ''}.
          {presetKey === '' && ' Carried over from a flat rate - pick a real table above.'}
        </div>
      )}

      <Label className="mb-2 block">Federal brackets</Label>
      <div className="flex flex-col gap-2 max-w-[360px]">
        {brackets.map((bracket, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] gap-3 items-center text-[13px]">
            <span className="text-dim font-mono">
              ${bracket.min.toLocaleString()} – {bracket.max === null ? 'and up' : `$${bracket.max.toLocaleString()}`}
            </span>
            <Controller
              control={control}
              name={`taxConfig.federalTable.brackets.${index}.rate`}
              render={({ field }) => (
                <div className="flex items-center gap-1">
                  <BracketRateInput value={field.value} onChange={field.onChange} />
                  <span className="text-dim">%</span>
                </div>
              )}
            />
          </div>
        ))}
      </div>
    </DashCard>
  );
}
