
export interface TradingInfo {
  lastPrice: number;
  outstandingShares: number;
  listedShares: number;
  min52W: number;
  max52W: number;
  vol52W: number;
}

export interface SaveAnalysisPayload {
  symbol: string;
  quarterlyData: {
    annualData: any;
    quarterlyData: any;
    peAssumptions: any;
    outstandingShares: number;
    currentPrice: number;
    max52W: number;
    min52W: number;
    revenueGrowth: number;
    grossMargin: number;
    netProfitGrowth: number;
  };
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  noteHtml: string;
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
  analysis?: {
    quarterlyData: any;
    noteHtml?: string | null;
    entryPrice?: number | null;
    targetPrice?: number | null;
    stopLoss?: number | null;
  } | null;
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