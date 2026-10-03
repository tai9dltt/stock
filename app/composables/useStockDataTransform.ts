/**
 * Stock Data Transform Composable
 * Helper functions for processing and transforming stock analysis data
 */

import {
  QUARTERLY_INDICATOR_SOURCES,
  ANNUAL_INDICATOR_SOURCES,
} from '~/constants/spreadJsConstants';
import type { AnalysisSheetData } from '~/spreadsheet/types';
import { extractYearsFromData } from '~/spreadsheet/years';
import type { SaveAnalysisPayload, StockData, TradingInfo } from '~/types';

/**
 * Process forecast periods from API response
 */
export function processForecasts(periods: any[]): {
  forecastYears: string[];
  forecastQuarters: string[];
} {
  const fYears = new Set<string>();
  const fQuarters = new Set<string>();

  periods.forEach((p: any) => {
    if (p.is_forecast) {
      if (p.source === 'year' || p.quarter === 0) {
        fYears.add(p.year.toString());
      } else {
        fQuarters.add(`${p.year}_Q${p.quarter}`);
      }
    }
  });

  return {
    forecastYears: Array.from(fYears),
    forecastQuarters: Array.from(fQuarters),
  };
}

/**
 * Metric codes feeding each indicator, lowest priority first, so that writing
 * them in order leaves the highest-priority value in place.
 */
function sourcesLowestFirst(sources: Record<string, string[]>, metrics: Record<string, any>) {
  return Object.entries(sources)
    .map(([indicator, codes]) => [indicator, [...codes].reverse().filter(code => code in metrics)] as const)
    .filter(([, codes]) => codes.length > 0);
}

/**
 * Overlay crawled quarterly metrics onto existing data
 * Official data overrides manual input for overlapping periods
 */
export function overlayQuarterlyMetrics(
  metrics: Record<string, any>,
  quarterlyData: Record<string, any>
): Record<string, any> {
  const result = { ...quarterlyData };

  for (const [indicator, codes] of sourcesLowestFirst(QUARTERLY_INDICATOR_SOURCES, metrics)) {
    result[indicator] ??= {};

    for (const code of codes) {
      for (const [periodKey, value] of Object.entries(metrics[code] as Record<string, string>)) {
        const [year, quarter] = periodKey.split('_');
        if (!year || !quarter) continue;

        result[indicator][year] ??= {};
        result[indicator][year][quarter] = parseFloat(value);
      }
    }
  }

  return result;
}

/**
 * Overlay crawled annual metrics onto existing data
 */
export function overlayAnnualMetrics(
  yearlyMetrics: Record<string, any>,
  annualData: Record<string, any>
): Record<string, any> {
  const result = { ...annualData };

  for (const [indicator, codes] of sourcesLowestFirst(ANNUAL_INDICATOR_SOURCES, yearlyMetrics)) {
    result[indicator] ??= {};

    for (const code of codes) {
      for (const [year, value] of Object.entries(yearlyMetrics[code] as Record<string, string>)) {
        result[indicator][year] = parseFloat(value);
      }
    }
  }

  return result;
}

/**
 * Sync years between annual and quarterly data
 * Ensures missing years are added with empty quarters
 */
export function syncYearsToQuarterly(
  annualData: Record<string, any>,
  quarterlyData: Record<string, any>
): Record<string, any> {
  const annualYears = new Set<string>();
  const quarterlyYears = new Set<string>();

  // Extract years from annualData
  for (const indicatorData of Object.values(annualData)) {
    if (indicatorData && typeof indicatorData === 'object') {
      Object.keys(indicatorData).forEach((year) => annualYears.add(year));
    }
  }

  // Extract years from quarterlyData
  for (const indicatorData of Object.values(quarterlyData)) {
    if (indicatorData && typeof indicatorData === 'object') {
      Object.keys(indicatorData).forEach((year) => quarterlyYears.add(year));
    }
  }

  // Find years in annual but not in quarterly
  const yearsToAdd = Array.from(annualYears).filter((year) => !quarterlyYears.has(year));

  if (yearsToAdd.length === 0) {
    return quarterlyData;
  }

  const result = { ...quarterlyData };

  for (const year of yearsToAdd) {
    for (const indicatorKey of Object.keys(result)) {
      if (!result[indicatorKey]) {
        result[indicatorKey] = {};
      }
      if (!result[indicatorKey][year]) {
        result[indicatorKey][year] = {
          Q1: null,
          Q2: null,
          Q3: null,
          Q4: null,
        };
      }
    }
  }

  return result;
}

/**
 * Extract outstanding shares per quarter from spreadsheet
 */
export function extractSharesPerQuarter(
  sheet: any,
  sharesRowPosition: number,
  quarterlyColsInfo: Array<{ year: string; quarter: string; col: number }>
): Record<string, Record<string, number>> {
  const sharesPerQuarter: Record<string, Record<string, number>> = {};

  quarterlyColsInfo.forEach(({ year, quarter, col }) => {
    const sharesVal = sheet.getValue(sharesRowPosition, col);
    if (sharesVal !== null && sharesVal !== undefined && !isNaN(Number(sharesVal))) {
      if (!sharesPerQuarter[year]) {
        sharesPerQuarter[year] = {};
      }
      sharesPerQuarter[year][quarter] = Number(sharesVal);
    }
  });

  return sharesPerQuarter;
}

/**
 * Read P/E values from valuation table
 */
export function extractPeValues(
  sheet: any,
  peRowStart: number,
  totalRows: number
): number[] {
  const peValues: number[] = [];

  for (let r = 0; r < totalRows; r++) {
    const peVal = sheet.getValue(peRowStart + r, 0);
    if (peVal !== null && peVal !== undefined && !isNaN(Number(peVal))) {
      peValues.push(Number(peVal));
    }
  }

  return peValues;
}

/**
 * Read input values from spreadsheet input section
 */
export function extractInputValues(
  sheet: any,
  inputRowStart: number,
  valueCol: number
): {
  currentPrice: number;
  outstandingShares: number;
  max52W: number;
  min52W: number;
  revenueGrowth: number;
  grossMargin: number;
  netProfitGrowth: number;
} {
  const getValue = (row: number): number => {
    const val = sheet.getValue(row, valueCol);
    return val !== null && val !== undefined ? Number(val) || 0 : 0;
  };

  return {
    currentPrice: getValue(inputRowStart + 1),
    outstandingShares: getValue(inputRowStart + 2),
    max52W: getValue(inputRowStart + 3),
    min52W: getValue(inputRowStart + 4),
    revenueGrowth: getValue(inputRowStart + 5),
    grossMargin: getValue(inputRowStart + 6),
    netProfitGrowth: getValue(inputRowStart + 7),
  };
}

// ============ PAGE STATE ============

export function createEmptyAnalysisState(symbol: string): AnalysisSheetData {
  return {
    symbol,
    annualData: {},
    quarterlyData: {},
    forecastYears: [],
    forecastQuarters: [],
    peScenarios: [],
    tradingDate: '',
    currentPrice: 0,
    outstandingShares: 0,
    max52W: 0,
    min52W: 0,
    revenueGrowth: 0,
    grossMargin: 0,
    netProfitGrowth: 0,
  };
}

/**
 * Build the analysis page state from GET /api/stock/get and the live trading info.
 *
 * Precedence: live trading info > stored snapshot > values saved with the analysis.
 * Financial figures come from the crawled metrics; the saved analysis only adds
 * the user's inputs (assumptions, P/E scenarios, shares per quarter).
 */
export function buildAnalysisState(
  symbol: string,
  data: StockData,
  tradingInfo: TradingInfo | null | undefined,
  today: string
): AnalysisSheetData {
  const state = createEmptyAnalysisState(symbol);

  if (data.periods) {
    const forecasts = processForecasts(data.periods);
    state.forecastYears = forecasts.forecastYears;
    state.forecastQuarters = forecasts.forecastQuarters;
  }

  const snapshot = data.tradingSnapshot;
  if (snapshot) {
    if (snapshot.outstandingShares) state.outstandingShares = snapshot.outstandingShares;
    if (snapshot.lastPrice) state.currentPrice = snapshot.lastPrice;
    if (snapshot.tradingDate) state.tradingDate = snapshot.tradingDate;
  }

  if (tradingInfo) {
    if (tradingInfo.lastPrice) {
      state.currentPrice = tradingInfo.lastPrice;
      state.tradingDate = today;
    }
    if (tradingInfo.outstandingShares) state.outstandingShares = tradingInfo.outstandingShares;
    if (tradingInfo.min52W) state.min52W = tradingInfo.min52W;
    if (tradingInfo.max52W) state.max52W = tradingInfo.max52W;
  }

  const saved = data.analysis;
  if (saved) {
    // Shares per quarter are the only per-period figures the user enters
    if (saved.sharesByQuarter) state.quarterlyData = { outstandingShares: structuredClone(saved.sharesByQuarter) };
    if (saved.peScenarios?.length) state.peScenarios = [...saved.peScenarios];
    if (saved.outstandingShares && !state.outstandingShares) state.outstandingShares = saved.outstandingShares;
    if (saved.currentPrice && !state.currentPrice) state.currentPrice = saved.currentPrice;
    if (saved.max52W && !state.max52W) state.max52W = saved.max52W;
    if (saved.min52W && !state.min52W) state.min52W = saved.min52W;
    state.revenueGrowth = saved.revenueGrowth;
    state.grossMargin = saved.grossMargin;
    state.netProfitGrowth = saved.netProfitGrowth;
  }

  if (data.metrics && Object.keys(data.metrics).length > 0) {
    state.quarterlyData = overlayQuarterlyMetrics(data.metrics, state.quarterlyData);
  }
  if (data.yearlyMetrics && Object.keys(data.yearlyMetrics).length > 0) {
    state.annualData = overlayAnnualMetrics(data.yearlyMetrics, state.annualData);
  }

  // Years that only have annual data still get (empty) quarter columns
  state.quarterlyData = syncYearsToQuarterly(state.annualData, state.quarterlyData);

  return state;
}

/**
 * The year "Add Year" appends: the year after the last one the sheet shows
 * (any indicator counts, since banks have no netRevenue).
 */
export function nextForecastYear(
  annualData: Record<string, any>,
  quarterlyData: Record<string, any>,
  forecastYears: string[]
): string {
  const years = [...extractYearsFromData(annualData), ...extractYearsFromData(quarterlyData), ...forecastYears]
    .map(Number)
    .filter(Number.isFinite);
  return years.length > 0 ? String(Math.max(...years) + 1) : String(new Date().getFullYear());
}

/**
 * Make sure every quarter of a forecast year is marked as a forecast quarter.
 */
export function withForecastYearQuarters(forecastYears: string[], forecastQuarters: string[]): string[] {
  const result = [...forecastQuarters];
  for (const year of forecastYears) {
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
      if (!result.includes(`${year}_${q}`)) result.push(`${year}_${q}`);
    }
  }
  return result;
}

export interface TradingPlan {
  noteHtml: string;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
}

/**
 * What gets saved for a stock: only the user's inputs, not the crawled figures.
 */
export function toSavePayload(state: AnalysisSheetData, plan: TradingPlan): SaveAnalysisPayload {
  return {
    symbol: state.symbol,
    forecastYears: [...state.forecastYears],
    revenueGrowth: state.revenueGrowth,
    grossMargin: state.grossMargin,
    netProfitGrowth: state.netProfitGrowth,
    peScenarios: state.peScenarios.length > 0 ? state.peScenarios : null,
    sharesByQuarter: state.quarterlyData['outstandingShares'] ?? null,
    currentPrice: state.currentPrice || null,
    outstandingShares: state.outstandingShares || null,
    max52W: state.max52W || null,
    min52W: state.min52W || null,
    ...plan,
  };
}
