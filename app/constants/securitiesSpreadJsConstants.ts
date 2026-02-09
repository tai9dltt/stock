/**
 * Securities Company SpreadJS Constants
 * Row labels, positions and configuration for securities stocks (SSI, VND, HCM, etc.)
 * Securities companies have different financial metrics than industrial companies and banks
 */

import type { AnnualRowPositions, QuarterlyRowPositions } from '~/types/spreadJsTypes';

// ============ SECURITIES ANNUAL TABLE ============
export const SECURITIES_ANNUAL_TABLE = {
  START_ROW: 3,
  COLUMN_WIDTH: 110,
};

/**
 * Calculate securities annual row positions based on start row
 */
export function getSecuritiesAnnualRowPositions(startRow: number): AnnualRowPositions {
  return {
    header: startRow,
    netRevenue: startRow + 1,      // DT từ KD chứng khoán
    grossProfit: startRow + 2,     // Lợi nhuận gộp
    operatingProfit: startRow + 3, // LNT từ KD chứng khoán
    netProfit: startRow + 4,       // LNST của CĐ cty mẹ
    grossMargin: startRow + 5,     // Biên LN gộp (%)
    netProfitMargin: startRow + 6, // Biên LN ròng (%)
    netMargin: startRow + 99,      // NOT USED - hidden
    eps: startRow + 7,
    pe: startRow + 8,
    ros: startRow + 9,
    roe: startRow + 10,
    roa: startRow + 11,
    revGrowth: startRow + 12,
    profitGrowth: startRow + 13,
  };
}

// ============ SECURITIES QUARTERLY TABLE ============
export const SECURITIES_QUARTERLY_TABLE = {
  GAP_FROM_ANNUAL: 4,
  COLUMN_WIDTH: 110,
};

/**
 * Calculate securities quarterly row positions based on start row
 */
export function getSecuritiesQuarterlyRowPositions(startRow: number): QuarterlyRowPositions {
  return {
    yearHeader: startRow,
    quarterHeader: startRow + 1,
    revenue: startRow + 2,         // DT từ KD chứng khoán
    grossProfit: startRow + 3,     // Lợi nhuận gộp
    operatingProfit: startRow + 4, // LNT từ KD chứng khoán
    netProfit: startRow + 5,       // LNST của CĐ cty mẹ
    shares: startRow + 6,          // KL CP lưu hành
    grossMargin: startRow + 7,     // Biên LN gộp (%)
    netProfitMargin: startRow + 8, // Biên LN ròng (%)
    netMargin: startRow + 99,      // NOT USED - hidden
    eps: startRow + 9,
    epsTtm: startRow + 10,
    pe: startRow + 11,
    roe: startRow + 12,
    roa: startRow + 13,
    revGrowth: startRow + 14,
    profitGrowth: startRow + 15,
  };
}

// ============ SECURITIES ROW LABELS ============
// Labels matching Vietstock format for securities companies
export const SECURITIES_ANNUAL_ROW_LABELS = {
  netRevenue: 'DT từ KD chứng khoán',
  grossProfit: 'Lợi nhuận gộp',
  operatingProfit: 'LNT từ KD chứng khoán',
  netProfit: 'LNST',
  grossMargin: 'Biên LN gộp (%)',
  netProfitMargin: 'Biên LN ròng (%)',
  netMargin: 'ROA (%)',
  eps: 'EPS (Vietstock)',
  pe: 'P/E (Vietstock)',
  ros: 'ROS (%)',
  roe: 'ROE (%)',
  roa: 'ROA (%)',
  revGrowth: 'TT Doanh thu (%)',
  profitGrowth: 'TT LNST (%)',
};

export const SECURITIES_QUARTERLY_ROW_LABELS = {
  revenue: 'DT từ KD chứng khoán',
  grossProfit: 'Lợi nhuận gộp',
  operatingProfit: 'LNT từ KD chứng khoán',
  netProfit: 'LNST',
  shares: 'KL CP lưu hành',
  grossMargin: 'Biên LN gộp (%)',
  netProfitMargin: 'Biên LN ròng (%)',
  netMargin: 'ROA (%)',
  eps: 'EPS quý',
  epsTtm: 'EPS lũy kế',
  pe: 'P/E',
  roe: 'ROE (%)',
  roa: 'ROA (%)',
  revGrowth: 'TT Doanh thu (%)',
  profitGrowth: 'TT LNST (%)',
};

export const SECURITIES_INPUT_FIELD_LABELS = {
  currentPrice: 'Giá cổ phiếu',
  outstandingShares: 'Số lượng CP lưu hành',
  max52W: 'Giá cao nhất 52T',
  min52W: 'Giá thấp nhất 52T',
  revenueGrowth: '% TT Doanh thu',
  grossMargin: '% Biên LN gộp',
  netProfitGrowth: '% TT LNST',
};

// ============ SECURITIES METRIC MAPPINGS ============
// Map API metrics to securities indicator keys
export const SECURITIES_METRIC_TO_INDICATOR_QUARTERLY: Record<string, string> = {
  REVENUE_NET: 'netRevenue',
  GROSS_PROFIT: 'grossProfit',
  OPERATING_PROFIT: 'operatingProfit',
  NET_PROFIT: 'netProfit',
  MARGIN_LOANS: 'marginLoans',
  TOTAL_ASSETS: 'totalAssets',
  TOTAL_LIABILITIES: 'totalLiabilities',
  EQUITY: 'shareholdersEquity',
  EPS_BASIC: 'eps',
  EPS_TTM: 'epsTtm',
  PE: 'pe',
  ROE: 'roe',
  ROA: 'roa',
  ROS: 'ros',
  BVPS: 'bvps',
  MINORITY_INTEREST: 'minorityInterest',
};

export const SECURITIES_METRIC_TO_INDICATOR_ANNUAL: Record<string, string> = {
  REVENUE_NET: 'netRevenue',
  GROSS_PROFIT: 'grossProfit',
  OPERATING_PROFIT: 'operatingProfit',
  NET_PROFIT: 'netProfit',
  MARGIN_LOANS: 'marginLoans',
  TOTAL_ASSETS: 'totalAssets',
  TOTAL_LIABILITIES: 'totalLiabilities',
  EQUITY: 'shareholdersEquity',
  EPS_BASIC: 'eps',
  EPS_TTM: 'eps',
  PE: 'pe',
  ROE: 'roe',
  ROA: 'roa',
  ROS: 'ros',
  BVPS: 'bvps',
};

// ============ SECURITIES STOCK LIST ============
// List of securities company symbols
export const SECURITIES_STOCKS = [
  'SSI', 'VND', 'HCM', 'VCI', 'SHS', 'MBS', 'VIX', 'BSC', 'CTS', 'ORS',
  'TVS', 'AGR', 'FTS', 'BVS', 'APS', 'DSE', 'EVS', 'VDS', 'TCI', 'VIS',
  'WSS', 'HBS', 'PSI', 'SBS', 'VNDS'
];

/**
 * Check if a symbol is a securities company
 */
export function isSecuritiesStock(symbol: string): boolean {
  return SECURITIES_STOCKS.includes(symbol.toUpperCase());
}
