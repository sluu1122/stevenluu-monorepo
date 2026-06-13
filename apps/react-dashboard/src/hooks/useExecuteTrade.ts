import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { executeTrade, getPortfolioBalance } from '../lib/mockMarketDB';
import type {
  Holdings,
  MarketPricesResult,
  PortfolioBalanceResult,
  TradeRequest,
  TradeResult,
} from '../lib/mockMarketDB';

type TradeSide = 'buy' | 'sell';

export interface UseExecuteTradeResult {
  // Portfolio data (kept in sync with ['portfolio-balance'] cache)
  holdings: Holdings;
  cash: number;
  // Trade UI state
  selectedSym: string;
  side: TradeSide;
  amount: string;
  setAmount: (v: string) => void;
  selectAsset: (sym: string) => void;
  setSide: (s: TradeSide) => void;
  setQuick: (v: number) => void;
  submitTrade: () => void;
  // Mutation state
  isPending: boolean;
  isSuccess: boolean;
  lastFilled: string | null;
}

export function useExecuteTrade(): UseExecuteTradeResult {
  const queryClient = useQueryClient();
  const [selectedSym, setSelectedSym] = useState('AAPL');
  const [side, setSideState] = useState<TradeSide>('buy');
  const [amount, setAmount] = useState('');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio-balance'],
    queryFn: getPortfolioBalance,
    staleTime: Infinity,
  });

  const mutation = useMutation<
    TradeResult,
    Error,
    TradeRequest,
    { snapshot: PortfolioBalanceResult | undefined }
  >({
    mutationFn: executeTrade,

    onMutate: async (variables) => {
      // Prevent in-flight background sync from overwriting our speculative update
      await queryClient.cancelQueries({ queryKey: ['portfolio-balance'] });

      const snapshot = queryClient.getQueryData<PortfolioBalanceResult>(['portfolio-balance']);

      if (snapshot) {
        const price = variables.priceAtSubmission ?? 0;
        if (price <= 0) return { snapshot }; // no cached price — skip optimistic, server will settle
        const units = variables.amount / price;

        const optimistic: PortfolioBalanceResult = {
          holdings: { ...snapshot.holdings },
          cash: snapshot.cash,
        };
        if (variables.side === 'buy') {
          optimistic.holdings[variables.sym] =
            (snapshot.holdings[variables.sym] ?? 0) + units;
          optimistic.cash = snapshot.cash - variables.amount;
        } else {
          optimistic.holdings[variables.sym] =
            (snapshot.holdings[variables.sym] ?? 0) - units;
          optimistic.cash = snapshot.cash + variables.amount;
        }

        queryClient.setQueryData<PortfolioBalanceResult>(['portfolio-balance'], optimistic);
      }

      return { snapshot };
    },

    onError: (_err, _vars, context) => {
      // Simulated network drop — restore exact pre-trade snapshot
      if (context?.snapshot) {
        queryClient.setQueryData<PortfolioBalanceResult>(
          ['portfolio-balance'],
          context.snapshot,
        );
      }
    },

    onSettled: () => {
      // Re-sync with mock DB regardless of outcome
      queryClient.invalidateQueries({ queryKey: ['portfolio-balance'] });
    },
  });

  // Ref-wrapped so the dismiss effect doesn't re-run (and restart the timer)
  // every time TQ reconstructs the mutation result object between price ticks.
  const resetRef = useRef(mutation.reset);
  resetRef.current = mutation.reset;

  // Schedule banner dismiss 5.2 s after a successful trade.
  // mutation.reset is read via ref — omitting it from deps is intentional so that
  // TQ's per-render mutation object reconstruction doesn't restart the timer on every tick.
  useEffect(() => {
    if (!mutation.isSuccess) return;
    setAmount('');
    const id = setTimeout(() => {
      resetRef.current();
      resetTimer.current = null;
    }, 5200);
    resetTimer.current = id;
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.isSuccess]);

  const selectAsset = (sym: string) => { setSelectedSym(sym); setAmount(''); };
  const setSide = (s: TradeSide) => { setSideState(s); setAmount(''); };
  const setQuick = (v: number) => setAmount(String(v));

  const submitTrade = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || mutation.isPending || mutation.isSuccess) return;
    const prices = queryClient.getQueryData<MarketPricesResult>(['market-prices']);
    const priceAtSubmission = prices?.tickers.find((t) => t.sym === selectedSym)?.price ?? 0;
    if (priceAtSubmission <= 0) return; // prices not yet loaded — block submission
    mutation.mutate({ sym: selectedSym, side, amount: amt, priceAtSubmission });
  };

  return {
    holdings: portfolio?.holdings ?? {},
    cash: portfolio?.cash ?? 0,
    selectedSym,
    side,
    amount,
    setAmount,
    selectAsset,
    setSide,
    setQuick,
    submitTrade,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    lastFilled: mutation.data?.filled ?? null,
  };
}
