/**
 * Bank SpreadJS Constants
 * Row labels, positions and configuration for bank stocks
 * Banks have different financial metrics than industrial companies
 */

import type { AnnualRowPositions, QuarterlyRowPositions } from '~/types/spreadJsTypes';

// ============ BANK ANNUAL TABLE ============
export const BANK_ANNUAL_TABLE = {
  START_ROW: 3,
  COLUMN_WIDTH: 110,
};

/**
 * Calculate bank annual row positions based on start row
 * Banks use Total Assets instead of Revenue, and have different metrics
 */
export function getBankAnnualRowPositions(startRow: number): AnnualRowPositions {
  return {
    header: startRow,
    netRevenue: startRow + 1,      // Will show "Thu nhập lãi thuần" (Net Interest Income)
    grossProfit: startRow + 2,     // Will show "Chi phí hoạt động"
    operatingProfit: startRow + 20, // NOT USED - placeholder for type compatibility
    netProfit: startRow + 3,       // Will show "LNST của CĐ Ngân hàng mẹ"
    grossMargin: startRow + 21,    // NOT USED - placeholder for type compatibility
    netProfitMargin: startRow + 4, // Will show "Biên LN ròng (%)"
    netMargin: startRow + 5,       // Will show "ROA (%)"
    eps: startRow + 6,
    pe: startRow + 7,
    ros: startRow + 22,            // Not used - placeholder for type compatibility
    roe: startRow + 8,
    roa: startRow + 9,
    revGrowth: startRow + 10,      // Will show "TT Thu nhập lãi"
    profitGrowth: startRow + 11,
  };
}

// ============ BANK QUARTERLY TABLE ============
export const BANK_QUARTERLY_TABLE = {
  GAP_FROM_ANNUAL: 4,
  COLUMN_WIDTH: 110,
};

/**
 * Calculate bank quarterly row positions based on start row
 */
export function getBankQuarterlyRowPositions(startRow: number): QuarterlyRowPositions {
  return {
    yearHeader: startRow,
    quarterHeader: startRow + 1,
    revenue: startRow + 2,         // Will show "Thu nhập lãi thuần"
    grossProfit: startRow + 3,     // Will show "Tổng thu nhập HĐ"
    operatingProfit: startRow + 20, // NOT USED - placeholder for type compatibility
    grossMargin: startRow + 21,    // NOT USED - placeholder for type compatibility
    netProfit: startRow + 4,       // Shifted up from 6
    shares: startRow + 5,          // Shifted up from 7
    netProfitMargin: startRow + 6, // Shifted up from 8
    netMargin: startRow + 7,       // Shifted up from 9
    eps: startRow + 8,             // Shifted up from 10
    epsTtm: startRow + 9,          // Shifted up from 11
    pe: startRow + 10,             // Shifted up from 12
    roe: startRow + 11,            // Shifted up from 13
    roa: startRow + 12,            // Shifted up from 14
    revGrowth: startRow + 13,      // Shifted up from 15
    profitGrowth: startRow + 14,   // Shifted up from 16
  };
}

// ============ BANK ROW LABELS ============
// Labels matching Vietstock format exactly
export const BANK_ANNUAL_ROW_LABELS = {
  netRevenue: 'Thu nhập lãi thuần',
  grossProfit: 'Chi phí hoạt động',
  netProfit: 'LNST',
  netProfitMargin: 'Biên LN ròng (%)',
  netMargin: 'ROA (%)',
  eps: 'EPS (Vietstock)',
  pe: 'P/E (Vietstock)',
  roe: 'ROE (%)',
  roa: 'ROA (%)',
  revGrowth: 'TT Thu nhập lãi (%)',
  profitGrowth: 'TT LNST (%)',
};

export const BANK_QUARTERLY_ROW_LABELS = {
  revenue: 'Thu nhập lãi thuần',
  grossProfit: 'Chi phí hoạt động',
  netProfit: 'LNST',
  shares: 'KL CP lưu hành',
  netProfitMargin: 'Biên LN ròng (%)',
  netMargin: 'ROA (%)',
  eps: 'EPS quý',
  epsTtm: 'EPS lũy kế',
  pe: 'P/E',
  roe: 'ROE (%)',
  roa: 'ROA (%)',
  revGrowth: 'TT Thu nhập lãi (%)',
  profitGrowth: 'TT LNST (%)',
};

export const BANK_INPUT_FIELD_LABELS = {
  currentPrice: 'Giá cổ phiếu',
  outstandingShares: 'Số lượng CP lưu hành',
  max52W: 'Giá cao nhất 52T',
  min52W: 'Giá thấp nhất 52T',
  niiGrowth: '% TT Thu nhập lãi',
  nimRate: '% NIM',
  netProfitGrowth: '% TT LNST',
};

// ============ BANK METRIC MAPPINGS ============
// Map API metrics to bank indicator keys
export const BANK_METRIC_TO_INDICATOR_QUARTERLY: Record<string, string> = {
  TOTAL_ASSETS: 'totalAssets',
  TOTAL_LIABILITIES: 'totalLiabilities',
  EPS_BASIC: 'eps',
  EPS_TTM: 'epsTtm',
  PE: 'pe',
  ROE: 'roe',
  ROA: 'roa',
  BVPS: 'bvps',
  NET_PROFIT: 'netProfit',
  PROFIT_AFTER_TAX: 'netProfit',
};

export const BANK_METRIC_TO_INDICATOR_ANNUAL: Record<string, string> = {
  TOTAL_ASSETS: 'totalAssets',
  TOTAL_LIABILITIES: 'totalLiabilities',
  EPS_BASIC: 'eps',
  EPS_TTM: 'eps',
  PE: 'pe',
  ROE: 'roe',
  ROA: 'roa',
  BVPS: 'bvps',
};
