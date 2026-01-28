/**
 * SpreadJS Type Definitions
 * TypeScript interfaces for SpreadJS-related data structures
 */

/**
 * SpreadJS context - holds references to GC module and active sheet
 */
export interface SpreadJSContext {
  GC: any;
  spread: any;
  sheet: any;
}

/**
 * Mapping of year strings to column indices for annual table
 */
export type AnnualColumnMap = Record<string, number>;

/**
 * Quarterly column information with metadata
 */
export interface QuarterlyColumnInfo {
  year: string;
  quarter: string; // Q1, Q2, Q3, Q4
  col: number;
  isForecast: boolean;
}

/**
 * Style options for setCell utility
 */
export interface CellStyle {
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: string;
  color?: string;
  bg?: string;
  border?: boolean;
  size?: number;
}

/**
 * Input cell addresses for formula references
 */
export interface InputCellReferences {
  currentPrice: string;
  revenueGrowth: string;
  grossMargin: string;
  netProfitGrowth: string;
}

/**
 * Annual table row positions
 */
export interface AnnualRowPositions {
  header: number;
  netRevenue: number;
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  eps: number;
  pe: number;
  ros: number;
  roe: number;
  roa: number;
  revGrowth: number;
  profitGrowth: number;
}

/**
 * Quarterly table row positions
 */
export interface QuarterlyRowPositions {
  yearHeader: number;
  quarterHeader: number;
  revenue: number;
  grossProfit: number;
  operatingProfit: number;
  grossMargin: number;
  netProfit: number;
  shares: number;
  netMargin: number;
  eps: number;
  epsTtm: number;
  pe: number;
  revGrowth: number;
  profitGrowth: number;
}

/**
 * Valuation table configuration
 */
export interface ValuationConfig {
  startRow: number;
  totalRows: number;
  peScenarios: number[];
}

/**
 * Stock data references from reactive state
 */
export interface StockDataRefs {
  outstandingShares: number;
  currentPrice: number;
  min52W: number;
  max52W: number;
  revenueGrowth: number;
  grossMargin: number;
  netProfitGrowth: number;
  tradingDate: string;
  annualData: Record<string, any>;
  quarterlyData: Record<string, any>;
  forecastYears: string[];
  forecastQuarters: string[];
  peAssumptions: Record<string, any>;
}
