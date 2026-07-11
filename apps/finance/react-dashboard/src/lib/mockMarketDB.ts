// ── Types ────────────────────────────────────────────────────────────────────

export interface Ticker {
  sym: string;
  name: string;
  price: number;
  prev: number;
  open: number;
  color: string;
  vol: number;
  tick: number;
  history: number[];
}

export interface Holdings {
  [sym: string]: number;
}

export interface MarketPricesResult {
  tickers: Ticker[];
}

export interface PortfolioBalanceResult {
  holdings: Holdings;
  cash: number;
}

export interface TradeRequest {
  sym: string;
  side: 'buy' | 'sell';
  amount: number;
  priceAtSubmission?: number; // captured at click time; used only for optimistic update
}

export interface TradeResult {
  filled: string;
  holdings: Holdings;
  cash: number;
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED: Pick<Ticker, 'sym' | 'name' | 'price' | 'color' | 'vol'>[] = [
  { sym: 'AAPL', name: 'Apple Inc.',   price: 189.42,   color: '#6E6AF0', vol: 0.0045 },
  { sym: 'TSLA', name: 'Tesla, Inc.',  price: 242.18,   color: '#F2918C', vol: 0.0085 },
  { sym: 'NVDA', name: 'NVIDIA Corp.', price: 121.36,   color: '#43C59E', vol: 0.0090 },
  { sym: 'BTC',  name: 'Bitcoin',      price: 67241.55, color: '#E8A23D', vol: 0.0060 },
  { sym: 'ETH',  name: 'Ethereum',     price: 3284.10,  color: '#6E6AF0', vol: 0.0070 },
];

const INITIAL_HOLDINGS: Holdings = {
  AAPL: 142, TSLA: 88, NVDA: 198, BTC: 0.30, ETH: 4.10,
};

const INITIAL_CASH = 18_650;
const HISTORY_LEN = 20;

// ── Simulation helpers ────────────────────────────────────────────────────────

function buildHistory(price: number): number[] {
  const history: number[] = [];
  let p = price * 0.94;
  for (let i = 0; i < HISTORY_LEN; i++) {
    p = p * (1 + (Math.random() - 0.48) * 0.012);
    history.push(p);
  }
  history.push(price);
  return history;
}

function initTickers(): Ticker[] {
  return SEED.map((s) => ({
    ...s,
    prev: s.price,
    open: s.price,
    tick: 0,
    history: buildHistory(s.price),
  }));
}

function tickPrice(t: Ticker): Ticker {
  const move = t.price * (Math.random() - 0.5) * t.vol * 2;
  const newPrice = Math.max(0.01, t.price + move);
  return {
    ...t,
    prev: t.price,
    price: newPrice,
    tick: t.tick + 1,
    history: [...t.history.slice(-(HISTORY_LEN - 1)), newPrice],
  };
}

function computeNetWorth(tickers: Ticker[], holdings: Holdings, cash: number): number {
  return tickers.reduce((sum, t) => sum + (holdings[t.sym] ?? 0) * t.price, cash);
}

function build30DayCurve(baseNetWorth: number): number[] {
  const points: number[] = [];
  let v = baseNetWorth * 0.872;
  for (let i = 0; i < 30; i++) {
    const sine = Math.sin((i / 29) * Math.PI * 2.2) * baseNetWorth * 0.04;
    v = v + (baseNetWorth - v) / (30 - i) + sine * 0.1 + (Math.random() - 0.48) * baseNetWorth * 0.006;
    points.push(Math.max(0, v));
  }
  points.push(baseNetWorth);
  return points;
}

// ── Singleton server state ────────────────────────────────────────────────────

let _tickers: Ticker[] = initTickers();
let _lastTickMs = 0;
let _holdings: Holdings = { ...INITIAL_HOLDINGS };
let _cash = INITIAL_CASH;

const _nwHistory: number[] = build30DayCurve(
  computeNetWorth(_tickers, _holdings, _cash),
);

// ── "API" functions (queryFns / mutationFn call these) ────────────────────────

export function getMarketPrices(): MarketPricesResult {
  // Guard against StrictMode double-invocation: two calls within 100 ms are treated
  // as a single tick. The real refetch interval is 2 000 ms, so no legitimate tick
  // is ever dropped.
  const now = Date.now();
  if (now - _lastTickMs > 100) {
    _tickers = _tickers.map(tickPrice);
    _lastTickMs = now;
  }
  return { tickers: [..._tickers] };
}

export function getPortfolioBalance(): PortfolioBalanceResult {
  return { holdings: { ..._holdings }, cash: _cash };
}

export function getNwHistory(): number[] {
  return [..._nwHistory];
}

export function executeTrade(req: TradeRequest): Promise<TradeResult> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const ticker = _tickers.find((t) => t.sym === req.sym);
      if (!ticker) { reject(new Error(`Unknown symbol: ${req.sym}`)); return; }

      const price = ticker.price;
      const units = req.amount / price;
      const newHoldings = { ..._holdings };
      let newCash = _cash;

      if (req.side === 'buy') {
        if (req.amount > _cash) { reject(new Error('Insufficient funds')); return; }
        newHoldings[req.sym] = (newHoldings[req.sym] ?? 0) + units;
        newCash -= req.amount;
      } else {
        const held = newHoldings[req.sym] ?? 0;
        if (units > held) { reject(new Error('Insufficient holdings')); return; }
        newHoldings[req.sym] = held - units;
        newCash += req.amount;
      }

      _holdings = newHoldings;
      _cash = newCash;

      const verb = req.side === 'buy' ? 'Bought' : 'Sold';
      resolve({
        filled: `${verb} ${units.toFixed(4)} ${req.sym} @ $${price.toFixed(2)}`,
        holdings: { ..._holdings },
        cash: _cash,
      });
    }, 1250);
  });
}
