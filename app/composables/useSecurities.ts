import type {
  SpreadJSContext,
  AnnualColumnMap,
  QuarterlyColumnInfo,
  InputCellReferences,
  AnnualRowPositions,
  QuarterlyRowPositions,
} from '~/types/spreadJsTypes';

import {
  SPREADJS_COLORS,
  INPUT_AREA,
  VALUATION_TABLE,
  QUARTER_DATE_RANGES,
} from '~/constants/spreadJsConstants';

import {
  SECURITIES_ANNUAL_TABLE,
  SECURITIES_QUARTERLY_TABLE,
  SECURITIES_ANNUAL_ROW_LABELS,
  SECURITIES_QUARTERLY_ROW_LABELS,
  SECURITIES_INPUT_FIELD_LABELS,
  getSecuritiesAnnualRowPositions,
  getSecuritiesQuarterlyRowPositions,
} from '~/constants/securitiesSpreadJsConstants';

import {
  setCell as setCellUtil,
  applyBorder,
  getCellAddr,
  setDivisionFormula,
  applyRowHighlightOnSelect,
} from '~/utils/spreadjs';

import {
  extractYearsFromData,
  isForecastYear,
  filterIncompleteYears,
  fillYearGaps,
} from './useSpreadJSBuilder';

// ============ SECURITIES SECTION BUILDERS ============

/**
 * Build title section for securities stocks
 */
export function buildSecuritiesTitleSection(
  ctx: SpreadJSContext,
  stockSymbol: string
): void {
  const { GC, sheet } = ctx;

  sheet.setRowHeight(0, 50);

  setCellUtil(GC, sheet, 0, 2, 'TẦM SOÁT CỔ PHIẾU CHỨNG KHOÁN', {
    bold: true,
    color: '#0000FF',
    align: 'center',
  });

  setCellUtil(GC, sheet, 0, 0, stockSymbol, {
    bold: true,
    color: '#FF0000',
    align: 'center',
    border: true,
  });

  setCellUtil(GC, sheet, 0, 4, 'NGÀY', { bold: true });
  setCellUtil(GC, sheet, 0, 5, new Date(), { format: 'dd/mm/yyyy' });
}

/**
 * Build input section for securities stocks
 */
export function buildSecuritiesInputSection(
  ctx: SpreadJSContext,
  data: {
    tradingDate: string;
    currentPrice: number;
    outstandingShares: number;
    max52W: number;
    min52W: number;
    revenueGrowth: number;
    grossMargin: number;
    netProfitGrowth: number;
  }
): InputCellReferences {
  const { GC, sheet } = ctx;
  const col = INPUT_AREA.COL;
  const startRow = INPUT_AREA.ROW_START;
  const valueCol = col + INPUT_AREA.VALUE_COL_OFFSET;

  // Set column widths
  sheet.setColumnWidth(col, 180);
  sheet.setColumnWidth(col + 1, 100);
  sheet.setColumnWidth(valueCol, 120);

  // Helper for creating input rows
  const createInputRow = (
    row: number,
    label: string,
    value: any,
    options: { editable?: boolean; format?: string; bg?: string } = {}
  ) => {
    const { editable = false, format = '#,##0', bg = SPREADJS_COLORS.INPUT } = options;

    setCellUtil(GC, sheet, row, col, label, { bold: true, align: 'left' });
    sheet.addSpan(row, col, 1, 2);
    sheet
      .getRange(row, col, 1, 2)
      .setBorder(
        new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
        { all: true }
      );

    setCellUtil(GC, sheet, row, valueCol, value, { format, border: true, bg });

    if (editable) {
      sheet.getCell(row, valueCol).locked(false);
    }
  };

  // Header with date
  const formattedDate = data.tradingDate
    ? data.tradingDate.split('-').reverse().join('/')
    : '';
  setCellUtil(GC, sheet, startRow, col, `Ngày: ${formattedDate}`, {
    bold: true,
    align: 'left',
    bg: '#D9E1F2',
  });
  sheet.addSpan(startRow, col, 1, 3);

  // Input rows - using securities-specific labels
  createInputRow(startRow + 1, SECURITIES_INPUT_FIELD_LABELS.currentPrice, data.currentPrice || 0, {
    editable: true,
  });
  createInputRow(startRow + 2, SECURITIES_INPUT_FIELD_LABELS.outstandingShares, data.outstandingShares || 0, {
    editable: true,
  });
  createInputRow(startRow + 3, SECURITIES_INPUT_FIELD_LABELS.max52W, data.max52W || 0, {
    bg: SPREADJS_COLORS.DISPLAY,
  });
  createInputRow(startRow + 4, SECURITIES_INPUT_FIELD_LABELS.min52W, data.min52W || 0, {
    bg: SPREADJS_COLORS.DISPLAY,
  });
  createInputRow(startRow + 5, SECURITIES_INPUT_FIELD_LABELS.revenueGrowth, data.revenueGrowth || 0, {
    editable: true,
    format: '0.00%',
  });
  createInputRow(startRow + 6, SECURITIES_INPUT_FIELD_LABELS.grossMargin, data.grossMargin || 0, {
    editable: true,
    format: '0.00%',
  });
  createInputRow(startRow + 7, SECURITIES_INPUT_FIELD_LABELS.netProfitGrowth, data.netProfitGrowth || 0, {
    editable: true,
    format: '0.00%',
  });

  // Return cell references for formulas
  return {
    currentPrice: GC.Spread.Sheets.CalcEngine.rangeToFormula(
      sheet.getRange(startRow + 1, valueCol, 1, 1)
    ),
    outstandingShares: GC.Spread.Sheets.CalcEngine.rangeToFormula(
      sheet.getRange(startRow + 2, valueCol, 1, 1)
    ),
    revenueGrowth: GC.Spread.Sheets.CalcEngine.rangeToFormula(
      sheet.getRange(startRow + 5, valueCol, 1, 1)
    ),
    grossMargin: GC.Spread.Sheets.CalcEngine.rangeToFormula(
      sheet.getRange(startRow + 6, valueCol, 1, 1)
    ),
    netProfitGrowth: GC.Spread.Sheets.CalcEngine.rangeToFormula(
      sheet.getRange(startRow + 7, valueCol, 1, 1)
    ),
  };
}

/**
 * Build annual summary table for securities companies
 */
export function buildSecuritiesAnnualTable(
  ctx: SpreadJSContext,
  data: {
    annualData: Record<string, any>;
    quarterlyData: Record<string, any>;
    forecastYears: string[];
  },
  inputRefs: InputCellReferences
): { colMap: AnnualColumnMap; rows: AnnualRowPositions; sortedYears: string[] } {
  const { GC, sheet } = ctx;
  const currentYear = new Date().getFullYear();
  const startRow = SECURITIES_ANNUAL_TABLE.START_ROW;
  const rows = getSecuritiesAnnualRowPositions(startRow);

  // Prepare years
  const dataYears = extractYearsFromData(data.annualData);
  const allYearsSet = new Set([...dataYears, ...data.forecastYears]);
  let sortedYears = Array.from(allYearsSet).sort();

  // Filter and fill gaps
  sortedYears = filterIncompleteYears(sortedYears, data.quarterlyData, currentYear);
  if (sortedYears.length > 0) {
    sortedYears = fillYearGaps(sortedYears);
    sortedYears = filterIncompleteYears(sortedYears, data.quarterlyData, currentYear);
  }

  // Create column mapping
  const colMap: AnnualColumnMap = {};
  sortedYears.forEach((year, i) => {
    colMap[year] = 1 + i;
  });

  // Header row
  sheet.setRowHeight(startRow, 60);
  setCellUtil(GC, sheet, startRow, 0, 'Chỉ số', {
    bold: true,
    align: 'center',
    border: true,
    bg: SPREADJS_COLORS.HEADER,
  });

  // Year headers
  sortedYears.forEach((year) => {
    const col = colMap[year]!;
    const forecast = isForecastYear(year, currentYear, data.quarterlyData, data.forecastYears);

    sheet.setColumnWidth(col, SECURITIES_ANNUAL_TABLE.COLUMN_WIDTH);

    const headerText = forecast ? `${year} (F)\n01/01-31/12` : `${year}\n01/01-31/12`;
    setCellUtil(GC, sheet, startRow, col, headerText, {
      bold: true,
      align: 'center',
      border: true,
      bg: forecast ? SPREADJS_COLORS.FORECAST : SPREADJS_COLORS.HISTORICAL,
    });
    sheet.getCell(startRow, col).wordWrap(true);
  });

  // Row labels - SECURITIES SPECIFIC
  setCellUtil(GC, sheet, rows.netRevenue, 0, SECURITIES_ANNUAL_ROW_LABELS.netRevenue, { border: true });
  setCellUtil(GC, sheet, rows.grossProfit, 0, SECURITIES_ANNUAL_ROW_LABELS.grossProfit, { border: true });
  setCellUtil(GC, sheet, rows.operatingProfit, 0, SECURITIES_ANNUAL_ROW_LABELS.operatingProfit, { border: true });
  setCellUtil(GC, sheet, rows.netProfit, 0, SECURITIES_ANNUAL_ROW_LABELS.netProfit, { border: true });
  setCellUtil(GC, sheet, rows.grossMargin, 0, SECURITIES_ANNUAL_ROW_LABELS.grossMargin, { border: true });
  setCellUtil(GC, sheet, rows.netProfitMargin!, 0, SECURITIES_ANNUAL_ROW_LABELS.netProfitMargin, { border: true });
  setCellUtil(GC, sheet, rows.eps, 0, SECURITIES_ANNUAL_ROW_LABELS.eps, { border: true });
  setCellUtil(GC, sheet, rows.pe, 0, SECURITIES_ANNUAL_ROW_LABELS.pe, { border: true });
  setCellUtil(GC, sheet, rows.ros, 0, SECURITIES_ANNUAL_ROW_LABELS.ros, { border: true });
  setCellUtil(GC, sheet, rows.roe, 0, SECURITIES_ANNUAL_ROW_LABELS.roe, { border: true });
  setCellUtil(GC, sheet, rows.roa, 0, SECURITIES_ANNUAL_ROW_LABELS.roa, { border: true });
  setCellUtil(GC, sheet, rows.revGrowth, 0, SECURITIES_ANNUAL_ROW_LABELS.revGrowth, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });
  setCellUtil(GC, sheet, rows.profitGrowth, 0, SECURITIES_ANNUAL_ROW_LABELS.profitGrowth, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });

  // Fill data for each year
  sortedYears.forEach((year) => {
    const col = colMap[year]!;
    const yearInt = parseInt(year);
    const forecast = isForecastYear(year, currentYear, data.quarterlyData, data.forecastYears);

    // Securities-specific metrics from Vietstock API
    const netRevenue = data.annualData['netRevenue']?.[year];
    const grossProfit = data.annualData['grossProfit']?.[year];
    const operatingProfit = data.annualData['operatingProfit']?.[year];
    const netProfit = data.annualData['netProfit']?.[year];
    const eps = data.annualData['eps']?.[year];
    const pe = data.annualData['pe']?.[year];
    const ros = data.annualData['ros']?.[year];
    const roe = data.annualData['roe']?.[year];
    const roa = data.annualData['roa']?.[year];

    // DT từ KD chứng khoán (Net Revenue) - use formula for forecast years
    if (forecast && colMap[(yearInt - 1).toString()]) {
      const prevYearCol = colMap[(yearInt - 1).toString()]!;
      const prevAddr = getCellAddr(GC, sheet, rows.netRevenue, prevYearCol);
      sheet.setFormula(rows.netRevenue, col, `${prevAddr} * (1 + ${inputRefs.revenueGrowth})`);
      sheet.setFormatter(rows.netRevenue, col, '#,##0');
    } else {
      setCellUtil(GC, sheet, rows.netRevenue, col, netRevenue, { format: '#,##0', border: true });
    }
    applyBorder(GC, sheet, rows.netRevenue, col);

    // Lợi nhuận gộp
    setCellUtil(GC, sheet, rows.grossProfit, col, grossProfit, { format: '#,##0', border: true });
    applyBorder(GC, sheet, rows.grossProfit, col);

    // LNT từ KD chứng khoán (Operating Profit)
    setCellUtil(GC, sheet, rows.operatingProfit, col, operatingProfit, { format: '#,##0', border: true });
    applyBorder(GC, sheet, rows.operatingProfit, col);

    // LNST
    setCellUtil(GC, sheet, rows.netProfit, col, netProfit, { format: '#,##0', border: true });
    applyBorder(GC, sheet, rows.netProfit, col);

    // Biên LN gộp (%) = grossProfit / netRevenue
    setDivisionFormula(GC, sheet, rows.grossMargin, col, rows.grossProfit, col, rows.netRevenue, col, '0.00%');
    applyBorder(GC, sheet, rows.grossMargin, col);

    // Biên LN ròng (%) = netProfit / netRevenue
    setDivisionFormula(GC, sheet, rows.netProfitMargin!, col, rows.netProfit, col, rows.netRevenue, col, '0.00%');
    applyBorder(GC, sheet, rows.netProfitMargin!, col);

    // EPS - For forecast years, will be calculated; for historical years, use API data
    if (!forecast) {
      setCellUtil(GC, sheet, rows.eps, col, eps, { format: '#,##0', border: true });
    }
    applyBorder(GC, sheet, rows.eps, col);

    // P/E - For forecast years, will be calculated from EPS; for historical years, use API data
    if (!forecast) {
      setCellUtil(GC, sheet, rows.pe, col, pe, { format: '0.00', border: true });
    }
    applyBorder(GC, sheet, rows.pe, col);

    // ROS - use API data directly
    setCellUtil(GC, sheet, rows.ros, col, ros !== undefined && ros !== null ? ros / 100 : null, { format: '0.00%', border: true });
    applyBorder(GC, sheet, rows.ros, col);

    // ROE - use API data directly
    setCellUtil(GC, sheet, rows.roe, col, roe !== undefined && roe !== null ? roe / 100 : null, { format: '0.00%', border: true });
    applyBorder(GC, sheet, rows.roe, col);

    // ROA - use API data directly
    setCellUtil(GC, sheet, rows.roa, col, roa !== undefined && roa !== null ? roa / 100 : null, { format: '0.00%', border: true });
    applyBorder(GC, sheet, rows.roa, col);

    // Growth formulas
    const prevYear = (yearInt - 1).toString();
    if (colMap[prevYear]) {
      const prevCol = colMap[prevYear]!;

      // Revenue growth
      const currAddr = getCellAddr(GC, sheet, rows.netRevenue, col);
      const prevAddr = getCellAddr(GC, sheet, rows.netRevenue, prevCol);
      sheet.setFormula(
        rows.revGrowth,
        col,
        `IF(${prevAddr}<>0, (${currAddr}-${prevAddr})/${prevAddr}, 0)`
      );
      sheet.setFormatter(rows.revGrowth, col, '0.00%');

      // Profit growth
      const currProfitAddr = getCellAddr(GC, sheet, rows.netProfit, col);
      const prevProfitAddr = getCellAddr(GC, sheet, rows.netProfit, prevCol);
      sheet.setFormula(
        rows.profitGrowth,
        col,
        `IF(${prevProfitAddr}<>0, (${currProfitAddr}-${prevProfitAddr})/${prevProfitAddr}, 0)`
      );
      sheet.setFormatter(rows.profitGrowth, col, '0.00%');
    }

    // Borders for growth rows
    applyBorder(GC, sheet, rows.revGrowth, col);
    applyBorder(GC, sheet, rows.profitGrowth, col);
  });

  return { colMap, rows, sortedYears };
}

/**
 * Build quarterly data table for securities companies
 */
export function buildSecuritiesQuarterlyTable(
  ctx: SpreadJSContext,
  data: {
    annualData: Record<string, any>;
    quarterlyData: Record<string, any>;
    forecastYears: string[];
    forecastQuarters: string[];
    outstandingShares: number;
  },
  inputRefs: InputCellReferences,
  annualRows: AnnualRowPositions
): { cols: QuarterlyColumnInfo[]; rows: QuarterlyRowPositions; currentCol: number } {
  const { GC, sheet } = ctx;
  const currentYear = new Date().getFullYear();
  const startRow = annualRows.profitGrowth + SECURITIES_QUARTERLY_TABLE.GAP_FROM_ANNUAL;
  const rows = getSecuritiesQuarterlyRowPositions(startRow);

  // Prepare years
  const annualYearsKeys = extractYearsFromData(data.annualData);
  const qYears = extractYearsFromData(data.quarterlyData);
  const initialYears = Array.from(new Set([...annualYearsKeys, ...qYears, ...data.forecastYears])).sort();

  let allQYears = filterIncompleteYears(initialYears, data.quarterlyData, currentYear);
  if (allQYears.length > 0) {
    allQYears = fillYearGaps(allQYears);
    allQYears = filterIncompleteYears(allQYears, data.quarterlyData, currentYear);
  }

  // Setup headers
  sheet.setRowHeight(startRow, 30);
  sheet.setRowHeight(startRow + 1, 50);

  setCellUtil(GC, sheet, startRow, 0, 'Niên độ \nChỉ số', {
    bold: true,
    align: 'center',
    border: true,
    bg: SPREADJS_COLORS.HEADER,
  });
  sheet.addSpan(startRow, 0, 2, 1);
  sheet.getCell(startRow, 0).wordWrap(true);

  // Build quarterly columns
  const cols: QuarterlyColumnInfo[] = [];
  let currentCol = 1;

  allQYears.forEach((year) => {
    const isYearForecast = isForecastYear(year, currentYear, data.quarterlyData, data.forecastYears);

    const headerStyle = {
      bold: true,
      align: 'center' as const,
      border: true,
      bg: isYearForecast ? SPREADJS_COLORS.FORECAST : SPREADJS_COLORS.HISTORICAL,
    };

    // Year header spanning 4 columns
    setCellUtil(GC, sheet, startRow, currentCol, year, headerStyle);
    sheet.addSpan(startRow, currentCol, 1, 4);
    sheet
      .getRange(startRow, currentCol, 1, 4)
      .setBorder(
        new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
        { all: true }
      );

    // Quarter columns
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, i) => {
      const actualQ = `${year}_${q}`;
      // For securities, check netRevenue (DT từ KD chứng khoán)
      const hasActualData =
        (data.quarterlyData['netRevenue']?.[year]?.[q] !== undefined &&
          data.quarterlyData['netRevenue']?.[year]?.[q] !== null) ||
        (data.quarterlyData['netProfit']?.[year]?.[q] !== undefined &&
          data.quarterlyData['netProfit']?.[year]?.[q] !== null);

      const isF =
        !hasActualData &&
        (data.forecastQuarters.includes(actualQ) ||
          data.forecastYears.includes(year) ||
          isYearForecast);

      sheet.setColumnWidth(currentCol, SECURITIES_QUARTERLY_TABLE.COLUMN_WIDTH);

      setCellUtil(
        GC,
        sheet,
        startRow + 1,
        currentCol,
        `${q}${isF ? ' (F)' : ''}\n${QUARTER_DATE_RANGES[i]}`,
        {
          bold: true,
          align: 'center',
          border: true,
          bg: isF ? SPREADJS_COLORS.FORECAST : SPREADJS_COLORS.HISTORICAL,
        }
      );
      sheet.getCell(startRow + 1, currentCol).wordWrap(true);

      cols.push({ year, quarter: q, col: currentCol, isForecast: isF });
      currentCol++;
    });
  });

  // Row labels - SECURITIES SPECIFIC
  setCellUtil(GC, sheet, rows.revenue, 0, SECURITIES_QUARTERLY_ROW_LABELS.revenue, { border: true });
  setCellUtil(GC, sheet, rows.grossProfit, 0, SECURITIES_QUARTERLY_ROW_LABELS.grossProfit, { border: true });
  setCellUtil(GC, sheet, rows.operatingProfit, 0, SECURITIES_QUARTERLY_ROW_LABELS.operatingProfit, { border: true });
  setCellUtil(GC, sheet, rows.netProfit, 0, SECURITIES_QUARTERLY_ROW_LABELS.netProfit, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });
  setCellUtil(GC, sheet, rows.shares, 0, SECURITIES_QUARTERLY_ROW_LABELS.shares, { border: true });
  setCellUtil(GC, sheet, rows.grossMargin, 0, SECURITIES_QUARTERLY_ROW_LABELS.grossMargin, { border: true });
  setCellUtil(GC, sheet, rows.netProfitMargin!, 0, SECURITIES_QUARTERLY_ROW_LABELS.netProfitMargin, { border: true });
  setCellUtil(GC, sheet, rows.eps, 0, SECURITIES_QUARTERLY_ROW_LABELS.eps, { border: true });
  setCellUtil(GC, sheet, rows.epsTtm, 0, SECURITIES_QUARTERLY_ROW_LABELS.epsTtm, { border: true });
  setCellUtil(GC, sheet, rows.pe, 0, SECURITIES_QUARTERLY_ROW_LABELS.pe, { border: true });
  setCellUtil(GC, sheet, rows.roe, 0, SECURITIES_QUARTERLY_ROW_LABELS.roe, { border: true });
  setCellUtil(GC, sheet, rows.roa, 0, SECURITIES_QUARTERLY_ROW_LABELS.roa, { border: true });
  setCellUtil(GC, sheet, rows.revGrowth, 0, SECURITIES_QUARTERLY_ROW_LABELS.revGrowth, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });
  setCellUtil(GC, sheet, rows.profitGrowth, 0, SECURITIES_QUARTERLY_ROW_LABELS.profitGrowth, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });

  // Fill data for each quarter
  cols.forEach(({ year, quarter, col, isForecast }) => {
    // Securities-specific metrics from Vietstock API
    const netRevenue = data.quarterlyData['netRevenue']?.[year]?.[quarter];
    const grossProfit = data.quarterlyData['grossProfit']?.[year]?.[quarter];
    const operatingProfit = data.quarterlyData['operatingProfit']?.[year]?.[quarter];
    const netProfit = data.quarterlyData['netProfit']?.[year]?.[quarter];

    const savedShares = data.quarterlyData['outstandingShares']?.[year]?.[quarter];
    const shares =
      savedShares !== undefined && savedShares !== null
        ? Number(savedShares)
        : data.outstandingShares;

    // DT từ KD chứng khoán (Net Revenue)
    if (isForecast) {
      const prevYearCol = col - 4;
      if (prevYearCol >= 1) {
        const prevAddr = getCellAddr(GC, sheet, rows.revenue, prevYearCol);
        sheet.setFormula(rows.revenue, col, `${prevAddr} * (1 + ${inputRefs.revenueGrowth})`);
        sheet.setFormatter(rows.revenue, col, '#,##0');
      } else {
        setCellUtil(GC, sheet, rows.revenue, col, netRevenue, { format: '#,##0', border: true });
      }
    } else {
      setCellUtil(GC, sheet, rows.revenue, col, netRevenue, { format: '#,##0', border: true });
    }
    applyBorder(GC, sheet, rows.revenue, col);

    // Lợi nhuận gộp
    setCellUtil(GC, sheet, rows.grossProfit, col, grossProfit, { format: '#,##0', border: true });
    applyBorder(GC, sheet, rows.grossProfit, col);

    // LNT từ KD chứng khoán (Operating Profit)
    setCellUtil(GC, sheet, rows.operatingProfit, col, operatingProfit, { format: '#,##0', border: true });
    applyBorder(GC, sheet, rows.operatingProfit, col);

    // LNST (Net Profit)
    if (isForecast) {
      const prevYearCol = col - 4;
      if (prevYearCol >= 1) {
        const prevProfitAddr = getCellAddr(GC, sheet, rows.netProfit, prevYearCol);
        sheet.setFormula(
          rows.netProfit,
          col,
          `${prevProfitAddr} * (1 + ${inputRefs.netProfitGrowth})`
        );
        sheet.setFormatter(rows.netProfit, col, '#,##0');
      } else {
        setCellUtil(GC, sheet, rows.netProfit, col, netProfit, { format: '#,##0', border: true });
      }
    } else {
      setCellUtil(GC, sheet, rows.netProfit, col, netProfit, { format: '#,##0', border: true });
    }
    applyBorder(GC, sheet, rows.netProfit, col);

    // Shares
    setCellUtil(GC, sheet, rows.shares, col, shares, { format: '#,##0', border: true });
    sheet.getCell(rows.shares, col).locked(false);
    applyBorder(GC, sheet, rows.shares, col);

    // Biên LN gộp (%) = grossProfit / revenue
    setDivisionFormula(GC, sheet, rows.grossMargin, col, rows.grossProfit, col, rows.revenue, col, '0.00%');
    applyBorder(GC, sheet, rows.grossMargin, col);

    // Biên LN ròng (%) = netProfit / revenue
    setDivisionFormula(GC, sheet, rows.netProfitMargin!, col, rows.netProfit, col, rows.revenue, col, '0.00%');
    applyBorder(GC, sheet, rows.netProfitMargin!, col);

    // EPS quý = (LNST * 1000000) / shares
    const profitAddr = getCellAddr(GC, sheet, rows.netProfit, col);
    const sharesAddr = getCellAddr(GC, sheet, rows.shares, col);
    sheet.setFormula(rows.eps, col, `IF(${sharesAddr}<>0, (${profitAddr} * 1000000) / ${sharesAddr}, 0)`);
    sheet.setFormatter(rows.eps, col, '#,##0');
    applyBorder(GC, sheet, rows.eps, col);

    // EPS TTM (lũy kế) - use API data for historical, formula for forecast
    const epsTtmFromApi = data.quarterlyData['epsTtm']?.[year]?.[quarter];
    const epsFromApi = data.quarterlyData['eps']?.[year]?.[quarter];

    if (!isForecast && (epsTtmFromApi !== undefined && epsTtmFromApi !== null)) {
      setCellUtil(GC, sheet, rows.epsTtm, col, epsTtmFromApi, { format: '#,##0', border: true });
    } else if (!isForecast && (epsFromApi !== undefined && epsFromApi !== null)) {
      setCellUtil(GC, sheet, rows.epsTtm, col, epsFromApi, { format: '#,##0', border: true });
    } else if (col >= 4) {
      const epsRange = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(rows.eps, col - 3, 1, 4)
      );
      sheet.setFormula(rows.epsTtm, col, `SUM(${epsRange})`);
      sheet.setFormatter(rows.epsTtm, col, '#,##0');
    }
    applyBorder(GC, sheet, rows.epsTtm, col);

    // P/E
    const peFromApi = data.quarterlyData['pe']?.[year]?.[quarter];
    if (peFromApi !== undefined && peFromApi !== null) {
      setCellUtil(GC, sheet, rows.pe, col, peFromApi, { format: '0.00', border: true });
    } else if (isForecast && col >= 4) {
      const epsRange = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(rows.eps, col - 3, 1, 4)
      );
      sheet.setFormula(
        rows.pe,
        col,
        `IF(SUM(${epsRange}) <> 0, ${inputRefs.currentPrice} / SUM(${epsRange}), 0)`
      );
      sheet.setFormatter(rows.pe, col, '0.00');
    }
    applyBorder(GC, sheet, rows.pe, col);

    // ROE
    const roeFromApi = data.quarterlyData['roe']?.[year]?.[quarter];
    if (roeFromApi !== undefined && roeFromApi !== null) {
      setCellUtil(GC, sheet, rows.roe, col, roeFromApi / 100, { format: '0.00%', border: true });
    }
    applyBorder(GC, sheet, rows.roe, col);

    // ROA
    const roaFromApi = data.quarterlyData['roa']?.[year]?.[quarter];
    if (roaFromApi !== undefined && roaFromApi !== null) {
      setCellUtil(GC, sheet, rows.roa, col, roaFromApi / 100, { format: '0.00%', border: true });
    }
    applyBorder(GC, sheet, rows.roa, col);

    // Growth formulas
    const prevYearCol = col - 4;
    if (prevYearCol >= 1) {
      const currAddr = getCellAddr(GC, sheet, rows.revenue, col);
      const prevAddr = getCellAddr(GC, sheet, rows.revenue, prevYearCol);
      sheet.setFormula(
        rows.revGrowth,
        col,
        `IF(${prevAddr}<>0, (${currAddr}-${prevAddr})/${prevAddr}, 0)`
      );
      sheet.setFormatter(rows.revGrowth, col, '0.00%');

      const currProfitAddr = getCellAddr(GC, sheet, rows.netProfit, col);
      const prevProfitAddr = getCellAddr(GC, sheet, rows.netProfit, prevYearCol);
      sheet.setFormula(
        rows.profitGrowth,
        col,
        `IF(${prevProfitAddr}<>0, (${currProfitAddr}-${prevProfitAddr})/${prevProfitAddr}, 0)`
      );
      sheet.setFormatter(rows.profitGrowth, col, '0.00%');
    }
    applyBorder(GC, sheet, rows.revGrowth, col);
    applyBorder(GC, sheet, rows.profitGrowth, col);

    // Double border at Q4
    if (quarter === 'Q4') {
      sheet
        .getRange(startRow, col, rows.profitGrowth - startRow + 1, 1)
        .setBorder(
          new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.double),
          { right: true }
        );
    }
  });

  // Bottom border
  sheet
    .getRange(rows.profitGrowth, 0, 1, currentCol)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.double),
      { bottom: true }
    );

  return { cols, rows, currentCol };
}
