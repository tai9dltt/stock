/**
 * Sheet sections shared by all stock profiles:
 * title, input area, annual table, quarterly table, valuation table.
 */

import type {
  AnalysisSheetData, CellContext, InputCellReferences, QuarterlyColumnInfo, RowMap, RowSpec,
  SheetContext, StockProfile,
} from './types'
import {
  ANNUAL_TABLE, INPUT_AREA, QUARTER_DATE_RANGES, QUARTERLY_TABLE, SPREADJS_COLORS, VALUATION_TABLE,
} from '~/constants/spreadJsConstants'
import {
  applyBorder, applyGrowthHighlightRange, applyRowHighlightOnSelect, getCellAddr, getDoubleBorder,
  getThinBorder, setCell, setQuarterlySumFormula,
} from '~/utils/spreadjs'
import { extractYearsFromData, isForecastYear, QUARTERS, resolveDisplayYears } from './years'

const HEADER_STYLE = { bold: true, align: 'center' as const, border: true }

const periodColor = (forecast: boolean) => (forecast ? SPREADJS_COLORS.FORECAST : SPREADJS_COLORS.HISTORICAL)

/** Lay rows out top to bottom starting at firstRow */
function layoutRows(specs: RowSpec[], firstRow: number): RowMap {
  return Object.fromEntries(specs.map((spec, i) => [spec.key, firstRow + i]))
}

function writeRowLabels(ctx: SheetContext, specs: RowSpec[], rows: RowMap) {
  for (const spec of specs) {
    setCell(ctx.GC, ctx.sheet, rows[spec.key]!, 0, spec.label, {
      border: true,
      ...(spec.emphasize ? { color: SPREADJS_COLORS.TEXT_RED } : {}),
    })
  }
}

function highlightGrowthRows(ctx: SheetContext, rows: RowMap, firstCol: number, colCount: number) {
  applyGrowthHighlightRange(ctx.GC, ctx.sheet, rows.revGrowth!, firstCol, colCount)
  applyGrowthHighlightRange(ctx.GC, ctx.sheet, rows.profitGrowth!, firstCol, colCount)
}

// ─── Title & inputs ─────────────────────────────────────────────────

export function buildTitleSection(ctx: SheetContext, profile: StockProfile, symbol: string): void {
  const { GC, sheet } = ctx

  sheet.setRowHeight(0, 50)
  setCell(GC, sheet, 0, 2, profile.title, { bold: true, color: '#0000FF', align: 'center' })
  setCell(GC, sheet, 0, 0, symbol, { bold: true, color: '#FF0000', align: 'center', border: true })
  setCell(GC, sheet, 0, 4, 'NGÀY', { bold: true })
  setCell(GC, sheet, 0, 5, new Date(), { format: 'dd/mm/yyyy' })
}

/**
 * Input area at K4: price, shares, 52-week range and the growth assumptions
 * the forecast formulas reference.
 */
export function buildInputSection(
  ctx: SheetContext,
  profile: StockProfile,
  data: AnalysisSheetData
): InputCellReferences {
  const { GC, sheet } = ctx
  const col = INPUT_AREA.COL
  const startRow = INPUT_AREA.ROW_START
  const valueCol = col + INPUT_AREA.VALUE_COL_OFFSET
  const labels = profile.inputLabels

  sheet.setColumnWidth(col, 180)
  sheet.setColumnWidth(col + 1, 100)
  sheet.setColumnWidth(valueCol, 120)

  const inputRow = (
    row: number,
    label: string,
    value: number,
    { editable = false, format = '#,##0', bg = SPREADJS_COLORS.INPUT } = {}
  ) => {
    setCell(GC, sheet, row, col, label, { bold: true, align: 'left' })
    sheet.addSpan(row, col, 1, 2)
    sheet.getRange(row, col, 1, 2).setBorder(getThinBorder(GC), { all: true })

    setCell(GC, sheet, row, valueCol, value, { format, border: true, bg })
    if (editable) sheet.getCell(row, valueCol).locked(false)
  }

  const formattedDate = data.tradingDate ? data.tradingDate.split('-').reverse().join('/') : ''
  setCell(GC, sheet, startRow, col, `Ngày: ${formattedDate}`, { bold: true, align: 'left', bg: '#D9E1F2' })
  sheet.addSpan(startRow, col, 1, 3)

  inputRow(startRow + 1, labels.currentPrice, data.currentPrice || 0, { editable: true })
  inputRow(startRow + 2, labels.outstandingShares, data.outstandingShares || 0, { editable: true })
  inputRow(startRow + 3, labels.max52W, data.max52W || 0, { bg: SPREADJS_COLORS.DISPLAY })
  inputRow(startRow + 4, labels.min52W, data.min52W || 0, { bg: SPREADJS_COLORS.DISPLAY })
  inputRow(startRow + 5, labels.revenueGrowth, data.revenueGrowth || 0, { editable: true, format: '0.00%' })
  inputRow(startRow + 6, labels.grossMargin, data.grossMargin || 0, { editable: true, format: '0.00%' })
  inputRow(startRow + 7, labels.netProfitGrowth, data.netProfitGrowth || 0, { editable: true, format: '0.00%' })

  const ref = (row: number) => getCellAddr(GC, sheet, row, valueCol)
  return {
    currentPrice: ref(startRow + 1),
    outstandingShares: ref(startRow + 2),
    revenueGrowth: ref(startRow + 5),
    grossMargin: ref(startRow + 6),
    netProfitGrowth: ref(startRow + 7),
  }
}

// ─── Annual table ───────────────────────────────────────────────────

export function buildAnnualTable(
  ctx: SheetContext,
  profile: StockProfile,
  data: AnalysisSheetData,
  refs: InputCellReferences
): { colMap: Record<string, number>; rows: RowMap; lastRow: number } {
  const { GC, sheet } = ctx
  const currentYear = new Date().getFullYear()
  const startRow = ANNUAL_TABLE.START_ROW
  const rows = layoutRows(profile.annualRows, startRow + 1)

  const years = resolveDisplayYears(
    [...extractYearsFromData(data.annualData), ...data.forecastYears],
    data.quarterlyData,
    currentYear
  )
  const colMap: Record<string, number> = Object.fromEntries(years.map((year, i) => [year, 1 + i]))
  const isForecast = (year: string) => isForecastYear(year, currentYear, data.quarterlyData, data.forecastYears)

  // Header
  sheet.setRowHeight(startRow, 60)
  setCell(GC, sheet, startRow, 0, 'Chỉ số', { ...HEADER_STYLE, bg: SPREADJS_COLORS.HEADER })

  for (const year of years) {
    const col = colMap[year]!
    const forecast = isForecast(year)
    sheet.setColumnWidth(col, ANNUAL_TABLE.COLUMN_WIDTH)
    setCell(GC, sheet, startRow, col, `${year}${forecast ? ' (F)' : ''}\n01/01-31/12`, {
      ...HEADER_STYLE,
      bg: periodColor(forecast),
    })
    sheet.getCell(startRow, col).wordWrap(true)
  }

  writeRowLabels(ctx, profile.annualRows, rows)

  // Data
  for (const year of years) {
    const cell: CellContext = {
      GC, sheet, rows, refs,
      col: colMap[year]!,
      year,
      isForecast: isForecast(year),
      prevYearCol: colMap[(parseInt(year) - 1).toString()],
      value: indicator => data.annualData[indicator]?.[year],
    }
    profile.annualRows.forEach(spec => spec.render(cell))
  }

  if (years.length > 0) highlightGrowthRows(ctx, rows, colMap[years[0]!]!, years.length)

  return { colMap, rows, lastRow: startRow + profile.annualRows.length }
}

// ─── Quarterly table ────────────────────────────────────────────────

export function buildQuarterlyTable(
  ctx: SheetContext,
  profile: StockProfile,
  data: AnalysisSheetData,
  refs: InputCellReferences,
  startRow: number
): { cols: QuarterlyColumnInfo[]; rows: RowMap; lastRow: number; nextCol: number } {
  const { GC, sheet } = ctx
  const currentYear = new Date().getFullYear()
  const rows = layoutRows(profile.quarterlyRows, startRow + 2)
  const lastRow = startRow + 1 + profile.quarterlyRows.length

  const years = resolveDisplayYears(
    [...extractYearsFromData(data.annualData), ...extractYearsFromData(data.quarterlyData), ...data.forecastYears],
    data.quarterlyData,
    currentYear
  )

  // Header
  sheet.setRowHeight(startRow, 30)
  sheet.setRowHeight(startRow + 1, 50)
  setCell(GC, sheet, startRow, 0, 'Niên độ \nChỉ số', { ...HEADER_STYLE, bg: SPREADJS_COLORS.HEADER })
  sheet.addSpan(startRow, 0, 2, 1)
  sheet.getCell(startRow, 0).wordWrap(true)

  const hasActualData = (year: string, quarter: string) =>
    profile.actualDataIndicators.some((indicator) => {
      const value = data.quarterlyData[indicator]?.[year]?.[quarter]
      return value !== undefined && value !== null
    })

  const cols: QuarterlyColumnInfo[] = []
  let nextCol = 1

  for (const year of years) {
    const isYearForecast = isForecastYear(year, currentYear, data.quarterlyData, data.forecastYears)

    setCell(GC, sheet, startRow, nextCol, year, { ...HEADER_STYLE, bg: periodColor(isYearForecast) })
    sheet.addSpan(startRow, nextCol, 1, 4)
    sheet.getRange(startRow, nextCol, 1, 4).setBorder(getThinBorder(GC), { all: true })

    QUARTERS.forEach((quarter, i) => {
      const isForecast = !hasActualData(year, quarter) && (
        data.forecastQuarters.includes(`${year}_${quarter}`) || data.forecastYears.includes(year) || isYearForecast
      )

      sheet.setColumnWidth(nextCol, QUARTERLY_TABLE.COLUMN_WIDTH)
      setCell(GC, sheet, startRow + 1, nextCol, `${quarter}${isForecast ? ' (F)' : ''}\n${QUARTER_DATE_RANGES[i]}`, {
        ...HEADER_STYLE,
        bg: periodColor(isForecast),
      })
      sheet.getCell(startRow + 1, nextCol).wordWrap(true)

      cols.push({ year, quarter, col: nextCol, isForecast })
      nextCol++
    })
  }

  writeRowLabels(ctx, profile.quarterlyRows, rows)

  // Data
  for (const { year, quarter, col, isForecast } of cols) {
    const savedShares = data.quarterlyData['outstandingShares']?.[year]?.[quarter]
    const cell: CellContext = {
      GC, sheet, rows, refs, col, year, quarter, isForecast,
      prevYearCol: col - 4 >= 1 ? col - 4 : undefined,
      value: indicator => data.quarterlyData[indicator]?.[year]?.[quarter],
      shares: savedShares !== undefined && savedShares !== null ? Number(savedShares) : data.outstandingShares,
    }
    profile.quarterlyRows.forEach(spec => spec.render(cell))

    // Double border after each year
    if (quarter === 'Q4') {
      sheet.getRange(startRow, col, lastRow - startRow + 1, 1).setBorder(getDoubleBorder(GC), { right: true })
    }
  }

  if (cols.length > 0) highlightGrowthRows(ctx, rows, cols[0]!.col, cols.length)

  sheet.getRange(lastRow, 0, 1, nextCol).setBorder(getDoubleBorder(GC), { bottom: true })

  return { cols, rows, lastRow, nextCol }
}

// ─── Annual ↔ quarterly links ───────────────────────────────────────

/**
 * Annual cells computed from the quarterly table: always for the profile's
 * sum rows, and for forecast years also net profit, EPS, P/E and ROS.
 */
export function linkAnnualToQuarterly(
  ctx: SheetContext,
  profile: StockProfile,
  colMap: Record<string, number>,
  annualRows: RowMap,
  quarterlyCols: QuarterlyColumnInfo[],
  quarterlyRows: RowMap,
  refs: InputCellReferences
): void {
  const { GC, sheet } = ctx

  for (const year of new Set(quarterlyCols.map(q => q.year))) {
    const annualCol = colMap[year]
    if (!annualCol) continue

    const yearQuarters = quarterlyCols.filter(q => q.year === year)
    const quarterCols = QUARTERS.map(quarter => yearQuarters.find(q => q.quarter === quarter)?.col)
    if (yearQuarters.length !== 4 || quarterCols.some(c => !c)) continue

    const sumOfQuarters = (key: keyof RowMap) =>
      setQuarterlySumFormula(GC, sheet, quarterlyRows[key]!, annualRows[key]!, annualCol, quarterCols as number[])

    profile.annualSumOfQuarters.forEach(sumOfQuarters)

    // Historical years keep the reported figures
    if (!yearQuarters.some(q => q.isForecast)) continue

    sumOfQuarters('netProfit')

    sumOfQuarters('eps')
    applyBorder(GC, sheet, annualRows.eps!, annualCol)

    const epsAddr = getCellAddr(GC, sheet, annualRows.eps!, annualCol)
    sheet.setFormula(annualRows.pe!, annualCol, `IF(${epsAddr}<>0, ${refs.currentPrice} / ${epsAddr}, 0)`)
    sheet.setFormatter(annualRows.pe!, annualCol, '0.00')
    applyBorder(GC, sheet, annualRows.pe!, annualCol)

    if (annualRows.ros !== undefined) {
      const profitAddr = getCellAddr(GC, sheet, annualRows.netProfit!, annualCol)
      const revAddr = getCellAddr(GC, sheet, annualRows.revenue!, annualCol)
      sheet.setFormula(annualRows.ros, annualCol, `IF(${revAddr}<>0, ${profitAddr} / ${revAddr}, 0)`)
      sheet.setFormatter(annualRows.ros, annualCol, '0.00%')
      applyBorder(GC, sheet, annualRows.ros, annualCol)
    }
  }
}

// ─── Valuation table ────────────────────────────────────────────────

/** P/E scenarios: saved by the user, else recent reported P/E + forecast P/E + defaults */
function resolvePeScenarios(
  ctx: SheetContext,
  quarterlyCols: QuarterlyColumnInfo[],
  quarterlyRows: RowMap,
  data: AnalysisSheetData,
  defaultPE: number
): number[] {
  const saved = data.peAssumptions?.values
  if (Array.isArray(saved) && saved.length > 0) return saved

  const byPeriod = (a: QuarterlyColumnInfo, b: QuarterlyColumnInfo) =>
    parseInt(a.year) - parseInt(b.year) || parseInt(a.quarter.slice(1)) - parseInt(b.quarter.slice(1))
  const isValidPe = (v: unknown) => v !== undefined && v !== null && !isNaN(Number(v)) && Number(v) > 0
  const round2 = (v: unknown) => Math.round(Number(v) * 100) / 100

  const lastHistorical = quarterlyCols.filter(q => !q.isForecast).sort((a, b) => byPeriod(b, a)).slice(0, 3)
  const firstForecast = quarterlyCols.filter(q => q.isForecast).sort(byPeriod).slice(0, 3)

  const values: number[] = []

  for (const q of lastHistorical.reverse()) {
    const pe = data.quarterlyData['pe']?.[q.year]?.[q.quarter]
    if (isValidPe(pe)) values.push(round2(pe))
  }

  for (const q of firstForecast) {
    const pe = ctx.sheet.getValue(quarterlyRows.pe!, q.col)
    values.push(isValidPe(pe) ? round2(pe) : defaultPE)
  }

  if (values.length < 6) {
    const defaults = [9, 11, 12, 13, 14, 5, 4]
    while (values.length < 7) values.push(defaults[values.length] || 10)
  }

  return values
}

/**
 * Price targets: each row is a P/E scenario × trailing EPS of every quarter.
 * Returns the first row of the table.
 */
export function buildValuationTable(
  ctx: SheetContext,
  quarterlyCols: QuarterlyColumnInfo[],
  quarterlyRows: RowMap,
  quarterlyLastRow: number,
  data: AnalysisSheetData
): number {
  const { GC, sheet } = ctx
  const currentYear = new Date().getFullYear()
  const startRow = quarterlyLastRow + 4
  const totalRows = VALUATION_TABLE.TOTAL_ROWS

  const lastPe = data.annualData['pe']?.[(currentYear - 1).toString()] || data.annualData['pe']?.[(currentYear - 2).toString()] || 10
  const defaultPE = parseFloat(String(lastPe)) || 10
  const peScenarios = resolvePeScenarios(ctx, quarterlyCols, quarterlyRows, data, defaultPE)

  // Year headers
  sheet.setRowHeight(startRow, 30)
  for (const year of new Set(quarterlyCols.map(q => q.year))) {
    const yearCols = quarterlyCols.filter(q => q.year === year)
    const firstCol = yearCols[0]!.col
    const forecast = isForecastYear(year, currentYear, data.quarterlyData, data.forecastYears)

    setCell(GC, sheet, startRow, firstCol, year, { ...HEADER_STYLE, bg: periodColor(forecast) })
    if (yearCols.length > 1) sheet.addSpan(startRow, firstCol, 1, yearCols.length)
    sheet.getRange(startRow, firstCol, 1, yearCols.length).setBorder(getThinBorder(GC), { all: true })
  }

  // Quarter headers
  for (const { quarter, col, isForecast } of quarterlyCols) {
    const qIdx = parseInt(quarter.replace('Q', '')) - 1
    setCell(GC, sheet, startRow + 1, col, `${quarter}${isForecast ? ' (F)' : ''}\n${QUARTER_DATE_RANGES[qIdx]}`, {
      ...HEADER_STYLE,
      bg: periodColor(isForecast),
    })
    sheet.getCell(startRow + 1, col).wordWrap(true)
    sheet.setRowHeight(startRow + 1, 50)
  }

  const labelStyle = { bold: true, border: true, align: 'center' as const, bg: SPREADJS_COLORS.HEADER }
  setCell(GC, sheet, startRow, 0, 'Niên độ:', labelStyle)
  setCell(GC, sheet, startRow + 1, 0, 'Giả sử P/E:', labelStyle)

  // Scenario rows
  const endCol = quarterlyCols.length > 0 ? quarterlyCols[quarterlyCols.length - 1]!.col + 1 : 1

  for (let r = 0; r < totalRows; r++) {
    const row = startRow + 2 + r
    const pe = peScenarios[r]

    setCell(GC, sheet, row, 0, pe, { border: true, align: 'center', format: '0.00' })
    sheet.getCell(row, 0).locked(false)

    if (pe !== undefined && Math.abs(pe - defaultPE) < 0.01) {
      sheet.getRange(row, 0, 1, endCol).backColor(SPREADJS_COLORS.DEFAULT_HIGHLIGHT)
    }

    const peAddr = `$A${row + 1}`
    for (const { col } of quarterlyCols) {
      const epsAddr = getCellAddr(GC, sheet, quarterlyRows.epsTtm!, col)
      sheet.setFormula(row, col, `IF(AND(ISNUMBER(${peAddr}), ISNUMBER(${epsAddr})), ${peAddr} * ${epsAddr}, "-")`)
      sheet.setFormatter(row, col, '#,##0')
      sheet.getCell(row, col).hAlign(GC.Spread.Sheets.HorizontalAlign.right)
      applyBorder(GC, sheet, row, col)
    }

    applyBorder(GC, sheet, row, 0)
  }

  for (const { quarter, col } of quarterlyCols) {
    if (quarter === 'Q4') {
      sheet.getRange(startRow, col, totalRows + 2, 1).setBorder(getDoubleBorder(GC), { right: true })
    }
  }

  return startRow
}

// ─── Final touches ──────────────────────────────────────────────────

export function applyFinalStyling(ctx: SheetContext, maxCol: number, valuationStartRow: number): void {
  const { GC, spread, sheet } = ctx

  sheet.autoFitColumn(0)
  sheet.setColumnWidth(0, 150)
  sheet.setColumnCount(Math.max(maxCol, 30))
  sheet.setRowCount(valuationStartRow + VALUATION_TABLE.TOTAL_ROWS + 4)
  sheet.frozenColumnCount(1)

  spread.options.scrollbarMaxAlign = true
  spread.options.scrollbarShowMax = true

  applyRowHighlightOnSelect(GC, sheet)
}
