/**
 * SpreadJS Constants
 * Magic numbers and configuration values for spreadsheet layout
 */

// ============ COLORS ============
// Muted palette matching the app (slate neutrals); forecasts are the one accent
export const SPREADJS_COLORS = {
  SELECTED: '#EEF6FF', // row highlight on select
  HEADER: '#E2E8F0', // "Chỉ số" / "Niên độ" corner cells, input header
  HISTORICAL: '#F1F5F9', // reported period headers
  FORECAST: '#FCE7F3', // forecast period headers (F)
  FORECAST_TEXT: '#9D174D', // text on forecast headers and forecast notes
  INPUT: '#FEF9C3', // editable inputs
  DISPLAY: '#F1F5F9',
  /** Every other row of the tables, to follow a row across many columns */
  STRIPE: '#EEF2F6',
  /** Lines between cells of a table */
  GRID: '#CBD5E1',
  /** Table frame, under headers, between years */
  FRAME: '#64748B',
  /** Outline of the same period last year as the selected cell */
  COMPARISON: '#F59E0B', // read-only inputs
  DEFAULT_HIGHLIGHT: '#FEF3C7', // default P/E row in the valuation table
  TEXT_RED: '#B91C1C', // emphasized row labels
  TITLE: '#0F172A',
  SYMBOL: '#007F45',
  NOTE: '#64748B',
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
/** Input rows below the date header (INPUT_AREA.ROW_START), in sheet order */
export const INPUT_FIELDS = [
  'currentPrice',
  'outstandingShares',
  'max52W',
  'min52W',
  'revenueGrowth',
  'grossMargin',
  'netProfitGrowth',
] as const;

export type InputFieldName = (typeof INPUT_FIELDS)[number];

/** Sheet row of an input value */
export const inputRow = (field: InputFieldName) => INPUT_AREA.ROW_START + 1 + INPUT_FIELDS.indexOf(field);

export const INPUT_AREA = {
  COL: 10, // Column K
  ROW_START: 3,
  VALUE_COL_OFFSET: 2, // Values in COL + 2
  NOTE_SPAN: 3, // Note ("actual" / "forecast") right of the values, over 3 columns
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
