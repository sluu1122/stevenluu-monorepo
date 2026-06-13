import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarketPrices, getPortfolioBalance, getNwHistory } from '../lib/mockMarketDB';
import type { Ticker, Holdings } from '../lib/mockMarketDB';

export type { Ticker, Holdings };

// ── Market prices — polled every 2 s, data considered fresh for 1.5 s ─────────

export function useMarketFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['market-prices'],
    queryFn: getMarketPrices,
    refetchInterval: 2000,
    staleTime: 1500,
    refetchOnWindowFocus: false,
  });

  const { data: historyData } = useQuery({
    queryKey: ['nw-history'],
    queryFn: getNwHistory,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const tickers: Ticker[] = useMemo(() => data?.tickers ?? [], [data]);

  const priceOf = useCallback(
    (sym: string): number => tickers.find((t) => t.sym === sym)?.price ?? 0,
    [tickers],
  );

  return {
    tickers,
    nwHistory: historyData ?? [],
    isLoading,
    priceOf,
  };
}

// ── Portfolio balance — updated only by trade mutations ───────────────────────

export function usePortfolioBalance(): { holdings: Holdings; cash: number } {
  const { data } = useQuery({
    queryKey: ['portfolio-balance'],
    queryFn: getPortfolioBalance,
    staleTime: Infinity,
  });
  return { holdings: data?.holdings ?? {}, cash: data?.cash ?? 0 };
}
