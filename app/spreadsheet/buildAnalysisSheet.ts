/**
 * Build the whole analysis sheet for one stock.
 */

import type { AnalysisSheetData, AnalysisSheetLayout, SheetContext } from './types'
import { INPUT_AREA, QUARTERLY_TABLE } from '~/constants/spreadJsConstants'
import { detectStockType, STOCK_PROFILES } from './profiles'
import {
  applyFinalStyling, buildAnnualTable, buildInputSection, buildQuarterlyTable, buildTitleSection,
  buildValuationTable, linkAnnualToQuarterly,
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
  applyFinalStyling(ctx, maxCol, valuationStartRow)

  return {
    stockType,
    quarterlyCols: quarterly.cols,
    sharesRow: quarterly.rows.shares!,
    valuationStartRow,
    growthRows: { revenue: quarterly.rows.revGrowth!, netProfit: quarterly.rows.profitGrowth! },
  }
}
