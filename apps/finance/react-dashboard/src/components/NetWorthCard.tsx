import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Badge } from '@repo/ui/components/badge';
import { DashCard } from './DashCard';
import { cn } from '../lib/utils';
import { useMarketFeed, usePortfolioBalance } from '../hooks/useMarketFeed';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const fmtShort = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

export function NetWorthCard() {
  const { tickers, nwHistory } = useMarketFeed();
  const { holdings, cash } = usePortfolioBalance();

  const nw = tickers.reduce((sum, t) => sum + (holdings[t.sym] ?? 0) * t.price, cash);

  const data = useMemo(
    () => nwHistory.map((value, i) => ({ i, value })),
    [nwHistory],
  );

  const sessionChange = nw - (nwHistory[0] ?? nw);
  const sessionPct = nwHistory[0] > 0 ? ((sessionChange / nwHistory[0]) * 100).toFixed(2) : '0.00';
  const isUp = sessionChange >= 0;

  return (
    <DashCard>
      <p className="dash-label mb-1">Total Net Worth</p>

      {/* Balance row */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <span className="text-[30px] sm:text-[38px] font-extrabold tracking-[-0.04em] text-ink tabular-nums leading-[1.05]">
          {fmt(nw)}
        </span>
        <Badge className={cn(
          'gap-1 px-[9px] py-[3px] rounded-full text-[12px] font-semibold font-mono mb-1.5 border-transparent',
          isUp ? 'bg-gain-bg text-gain-dark hover:bg-gain-bg' : 'bg-loss-bg text-loss-dark hover:bg-loss-bg',
        )}>
          {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{sessionPct}%
        </Badge>
      </div>

      {/* 30-day area chart */}
      <div className="h-[100px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5B5BD6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#5B5BD6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="2 5" />
            <XAxis dataKey="i" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #EAECF1',
                borderRadius: 10,
                fontSize: 12,
                fontFamily: "'Geist Mono', monospace",
                boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
              }}
              formatter={(v) => [fmt(Number(v)), 'Net Worth']}
              labelFormatter={() => ''}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#5B5BD6"
              strokeWidth={2.4}
              fill="url(#nwGradient)"
              dot={false}
              activeDot={{ r: 4, stroke: '#5B5BD6', fill: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="flex justify-between mt-4 pt-3.5 border-t border-edge-soft">
        <div>
          <p className="text-[11px] text-dim font-mono mb-0.5">Buying Power</p>
          <p className="text-[14px] font-bold text-ink font-mono tabular-nums">{fmt(cash)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-dim font-mono mb-0.5">30-Day Change</p>
          <p className={`text-[14px] font-bold font-mono tabular-nums ${isUp ? 'text-gain-dark' : 'text-loss-dark'}`}>
            {isUp ? '+' : ''}{fmtShort(sessionChange)}
          </p>
        </div>
      </div>
    </DashCard>
  );
}
