import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DashCard } from './DashCard';
import { useMarketFeed, usePortfolioBalance } from '../hooks/useMarketFeed';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const STOCK_SYMS = ['AAPL', 'TSLA', 'NVDA'];
const CRYPTO_SYMS = ['BTC', 'ETH'];

export function AllocationCard() {
  const { priceOf } = useMarketFeed();
  const { holdings, cash } = usePortfolioBalance();

  const stockVal = STOCK_SYMS.reduce((s, sym) => s + (holdings[sym] ?? 0) * priceOf(sym), 0);
  const cryptoVal = CRYPTO_SYMS.reduce((s, sym) => s + (holdings[sym] ?? 0) * priceOf(sym), 0);

  const alloc = [
    { name: 'Stocks', value: stockVal, color: '#6E6AF0' },
    { name: 'Crypto', value: cryptoVal, color: '#43C59E' },
    { name: 'Cash', value: cash, color: '#F2918C' },
  ];
  const total = alloc.reduce((s, a) => s + a.value, 0);

  return (
    <DashCard>
      <p className="dash-label mb-4">Asset Allocation</p>

      {/* Donut */}
      <div className="relative h-40" role="img" aria-label="Asset allocation donut chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={alloc}
              dataKey="value"
              innerRadius={52}
              outerRadius={68}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {alloc.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[15px] font-extrabold tracking-[-0.03em] text-ink font-mono tabular-nums">
            {fmt(total)}
          </span>
          <span className="text-[10px] text-dim mt-0.5 font-mono tracking-[0.04em]">
            NET WORTH
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 mt-4">
        {alloc.map((a) => {
          const pct = total > 0 ? ((a.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={a.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flexShrink: 0 }} />
                <span className="text-[13px] text-ink-mid font-medium">{a.name}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[12px] text-dim font-mono">{pct}%</span>
                <span className="text-[12px] font-semibold text-ink font-mono tabular-nums min-w-[72px] text-right">
                  {fmt(a.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </DashCard>
  );
}
