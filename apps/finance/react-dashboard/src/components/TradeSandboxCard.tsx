import { useMarketFeed } from '../hooks/useMarketFeed';
import { useExecuteTrade } from '../hooks/useExecuteTrade';

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
    <div className="dash-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-[18px]">
        <p className="dash-label">Trade Sandbox</p>
        <span className="text-[9.5px] font-bold tracking-[0.08em] text-indigo bg-indigo-bg px-2 py-[3px] rounded-full font-mono">
          OPTIMISTIC UI
        </span>
      </div>

      {/* Buy / Sell toggle */}
      <div className="flex bg-surface-pressed rounded-[10px] p-[3px] mb-4 gap-[3px]">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`flex-1 py-2 rounded-lg border-none text-[13px] font-semibold cursor-pointer transition-all ${
              side === s
                ? `bg-surface shadow-sm ${s === 'buy' ? 'text-gain-dark' : 'text-loss-dark'}`
                : 'bg-transparent text-dim'
            }`}
          >
            {s === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      {/* Asset chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tickers.map((t) => (
          <button
            key={t.sym}
            onClick={() => selectAsset(t.sym)}
            className={`px-3 py-[5px] rounded-lg border text-[12.5px] font-semibold cursor-pointer font-mono transition-all ${
              selectedSym === t.sym
                ? 'border-indigo bg-indigo-bg text-indigo'
                : 'border-edge text-slate bg-surface'
            }`}
          >
            {t.sym}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mb-2.5">
        <label className="dash-label block mb-1.5 tracking-[0.04em]">Amount (USD)</label>
        <div className={`flex items-center rounded-[10px] bg-surface-muted overflow-hidden transition-colors border ${
          isOver ? 'border-[#F87171]' : 'border-edge'
        }`}>
          <span className="px-3 text-dim text-[15px] font-medium shrink-0">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min={0}
            className="flex-1 border-none outline-none bg-transparent text-[15px] font-semibold text-ink py-[10px] pr-3 font-mono tabular-nums"
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
          <button
            key={v}
            onClick={() => setQuick(v)}
            className="flex-1 py-1.5 rounded-[7px] border border-edge bg-surface text-slate text-[11.5px] font-medium cursor-pointer font-mono"
          >
            ${v >= 1000 ? `${v / 1000}k` : v}
          </button>
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
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gain-bg border border-gain-border rounded-[10px] text-[13px] font-semibold text-gain-dark font-mono mb-2.5"
            style={{ animation: 'bannerIn 0.25s ease forwards' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {lastFilled}
          </div>
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
        <button
          onClick={submitTrade}
          disabled={!canSubmit}
          className={`w-full py-[13px] rounded-[12px] border-none text-[14px] font-bold tracking-[-0.01em] transition-all ${
            canSubmit
              ? `cursor-pointer text-white shadow-sm ${side === 'buy' ? 'bg-ink' : 'bg-[#7F1D1D]'}`
              : 'cursor-not-allowed text-dim bg-edge'
          }`}
        >
          {side === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
        </button>
      </div>
    </div>
  );
}
