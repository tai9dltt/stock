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
  ANNUAL_TABLE,
  QUARTERLY_TABLE,
  VALUATION_TABLE,
  QUARTER_DATE_RANGES,
  ANNUAL_ROW_LABELS,
  QUARTERLY_ROW_LABELS,
  INPUT_FIELD_LABELS,
  YEAR_DETECTION_METRICS,
  getAnnualRowPositions,
  getQuarterlyRowPositions,
} from '~/constants/spreadJsConstants';

import {
  setCell as setCellUtil,
  applyBorder,
  getCellAddr,
  setDivisionFormula,
  setQuarterlySumFormula,
  applyRowHighlightOnSelect,
} from '~/utils/spreadjs';

// ============ HELPER FUNCTIONS ============

/**
 * Extract years from data by checking multiple metrics
 * Banks don't have netRevenue, so we check various metrics
 */
export function extractYearsFromData(data: Record<string, any>): string[] {
  const yearsSet = new Set<string>();

  for (const metric of YEAR_DETECTION_METRICS) {
    const metricData = data[metric];
    if (metricData && typeof metricData === 'object') {
      Object.keys(metricData).forEach((year) => yearsSet.add(year));
    }
  }

  return Array.from(yearsSet).sort();
}

/**
 * Check if any quarter has data for a given year
 */
export function hasQuarterData(
  quarterlyData: Record<string, any>,
  year: string,
  quarter: string
): boolean {
  for (const metric of YEAR_DETECTION_METRICS) {
    const value = quarterlyData[metric]?.[year]?.[quarter];
    if (value !== undefined && value !== null) {
      return true;
    }
  }
  return false;
}

/**
 * Determine if a year is forecast based on current year and data availability
 */
export function isForecastYear(
  year: string,
  currentYear: number,
  quarterlyData: Record<string, any>,
  forecastYears: string[]
): boolean {
  const yearInt = parseInt(year);

  // Future years are always forecast
  if (yearInt >= currentYear) return true;

  // Past years (2+ years old) are always historical
  if (yearInt < currentYear - 1) return false;

  // Previous year: check if Q4 data exists in any metric
  if (yearInt === currentYear - 1) {
    return !hasQuarterData(quarterlyData, year, 'Q4');
  }

  return forecastYears.includes(year);
}

/**
 * Get date range string for a quarter
 */
export function getQuarterDateRange(quarter: string): string {
  const qIdx = parseInt(quarter.replace('Q', '')) - 1;
  return QUARTER_DATE_RANGES[qIdx] || '';
}

/**
 * Filter years based on data completeness
 * Only hide years that are MORE than 2 years old AND don't have all 4 quarters
 */
export function filterIncompleteYears(
  years: string[],
  quarterlyData: Record<string, any>,
  currentYear: number
): string[] {
  return years.filter((year) => {
    const yearInt = parseInt(year);

    // Always show current year and future years
    if (yearInt >= currentYear) return true;

    // Always show previous year
    if (yearInt === currentYear - 1) return true;

    // For years MORE than 2 years old, check for all 4 quarters in any metric
    if (yearInt < currentYear - 1) {
      return (
        hasQuarterData(quarterlyData, year, 'Q1') &&
        hasQuarterData(quarterlyData, year, 'Q2') &&
        hasQuarterData(quarterlyData, year, 'Q3') &&
        hasQuarterData(quarterlyData, year, 'Q4')
      );
    }

    return true;
  });
}

/**
 * Fill gaps in years array to ensure continuity
 */
export function fillYearGaps(years: string[]): string[] {
  if (years.length === 0) return years;

  const minYear = parseInt(years[0]!);
  const maxYear = parseInt(years[years.length - 1]!);
  const result: string[] = [];

  for (let y = minYear; y <= maxYear; y++) {
    result.push(y.toString());
  }

  return result;
}

// ============ SECTION BUILDERS ============

/**
 * Build title section (Row 0)
 */
export function buildTitleSection(
  ctx: SpreadJSContext,
  stockSymbol: string
): void {
  const { GC, sheet } = ctx;

  sheet.setRowHeight(0, 50);

  setCellUtil(GC, sheet, 0, 2, 'TẦM SOÁT CỔ PHIẾU', {
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
 * Build input section (Starting at K4)
 * Returns cell references for use in formulas
 */
export function buildInputSection(
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

  // Input rows
  createInputRow(startRow + 1, INPUT_FIELD_LABELS.currentPrice, data.currentPrice || 0, {
    editable: true,
  });
  createInputRow(startRow + 2, INPUT_FIELD_LABELS.outstandingShares, data.outstandingShares || 0, {
    editable: true,
  });
  createInputRow(startRow + 3, INPUT_FIELD_LABELS.max52W, data.max52W || 0, {
    bg: SPREADJS_COLORS.DISPLAY,
  });
  createInputRow(startRow + 4, INPUT_FIELD_LABELS.min52W, data.min52W || 0, {
    bg: SPREADJS_COLORS.DISPLAY,
  });
  createInputRow(startRow + 5, INPUT_FIELD_LABELS.revenueGrowth, data.revenueGrowth || 0, {
    editable: true,
    format: '0.00%',
  });
  createInputRow(startRow + 6, INPUT_FIELD_LABELS.grossMargin, data.grossMargin || 0, {
    editable: true,
    format: '0.00%',
  });
  createInputRow(startRow + 7, INPUT_FIELD_LABELS.netProfitGrowth, data.netProfitGrowth || 0, {
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
 * Build annual summary table
 * Returns column mapping and row positions
 */
export function buildAnnualTable(
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
  const startRow = ANNUAL_TABLE.START_ROW;
  const rows = getAnnualRowPositions(startRow);

  // Prepare years - check multiple metrics for year detection (banks don't have netRevenue)
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

    sheet.setColumnWidth(col, ANNUAL_TABLE.COLUMN_WIDTH);

    const headerText = forecast ? `${year} (F)\n01/01-31/12` : `${year}\n01/01-31/12`;
    setCellUtil(GC, sheet, startRow, col, headerText, {
      bold: true,
      align: 'center',
      border: true,
      bg: forecast ? SPREADJS_COLORS.FORECAST : SPREADJS_COLORS.HISTORICAL,
    });
    sheet.getCell(startRow, col).wordWrap(true);
  });

  // Row labels
  setCellUtil(GC, sheet, rows.netRevenue, 0, ANNUAL_ROW_LABELS.netRevenue, { border: true });
  setCellUtil(GC, sheet, rows.grossProfit, 0, ANNUAL_ROW_LABELS.grossProfit, { border: true });
  setCellUtil(GC, sheet, rows.operatingProfit, 0, ANNUAL_ROW_LABELS.operatingProfit, { border: true });
  setCellUtil(GC, sheet, rows.netProfit, 0, ANNUAL_ROW_LABELS.netProfit, { border: true });
  setCellUtil(GC, sheet, rows.grossMargin, 0, ANNUAL_ROW_LABELS.grossMargin, { border: true });
  setCellUtil(GC, sheet, rows.netMargin, 0, ANNUAL_ROW_LABELS.netMargin, { border: true });
  setCellUtil(GC, sheet, rows.eps, 0, ANNUAL_ROW_LABELS.eps, { border: true });
  setCellUtil(GC, sheet, rows.pe, 0, ANNUAL_ROW_LABELS.pe, { border: true });
  setCellUtil(GC, sheet, rows.ros, 0, ANNUAL_ROW_LABELS.ros, { border: true });
  setCellUtil(GC, sheet, rows.roe, 0, ANNUAL_ROW_LABELS.roe, { border: true });
  setCellUtil(GC, sheet, rows.roa, 0, ANNUAL_ROW_LABELS.roa, { border: true });
  setCellUtil(GC, sheet, rows.revGrowth, 0, ANNUAL_ROW_LABELS.revGrowth, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });
  setCellUtil(GC, sheet, rows.profitGrowth, 0, ANNUAL_ROW_LABELS.profitGrowth, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });

  // Fill data for each year
  sortedYears.forEach((year) => {
    const col = colMap[year]!;
    const yearInt = parseInt(year);
    const forecast = isForecastYear(year, currentYear, data.quarterlyData, data.forecastYears);

    const rev = data.annualData['netRevenue']?.[year];
    const gross = data.annualData['grossProfit']?.[year];
    const operating = data.annualData['operatingProfit']?.[year];
    const profit = data.annualData['netProfit']?.[year];
    const eps = data.annualData['eps']?.[year];
    const pe = data.annualData['pe']?.[year];
    const ros = data.annualData['ros']?.[year];
    const roe = data.annualData['roe']?.[year];
    const roa = data.annualData['roa']?.[year];

    // Revenue: Use formula for forecast years
    if (forecast && colMap[(yearInt - 1).toString()]) {
      const prevYearCol = colMap[(yearInt - 1).toString()]!;
      const prevRevAddr = getCellAddr(GC, sheet, rows.netRevenue, prevYearCol);
      sheet.setFormula(rows.netRevenue, col, `${prevRevAddr} * (1 + ${inputRefs.revenueGrowth})`);
      sheet.setFormatter(rows.netRevenue, col, '#,##0');
    } else {
      setCellUtil(GC, sheet, rows.netRevenue, col, rev, { format: '#,##0', border: true });
    }
    applyBorder(GC, sheet, rows.netRevenue, col);

    // Other metrics
    setCellUtil(GC, sheet, rows.grossProfit, col, gross, { format: '#,##0', border: true });
    setCellUtil(GC, sheet, rows.operatingProfit, col, operating, { format: '#,##0', border: true });
    setCellUtil(GC, sheet, rows.netProfit, col, profit, { format: '#,##0', border: true });

    // EPS: For forecast years, will be calculated as SUM of quarterly EPS; for historical years, use API data
    if (!forecast) {
      setCellUtil(GC, sheet, rows.eps, col, eps, { format: '#,##0', border: true });
    }

    // P/E: For forecast years, will be calculated from EPS; for historical years, use API data
    if (!forecast) {
      setCellUtil(GC, sheet, rows.pe, col, pe, { format: '0.00', border: true });
    }

    // ROS: For forecast years, will be calculated as Net Profit / Revenue; for historical years, use API data
    if (!forecast) {
      setCellUtil(GC, sheet, rows.ros, col, ros !== undefined && ros !== null ? ros / 100 : null, { format: '0.00%', border: true });
    }

    setCellUtil(GC, sheet, rows.roe, col, roe, { format: '0.00', border: true });
    setCellUtil(GC, sheet, rows.roa, col, roa, { format: '0.00', border: true });

    // Margin formulas - always calculate from row references
    setDivisionFormula(GC, sheet, rows.grossMargin, col, rows.grossProfit, col, rows.netRevenue, col, '0.00%');
    setDivisionFormula(GC, sheet, rows.netMargin, col, rows.netProfit, col, rows.netRevenue, col, '0.00%');
    [rows.grossMargin, rows.netMargin].forEach((r) => applyBorder(GC, sheet, r, col));

    // Growth formulas
    const prevYear = (yearInt - 1).toString();
    if (colMap[prevYear]) {
      const prevCol = colMap[prevYear]!;

      // Revenue growth
      const currRevAddr = getCellAddr(GC, sheet, rows.netRevenue, col);
      const prevRevAddr = getCellAddr(GC, sheet, rows.netRevenue, prevCol);
      sheet.setFormula(
        rows.revGrowth,
        col,
        `IF(${prevRevAddr}<>0, (${currRevAddr}-${prevRevAddr})/${prevRevAddr}, 0)`
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
 * Build quarterly data table
 * Returns column info and row positions
 */
export function buildQuarterlyTable(
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
  const startRow = annualRows.profitGrowth + QUARTERLY_TABLE.GAP_FROM_ANNUAL;
  const rows = getQuarterlyRowPositions(startRow);

  // Prepare years - check multiple metrics for year detection (banks don't have netRevenue)
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
      const hasActualData =
        data.quarterlyData['netRevenue']?.[year]?.[q] !== undefined &&
        data.quarterlyData['netRevenue']?.[year]?.[q] !== null;

      const isF =
        !hasActualData &&
        (data.forecastQuarters.includes(actualQ) ||
          data.forecastYears.includes(year) ||
          isYearForecast);

      sheet.setColumnWidth(currentCol, QUARTERLY_TABLE.COLUMN_WIDTH);

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

  // Row labels
  setCellUtil(GC, sheet, rows.revenue, 0, QUARTERLY_ROW_LABELS.revenue, { border: true });
  setCellUtil(GC, sheet, rows.grossProfit, 0, QUARTERLY_ROW_LABELS.grossProfit, { border: true });
  setCellUtil(GC, sheet, rows.operatingProfit, 0, QUARTERLY_ROW_LABELS.operatingProfit, { border: true });
  setCellUtil(GC, sheet, rows.grossMargin, 0, QUARTERLY_ROW_LABELS.grossMargin, { border: true });
  setCellUtil(GC, sheet, rows.netProfit, 0, QUARTERLY_ROW_LABELS.netProfit, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });
  setCellUtil(GC, sheet, rows.shares, 0, QUARTERLY_ROW_LABELS.shares, { border: true });
  setCellUtil(GC, sheet, rows.netMargin, 0, QUARTERLY_ROW_LABELS.netMargin, { border: true });
  setCellUtil(GC, sheet, rows.eps, 0, QUARTERLY_ROW_LABELS.eps, { border: true });
  setCellUtil(GC, sheet, rows.epsTtm, 0, QUARTERLY_ROW_LABELS.epsTtm, { border: true });
  setCellUtil(GC, sheet, rows.pe, 0, QUARTERLY_ROW_LABELS.pe, { border: true });
  setCellUtil(GC, sheet, rows.roe, 0, QUARTERLY_ROW_LABELS.roe, { border: true });
  setCellUtil(GC, sheet, rows.roa, 0, QUARTERLY_ROW_LABELS.roa, { border: true });
  setCellUtil(GC, sheet, rows.revGrowth, 0, QUARTERLY_ROW_LABELS.revGrowth, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });
  setCellUtil(GC, sheet, rows.profitGrowth, 0, QUARTERLY_ROW_LABELS.profitGrowth, {
    border: true,
    color: SPREADJS_COLORS.TEXT_RED,
  });

  // Fill data for each quarter
  cols.forEach(({ year, quarter, col, isForecast }) => {
    const rev = data.quarterlyData['netRevenue']?.[year]?.[quarter];
    const gross = data.quarterlyData['grossProfit']?.[year]?.[quarter];
    const operating = data.quarterlyData['operatingProfit']?.[year]?.[quarter];
    const profit = data.quarterlyData['netProfit']?.[year]?.[quarter];

    const savedShares = data.quarterlyData['outstandingShares']?.[year]?.[quarter];
    const shares =
      savedShares !== undefined && savedShares !== null
        ? Number(savedShares)
        : data.outstandingShares;

    // Revenue
    if (isForecast) {
      const prevYearCol = col - 4;
      if (prevYearCol >= 1) {
        const prevRevAddr = getCellAddr(GC, sheet, rows.revenue, prevYearCol);
        sheet.setFormula(rows.revenue, col, `${prevRevAddr} * (1 + ${inputRefs.revenueGrowth})`);
        sheet.setFormatter(rows.revenue, col, '#,##0');
      } else {
        setCellUtil(GC, sheet, rows.revenue, col, rev, { format: '#,##0', border: true });
      }
    } else {
      setCellUtil(GC, sheet, rows.revenue, col, rev, { format: '#,##0', border: true });
    }
    applyBorder(GC, sheet, rows.revenue, col);

    // Gross Profit
    if (isForecast) {
      const revAddr = getCellAddr(GC, sheet, rows.revenue, col);
      sheet.setFormula(rows.grossProfit, col, `${revAddr} * ${inputRefs.grossMargin}`);
      sheet.setFormatter(rows.grossProfit, col, '#,##0');
    } else {
      setCellUtil(GC, sheet, rows.grossProfit, col, gross, { format: '#,##0', border: true });
    }
    applyBorder(GC, sheet, rows.grossProfit, col);

    setCellUtil(GC, sheet, rows.operatingProfit, col, operating, { format: '#,##0', border: true });

    // Net Profit
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
        setCellUtil(GC, sheet, rows.netProfit, col, profit, { format: '#,##0', border: true });
      }
    } else {
      setCellUtil(GC, sheet, rows.netProfit, col, profit, { format: '#,##0', border: true });
    }
    applyBorder(GC, sheet, rows.netProfit, col);

    setCellUtil(GC, sheet, rows.shares, col, shares, { format: '#,##0', border: true });
    sheet.getCell(rows.shares, col).locked(false);

    // Margin formulas
    setDivisionFormula(GC, sheet, rows.grossMargin, col, rows.grossProfit, col, rows.revenue, col, '0.00%');
    setDivisionFormula(GC, sheet, rows.netMargin, col, rows.netProfit, col, rows.revenue, col, '0.00%');

    // EPS - use API data if available, otherwise calculate from netProfit for forecast
    const epsFromApi = data.quarterlyData['eps']?.[year]?.[quarter];
    if (epsFromApi !== undefined && epsFromApi !== null) {
      // Use EPS from API directly (historical data or forecast data from API)
      setCellUtil(GC, sheet, rows.eps, col, epsFromApi, { format: '#,##0', border: true });
    } else if (isForecast || profit !== undefined && profit !== null) {
      // For forecast quarters or when we have netProfit: calculate EPS = (LNST * 1000000) / shares
      const profitAddr = getCellAddr(GC, sheet, rows.netProfit, col);
      const sharesAddr = getCellAddr(GC, sheet, rows.shares, col);
      sheet.setFormula(rows.eps, col, `IF(${sharesAddr}<>0, (${profitAddr} * 1000000) / ${sharesAddr}, 0)`);
      sheet.setFormatter(rows.eps, col, '#,##0');
    } else {
      // No data available
      setCellUtil(GC, sheet, rows.eps, col, null, { format: '#,##0', border: true });
    }

    // EPS TTM - use API data if available, otherwise calculate
    const epsTtmFromApi = data.quarterlyData['epsTtm']?.[year]?.[quarter];
    if (!isForecast && epsTtmFromApi !== undefined && epsTtmFromApi !== null) {
      setCellUtil(GC, sheet, rows.epsTtm, col, epsTtmFromApi, { format: '#,##0', border: true });
    } else if (col >= 4) {
      const epsRange = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(rows.eps, col - 3, 1, 4)
      );
      sheet.setFormula(rows.epsTtm, col, `SUM(${epsRange})`);
      sheet.setFormatter(rows.epsTtm, col, '#,##0');
    }

    // P/E
    const peFromApi = data.quarterlyData['pe']?.[year]?.[quarter];
    if (!isForecast && peFromApi !== undefined && peFromApi !== null) {
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

    // ROE - use API data if available (banks have ROE data)
    const roeFromApi = data.quarterlyData['roe']?.[year]?.[quarter];
    if (roeFromApi !== undefined && roeFromApi !== null) {
      setCellUtil(GC, sheet, rows.roe, col, roeFromApi, { format: '0.00', border: true });
    } else {
      applyBorder(GC, sheet, rows.roe, col);
    }

    // ROA - use API data if available (banks have ROA data)
    const roaFromApi = data.quarterlyData['roa']?.[year]?.[quarter];
    if (roaFromApi !== undefined && roaFromApi !== null) {
      setCellUtil(GC, sheet, rows.roa, col, roaFromApi, { format: '0.00', border: true });
    } else {
      applyBorder(GC, sheet, rows.roa, col);
    }

    // Growth formulas
    const prevYearCol = col - 4;
    if (prevYearCol >= 1) {
      const currRevAddr = getCellAddr(GC, sheet, rows.revenue, col);
      const prevRevAddr = getCellAddr(GC, sheet, rows.revenue, prevYearCol);
      sheet.setFormula(
        rows.revGrowth,
        col,
        `IF(${prevRevAddr}<>0, (${currRevAddr}-${prevRevAddr})/${prevRevAddr}, 0)`
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

    // Borders
    for (let r = rows.grossMargin; r <= rows.profitGrowth; r++) {
      applyBorder(GC, sheet, r, col);
    }

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

/**
 * Link annual table to quarterly data with SUM formulas
 */
export function linkAnnualToQuarterly(
  ctx: SpreadJSContext,
  annualColMap: AnnualColumnMap,
  annualRows: AnnualRowPositions,
  quarterlyCols: QuarterlyColumnInfo[],
  quarterlyRows: QuarterlyRowPositions,
  inputRefs: InputCellReferences
): void {
  const { GC, sheet } = ctx;

  const uniqueYears = [...new Set(quarterlyCols.map((q) => q.year))];

  uniqueYears.forEach((year) => {
    const annualCol = annualColMap[year];
    if (!annualCol) return;

    const yearQuarters = quarterlyCols.filter((q) => q.year === year);
    if (yearQuarters.length !== 4) return;

    const q1Col = yearQuarters.find((q) => q.quarter === 'Q1')?.col;
    const q2Col = yearQuarters.find((q) => q.quarter === 'Q2')?.col;
    const q3Col = yearQuarters.find((q) => q.quarter === 'Q3')?.col;
    const q4Col = yearQuarters.find((q) => q.quarter === 'Q4')?.col;

    if (!q1Col || !q2Col || !q3Col || !q4Col) return;

    const quarterCols = [q1Col, q2Col, q3Col, q4Col];

    // Check if this year is a forecast year (check if any quarter is forecast)
    const isYearForecast = yearQuarters.some((q) => q.isForecast);

    // Sum formulas - grossProfit only (not netProfit, which should only sum for forecast years)
    setQuarterlySumFormula(GC, sheet, quarterlyRows.grossProfit, annualRows.grossProfit, annualCol, quarterCols);

    // Only sum for forecast years (historical years use API data directly)
    if (isYearForecast) {
      // Net Profit: sum from quarterly data for forecast years
      setQuarterlySumFormula(GC, sheet, quarterlyRows.netProfit, annualRows.netProfit, annualCol, quarterCols);

      // EPS: sum from quarterly data for forecast years
      setQuarterlySumFormula(GC, sheet, quarterlyRows.eps, annualRows.eps, annualCol, quarterCols);
      applyBorder(GC, sheet, annualRows.eps, annualCol);

      // P/E = Price / EPS (only for forecast years after EPS is calculated)
      const epsAddr = getCellAddr(GC, sheet, annualRows.eps, annualCol);
      sheet.setFormula(annualRows.pe, annualCol, `IF(${epsAddr}<>0, ${inputRefs.currentPrice} / ${epsAddr}, 0)`);
      sheet.setFormatter(annualRows.pe, annualCol, '0.00');
      applyBorder(GC, sheet, annualRows.pe, annualCol);

      // ROS = Net Profit / Revenue (only for forecast years)
      const profitAddr = getCellAddr(GC, sheet, annualRows.netProfit, annualCol);
      const revAddr = getCellAddr(GC, sheet, annualRows.netRevenue, annualCol);
      sheet.setFormula(annualRows.ros, annualCol, `IF(${revAddr}<>0, ${profitAddr} / ${revAddr}, 0)`);
      sheet.setFormatter(annualRows.ros, annualCol, '0.00%');
      applyBorder(GC, sheet, annualRows.ros, annualCol);
    }
  });
}

/**
 * Build valuation table with P/E scenarios
 */
export function buildValuationTable(
  ctx: SpreadJSContext,
  quarterlyCols: QuarterlyColumnInfo[],
  quarterlyRows: QuarterlyRowPositions,
  data: {
    quarterlyData: Record<string, any>;
    forecastYears: string[];
    peAssumptions: Record<string, any>;
    annualData: Record<string, any>;
  }
): number {
  const { GC, sheet } = ctx;
  const currentYear = new Date().getFullYear();
  const startRow = quarterlyRows.profitGrowth + 4;

  // Get default P/E
  const prevYearStr = (currentYear - 1).toString();
  const prevYear2Str = (currentYear - 2).toString();
  let defaultPE =
    data.annualData['pe']?.[prevYearStr] || data.annualData['pe']?.[prevYear2Str] || 10;
  defaultPE = parseFloat(String(defaultPE)) || 10;

  // Get PE scenarios
  const savedPeValues = data.peAssumptions?.values;
  let peScenarios: number[];

  if (Array.isArray(savedPeValues) && savedPeValues.length > 0) {
    peScenarios = savedPeValues;
  } else {
    // Generate from historical + forecast data
    const historicalQuarters = quarterlyCols
      .filter((q) => !q.isForecast)
      .sort((a, b) => {
        const yearDiff = parseInt(b.year) - parseInt(a.year);
        if (yearDiff !== 0) return yearDiff;
        return parseInt(b.quarter.replace('Q', '')) - parseInt(a.quarter.replace('Q', ''));
      })
      .slice(0, 3);

    const forecastQuartersList = quarterlyCols
      .filter((q) => q.isForecast)
      .sort((a, b) => {
        const yearDiff = parseInt(a.year) - parseInt(b.year);
        if (yearDiff !== 0) return yearDiff;
        return parseInt(a.quarter.replace('Q', '')) - parseInt(b.quarter.replace('Q', ''));
      })
      .slice(0, 3);

    const peValues: number[] = [];

    historicalQuarters.reverse().forEach((q) => {
      const pe = data.quarterlyData['pe']?.[q.year]?.[q.quarter];
      if (pe !== undefined && pe !== null && !isNaN(Number(pe)) && Number(pe) > 0) {
        peValues.push(Math.round(Number(pe) * 100) / 100);
      }
    });

    forecastQuartersList.forEach((q) => {
      const peVal = sheet.getValue(quarterlyRows.pe, q.col);
      if (peVal !== undefined && peVal !== null && !isNaN(Number(peVal)) && Number(peVal) > 0) {
        peValues.push(Math.round(Number(peVal) * 100) / 100);
      } else {
        peValues.push(defaultPE);
      }
    });

    if (peValues.length < 6) {
      const defaults = [9, 11, 12, 13, 14, 5, 4];
      while (peValues.length < 7) {
        peValues.push(defaults[peValues.length] || 10);
      }
    }

    peScenarios = peValues;
  }

  const totalRows = VALUATION_TABLE.TOTAL_ROWS;

  // Year headers
  sheet.setRowHeight(startRow, 30);
  const valuationYears = [...new Set(quarterlyCols.map((q) => q.year))];

  valuationYears.forEach((year) => {
    const yearCols = quarterlyCols.filter((q) => q.year === year);
    if (yearCols.length === 0) return;

    const firstCol = yearCols[0]!.col;
    const spanCount = yearCols.length;
    const isYearForecast = isForecastYear(year, currentYear, data.quarterlyData, data.forecastYears);

    setCellUtil(GC, sheet, startRow, firstCol, year, {
      bold: true,
      align: 'center',
      border: true,
      bg: isYearForecast ? SPREADJS_COLORS.FORECAST : SPREADJS_COLORS.HISTORICAL,
    });

    if (spanCount > 1) {
      sheet.addSpan(startRow, firstCol, 1, spanCount);
    }

    sheet
      .getRange(startRow, firstCol, 1, spanCount)
      .setBorder(
        new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
        { all: true }
      );
  });

  // Quarter sub-headers
  quarterlyCols.forEach(({ year, quarter, col, isForecast }) => {
    const qIdx = parseInt(quarter.replace('Q', '')) - 1;

    setCellUtil(
      GC,
      sheet,
      startRow + 1,
      col,
      `${quarter}${isForecast ? ' (F)' : ''}\n${QUARTER_DATE_RANGES[qIdx]}`,
      {
        bold: true,
        align: 'center',
        border: true,
        bg: isForecast ? SPREADJS_COLORS.FORECAST : SPREADJS_COLORS.HISTORICAL,
      }
    );
    sheet.getCell(startRow + 1, col).wordWrap(true);
    sheet.setRowHeight(startRow + 1, 50);
  });

  // Label cells
  setCellUtil(GC, sheet, startRow, 0, 'Niên độ:', {
    bold: true,
    border: true,
    align: 'center',
    bg: SPREADJS_COLORS.HEADER,
  });
  setCellUtil(GC, sheet, startRow + 1, 0, 'Giả sử P/E:', {
    bold: true,
    border: true,
    align: 'center',
    bg: SPREADJS_COLORS.HEADER,
  });

  // Data rows
  const currentQCol = quarterlyCols.length > 0 ? quarterlyCols[quarterlyCols.length - 1]!.col + 1 : 1;

  for (let r = 0; r < totalRows; r++) {
    const currentRow = startRow + 2 + r;
    const peValue = peScenarios[r];

    setCellUtil(GC, sheet, currentRow, 0, peValue, {
      border: true,
      align: 'center',
      format: '0.00',
    });
    sheet.getCell(currentRow, 0).locked(false);

    // Highlight default row
    if (peValue !== undefined && Math.abs(peValue - defaultPE) < 0.01) {
      sheet.getRange(currentRow, 0, 1, currentQCol).backColor(SPREADJS_COLORS.DEFAULT_HIGHLIGHT);
    }

    // Fill formulas
    quarterlyCols.forEach(({ col }) => {
      const peAddr = `$A${currentRow + 1}`;
      const epsCell = sheet.getRange(quarterlyRows.epsTtm, col, 1, 1);
      const epsAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(epsCell);

      sheet.setFormula(
        currentRow,
        col,
        `IF(ISNUMBER(${peAddr})*ISNUMBER(${epsAddr}), ${peAddr} * ${epsAddr}, "-")`
      );
      sheet.setFormatter(currentRow, col, '#,##0');
      sheet.getCell(currentRow, col).hAlign(GC.Spread.Sheets.HorizontalAlign.right);
      applyBorder(GC, sheet, currentRow, col);
    });

    applyBorder(GC, sheet, currentRow, 0);
  }

  // Double borders at Q4
  quarterlyCols.forEach(({ quarter, col }) => {
    if (quarter === 'Q4') {
      sheet
        .getRange(startRow, col, totalRows + 2, 1)
        .setBorder(
          new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.double),
          { right: true }
        );
    }
  });

  return startRow;
}

/**
 * Apply final styling and configuration to the spreadsheet
 */
export function applyFinalStyling(
  ctx: SpreadJSContext,
  maxCol: number,
  valuationStartRow: number
): void {
  const { GC, spread, sheet } = ctx;

  sheet.autoFitColumn(0);
  sheet.setColumnWidth(0, 150);
  sheet.setColumnCount(Math.max(maxCol, 30));
  sheet.setRowCount(valuationStartRow + VALUATION_TABLE.TOTAL_ROWS + 4);
  sheet.frozenColumnCount(1);

  spread.options.scrollbarMaxAlign = true;
  spread.options.scrollbarShowMax = true;

  applyRowHighlightOnSelect(GC, sheet);
}
