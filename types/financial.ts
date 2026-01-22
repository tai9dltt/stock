// Types for quarterly financial data
export interface QuarterlyData {
  revenue: number | null;
  netInterestIncome?: number | null; // For banks
  netProfit: number | null;
  grossProfit?: number | null;
  operatingProfit?: number | null;
}

export interface YearQuarterData {
  Q1: QuarterlyData | null;
  Q2: QuarterlyData | null;
  Q3: QuarterlyData | null;
  Q4: QuarterlyData | null;
}

export interface QuarterlyAnalysis {
  years: string[]; // e.g., ['2020', '2021', '2022', '2023']
  quarters: Record<string, YearQuarterData>; // keyed by year
  forecastStartYear: string; // e.g., '2022'
  forecastStartQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; // e.g., 'Q1'
  outstandingShares: number | null; // Số lượng CP lưu hành
  currentPrice: number | null; // Giá CP hiện tại
}

export interface CalculatedMetrics {
  netProfitMargin: number | null; // Biên lợi nhuận ròng
  quarterlyEPS: number | null; // EPS quý
  cumulativeEPS: number | null; // EPS lũy kế
  pe: number | null; // P/E ratio
  revenueGrowth: number | null; // % tăng trưởng doanh thu
  profitGrowth: number | null; // % tăng trưởng LNST
}

export interface QuarterCell extends QuarterlyData, CalculatedMetrics {
  year: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  isForecast: boolean;
}

export interface FinancialIndicatorRow {
  indicator: string;
  indicatorKey: string;
  quarters: QuarterCell[];
}
