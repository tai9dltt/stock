/**
 * Target price sensitivity: how the price moves with next-4-quarter profit
 * growth (rows) and the P/E paid for it (columns).
 *
 *   price = trailing EPS of the latest reported quarter × (1 + growth) × P/E
 *
 * Everything is a live formula, so editing a growth or P/E cell, or the
 * price input, recalculates the table (also in the Excel export).
 */

import type { AnalysisSheetData, InputCellReferences, QuarterlyColumnInfo, RowMap, SheetContext } from './types'
import { SPREADJS_COLORS } from '~/constants/spreadJsConstants'
import { applyBorder, columnName, getCellAddr, getSeparatorBorder, outlineRange, relativeAddr, setCell } from '~/utils/spreadjs'
import { peLadder } from './peLadder'

export const SENSITIVITY_TABLE = {
  /** Empty rows between the valuation table and this one */
  GAP: 3,
  GROWTHS: [-0.1, 0, 0.1, 0.2, 0.3],
  /** Up to this many P/E columns (the ladder levels) */
  MAX_PE: 6,
  /** Green from this multiple of the current price */
  GOOD_UPSIDE: 1.2,
}

export interface SensitivityTable {
  startRow: number
  /** Growth rows */
  firstDataRow: number
  lastRow: number
  lastCol: number
}

const HEADER = { bold: true, border: true, bg: SPREADJS_COLORS.HEADER }

export function buildSensitivityTable(
  ctx: SheetContext,
  data: AnalysisSheetData,
  refs: InputCellReferences,
  quarterlyCols: QuarterlyColumnInfo[],
  quarterlyRows: RowMap,
  afterRow: number
): SensitivityTable | null {
  const { GC, sheet } = ctx
  const latest = quarterlyCols.filter(q => !q.isForecast).at(-1)
  if (!latest || quarterlyRows.epsTtm === undefined) return null

  const ladder = peLadder(data).slice(0, SENSITIVITY_TABLE.MAX_PE)
  const startRow = afterRow + SENSITIVITY_TABLE.GAP
  const labelRow = startRow + 1
  const peRow = startRow + 2
  const firstDataRow = startRow + 3
  const lastRow = firstDataRow + SENSITIVITY_TABLE.GROWTHS.length - 1
  const lastCol = ladder.length
  const epsAddr = getCellAddr(GC, sheet, quarterlyRows.epsTtm, latest.col)

  // Title, and how the cells are computed
  setCell(GC, sheet, startRow, 0, 'Độ nhạy giá mục tiêu', { ...HEADER, align: 'center' })
  setCell(GC, sheet, startRow, 1,
    `Giá = EPS 4 quý ${latest.quarter}/${latest.year} × (1 + TT LNST 4 quý tới) × P/E`,
    { ...HEADER, align: 'left' })
  if (lastCol > 1) sheet.addSpan(startRow, 1, 1, lastCol)

  // P/E columns: the ladder levels with their meaning above. Not editable,
  // so a label always matches its value (scenarios are edited in the P/E table)
  setCell(GC, sheet, labelRow, 0, '', { ...HEADER })
  setCell(GC, sheet, peRow, 0, 'TT LNST \\ P/E', { ...HEADER, align: 'center' })
  ladder.forEach(({ value, label }, i) => {
    setCell(GC, sheet, labelRow, 1 + i, label, { border: true, bg: SPREADJS_COLORS.HEADER, align: 'center', color: SPREADJS_COLORS.NOTE })
    setCell(GC, sheet, peRow, 1 + i, value, { ...HEADER, align: 'center', format: '0.00' })
  })

  // Growth rows, editable; each cell is EPS × (1 + growth) × P/E
  SENSITIVITY_TABLE.GROWTHS.forEach((growth, r) => {
    const row = firstDataRow + r
    setCell(GC, sheet, row, 0, growth, { bold: true, border: true, align: 'center', format: '+0%;-0%;0%' })
    sheet.getCell(row, 0).locked(false)
    for (let col = 1; col <= lastCol; col++) {
      sheet.setFormula(row, col, `${epsAddr} * (1 + $A${row + 1}) * ${columnName(col)}$${peRow + 1}`)
      sheet.setFormatter(row, col, '#,##0')
      applyBorder(GC, sheet, row, col)
    }
  })

  highlightAgainstPrice(ctx, refs.currentPrice, firstDataRow, lastRow, lastCol)

  sheet.getRange(peRow, 0, 1, lastCol + 1).setBorder(getSeparatorBorder(GC), { bottom: true })
  sheet.getRange(firstDataRow, 0, SENSITIVITY_TABLE.GROWTHS.length, 1).setBorder(getSeparatorBorder(GC), { right: true })
  outlineRange(GC, sheet, startRow, 0, lastRow - startRow + 1, lastCol + 1)

  return { startRow, firstDataRow, lastRow, lastCol }
}

/** Green: at least 20% above the price; yellow: above it; red: below it */
function highlightAgainstPrice(ctx: SheetContext, priceAddr: string, firstRow: number, lastRow: number, lastCol: number) {
  const { GC, sheet } = ctx
  if (lastCol < 1) return
  const range = [new GC.Spread.Sheets.Range(firstRow, 1, lastRow - firstRow + 1, lastCol)]
  // Relative to the first cell of the range, like Excel
  const cell = relativeAddr(firstRow, 1)
  const style = (backColor: string) => {
    const s = new GC.Spread.Sheets.Style()
    s.backColor = backColor
    return s
  }
  const good = `${priceAddr} * ${SENSITIVITY_TABLE.GOOD_UPSIDE}`
  const cfs = sheet.conditionalFormats
  cfs.addFormulaRule(`=AND(ISNUMBER(${cell}), ${priceAddr}>0, ${cell}>=${good})`, style('#C6EFCE'), range)
  cfs.addFormulaRule(`=AND(ISNUMBER(${cell}), ${priceAddr}>0, ${cell}>=${priceAddr}, ${cell}<${good})`, style('#FEF3C7'), range)
  cfs.addFormulaRule(`=AND(ISNUMBER(${cell}), ${priceAddr}>0, ${cell}<${priceAddr})`, style('#FFC7CE'), range)
}
