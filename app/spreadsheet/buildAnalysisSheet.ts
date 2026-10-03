/**
 * Build the whole analysis sheet for one stock.
 */

import type { AnalysisSheetData, AnalysisSheetLayout, PeriodTable, SheetContext } from './types'
import {
  ANNUAL_TABLE, INPUT_AREA, INPUT_FIELDS, inputRow, QUARTERLY_TABLE, VALUATION_TABLE,
} from '~/constants/spreadJsConstants'
import { getSeparatorBorder, outlineRange } from '~/utils/spreadjs'
import { detectStockType, STOCK_PROFILES } from './profiles'
import {
  applyFinalStyling, buildAnnualTable, buildInputSection, buildQuarterlyTable, buildTitleSection,
  buildValuationTable, linkAnnualToQuarterly, stripeRows,
} from './sections'
import { buildSensitivityTable } from './sensitivity'
import { buildHealthTable } from './health'

export function buildAnalysisSheet(ctx: SheetContext, data: AnalysisSheetData): AnalysisSheetLayout {
  const stockType = detectStockType(data.symbol, data.annualData, data.quarterlyData)
  const profile = STOCK_PROFILES[stockType]

  buildTitleSection(ctx, profile, data.symbol)
  const refs = buildInputSection(ctx, profile, data)

  const annual = buildAnnualTable(ctx, profile, data, refs)
  const quarterly = buildQuarterlyTable(ctx, profile, data, refs, annual.lastRow + QUARTERLY_TABLE.GAP_FROM_ANNUAL)

  linkAnnualToQuarterly(ctx, profile, annual.colMap, annual.rows, quarterly.cols, quarterly.rows, refs)

  const health = buildHealthTable(ctx, stockType, data, quarterly.cols, quarterly.rows, quarterly.lastRow)
  const valuationStartRow = buildValuationTable(ctx, quarterly.cols, quarterly.rows, health?.lastRow ?? quarterly.lastRow, data)
  const valuationLastRow = valuationStartRow + 1 + VALUATION_TABLE.TOTAL_ROWS
  const sensitivity = buildSensitivityTable(ctx, data, refs, quarterly.cols, quarterly.rows, valuationLastRow)

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

  const healthTable: PeriodTable | null = health && {
    firstRow: health.firstDataRow,
    lastRow: health.lastRow,
    firstCol: quarterlyTable.firstCol,
    lastCol: quarterlyTable.lastCol,
    lag: 4,
  }

  // Last: stripes only fill cells that have no colour of their own
  stripeRows(ctx, annualTable.firstRow, annualTable.lastRow, annualTable.lastCol)
  stripeRows(ctx, quarterlyTable.firstRow, quarterlyTable.lastRow, quarterlyTable.lastCol)
  if (healthTable) stripeRows(ctx, healthTable.firstRow, healthTable.lastRow, healthTable.lastCol)
  stripeRows(ctx, valuationStartRow + 2, valuationLastRow, quarterly.nextCol - 1)
  if (sensitivity) stripeRows(ctx, sensitivity.firstDataRow, sensitivity.lastRow, sensitivity.lastCol)

  // Frames: each table outlined, a line under its headers
  const { GC, sheet } = ctx
  const underHeader = (row: number, lastCol: number) =>
    sheet.getRange(row, 0, 1, lastCol + 1).setBorder(getSeparatorBorder(GC), { bottom: true })
  const quarterlyHeaderRow = quarterlyTable.firstRow - 2

  underHeader(ANNUAL_TABLE.START_ROW, annualTable.lastCol)
  outlineRange(GC, sheet, ANNUAL_TABLE.START_ROW, 0, annualTable.lastRow - ANNUAL_TABLE.START_ROW + 1, annualTable.lastCol + 1)
  underHeader(quarterlyHeaderRow + 1, quarterlyTable.lastCol)
  outlineRange(GC, sheet, quarterlyHeaderRow, 0, quarterlyTable.lastRow - quarterlyHeaderRow + 1, quarterlyTable.lastCol + 1)
  if (health) {
    underHeader(health.startRow + 1, quarterlyTable.lastCol)
    outlineRange(GC, sheet, health.startRow, 0, health.lastRow - health.startRow + 1, quarterlyTable.lastCol + 1)
  }
  underHeader(valuationStartRow + 1, quarterlyTable.lastCol)
  outlineRange(GC, sheet, valuationStartRow, 0, valuationLastRow - valuationStartRow + 1, quarterlyTable.lastCol + 1)

  const inputLastRow = inputRow(INPUT_FIELDS[INPUT_FIELDS.length - 1]!)
  const inputLastCol = INPUT_AREA.COL + INPUT_AREA.VALUE_COL_OFFSET + INPUT_AREA.NOTE_SPAN
  sheet.getRange(INPUT_AREA.ROW_START, INPUT_AREA.COL, 1, inputLastCol - INPUT_AREA.COL + 1)
    .setBorder(getSeparatorBorder(GC), { bottom: true })
  outlineRange(GC, sheet, INPUT_AREA.ROW_START, INPUT_AREA.COL, inputLastRow - INPUT_AREA.ROW_START + 1, inputLastCol - INPUT_AREA.COL + 1)

  applyFinalStyling(ctx, maxCol, sensitivity?.lastRow ?? valuationLastRow)

  return {
    stockType,
    quarterlyCols: quarterly.cols,
    sharesRow: quarterly.rows.shares!,
    valuationStartRow,
    quarterlyRows: quarterly.rows,
    growthRows: Object.fromEntries(profile.quarterlyRows
      .filter(spec => spec.forecastInput)
      .map(spec => [spec.forecastInput!, quarterly.rows[spec.key]!])),
    periodTables: healthTable ? [annualTable, quarterlyTable, healthTable] : [annualTable, quarterlyTable],
  }
}

/** The same cell one year earlier (same quarter last year), if it is in the table */
export function samePeriodLastYear(layout: AnalysisSheetLayout, row: number, col: number): { row: number; col: number } | null {
  const table = layout.periodTables.find(t =>
    row >= t.firstRow && row <= t.lastRow && col >= t.firstCol && col <= t.lastCol)
  if (!table || col - table.lag < table.firstCol) return null
  return { row, col: col - table.lag }
}
