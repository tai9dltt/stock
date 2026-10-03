/**
 * Build the whole analysis sheet for one stock.
 */

import type { AnalysisSheetData, AnalysisSheetLayout, PeriodTable, SheetContext } from './types'
import { ANNUAL_TABLE, INPUT_AREA, QUARTERLY_TABLE, VALUATION_TABLE } from '~/constants/spreadJsConstants'
import { detectStockType, STOCK_PROFILES } from './profiles'
import {
  applyFinalStyling, buildAnnualTable, buildInputSection, buildQuarterlyTable, buildTitleSection,
  buildValuationTable, linkAnnualToQuarterly, stripeRows,
} from './sections'

export function buildAnalysisSheet(ctx: SheetContext, data: AnalysisSheetData): AnalysisSheetLayout {
  const stockType = detectStockType(data.symbol, data.annualData, data.quarterlyData)
  const profile = STOCK_PROFILES[stockType]

  buildTitleSection(ctx, profile, data.symbol)
  const refs = buildInputSection(ctx, profile, data)

  const annual = buildAnnualTable(ctx, profile, data, refs)
  const quarterly = buildQuarterlyTable(ctx, profile, data, refs, annual.lastRow + QUARTERLY_TABLE.GAP_FROM_ANNUAL)

  linkAnnualToQuarterly(ctx, profile, annual.colMap, annual.rows, quarterly.cols, quarterly.rows, refs)

  const valuationStartRow = buildValuationTable(ctx, quarterly.cols, quarterly.rows, quarterly.lastRow, data)

  const maxCol = Math.max(
    INPUT_AREA.COL + INPUT_AREA.VALUE_COL_OFFSET + 1 + INPUT_AREA.NOTE_SPAN,
    quarterly.nextCol + 1,
    Math.max(0, ...Object.values(annual.colMap)) + 1,
    30
  )
  const annualTable: PeriodTable = {
    firstRow: ANNUAL_TABLE.START_ROW + 1,
    lastRow: annual.lastRow,
    firstCol: 1,
    lastCol: Math.max(0, ...Object.values(annual.colMap)),
    lag: 1,
  }
  const quarterlyTable: PeriodTable = {
    firstRow: Math.min(...Object.values(quarterly.rows)),
    lastRow: quarterly.lastRow,
    firstCol: quarterly.cols[0]?.col ?? 1,
    lastCol: quarterly.nextCol - 1,
    lag: 4,
  }

  // Last: stripes only fill cells that have no colour of their own
  stripeRows(ctx, annualTable.firstRow, annualTable.lastRow, annualTable.lastCol)
  stripeRows(ctx, quarterlyTable.firstRow, quarterlyTable.lastRow, quarterlyTable.lastCol)
  stripeRows(ctx, valuationStartRow + 2, valuationStartRow + 1 + VALUATION_TABLE.TOTAL_ROWS, quarterly.nextCol - 1)

  applyFinalStyling(ctx, maxCol, valuationStartRow)

  return {
    stockType,
    quarterlyCols: quarterly.cols,
    sharesRow: quarterly.rows.shares!,
    valuationStartRow,
    growthRows: { revenue: quarterly.rows.revGrowth!, netProfit: quarterly.rows.profitGrowth! },
    periodTables: [annualTable, quarterlyTable],
  }
}

/** The same cell one year earlier (same quarter last year), if it is in the table */
export function samePeriodLastYear(layout: AnalysisSheetLayout, row: number, col: number): { row: number; col: number } | null {
  const table = layout.periodTables.find(t =>
    row >= t.firstRow && row <= t.lastRow && col >= t.firstCol && col <= t.lastCol)
  if (!table || col - table.lag < table.firstCol) return null
  return { row, col: col - table.lag }
}
