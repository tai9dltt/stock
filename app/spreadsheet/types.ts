/**
 * Types for building the analysis spreadsheet.
 */

export type StockType = 'industrial' | 'bank' | 'securities'

/** SpreadJS module, workbook and the sheet being built */
export interface SheetContext {
  GC: any
  spread: any
  sheet: any
}

/** Formula addresses of the editable input cells */
export interface InputCellReferences {
  currentPrice: string
  outstandingShares: string
  revenueGrowth: string
  grossMargin: string
  netProfitGrowth: string
}

/** Logical row keys shared by the annual and quarterly tables */
export type RowKey =
  | 'revenue'
  | 'grossProfit'
  | 'operatingExpenses'
  | 'operatingProfit'
  | 'netProfit'
  | 'shares'
  | 'grossMargin'
  | 'netMargin'
  | 'netProfitMargin'
  | 'assetReturn'
  | 'eps'
  | 'epsTtm'
  | 'pe'
  | 'ros'
  | 'roe'
  | 'roa'
  | 'revGrowth'
  | 'profitGrowth'

/** Row index of each row a table actually has */
export type RowMap = Partial<Record<RowKey, number>>

/** Everything a row renderer needs to fill one cell */
export interface CellContext {
  GC: any
  sheet: any
  rows: RowMap
  refs: InputCellReferences
  col: number
  year: string
  /** 'Q1'..'Q4' in the quarterly table, undefined in the annual table */
  quarter?: string
  isForecast: boolean
  /** Same period one year earlier: previous annual column, or col - 4 in the quarterly table */
  prevYearCol?: number
  /** Raw value of an indicator for this period */
  value: (indicator: string) => any
  /** Outstanding shares for this quarter (quarterly table only) */
  shares?: number
}

export interface RowSpec {
  key: RowKey
  label: string
  /** Red label text */
  emphasize?: boolean
  render: (cell: CellContext) => void
}

export interface StockProfile {
  type: StockType
  title: string
  inputLabels: {
    currentPrice: string
    outstandingShares: string
    max52W: string
    min52W: string
    revenueGrowth: string
    grossMargin: string
    netProfitGrowth: string
  }
  /** A quarter with any of these indicators is actual data, not a forecast */
  actualDataIndicators: string[]
  annualRows: RowSpec[]
  quarterlyRows: RowSpec[]
  /** Annual rows that are always the sum of their 4 quarters */
  annualSumOfQuarters: RowKey[]
}

/** Column of one quarter in the quarterly table */
export interface QuarterlyColumnInfo {
  year: string
  quarter: string
  col: number
  isForecast: boolean
}

/** Data the sheet is built from (state of the analysis page) */
export interface AnalysisSheetData {
  symbol: string
  annualData: Record<string, any>
  quarterlyData: Record<string, any>
  forecastYears: string[]
  forecastQuarters: string[]
  /** Saved P/E scenarios of the valuation table; empty = derive defaults */
  peScenarios: number[]
  tradingDate: string
  currentPrice: number
  outstandingShares: number
  max52W: number
  min52W: number
  revenueGrowth: number
  grossMargin: number
  netProfitGrowth: number
}

/** Positions the page needs to read user edits back from the sheet */
export interface AnalysisSheetLayout {
  stockType: StockType
  quarterlyCols: QuarterlyColumnInfo[]
  sharesRow: number
  valuationStartRow: number
}
