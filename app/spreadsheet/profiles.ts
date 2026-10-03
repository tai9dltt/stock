/**
 * Stock profiles: which rows each type of company shows and how they are computed.
 *
 * Rows are laid out in the order listed. Adding a new company type (e.g.
 * insurance) means adding a profile here.
 */

import type { InputNote, RowSpec, StockProfile, StockType } from './types'
import {
  amount, assetReturn, forecastGrossProfit, growth, projectedAmount, quarterlyGrowth, quarterlyEps, quarterlyPe,
  ratio, reported, shares, trailingEps,
} from './cells'

const AMOUNT = '#,##0'
const PERCENT = '0.00%'

const COMMON_INPUT_NOTES: StockProfile['inputNotes'] = {
  currentPrice: { kind: 'actual', text: 'Thực tế · dùng tính P/E' },
  outstandingShares: { kind: 'actual', text: 'Thực tế (Vietstock)' },
  max52W: { kind: 'actual', text: 'Thực tế (Vietstock)' },
  min52W: { kind: 'actual', text: 'Thực tế (Vietstock)' },
  // Forecast quarters (F) = same quarter last year × (1 + %), unless the quarter has its own % typed in its growth row
  revenueGrowth: { kind: 'forecast', text: 'Dự phóng · YoY, sửa riêng ở dòng TT' },
  // Gross profit of forecast quarters = revenue × %
  grossMargin: { kind: 'forecast', text: 'Dự phóng · biên LN gộp các quý (F)' },
  netProfitGrowth: { kind: 'forecast', text: 'Dự phóng · YoY, sửa riêng ở dòng TT' },
}

/** For profiles whose gross profit row is reported only, never forecast */
const UNUSED_GROSS_MARGIN: InputNote = { kind: 'unused', text: 'Không dùng cho loại cổ phiếu này' }

const COMMON_INPUT_LABELS = {
  currentPrice: 'Giá cổ phiếu',
  outstandingShares: 'Số lượng CP lưu hành',
  max52W: 'Giá cao nhất 52T',
  min52W: 'Giá thấp nhất 52T',
  revenueGrowth: '% TT Doanh thu',
  grossMargin: '% Biên LN gộp',
  netProfitGrowth: '% TT LNST',
}

/** Quarterly rows shared by all profiles, after the income statement rows */
const quarterlyPerShareRows = (opts: { peReportedInForecast: boolean, percentReturns: boolean }): RowSpec[] => [
  { key: 'eps', label: 'EPS quý', render: quarterlyEps() },
  { key: 'epsTtm', label: 'EPS lũy kế', render: trailingEps() },
  { key: 'pe', label: 'P/E', render: quarterlyPe(opts.peReportedInForecast) },
  {
    key: 'roe',
    label: 'ROE (%)',
    render: opts.percentReturns
      ? reported('roe', 'roe', PERCENT, { fromPercent: true, skipEmpty: true })
      : reported('roe', 'roe', '0.00', { skipEmpty: true }),
  },
  {
    key: 'roa',
    label: 'ROA (%)',
    render: opts.percentReturns
      ? reported('roa', 'roa', PERCENT, { fromPercent: true, skipEmpty: true })
      : reported('roa', 'roa', '0.00', { skipEmpty: true }),
  },
]

const growthRow = (key: 'revGrowth' | 'profitGrowth', label: string, base: 'revenue' | 'netProfit'): RowSpec => ({
  key, label, emphasize: true, render: growth(key, base),
})

/** Quarterly growth row; its forecast cells take the growth the projection uses */
const quarterlyGrowthRow = (key: 'revGrowth' | 'profitGrowth', label: string, base: 'revenue' | 'netProfit'): RowSpec => ({
  key, label, emphasize: true, render: quarterlyGrowth(key, base, base),
})

// ─── Industrial (default) ───────────────────────────────────────────

const industrial: StockProfile = {
  type: 'industrial',
  title: 'TẦM SOÁT CỔ PHIẾU',
  inputLabels: COMMON_INPUT_LABELS,
  inputNotes: COMMON_INPUT_NOTES,
  actualDataIndicators: ['netRevenue'],
  annualSumOfQuarters: ['grossProfit'],
  annualRows: [
    { key: 'revenue', label: 'Doanh thu thuần', render: projectedAmount('revenue', 'netRevenue', 'revenueGrowth') },
    { key: 'grossProfit', label: 'Lợi nhuận gộp', render: amount('grossProfit', 'grossProfit') },
    { key: 'operatingProfit', label: 'LN từ HĐKD', render: amount('operatingProfit', 'operatingProfit') },
    { key: 'netProfit', label: 'LNST công ty mẹ', render: amount('netProfit', 'netProfit') },
    { key: 'grossMargin', label: 'Biên LN gộp (%)', render: ratio('grossMargin', 'grossProfit', 'revenue') },
    { key: 'netMargin', label: 'Biên LN ròng (%)', render: ratio('netMargin', 'netProfit', 'revenue') },
    { key: 'eps', label: 'EPS (Vietstock)', render: reported('eps', 'eps', AMOUNT, { historicalOnly: true }) },
    { key: 'pe', label: 'P/E (Vietstock)', render: reported('pe', 'pe', '0.00', { historicalOnly: true }) },
    { key: 'ros', label: 'ROS (%)', render: reported('ros', 'ros', PERCENT, { fromPercent: true, historicalOnly: true }) },
    { key: 'roe', label: 'ROE (%)', render: reported('roe', 'roe', '0.00') },
    { key: 'roa', label: 'ROA (%)', render: reported('roa', 'roa', '0.00') },
    growthRow('revGrowth', 'TT tăng trưởng DT', 'revenue'),
    growthRow('profitGrowth', 'TT tăng trưởng LNST', 'netProfit'),
  ],
  quarterlyRows: [
    { key: 'revenue', label: 'Doanh thu thuần', render: projectedAmount('revenue', 'netRevenue', 'revenueGrowth', 'revGrowth') },
    { key: 'grossProfit', label: 'Lợi nhuận gộp', render: forecastGrossProfit() },
    { key: 'operatingProfit', label: 'LN từ HĐKD', render: amount('operatingProfit', 'operatingProfit') },
    { key: 'grossMargin', label: 'Biên lợi nhuận gộp', render: ratio('grossMargin', 'grossProfit', 'revenue') },
    {
      key: 'netProfit', label: 'LNST công ty mẹ', emphasize: true,
      render: projectedAmount('netProfit', 'netProfit', 'netProfitGrowth', 'profitGrowth'),
    },
    { key: 'shares', label: 'KL CP lưu hành', render: shares() },
    { key: 'netMargin', label: 'Biên lợi nhuận ròng', render: ratio('netMargin', 'netProfit', 'revenue') },
    ...quarterlyPerShareRows({ peReportedInForecast: false, percentReturns: false }),
    quarterlyGrowthRow('revGrowth', 'TT DT (%)', 'revenue'),
    quarterlyGrowthRow('profitGrowth', 'TT LNST (%)', 'netProfit'),
  ],
}

// ─── Bank ───────────────────────────────────────────────────────────
// Banks report net interest income instead of revenue and have no gross profit.

const bank: StockProfile = {
  type: 'bank',
  title: 'TẦM SOÁT CỔ PHIẾU NGÂN HÀNG',
  inputLabels: {
    ...COMMON_INPUT_LABELS,
    revenueGrowth: '% TT Thu nhập lãi',
    grossMargin: '% NIM',
  },
  inputNotes: { ...COMMON_INPUT_NOTES, grossMargin: UNUSED_GROSS_MARGIN },
  actualDataIndicators: ['netInterestIncome', 'totalAssets'],
  annualSumOfQuarters: ['operatingExpenses'],
  annualRows: [
    {
      key: 'revenue', label: 'Thu nhập lãi thuần',
      render: projectedAmount('revenue', 'netInterestIncome', 'revenueGrowth'),
    },
    { key: 'operatingExpenses', label: 'Chi phí hoạt động', render: amount('operatingExpenses', 'operatingExpenses') },
    { key: 'netProfit', label: 'LNST', render: amount('netProfit', 'netProfit') },
    { key: 'netProfitMargin', label: 'Biên LN ròng (%)', render: ratio('netProfitMargin', 'netProfit', 'revenue') },
    { key: 'assetReturn', label: 'ROA (%)', render: assetReturn() },
    { key: 'eps', label: 'EPS (Vietstock)', render: reported('eps', 'eps', AMOUNT, { historicalOnly: true }) },
    { key: 'pe', label: 'P/E (Vietstock)', render: reported('pe', 'pe', '0.00', { historicalOnly: true }) },
    { key: 'roe', label: 'ROE (%)', render: reported('roe', 'roe', PERCENT, { fromPercent: true }) },
    { key: 'roa', label: 'ROA (%)', render: reported('roa', 'roa', PERCENT, { fromPercent: true }) },
    growthRow('revGrowth', 'TT Thu nhập lãi (%)', 'revenue'),
    growthRow('profitGrowth', 'TT LNST (%)', 'netProfit'),
  ],
  quarterlyRows: [
    {
      key: 'revenue', label: 'Thu nhập lãi thuần',
      render: projectedAmount('revenue', 'netInterestIncome', 'revenueGrowth', 'revGrowth'),
    },
    { key: 'operatingExpenses', label: 'Chi phí hoạt động', render: amount('operatingExpenses', 'operatingExpenses') },
    {
      key: 'netProfit', label: 'LNST', emphasize: true,
      render: projectedAmount('netProfit', 'netProfit', 'netProfitGrowth', 'profitGrowth'),
    },
    { key: 'shares', label: 'KL CP lưu hành', render: shares() },
    { key: 'netProfitMargin', label: 'Biên LN ròng (%)', render: ratio('netProfitMargin', 'netProfit', 'revenue') },
    { key: 'assetReturn', label: 'ROA (%)', render: assetReturn() },
    ...quarterlyPerShareRows({ peReportedInForecast: true, percentReturns: true }),
    quarterlyGrowthRow('revGrowth', 'TT Thu nhập lãi (%)', 'revenue'),
    quarterlyGrowthRow('profitGrowth', 'TT LNST (%)', 'netProfit'),
  ],
}

// ─── Securities companies ───────────────────────────────────────────

const securities: StockProfile = {
  type: 'securities',
  title: 'TẦM SOÁT CỔ PHIẾU CHỨNG KHOÁN',
  inputLabels: COMMON_INPUT_LABELS,
  inputNotes: { ...COMMON_INPUT_NOTES, grossMargin: UNUSED_GROSS_MARGIN },
  actualDataIndicators: ['netRevenue', 'netProfit'],
  annualSumOfQuarters: ['grossProfit'],
  annualRows: [
    { key: 'revenue', label: 'DT từ KD chứng khoán', render: projectedAmount('revenue', 'netRevenue', 'revenueGrowth') },
    { key: 'grossProfit', label: 'Lợi nhuận gộp', render: amount('grossProfit', 'grossProfit') },
    { key: 'operatingProfit', label: 'LNT từ KD chứng khoán', render: amount('operatingProfit', 'operatingProfit') },
    { key: 'netProfit', label: 'LNST', render: amount('netProfit', 'netProfit') },
    { key: 'grossMargin', label: 'Biên LN gộp (%)', render: ratio('grossMargin', 'grossProfit', 'revenue') },
    { key: 'netProfitMargin', label: 'Biên LN ròng (%)', render: ratio('netProfitMargin', 'netProfit', 'revenue') },
    { key: 'eps', label: 'EPS (Vietstock)', render: reported('eps', 'eps', AMOUNT, { historicalOnly: true }) },
    { key: 'pe', label: 'P/E (Vietstock)', render: reported('pe', 'pe', '0.00', { historicalOnly: true }) },
    { key: 'ros', label: 'ROS (%)', render: reported('ros', 'ros', PERCENT, { fromPercent: true }) },
    { key: 'roe', label: 'ROE (%)', render: reported('roe', 'roe', PERCENT, { fromPercent: true }) },
    { key: 'roa', label: 'ROA (%)', render: reported('roa', 'roa', PERCENT, { fromPercent: true }) },
    growthRow('revGrowth', 'TT Doanh thu (%)', 'revenue'),
    growthRow('profitGrowth', 'TT LNST (%)', 'netProfit'),
  ],
  quarterlyRows: [
    { key: 'revenue', label: 'DT từ KD chứng khoán', render: projectedAmount('revenue', 'netRevenue', 'revenueGrowth', 'revGrowth') },
    { key: 'grossProfit', label: 'Lợi nhuận gộp', render: amount('grossProfit', 'grossProfit') },
    { key: 'operatingProfit', label: 'LNT từ KD chứng khoán', render: amount('operatingProfit', 'operatingProfit') },
    {
      key: 'netProfit', label: 'LNST', emphasize: true,
      render: projectedAmount('netProfit', 'netProfit', 'netProfitGrowth', 'profitGrowth'),
    },
    { key: 'shares', label: 'KL CP lưu hành', render: shares() },
    { key: 'grossMargin', label: 'Biên LN gộp (%)', render: ratio('grossMargin', 'grossProfit', 'revenue') },
    { key: 'netProfitMargin', label: 'Biên LN ròng (%)', render: ratio('netProfitMargin', 'netProfit', 'revenue') },
    ...quarterlyPerShareRows({ peReportedInForecast: true, percentReturns: true }),
    quarterlyGrowthRow('revGrowth', 'TT Doanh thu (%)', 'revenue'),
    quarterlyGrowthRow('profitGrowth', 'TT LNST (%)', 'netProfit'),
  ],
}

export const STOCK_PROFILES: Record<StockType, StockProfile> = { industrial, bank, securities }

// ─── Detection ──────────────────────────────────────────────────────

export const SECURITIES_STOCKS = [
  'SSI', 'VND', 'HCM', 'VCI', 'SHS', 'MBS', 'VIX', 'BSC', 'CTS', 'ORS',
  'TVS', 'AGR', 'FTS', 'BVS', 'APS', 'DSE', 'EVS', 'VDS', 'TCI', 'VIS',
  'WSS', 'HBS', 'PSI', 'SBS', 'VNDS',
]

const hasAny = (data: Record<string, any>, indicator: string) =>
  !!data[indicator] && Object.keys(data[indicator]).length > 0

/**
 * Banks have net interest income (or, in older data, total assets without revenue).
 */
export function isBankStock(annualData: Record<string, any>, quarterlyData: Record<string, any>): boolean {
  const has = (indicator: string) => hasAny(annualData, indicator) || hasAny(quarterlyData, indicator)
  return has('netInterestIncome') || (!has('netRevenue') && has('totalAssets'))
}

export function detectStockType(
  symbol: string,
  annualData: Record<string, any>,
  quarterlyData: Record<string, any>
): StockType {
  if (SECURITIES_STOCKS.includes(symbol.toUpperCase())) return 'securities'
  if (isBankStock(annualData, quarterlyData)) return 'bank'
  return 'industrial'
}
