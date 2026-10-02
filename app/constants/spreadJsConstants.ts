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
// Page indicator ← DB metric codes, highest priority first. When several codes
// feed one indicator, each period takes the first code that has a value.
const SHARED_INDICATOR_SOURCES: Record<string, string[]> = {
  netRevenue: ['REVENUE_NET'],
  grossProfit: ['GROSS_PROFIT'],
  operatingProfit: ['OPERATING_PROFIT'],
  // Profit attributable to the parent company; total profit after tax as fallback
  netProfit: ['NET_PROFIT', 'PROFIT_AFTER_TAX'],
  eps: ['EPS_BASIC', 'EPS_TTM'],
  pe: ['PE'],
  roe: ['ROE'],
  roa: ['ROA'],
  totalAssets: ['TOTAL_ASSETS'],
  totalLiabilities: ['TOTAL_LIABILITIES'],
  bvps: ['BVPS'],
  // Bank-specific
  netInterestIncome: ['NET_INTEREST_INCOME'],
  operatingExpenses: ['OPERATING_EXPENSES'],
  totalOperatingIncome: ['TOTAL_OPERATING_INCOME'],
  totalNetProfit: ['TOTAL_NET_PROFIT'],
};

export const QUARTERLY_INDICATOR_SOURCES: Record<string, string[]> = {
  ...SHARED_INDICATOR_SOURCES,
  netMargin: ['ROS'],
  currentAssets: ['CURRENT_ASSETS'],
  shortTermLiabilities: ['SHORT_TERM_LIABILITIES'],
  equity: ['EQUITY'],
};

export const ANNUAL_INDICATOR_SOURCES: Record<string, string[]> = {
  ...SHARED_INDICATOR_SOURCES,
  ros: ['ROS'],
};
