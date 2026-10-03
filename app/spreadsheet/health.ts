/**
 * Financial health table, under the quarterly table: is the profit backed by
 * cash, how indebted and liquid the company is (banks: margin, cost, loans
 * to deposits). Ratios come from Vietstock "Chỉ số tài chính", per reported
 * quarter; forecast quarters stay empty.
 */

import type { AnalysisSheetData, QuarterlyColumnInfo, RowMap, SheetContext, StockType } from './types'
import { applyBorder, applyYoyChangeHighlight, getSeparatorBorder, relativeAddr, setCell } from '~/utils/spreadjs'
import { writePeriodHeaders } from './sections'

interface HealthRow {
  label: string
  /** Reported ratio, or a figure computed from it */
  source: { indicator: string; percent?: boolean } | 'operatingCashFlow' | 'cashToProfitTtm'
  format: string
  /** Conditions on the cell, written with {c} for it, e.g. "{c}<1" */
  red?: string
  green?: string
  /** Colour by change against the same quarter last year instead */
  yoy?: boolean
}

// Operating cash flow = (cash flow ÷ operating profit, %) × operating profit
const CASH_ROWS: HealthRow[] = [
  { label: 'Dòng tiền HĐKD (tr.đ)', source: 'operatingCashFlow', format: '#,##0', red: '{c}<0' },
  { label: 'Dòng tiền 4Q ÷ LNST 4Q', source: 'cashToProfitTtm', format: '0.00', red: '{c}<0.5', green: '{c}>=1' },
]

export const HEALTH_ROWS: Record<StockType, HealthRow[]> = {
  industrial: [
    ...CASH_ROWS,
    { label: 'Nợ vay ÷ VCSH', source: { indicator: 'borrowingsToEquity', percent: true }, format: '0%', red: '{c}>1' },
    { label: 'Nợ phải trả ÷ VCSH', source: { indicator: 'debtToEquity', percent: true }, format: '0%', red: '{c}>2' },
    { label: 'Thanh toán hiện hành', source: { indicator: 'currentRatio' }, format: '0.00', red: '{c}<1' },
    { label: 'Vòng quay HTK', source: { indicator: 'inventoryTurnover' }, format: '0.00', yoy: true },
    { label: 'Khả năng trả lãi vay', source: { indicator: 'interestCoverage' }, format: '0.00', red: '{c}<2', green: '{c}>=5' },
  ],
  securities: [
    ...CASH_ROWS,
    { label: 'Nợ phải trả ÷ VCSH', source: { indicator: 'debtToEquity', percent: true }, format: '0%', red: '{c}>3' },
    { label: 'Thanh toán hiện hành', source: { indicator: 'currentRatio' }, format: '0.00', red: '{c}<1' },
    { label: 'Khả năng trả lãi vay', source: { indicator: 'interestCoverage' }, format: '0.00', red: '{c}<2', green: '{c}>=5' },
  ],
  bank: [
    { label: 'NIM (quý)', source: { indicator: 'nim', percent: true }, format: '0.00%', yoy: true },
    { label: 'CIR', source: { indicator: 'cir', percent: true }, format: '0.00%', red: '{c}>0.5', green: '{c}<=0.35' },
    { label: 'LDR', source: { indicator: 'ldr', percent: true }, format: '0.00%', red: '{c}>0.85' },
  ],
}

export interface HealthTable {
  startRow: number
  firstDataRow: number
  lastRow: number
}

const indicatorsOf = (rows: HealthRow[]) =>
  rows.flatMap(r => (typeof r.source === 'object' ? [r.source.indicator] : ['cfoToOperatingProfit']))

export function buildHealthTable(
  ctx: SheetContext,
  stockType: StockType,
  data: AnalysisSheetData,
  quarterlyCols: QuarterlyColumnInfo[],
  quarterlyRows: RowMap,
  afterRow: number
): HealthTable | null {
  const { GC, sheet } = ctx
  const rows = HEALTH_ROWS[stockType]
  const value = (indicator: string, year: string, quarter: string) => {
    const v = data.quarterlyData[indicator]?.[year]?.[quarter]
    const n = Number(v)
    return v === null || v === undefined || v === '' || !Number.isFinite(n) ? undefined : n
  }

  // Stocks crawled before the ratios existed: no table
  const hasRatios = quarterlyCols.some(q => indicatorsOf(rows).some(i => value(i, q.year, q.quarter) !== undefined))
  if (!hasRatios || quarterlyCols.length === 0) return null

  const startRow = afterRow + 3
  const firstDataRow = startRow + 2
  const lastRow = firstDataRow + rows.length - 1
  const firstCol = quarterlyCols[0]!.col
  const rowOf = (index: number) => firstDataRow + index
  const cashRow = rows.findIndex(r => r.source === 'operatingCashFlow')

  writePeriodHeaders(ctx, quarterlyCols, startRow, 'Sức khoẻ tài chính', 'Chỉ số (Vietstock)')

  rows.forEach((spec, i) => {
    const row = rowOf(i)
    setCell(GC, sheet, row, 0, spec.label, { border: true })

    for (const { year, quarter, col, isForecast } of quarterlyCols) {
      if (isForecast) {
        applyBorder(GC, sheet, row, col)
        continue
      }
      if (spec.source === 'operatingCashFlow') {
        const ratio = value('cfoToOperatingProfit', year, quarter)
        const profit = value('operatingProfit', year, quarter)
        setCell(GC, sheet, row, col, ratio !== undefined && profit !== undefined ? Math.round(ratio / 100 * profit) : null,
          { format: spec.format, border: true })
      } else if (spec.source === 'cashToProfitTtm') {
        // Needs the 4 quarters of cash flow; net profit from the quarterly table
        if (col - 3 >= firstCol && cashRow >= 0 && quarterlyRows.netProfit !== undefined) {
          const cash = relativeRange(rowOf(cashRow), col)
          const profit = relativeRange(quarterlyRows.netProfit, col)
          sheet.setFormula(row, col, `IF(AND(COUNT(${cash})=4, SUM(${profit})<>0), SUM(${cash})/SUM(${profit}), "")`)
          sheet.setFormatter(row, col, spec.format)
        }
        applyBorder(GC, sheet, row, col)
      } else {
        const v = value(spec.source.indicator, year, quarter)
        setCell(GC, sheet, row, col, v === undefined ? null : spec.source.percent ? v / 100 : v,
          { format: spec.format, border: true })
      }
    }

    highlight(ctx, spec, row, firstCol, quarterlyCols.length)
  })

  // Same separators as the tables above: after each year
  for (const { quarter, col } of quarterlyCols) {
    if (quarter === 'Q4') {
      sheet.getRange(startRow, col, lastRow - startRow + 1, 1).setBorder(getSeparatorBorder(GC), { right: true })
    }
  }

  return { startRow, firstDataRow, lastRow }
}

/** This quarter and the 3 before it in a row, e.g. "F27:I27" */
const relativeRange = (row: number, col: number) => `${relativeAddr(row, col - 3)}:${relativeAddr(row, col)}`

function highlight(ctx: SheetContext, spec: HealthRow, row: number, firstCol: number, colCount: number) {
  const { GC, sheet } = ctx
  if (spec.yoy) {
    if (colCount > 4) applyYoyChangeHighlight(GC, sheet, row, firstCol + 4, colCount - 4)
    return
  }
  const range = [new GC.Spread.Sheets.Range(row, firstCol, 1, colCount)]
  // Relative to the first cell of the range, like Excel
  const cell = relativeAddr(row, firstCol)
  const rule = (condition: string, backColor: string) => {
    const style = new GC.Spread.Sheets.Style()
    style.backColor = backColor
    sheet.conditionalFormats.addFormulaRule(
      `=AND(ISNUMBER(${cell}), ${condition.replaceAll('{c}', cell)})`, style, range)
  }
  if (spec.green) rule(spec.green, '#C6EFCE')
  if (spec.red) rule(spec.red, '#FFC7CE')
}
