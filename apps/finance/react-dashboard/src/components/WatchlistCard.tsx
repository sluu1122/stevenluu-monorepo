import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import { useMarketFeed } from '../hooks/useMarketFeed';
import type { Ticker } from '../hooks/useMarketFeed';

const fmtPrice = (n: number) =>
  n >= 1000
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
    : `$${n.toFixed(2)}`;

function WatchlistRow({ ticker: t, isLast }: { ticker: Ticker; isLast: boolean }) {
  const change = t.price - t.open;
  const changePct = ((change / t.open) * 100).toFixed(2);
  const isUp = change >= 0;
  const sparkData = t.history.map((v, i) => ({ i, v }));

  return (
    <div className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 sm:gap-4 px-2 py-3 rounded-lg ${!isLast ? 'border-b border-edge-soft' : ''}`}>
      {/* Ticker info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: `${t.color}1A` }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-ink tracking-[-0.01em] m-0">{t.sym}</p>
          <p className="text-[11px] text-dim truncate m-0">{t.name}</p>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ width: 66, height: 26 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Line
              type="monotone"
              dataKey="v"
              stroke={isUp ? '#16A34A' : '#E11D48'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price + change */}
      <div className="text-right min-w-[80px] sm:min-w-[90px]">
        <p className="text-[14px] font-bold text-ink font-mono tabular-nums m-0">{fmtPrice(t.price)}</p>
        <p className={`text-[11.5px] font-semibold font-mono mt-0.5 m-0 ${isUp ? 'text-gain' : 'text-loss'}`}>
          {isUp ? '+' : ''}{changePct}%
        </p>
      </div>
    </div>
  );
}

export function WatchlistCard() {
  const { tickers } = useMarketFeed();

  return (
    <div className="dash-card">
      <p className="dash-label mb-4">Live Watchlist</p>
      <div className="flex flex-col">
        {tickers.map((t, idx) => (
          <WatchlistRow key={t.sym} ticker={t} isLast={idx === tickers.length - 1} />
        ))}
      </div>
    </div>
  );
}
