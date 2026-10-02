/**
 * SpreadJS Constants
 * Magic numbers and configuration values for spreadsheet layout
 */

// ============ COLORS ============
export const SPREADJS_COLORS = {
  SELECTED: '#E3F2FD',
  HEADER: '#cffc03',
  FORECAST: '#FF1493',
  HISTORICAL: '#70AD47',
  INPUT: '#FFF2CC',
  DISPLAY: '#E2EFDA',
  DEFAULT_HIGHLIGHT: '#FFE4E1',
  TEXT_RED: '#e02926',
};

// ============ YEAR DETECTION ============
// Metrics to check for year detection (in priority order)
// Banks don't have netRevenue, so we check multiple metrics including netInterestIncome
export const YEAR_DETECTION_METRICS = [
  'netRevenue',
  'netInterestIncome', // Bank-specific
  'totalAssets',
  'eps',
  'netProfit',
  'roe',
  'pe',
  'totalLiabilities',
  'bvps',
];

// ============ INPUT AREA ============
export const INPUT_AREA = {
  COL: 10, // Column K
  ROW_START: 3,
  VALUE_COL_OFFSET: 2, // Values in COL + 2
};

// ============ ANNUAL TABLE ============
export const ANNUAL_TABLE = {
  START_ROW: 3,
  COLUMN_WIDTH: 110,
};

// ============ QUARTERLY TABLE ============
export const QUARTERLY_TABLE = {
  GAP_FROM_ANNUAL: 4,
  COLUMN_WIDTH: 110,
};

// ============ VALUATION TABLE ============
export const VALUATION_TABLE = {
  TOTAL_ROWS: 10,
};

// ============ DATE RANGES ============
export const QUARTER_DATE_RANGES = [
  '01/01-31/03',
  '01/04-30/06',
  '01/07-30/09',
  '01/10-31/12',
];

// ============ METRIC MAPPINGS ============
export const METRIC_TO_INDICATOR_QUARTERLY: Record<string, string> = {
  REVENUE_NET: 'netRevenue',
  GROSS_PROFIT: 'grossProfit',
  OPERATING_PROFIT: 'operatingProfit',
  NET_PROFIT: 'netProfit',
  PROFIT_AFTER_TAX: 'netProfit',
  EPS_TTM: 'eps',
  EPS_BASIC: 'eps',
  PE: 'pe',
  ROS: 'netMargin',
  ROE: 'roe',
  ROA: 'roa',
  TOTAL_ASSETS: 'totalAssets',
  CURRENT_ASSETS: 'currentAssets',
  TOTAL_LIABILITIES: 'totalLiabilities',
  SHORT_TERM_LIABILITIES: 'shortTermLiabilities',
  EQUITY: 'equity',
  BVPS: 'bvps',
  // Bank-specific metrics
  NET_INTEREST_INCOME: 'netInterestIncome',
  OPERATING_EXPENSES: 'operatingExpenses',
  TOTAL_OPERATING_INCOME: 'totalOperatingIncome',
  TOTAL_NET_PROFIT: 'totalNetProfit',
};

export const METRIC_TO_INDICATOR_ANNUAL: Record<string, string> = {
  REVENUE_NET: 'netRevenue',
  GROSS_PROFIT: 'grossProfit',
  OPERATING_PROFIT: 'operatingProfit',
  NET_PROFIT: 'netProfit',
  PROFIT_AFTER_TAX: 'netProfit',
  EPS_TTM: 'eps',
  EPS_BASIC: 'eps',
  PE: 'pe',
  ROS: 'ros',
  ROE: 'roe',
  ROA: 'roa',
  // Bank-specific metrics
  TOTAL_ASSETS: 'totalAssets',
  TOTAL_LIABILITIES: 'totalLiabilities',
  BVPS: 'bvps',
  NET_INTEREST_INCOME: 'netInterestIncome',
  OPERATING_EXPENSES: 'operatingExpenses',
  TOTAL_OPERATING_INCOME: 'totalOperatingIncome',
  TOTAL_NET_PROFIT: 'totalNetProfit',
};
