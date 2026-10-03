
import type { StockDataResponse, CrawlResponse, ForecastSnapshot, SaveAnalysisPayload, TradingInfo } from '~/types';

/**
 * Fetch stock data including metrics, analysis, and trading info
 */
export async function getStockData(symbol: string): Promise<StockDataResponse> {
  return await $fetch<StockDataResponse>('/api/stock/get', {
    method: 'GET',
    params: { symbol },
  });
}

export interface StockSummary {
  id: number;
  symbol: string;
  created_at: string;
  updated_at: string;
  entry_price: string | null;
  target_price: string | null;
  stop_loss: string | null;
  /** Latest stored trading snapshot */
  last_price: string | null;
  price_date: string | null;
}

/**
 * Fetch list of all stock analyses
 */
export async function getStockList(): Promise<{ success: boolean; data: StockSummary[] }> {
  return await $fetch<{ success: boolean; data: StockSummary[] }>('/api/stock/list');
}

/**
 * Fetch live trading information from Vietstock (also stores today's snapshot)
 */
export async function fetchTradingInfo(symbol: string): Promise<{ success: boolean; data?: { tradingInfo: TradingInfo } }> {
  return await $fetch('/api/stock/trading', {
    method: 'GET',
    params: { symbol },
  });
}

/**
 * Crawl quarterly + yearly financial data from Vietstock into the DB
 */
export async function crawlStockData(symbol: string): Promise<CrawlResponse> {
  return await $fetch<CrawlResponse>('/api/stock/crawl', {
    method: 'POST',
    body: { symbol, type: 'all' },
  });
}

/**
 * Save stock analysis data
 */
export async function saveStockAnalysis(payload: SaveAnalysisPayload): Promise<{ success: boolean }> {
  return await $fetch('/api/stock/save', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Delete stock analysis data
 */
export async function deleteStockAnalysis(symbol: string): Promise<{ success: boolean; message: string }> {
  return await $fetch(`/api/stock/delete?symbol=${symbol}`, {
    method: 'DELETE',
  });
}

/** Forecast journal of a stock, newest first */
export async function getForecastJournal(symbol: string): Promise<{ success: boolean; data: ForecastSnapshot[] }> {
  return await $fetch(`/api/stock/snapshots?symbol=${symbol}`);
}

export async function deleteForecastSnapshot(id: number): Promise<{ success: boolean }> {
  return await $fetch(`/api/stock/snapshots/${id}`, { method: 'DELETE' });
}

/**
 * Get Vietstock authentication status
 */
export async function getVietstockStatus(): Promise<{
  authenticated: boolean;
  email: string | null;
  expiresAt: string | null;
  loginTime: string | null;
  source: 'auto-login' | 'env-cookie' | 'none';
}> {
  return await $fetch('/api/auth/vietstock-status');
}

/**
 * Trigger Vietstock login manually
 */
export async function loginVietstock(email?: string, password?: string): Promise<{
  success: boolean;
  message: string;
  expiresAt?: string | null;
}> {
  return await $fetch('/api/auth/vietstock-login', {
    method: 'POST',
    body: { email, password },
  });
}
