import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/tabs';
import { ToggleGroup, ToggleGroupItem } from '@repo/ui/components/toggle-group';
import { Alert, AlertDescription } from '@repo/ui/components/alert';
import { DashCard } from './DashCard';
import { cn } from '../lib/utils';
import { useMarketFeed } from '../hooks/useMarketFeed';
import { useExecuteTrade } from '../hooks/useExecuteTrade';
import type { TradeSide } from '../hooks/useExecuteTrade';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const QUICK_FILLS = [100, 500, 1000, 2500];

export function TradeSandboxCard() {
  const { tickers, priceOf } = useMarketFeed();
  const {
    cash, selectedSym, side, amount, setAmount,
    selectAsset, setSide, setQuick, submitTrade,
    isPending, isSuccess, lastFilled,
  } = useExecuteTrade();

  const price = priceOf(selectedSym);
  const amtNum = parseFloat(amount);
  const units = amtNum > 0 && price > 0 ? amtNum / price : 0;
  const isOver = side === 'buy' && amtNum > cash;
  const canSubmit = amtNum > 0 && !isOver && !isPending && !isSuccess;

  return (
    <DashCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-[18px]">
        <p className="dash-label">Trade Sandbox</p>
        <Badge className="text-[9.5px] font-bold tracking-[0.08em] text-indigo bg-indigo-bg hover:bg-indigo-bg px-2 py-[3px] rounded-full font-mono border-transparent">
          OPTIMISTIC UI
        </Badge>
      </div>

      {/* Buy / Sell toggle */}
      <Tabs value={side} onValueChange={(v: string) => setSide(v as TradeSide)} className="mb-4">
        <TabsList className="flex w-full h-auto bg-surface-pressed rounded-[10px] p-[3px] gap-[3px]">
          <TabsTrigger
            value="buy"
            className="flex-1 py-2 rounded-lg text-[13px] font-semibold text-dim data-[state=active]:bg-surface data-[state=active]:shadow-sm data-[state=active]:text-gain-dark"
          >
            Buy
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className="flex-1 py-2 rounded-lg text-[13px] font-semibold text-dim data-[state=active]:bg-surface data-[state=active]:shadow-sm data-[state=active]:text-loss-dark"
          >
            Sell
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Asset chips */}
      <ToggleGroup
        type="single"
        value={selectedSym}
        onValueChange={(v: string) => { if (v) selectAsset(v); }}
        className="flex-wrap justify-start gap-1.5 mb-4"
      >
        {tickers.map((t) => (
          <ToggleGroupItem
            key={t.sym}
            value={t.sym}
            className="h-auto px-3 py-[5px] rounded-lg border border-edge bg-surface text-slate text-[12.5px] font-semibold font-mono hover:bg-surface hover:text-slate data-[state=on]:border-indigo data-[state=on]:bg-indigo-bg data-[state=on]:text-indigo"
          >
            {t.sym}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Amount input */}
      <div className="mb-2.5">
        <Label htmlFor="trade-amount" className="dash-label text-[11.5px] block mb-1.5 tracking-[0.04em]">
          Amount (USD)
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim text-[15px] font-medium pointer-events-none">$</span>
          <Input
            id="trade-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min={0}
            className={cn(
              'h-auto rounded-[10px] bg-surface-muted pl-7 pr-3 py-[10px] text-[15px] md:text-[15px] font-semibold text-ink font-mono tabular-nums',
              isOver ? 'border-[#F87171]' : 'border-edge',
            )}
          />
        </div>
        {isOver && (
          <p className="text-[11.5px] text-loss mt-1 font-mono">
            Exceeds buying power ({fmt(cash)})
          </p>
        )}
      </div>

      {/* Quick fills */}
      <div className="flex gap-1.5 mb-4">
        {QUICK_FILLS.map((v) => (
          <Button
            key={v}
            variant="outline"
            onClick={() => setQuick(v)}
            className="flex-1 h-auto py-1.5 px-2 rounded-[7px] border-edge bg-surface text-slate text-[11.5px] font-medium font-mono"
          >
            ${v >= 1000 ? `${v / 1000}k` : v}
          </Button>
        ))}
      </div>

      {/* Estimate */}
      {units > 0 && (
        <p className="text-[12px] text-slate font-mono mb-3.5 px-3 py-2 bg-surface-raised rounded-lg border border-edge-soft">
          ≈ {units.toFixed(6)} {selectedSym} @ {fmt(price)}
        </p>
      )}

      {/* Action area */}
      <div className="relative">
        {/* Success banner */}
        {isSuccess && lastFilled && (
          <Alert
            role="status"
            aria-live="polite"
            className="bg-gain-bg border-gain-border rounded-[10px] px-3.5 py-2.5 mb-2.5"
            style={{ animation: 'bannerIn 0.25s ease forwards' }}
          >
            <AlertDescription className="flex items-center gap-2 text-[13px] font-semibold text-gain-dark font-mono">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {lastFilled}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading skeleton */}
        {isPending && (
          <div
            className="flex items-center gap-2.5 px-4 py-3.5 bg-surface-raised border border-edge rounded-[12px] mb-2.5"
            style={{
              backgroundImage: 'linear-gradient(90deg, #F8FAFC 0%, #EFF4FB 50%, #F8FAFC 100%)',
              backgroundSize: '460px 100%',
              animation: 'shimmer 1.2s infinite linear',
            }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-indigo border-t-transparent shrink-0"
              style={{ animation: 'spin 0.7s linear infinite' }}
            />
            <span className="text-[13px] font-semibold text-slate font-mono">Routing order…</span>
          </div>
        )}

        {/* Submit button */}
        <Button
          onClick={submitTrade}
          disabled={!canSubmit}
          className={cn(
            'w-full h-auto py-[13px] rounded-[12px] text-[14px] font-bold tracking-[-0.01em] shadow-sm text-white',
            side === 'buy' ? 'bg-ink hover:bg-ink/90' : 'bg-[#7F1D1D] hover:bg-[#7F1D1D]/90',
            !canSubmit && 'disabled:opacity-100 bg-edge text-dim shadow-none hover:bg-edge hover:text-dim',
          )}
        >
          {side === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
        </Button>
      </div>
    </DashCard>
  );
}
