/**
 * Cell renderers: building blocks the stock profiles compose their rows from.
 *
 * Each renderer fills one cell of a row for one period and leaves it bordered.
 */

import type { CellContext, GrowthKind, RowKey } from './types'
import { SPREADJS_COLORS } from '~/constants/spreadJsConstants'
import { applyBorder, getCellAddr, getThinBorder, setCell, setDivisionFormula } from '~/utils/spreadjs'

type Renderer = (cell: CellContext) => void

const AMOUNT = '#,##0'
const PERCENT = '0.00%'

const isPresent = (v: unknown) => v !== undefined && v !== null

function rowOf(cell: CellContext, key: RowKey): number {
  const row = cell.rows[key]
  if (row === undefined) throw new Error(`Row "${key}" is not part of this table`)
  return row
}

const addrOf = (cell: CellContext, key: RowKey, col = cell.col) =>
  getCellAddr(cell.GC, cell.sheet, rowOf(cell, key), col)

function setFormula(cell: CellContext, key: RowKey, formula: string, format: string) {
  const row = rowOf(cell, key)
  cell.sheet.setFormula(row, cell.col, formula)
  cell.sheet.setFormatter(row, cell.col, format)
}

const border = (cell: CellContext, key: RowKey) => applyBorder(cell.GC, cell.sheet, rowOf(cell, key), cell.col)

/** Reported amount, e.g. revenue in million VND */
export function amount(key: RowKey, indicator: string): Renderer {
  return (cell) => {
    setCell(cell.GC, cell.sheet, rowOf(cell, key), cell.col, cell.value(indicator), { format: AMOUNT, border: true })
    border(cell, key)
  }
}

/**
 * Reported amount; in forecast periods projected from the same period last year:
 * last year × (1 + growth). The growth is the input above the sheet, or the
 * period's own growth cell when `growthRow` is given (quarterly table).
 */
export function projectedAmount(
  key: RowKey,
  indicator: string,
  growthRef: 'revenueGrowth' | 'netProfitGrowth',
  growthRow?: RowKey
): Renderer {
  return (cell) => {
    if (cell.isForecast && cell.prevYearCol) {
      const rate = growthRow ? addrOf(cell, growthRow) : cell.refs[growthRef]
      setFormula(cell, key, `${addrOf(cell, key, cell.prevYearCol)} * (1 + ${rate})`, AMOUNT)
    } else {
      setCell(cell.GC, cell.sheet, rowOf(cell, key), cell.col, cell.value(indicator), { format: AMOUNT, border: true })
    }
    border(cell, key)
  }
}

/**
 * Gross profit; in forecast quarters revenue × gross margin: the input above
 * the sheet, or the quarter's own margin cell when `marginRow` is given
 */
export function forecastGrossProfit(marginRow?: RowKey): Renderer {
  return (cell) => {
    if (cell.isForecast) {
      const margin = marginRow ? addrOf(cell, marginRow) : cell.refs.grossMargin
      setFormula(cell, 'grossProfit', `${addrOf(cell, 'revenue')} * ${margin}`, AMOUNT)
    } else {
      setCell(cell.GC, cell.sheet, rowOf(cell, 'grossProfit'), cell.col, cell.value('grossProfit'), {
        format: AMOUNT,
        border: true,
      })
    }
    border(cell, 'grossProfit')
  }
}

interface ReportedOptions {
  /** Vietstock sends percentages as 15.2 → store 0.152 */
  fromPercent?: boolean
  /** Leave forecast periods to formulas (see linkAnnualToQuarterly) */
  historicalOnly?: boolean
  /** Don't touch the cell when there is no value */
  skipEmpty?: boolean
}

/** Reported ratio or per-share figure (EPS, P/E, ROE, ...) */
export function reported(key: RowKey, indicator: string, format: string, options: ReportedOptions = {}): Renderer {
  return (cell) => {
    const raw = cell.value(indicator)
    const skip = (options.historicalOnly && cell.isForecast) || (options.skipEmpty && !isPresent(raw))

    if (!skip) {
      const value = options.fromPercent ? (isPresent(raw) ? Number(raw) / 100 : null) : raw
      setCell(cell.GC, cell.sheet, rowOf(cell, key), cell.col, value, { format, border: true })
    }
    border(cell, key)
  }
}

/** numerator / denominator, e.g. gross margin = gross profit / revenue */
export function ratio(key: RowKey, numerator: RowKey, denominator: RowKey): Renderer {
  return (cell) => {
    setDivisionFormula(
      cell.GC, cell.sheet,
      rowOf(cell, key), cell.col,
      rowOf(cell, numerator), cell.col,
      rowOf(cell, denominator), cell.col,
      PERCENT
    )
    border(cell, key)
  }
}

/** Bank return on assets: net profit / total assets, else reported ROA */
export function assetReturn(): Renderer {
  return (cell) => {
    const netProfit = cell.value('netProfit')
    const totalAssets = cell.value('totalAssets')
    const roa = cell.value('roa')

    let value: number | null = null
    if (totalAssets && totalAssets > 0 && netProfit) value = netProfit / totalAssets
    else if (roa) value = roa / 100

    setCell(cell.GC, cell.sheet, rowOf(cell, 'assetReturn'), cell.col, value, { format: PERCENT, border: true })
    border(cell, 'assetReturn')
  }
}

/** Outstanding shares of the quarter (editable) */
export function shares(): Renderer {
  return (cell) => {
    const row = rowOf(cell, 'shares')
    setCell(cell.GC, cell.sheet, row, cell.col, cell.shares, { format: AMOUNT, border: true })
    cell.sheet.getCell(row, cell.col).locked(false)
    border(cell, 'shares')
  }
}

/** Quarterly EPS = net profit (million VND) × 1,000,000 / shares */
export function quarterlyEps(): Renderer {
  return (cell) => {
    const sharesAddr = addrOf(cell, 'shares')
    setFormula(cell, 'eps', `IF(${sharesAddr}<>0, (${addrOf(cell, 'netProfit')} * 1000000) / ${sharesAddr}, 0)`, AMOUNT)
    border(cell, 'eps')
  }
}

/** This quarter and the 3 before it, e.g. "F27:I27" */
function lastFourQuarters(cell: CellContext, key: RowKey): string {
  return cell.GC.Spread.Sheets.CalcEngine.rangeToFormula(
    cell.sheet.getRange(rowOf(cell, key), cell.col - 3, 1, 4)
  )
}

/**
 * Trailing 4-quarter EPS: reported for historical quarters, else
 * net profit of the last 4 quarters (million VND) × 1,000,000 / this quarter's shares.
 * (Adding up quarterly EPS would mix share counts before and after stock dividends.)
 */
export function trailingEps(): Renderer {
  return (cell) => {
    // Vietstock reports TTM EPS under both 'epsTtm' and 'eps'
    const reportedTtm = [cell.value('epsTtm'), cell.value('eps')].find(isPresent)

    if (!cell.isForecast && reportedTtm !== undefined) {
      setCell(cell.GC, cell.sheet, rowOf(cell, 'epsTtm'), cell.col, reportedTtm, { format: AMOUNT, border: true })
    } else if (cell.col >= 4) {
      const sharesAddr = addrOf(cell, 'shares')
      setFormula(
        cell, 'epsTtm',
        `IF(${sharesAddr}<>0, SUM(${lastFourQuarters(cell, 'netProfit')}) * 1000000 / ${sharesAddr}, 0)`,
        AMOUNT
      )
    }
    border(cell, 'epsTtm')
  }
}

/**
 * Quarterly P/E: reported value, else in forecast quarters price / trailing EPS.
 * @param reportedInForecast also prefer a reported P/E in forecast quarters
 */
export function quarterlyPe(reportedInForecast: boolean): Renderer {
  return (cell) => {
    const pe = cell.value('pe')

    if (isPresent(pe) && (reportedInForecast || !cell.isForecast)) {
      setCell(cell.GC, cell.sheet, rowOf(cell, 'pe'), cell.col, pe, { format: '0.00', border: true })
    } else if (cell.isForecast && cell.col >= 4) {
      const epsTtm = addrOf(cell, 'epsTtm')
      setFormula(cell, 'pe', `IF(${epsTtm}<>0, ${cell.refs.currentPrice} / ${epsTtm}, 0)`, '0.00')
    }
    border(cell, 'pe')
  }
}

/** Year-over-year growth of another row */
export function growth(key: RowKey, base: RowKey): Renderer {
  return (cell) => {
    if (cell.prevYearCol) {
      const curr = addrOf(cell, base)
      const prev = addrOf(cell, base, cell.prevYearCol)
      setFormula(cell, key, `IF(${prev}<>0, (${curr}-${prev})/${prev}, 0)`, PERCENT)
    }
    border(cell, key)
  }
}

const GROWTH_INPUT: Record<GrowthKind, 'revenueGrowth' | 'grossMargin' | 'netProfitGrowth'> = {
  revenue: 'revenueGrowth',
  grossMargin: 'grossMargin',
  netProfit: 'netProfitGrowth',
}

/**
 * Style of a forecast quarter's growth cell: editable; bold when the user typed
 * a growth for this quarter instead of following the input above the sheet.
 */
export function styleGrowthInput(GC: any, sheet: any, row: number, col: number, typed: boolean) {
  const style = new GC.Spread.Sheets.Style()
  style.backColor = SPREADJS_COLORS.INPUT
  if (typed) {
    style.font = 'bold 11pt Calibri'
    style.foreColor = SPREADJS_COLORS.FORECAST_TEXT
  }
  const border = getThinBorder(GC)
  style.borderLeft = border
  style.borderTop = border
  style.borderRight = border
  style.borderBottom = border
  style.formatter = PERCENT
  style.locked = false
  sheet.setStyle(row, col, style)
}

/**
 * Quarterly growth row. Reported quarters: year-over-year growth of `base`.
 * Forecast quarters: the growth the projection uses, which the user can type
 * per quarter; otherwise it follows the input above the sheet.
 */
export function quarterlyGrowth(key: RowKey, base: RowKey, kind: GrowthKind): Renderer {
  const reported = growth(key, base)
  return (cell) => {
    if (!cell.isForecast || !cell.prevYearCol) return reported(cell)

    forecastInput(cell, key, kind)
  }
}

/**
 * Quarterly margin row, e.g. gross margin. Reported quarters: numerator ÷
 * denominator. Forecast quarters: the margin the projection uses, typed per
 * quarter or following the input above the sheet.
 */
export function quarterlyMargin(key: RowKey, numerator: RowKey, denominator: RowKey): Renderer {
  const reported = ratio(key, numerator, denominator)
  return (cell) => {
    if (!cell.isForecast) return reported(cell)
    forecastInput(cell, key, 'grossMargin')
  }
}

/** Forecast quarter cell of an assumption: the typed value, else the input */
function forecastInput(cell: CellContext, key: RowKey, kind: GrowthKind) {
  const row = rowOf(cell, key)
  const typed = cell.growthOverride?.(kind)
  if (typed !== undefined) cell.sheet.setValue(row, cell.col, typed)
  else cell.sheet.setFormula(row, cell.col, cell.refs[GROWTH_INPUT[kind]])
  styleGrowthInput(cell.GC, cell.sheet, row, cell.col, typed !== undefined)
}
