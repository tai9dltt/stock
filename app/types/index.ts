
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

export interface StockDataResponse {
  success: boolean;
  data?: {
    metrics: any;
    yearlyMetrics: any;
    periods?: any[];
    tradingSnapshot?: {
      outstandingShares?: number;
      lastPrice?: number;
      tradingDate?: string;
    };
    analysis?: {
      quarterlyData: any;
      noteHtml?: string;
      entryPrice?: number;
      targetPrice?: number;
      stopLoss?: number;
    };
    tradingInfo?: TradingInfo;
  };
  error?: string;
}

export interface SmartUpdateResponse {
  success: boolean;
  data?: {
    quarters: any;
    annual?: any;
    newDataFetched: boolean;
    message: string;
  };
  error?: string;
}

export interface CrawlResponse {
  success: boolean;
  data?: any;
  error?: string;
}