/**
 * Stock Data Transform Composable
 * Helper functions for processing and transforming stock analysis data
 */

import {
  METRIC_TO_INDICATOR_QUARTERLY,
  METRIC_TO_INDICATOR_ANNUAL,
} from '~/constants/spreadJsConstants';

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
 * Overlay crawled quarterly metrics onto existing data
 * Official data overrides manual input for overlapping periods
 */
export function overlayQuarterlyMetrics(
  metrics: Record<string, any>,
  quarterlyData: Record<string, any>
): Record<string, any> {
  const result = { ...quarterlyData };

  for (const [metricCode, periodValues] of Object.entries(metrics)) {
    const indicatorKey = METRIC_TO_INDICATOR_QUARTERLY[metricCode];
    if (!indicatorKey) continue;

    if (!result[indicatorKey]) {
      result[indicatorKey] = {};
    }

    for (const [periodKey, value] of Object.entries(periodValues as Record<string, string>)) {
      const parts = periodKey.split('_');
      if (parts.length < 2) continue;

      const year = parts[0]!;
      const quarter = parts[1]!;

      if (!result[indicatorKey][year]) {
        result[indicatorKey][year] = {};
      }

      result[indicatorKey][year][quarter] = parseFloat(value as string);
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

  for (const [metricCode, yearValues] of Object.entries(yearlyMetrics)) {
    const indicatorKey = METRIC_TO_INDICATOR_ANNUAL[metricCode];
    if (!indicatorKey) continue;

    if (!result[indicatorKey]) {
      result[indicatorKey] = {};
    }

    for (const [year, value] of Object.entries(yearValues as Record<string, string>)) {
      result[indicatorKey][year] = parseFloat(value);
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
