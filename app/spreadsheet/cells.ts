/**
 * Cell renderers: building blocks the stock profiles compose their rows from.
 *
 * Each renderer fills one cell of a row for one period and leaves it bordered.
 */

import type { CellContext, RowKey } from './types'
import { applyBorder, getCellAddr, setCell, setDivisionFormula } from '~/utils/spreadjs'

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
 * last year × (1 + growth input)
 */
export function projectedAmount(
  key: RowKey,
  indicator: string,
  growthRef: 'revenueGrowth' | 'netProfitGrowth'
): Renderer {
  return (cell) => {
    if (cell.isForecast && cell.prevYearCol) {
      setFormula(cell, key, `${addrOf(cell, key, cell.prevYearCol)} * (1 + ${cell.refs[growthRef]})`, AMOUNT)
    } else {
      setCell(cell.GC, cell.sheet, rowOf(cell, key), cell.col, cell.value(indicator), { format: AMOUNT, border: true })
    }
    border(cell, key)
  }
}

/** Gross profit; in forecast quarters revenue × gross margin input */
export function forecastGrossProfit(): Renderer {
  return (cell) => {
    if (cell.isForecast) {
      setFormula(cell, 'grossProfit', `${addrOf(cell, 'revenue')} * ${cell.refs.grossMargin}`, AMOUNT)
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

function lastFourQuartersEps(cell: CellContext): string {
  return cell.GC.Spread.Sheets.CalcEngine.rangeToFormula(
    cell.sheet.getRange(rowOf(cell, 'eps'), cell.col - 3, 1, 4)
  )
}

/** Trailing 4-quarter EPS: reported for historical quarters, else SUM of the last 4 quarterly EPS */
export function trailingEps(): Renderer {
  return (cell) => {
    // Vietstock reports TTM EPS under both 'epsTtm' and 'eps'
    const reportedTtm = [cell.value('epsTtm'), cell.value('eps')].find(isPresent)

    if (!cell.isForecast && reportedTtm !== undefined) {
      setCell(cell.GC, cell.sheet, rowOf(cell, 'epsTtm'), cell.col, reportedTtm, { format: AMOUNT, border: true })
    } else if (cell.col >= 4) {
      setFormula(cell, 'epsTtm', `SUM(${lastFourQuartersEps(cell)})`, AMOUNT)
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
      const eps = lastFourQuartersEps(cell)
      setFormula(cell, 'pe', `IF(SUM(${eps}) <> 0, ${cell.refs.currentPrice} / SUM(${eps}), 0)`, '0.00')
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
