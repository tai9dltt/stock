
export interface TradingInfo {
  lastPrice: number;
  outstandingShares: number;
  listedShares: number;
  min52W: number;
  max52W: number;
  vol52W: number;
}

/** User inputs saved per stock (crawled figures are not part of it) */
export interface AnalysisInputs {
  /** Forecast assumptions as fractions (0.25 = 25%) */
  revenueGrowth: number;
  grossMargin: number;
  netProfitGrowth: number;
  peScenarios: number[] | null;
  sharesByQuarter: Record<string, Record<string, number>> | null;
  /** Market data last shown in the sheet, used when no live price is available */
  currentPrice: number | null;
  outstandingShares: number | null;
  max52W: number | null;
  min52W: number | null;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  noteHtml: string | null;
}

export interface SaveAnalysisPayload extends AnalysisInputs {
  symbol: string;
}

/** data of GET /api/stock/get */
export interface StockData {
  metrics: Record<string, Record<string, number | string | null>>;
  yearlyMetrics: Record<string, Record<string, number | string | null>>;
  periods?: { year: number; quarter: number; source: string; is_forecast: number | boolean }[];
  tradingSnapshot?: {
    outstandingShares?: number;
    lastPrice?: number;
    tradingDate?: string;
  } | null;
  analysis?: AnalysisInputs | null;
}

export interface StockDataResponse {
  success: boolean;
  data?: StockData | null;
  error?: string;
}

export interface CrawlResponse {
  success: boolean;
  data?: any;
  error?: string;
}