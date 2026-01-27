
import type { StockDataResponse, SmartUpdateResponse, CrawlResponse, SaveAnalysisPayload, TradingInfo } from '~/types';

/**
 * Fetch stock data including metrics, analysis, and trading info
 */
export async function getStockData(symbol: string): Promise<StockDataResponse> {
  return await $fetch<StockDataResponse>('/api/stock/get', {
    method: 'GET',
    params: { symbol },
  });
}

/**
 * Fetch trading information from Vietstock
 */
export async function fetchTradingInfo(symbol: string): Promise<{ success: boolean; data?: { tradingInfo: TradingInfo } }> {
  return await $fetch('/api/stock/fetch-vietstock', {
    method: 'POST',
    body: { code: symbol },
  });
}

/**
 * Smart update - fetch new data if available, otherwise return existing
 */
export async function smartUpdateStock(symbol: string): Promise<SmartUpdateResponse> {
  return await $fetch<SmartUpdateResponse>('/api/stock/smart-update', {
    method: 'POST',
    body: { symbol },
  });
}

/**
 * Crawl quarterly data from Vietstock
 */
export async function crawlQuarterlyData(symbol: string, pages: number = 4): Promise<CrawlResponse> {
  return await $fetch<CrawlResponse>('/api/stock/crawl', {
    method: 'POST',
    body: { symbol, pages },
  });
}

/**
 * Crawl yearly data from Vietstock
 */
export async function crawlYearlyData(symbol: string, pages: number = 2): Promise<CrawlResponse> {
  return await $fetch<CrawlResponse>('/api/stock/crawl-yearly', {
    method: 'POST',
    body: { symbol, pages },
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
