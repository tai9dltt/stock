<script setup lang="ts">
import { ref, watch, onMounted, computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  applyRowHighlightOnSelect,
  setCell as setCellUtil,
  setQuarterlySumFormula,
  applyBorder,
  getCellAddr,
  setDivisionFormula,
} from '~/utils/spreadjs';

// Dynamically import SpreadJS components and CSS to avoid SSR issues
const GcSpreadSheets = defineAsyncComponent(() =>
  import('@mescius/spread-sheets-vue').then((m) => m.GcSpreadSheets),
);
const GcWorksheet = defineAsyncComponent(() =>
  import('@mescius/spread-sheets-vue').then((m) => m.GcWorksheet),
);

// Get symbol from route
const route = useRoute();
const router = useRouter();
const stockSymbol = computed(
  () => (route.params.symbol as string)?.toUpperCase() || '',
);

// Types
interface TradingNoteInstance extends ComponentPublicInstance {
  setValues: (data: {
    entryPrice?: number | null;
    targetPrice?: number | null;
    stopLoss?: number | null;
  }) => void;
}

// Refs
const outstandingShares = ref(0);
const currentPrice = ref(0);
const min52W = ref(0);
const max52W = ref(0);
const tradingDate = ref<string>('');

const peAssumptions = ref<Record<string, number>>({});
const annualData = ref<Record<string, any>>({});
const quarterlyData = ref<Record<string, any>>({});
const forecastYears = ref<string[]>([]);
const forecastQuarters = ref<string[]>([]);
const currentNoteHtml = ref('');
const isCloning = ref(false);
const loadingStore = useLoadingStore();

// Component refs
const tradingNoteRef = ref<TradingNoteInstance | null>(null);

// SpreadJS specific refs
const spreadInstance = ref<any>(null); // Use any because GC types are not available at compile time if we don't import them
let GC: any = null; // Will hold the GC module

// Toast
const toast = useToast();

// SpreadJS Initialization
const initWorkbook = async (spread: any) => {
  spreadInstance.value = spread;
  console.log('SpreadJS Initialized', spread);

  // Ensure GC is loaded
  if (!GC) {
    GC = await import('@mescius/spread-sheets');
    await import('@mescius/spread-sheets/styles/gc.spread.sheets.excel2013white.css');
  }

  updateSpreadSheet();
};

// Filter years based on data completeness
// Only hide years that are MORE than 2 years old AND don't have all 4 quarters
const filterIncompleteYears = (years: string[]): string[] => {
  const currentYear = new Date().getFullYear();

  return years.filter((year) => {
    const yearInt = parseInt(year);

    // Always show current year and future years
    if (yearInt >= currentYear) return true;

    // Always show previous year (current - 1)
    if (yearInt === currentYear - 1) return true;

    // For years that are MORE than 2 years old (< current - 1)
    // Only show if all 4 quarters exist
    if (yearInt < currentYear - 1) {
      const netRev = quarterlyData.value['netRevenue']?.[year] || {};
      const hasQ1 = netRev['Q1'] !== undefined && netRev['Q1'] !== null;
      const hasQ2 = netRev['Q2'] !== undefined && netRev['Q2'] !== null;
      const hasQ3 = netRev['Q3'] !== undefined && netRev['Q3'] !== null;
      const hasQ4 = netRev['Q4'] !== undefined && netRev['Q4'] !== null;

      return hasQ1 && hasQ2 && hasQ3 && hasQ4;
    }

    return true;
  });
};

const updateSpreadSheet = () => {
  if (!spreadInstance.value || !GC) return;
  const spread = spreadInstance.value;
  spread.suspendPaint();

  // Create or get 'Analysis' sheet
  let sheet = spread.getSheet(0);
  if (!sheet) {
    spread.addSheet(0, new GC.Spread.Sheets.Worksheet('Analysis'));
    sheet = spread.getSheet(0);
  }
  sheet.name('Analysis');
  sheet.reset();

  // Set default styles
  const defaultStyle = new GC.Spread.Sheets.Style();
  defaultStyle.font = '11pt Calibri';
  defaultStyle.vAlign = GC.Spread.Sheets.VerticalAlign.center;
  sheet.setDefaultStyle(defaultStyle);

  // Set a large enough column count up front to avoid issues with addSpan/setCell
  // We'll refine this at the end if needed
  sheet.setColumnCount(100);

  // --- UTILS ---
  const setCell = (r: number, c: number, value: any, style: any = {}) => {
    setCellUtil(GC, sheet, r, c, value, style);
  };

  // --- SECTION 0: TITLE & INFO ---
  // Row 1 (0-indexed): Title
  setCell(1, 2, 'TẦM SOÁT CỔ PHIẾU', {
    bold: true,
    color: '#0000FF',
    align: 'center',
  });
  setCell(1, 6, stockSymbol.value, {
    bold: true,
    color: '#FF0000',
    align: 'center',
  });
  setCell(1, 7, 'NGÀY', { bold: true });
  setCell(1, 8, new Date(), { format: 'dd/mm/yyyy' });

  // Row 4: Company Name
  setCell(4, 0, 'Tổng Công ty (Placeholder Name)', { bold: true, size: 12 });
  setCell(4, 7, 'LN dự kiến:', { bold: true });
  setCell(4, 9, 'Đơn vị tính: 10^6', { bold: true, color: 'blue' });

  // --- SECTION 0.5: GROWTH ASSUMPTIONS INPUT TABLE (Starting at K7) ---
  const INPUT_COL = 10; // Column K (0-indexed: K = 10)
  const INPUT_ROW_START = 6; // Row 7 (0-indexed: 7 = 6)

  // Set column width for input area
  sheet.setColumnWidth(INPUT_COL, 180);
  sheet.setColumnWidth(INPUT_COL + 1, 100);
  sheet.setColumnWidth(INPUT_COL + 2, 120); // For values

  // Header - merge 3 columns
  setCell(INPUT_ROW_START, INPUT_COL, `Ngày: ${tradingDate.value}`, {
    bold: true,
    align: 'left',
    bg: '#D9E1F2',
  });
  sheet.addSpan(INPUT_ROW_START, INPUT_COL, 1, 3);

  // Row 1: Stock Price
  setCell(INPUT_ROW_START + 1, INPUT_COL, 'Giá cổ phiếu', {
    bold: true,
    align: 'left',
  });
  sheet.addSpan(INPUT_ROW_START + 1, INPUT_COL, 1, 2);
  sheet
    .getRange(INPUT_ROW_START + 1, INPUT_COL, 1, 2)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
      { all: true },
    );
  setCell(INPUT_ROW_START + 1, INPUT_COL + 2, currentPrice.value || 0, {
    format: '#,##0',
    border: true,
    bg: '#FFF2CC',
  });
  sheet.getCell(INPUT_ROW_START + 1, INPUT_COL + 2).locked(false);

  // Row 2: Outstanding Shares
  setCell(INPUT_ROW_START + 2, INPUT_COL, 'Số lượng CP lưu hành', {
    bold: true,
    align: 'left',
  });
  sheet.addSpan(INPUT_ROW_START + 2, INPUT_COL, 1, 2);
  sheet
    .getRange(INPUT_ROW_START + 2, INPUT_COL, 1, 2)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
      { all: true },
    );
  setCell(INPUT_ROW_START + 2, INPUT_COL + 2, outstandingShares.value || 0, {
    format: '#,##0',
    border: true,
    bg: '#FFF2CC',
  });
  sheet.getCell(INPUT_ROW_START + 2, INPUT_COL + 2).locked(false);

  // Row 3: 52-Week High
  setCell(INPUT_ROW_START + 3, INPUT_COL, 'Giá cao nhất 52T', {
    bold: true,
    align: 'left',
  });
  sheet.addSpan(INPUT_ROW_START + 3, INPUT_COL, 1, 2);
  sheet
    .getRange(INPUT_ROW_START + 3, INPUT_COL, 1, 2)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
      { all: true },
    );
  setCell(INPUT_ROW_START + 3, INPUT_COL + 2, max52W.value || 0, {
    format: '#,##0',
    border: true,
    bg: '#E2EFDA',
  });

  // Row 4: 52-Week Low
  setCell(INPUT_ROW_START + 4, INPUT_COL, 'Giá thấp nhất 52T', {
    bold: true,
    align: 'left',
  });
  sheet.addSpan(INPUT_ROW_START + 4, INPUT_COL, 1, 2);
  sheet
    .getRange(INPUT_ROW_START + 4, INPUT_COL, 1, 2)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
      { all: true },
    );
  setCell(INPUT_ROW_START + 4, INPUT_COL + 2, min52W.value || 0, {
    format: '#,##0',
    border: true,
    bg: '#E2EFDA',
  });

  // Row 5: Revenue Growth %
  setCell(INPUT_ROW_START + 5, INPUT_COL, '% TT Doanh thu', {
    bold: true,
    align: 'left',
  });
  sheet.addSpan(INPUT_ROW_START + 5, INPUT_COL, 1, 2);
  sheet
    .getRange(INPUT_ROW_START + 5, INPUT_COL, 1, 2)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
      { all: true },
    );
  setCell(INPUT_ROW_START + 5, INPUT_COL + 2, 0, {
    format: '0.00%',
    border: true,
    bg: '#FFF2CC',
  });
  sheet.getCell(INPUT_ROW_START + 5, INPUT_COL + 2).locked(false);

  // Row 6: Gross Margin %
  setCell(INPUT_ROW_START + 6, INPUT_COL, '% Biên LN gộp', {
    bold: true,
    align: 'left',
  });
  sheet.addSpan(INPUT_ROW_START + 6, INPUT_COL, 1, 2);
  sheet
    .getRange(INPUT_ROW_START + 6, INPUT_COL, 1, 2)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
      { all: true },
    );
  setCell(INPUT_ROW_START + 6, INPUT_COL + 2, 0, {
    format: '0.00%',
    border: true,
    bg: '#FFF2CC',
  });
  sheet.getCell(INPUT_ROW_START + 6, INPUT_COL + 2).locked(false);

  // Row 7: Net Profit Growth %
  setCell(INPUT_ROW_START + 7, INPUT_COL, '% TT LNST', {
    bold: true,
    align: 'left',
  });
  sheet.addSpan(INPUT_ROW_START + 7, INPUT_COL, 1, 2);
  sheet
    .getRange(INPUT_ROW_START + 7, INPUT_COL, 1, 2)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
      { all: true },
    );
  setCell(INPUT_ROW_START + 7, INPUT_COL + 2, 0, {
    format: '0.00%',
    border: true,
    bg: '#FFF2CC',
  });
  sheet.getCell(INPUT_ROW_START + 7, INPUT_COL + 2).locked(false);

  // Store the input cell addresses for later use in formulas
  const CURRENT_PRICE_CELL = GC.Spread.Sheets.CalcEngine.rangeToFormula(
    sheet.getRange(INPUT_ROW_START + 1, INPUT_COL + 2, 1, 1),
  );
  const REVENUE_GROWTH_CELL = GC.Spread.Sheets.CalcEngine.rangeToFormula(
    sheet.getRange(INPUT_ROW_START + 5, INPUT_COL + 2, 1, 1),
  );
  const GROSS_MARGIN_CELL = GC.Spread.Sheets.CalcEngine.rangeToFormula(
    sheet.getRange(INPUT_ROW_START + 6, INPUT_COL + 2, 1, 1),
  );
  const NET_PROFIT_GROWTH_CELL = GC.Spread.Sheets.CalcEngine.rangeToFormula(
    sheet.getRange(INPUT_ROW_START + 7, INPUT_COL + 2, 1, 1),
  );

  // --- SECTION 1: ANNUAL DATA (Rows 6-14 in Excel -> Index 6-14) ---
  const startRowAnnual = 6;

  // Header Row
  sheet.setRowHeight(startRowAnnual, 60);
  setCell(startRowAnnual, 0, 'Niên độ\nThông tin + chỉ số', {
    bold: true,
    align: 'center',
    border: true,
  });
  // Merge years from data with forecastYears
  const years = Object.keys(annualData.value['netRevenue'] || {}).sort();
  const allYearsSet = new Set([...years, ...forecastYears.value]);
  let sortedYears = Array.from(allYearsSet).sort();

  // Filter incomplete years BEFORE filling gaps
  sortedYears = filterIncompleteYears(sortedYears);

  // Fill gaps specifically for the Annual table to ensure continuity
  if (sortedYears.length > 0) {
    const minYear = parseInt(sortedYears[0]!);
    const maxYear = parseInt(sortedYears[sortedYears.length - 1]!);
    const continuousYears: string[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      continuousYears.push(y.toString());
    }
    // Filter again after filling gaps to remove any incomplete years that were added
    sortedYears = filterIncompleteYears(continuousYears);
  }

  // Map years to columns starting from Col 1 (was Col 2)
  const annualColMap: Record<string, number> = {};
  sortedYears.forEach((year, i) => {
    const col = 1 + i;
    annualColMap[year] = col;
    sheet.setColumnWidth(col, 110); // Set width for annual columns

    // Check if forecast
    // Rule:
    // Future (>= Current Year): Always Forecast
    // Past (<= Current Year - 2): Always Historical
    // Previous Year (Current Year - 1): Forecast IF incomplete (missing Q4), otherwise Historical

    const currentYearInt = new Date().getFullYear();
    const yearInt = parseInt(year);

    let isForecast =
      forecastYears.value.includes(year) || yearInt >= currentYearInt;

    // Special Check for Previous Year (e.g., 2025 if current is 2026)
    if (yearInt === currentYearInt - 1) {
      // Check if Q4 data exists (using netRevenue as proxy)
      // Note: quarterlyData structure is { netRevenue: { 2025: { Q4: value } } }
      const hasQ4 = quarterlyData.value['netRevenue']?.[year]?.['Q4'];

      // If incomplete (Q4 missing/null), force Forecast
      if (hasQ4 === undefined || hasQ4 === null) {
        isForecast = true;
      } else {
        // If complete, force Historical (unless explicitly in forecastYears which is unlikely for past)
        isForecast = false;
      }
    }

    // Strict History Check: Years older than previous year are always History
    if (yearInt < currentYearInt - 1) {
      isForecast = false;
    }

    const headerText = isForecast
      ? `${year} (F)\n01/01-31/12`
      : `${year}\n01/01-31/12`;

    setCell(startRowAnnual, col, headerText, {
      bold: true,
      align: 'center',
      border: true,
      bg: isForecast ? '#FF1493' : '#70AD47', // Pink for Forecast, Green for Historical
    });
    sheet.getCell(startRowAnnual, col).wordWrap(true);
  });

  // Data Rows Constants
  const ROW_NET_REVENUE = startRowAnnual + 1;
  const ROW_GROSS_PROFIT = startRowAnnual + 2;
  const ROW_OPERATING_PROFIT = startRowAnnual + 3;
  const ROW_NET_PROFIT = startRowAnnual + 4;
  const ROW_GROSS_MARGIN = startRowAnnual + 5;
  const ROW_NET_MARGIN = startRowAnnual + 6;
  const ROW_EPS = startRowAnnual + 7;
  const ROW_PE = startRowAnnual + 8;
  const ROW_ROS = startRowAnnual + 9;
  const ROW_ROE = startRowAnnual + 10;
  const ROW_ROA = startRowAnnual + 11;
  const ROW_REV_GROWTH = startRowAnnual + 12;
  const ROW_PROFIT_GROWTH = startRowAnnual + 13;

  // Labels (Col 0)
  setCell(ROW_NET_REVENUE, 0, 'Doanh thu thuần', { border: true });
  setCell(ROW_GROSS_PROFIT, 0, 'Lợi nhuận gộp', { border: true });
  setCell(ROW_OPERATING_PROFIT, 0, 'LN từ HĐKD', { border: true });
  setCell(ROW_NET_PROFIT, 0, 'LNST công ty mẹ', { border: true });
  setCell(ROW_GROSS_MARGIN, 0, 'Biên LN gộp (%)', { border: true });
  setCell(ROW_NET_MARGIN, 0, 'Biên LN ròng (%)', { border: true });
  setCell(ROW_EPS, 0, 'EPS (Vietstock)', { border: true });
  setCell(ROW_PE, 0, 'P/E (Vietstock)', { border: true });
  setCell(ROW_ROS, 0, 'ROS (%)', { border: true });
  setCell(ROW_ROE, 0, 'ROE (%)', { border: true });
  setCell(ROW_ROA, 0, 'ROA (%)', { border: true });
  setCell(ROW_REV_GROWTH, 0, 'TT tăng trưởng DT', { border: true });
  setCell(ROW_PROFIT_GROWTH, 0, 'TT tăng trưởng LNST', { border: true });

  // Fill Data
  sortedYears.forEach((year) => {
    const col = annualColMap[year];
    if (!col) return; // verification check

    // Check if this year is forecast
    const currentYearInt = new Date().getFullYear();
    const yearInt = parseInt(year);
    let isForecast =
      forecastYears.value.includes(year) || yearInt >= currentYearInt;

    if (yearInt === currentYearInt - 1) {
      const hasQ4 = quarterlyData.value['netRevenue']?.[year]?.['Q4'];
      if (hasQ4 === undefined || hasQ4 === null) {
        isForecast = true;
      } else {
        isForecast = false;
      }
    }

    if (yearInt < currentYearInt - 1) {
      isForecast = false;
    }

    const rev = annualData.value['netRevenue']?.[year];
    const gross = annualData.value['grossProfit']?.[year];
    const operating = annualData.value['operatingProfit']?.[year];
    const profit = annualData.value['netProfit']?.[year];
    const eps = annualData.value['eps']?.[year];
    const pe = annualData.value['pe']?.[year];
    const ros = annualData.value['ros']?.[year];
    const roe = annualData.value['roe']?.[year];
    const roa = annualData.value['roa']?.[year];

    // Revenue: Use formula for forecast years
    if (isForecast && annualColMap[(yearInt - 1).toString()]) {
      // Formula: Previous Year Revenue * (1 + Growth Rate)
      const prevYearCol = annualColMap[(yearInt - 1).toString()];
      const prevRevAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(ROW_NET_REVENUE, prevYearCol, 1, 1),
      );
      sheet.setFormula(
        ROW_NET_REVENUE,
        col,
        `${prevRevAddr} * (1 + ${REVENUE_GROWTH_CELL})`,
      );
      sheet.setFormatter(ROW_NET_REVENUE, col, '#,##0');
    } else {
      setCell(ROW_NET_REVENUE, col, rev, { format: '#,##0', border: true });
    }

    // Apply border to revenue cell\n    applyBorder(GC, sheet, ROW_NET_REVENUE, col);

    setCell(ROW_GROSS_PROFIT, col, gross, { format: '#,##0', border: true });
    setCell(ROW_OPERATING_PROFIT, col, operating, {
      format: '#,##0',
      border: true,
    });
    setCell(ROW_NET_PROFIT, col, profit, { format: '#,##0', border: true });
    setCell(ROW_EPS, col, eps, { format: '#,##0', border: true });
    setCell(ROW_PE, col, pe, { format: '0.00', border: true });
    setCell(ROW_ROS, col, ros, { format: '0.00', border: true }); // Assume data is number
    setCell(ROW_ROE, col, roe, { format: '0.00', border: true });
    setCell(ROW_ROA, col, roa, { format: '0.00', border: true });

    // NOTE: Forecast year formulas will be added after Quarterly section is created

    // Formulas
    // Gross Margin = GrossProfit / Revenue
    if (rev && gross) {
      setDivisionFormula(
        GC,
        sheet,
        ROW_GROSS_MARGIN,
        col,
        ROW_GROSS_PROFIT,
        col,
        ROW_NET_REVENUE,
        col,
        '0.00%',
      );
    }
    // Net Margin = Profit / Revenue
    if (rev && profit) {
      setDivisionFormula(
        GC,
        sheet,
        ROW_NET_MARGIN,
        col,
        ROW_NET_PROFIT,
        col,
        ROW_NET_REVENUE,
        col,
        '0.00%',
      );
    }

    // Borders for margin rows
    [ROW_GROSS_MARGIN, ROW_NET_MARGIN].forEach((r) => {
      applyBorder(GC, sheet, r, col);
    });

    // Growth formulas (need previous column)
    const prevYear = (parseInt(year) - 1).toString();
    if (annualColMap[prevYear]) {
      const prevCol = annualColMap[prevYear];
      const currRevAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(ROW_NET_REVENUE, col, 1, 1),
      );
      const prevRevAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(ROW_NET_REVENUE, prevCol, 1, 1),
      );

      sheet.setFormula(
        ROW_REV_GROWTH,
        col,
        `IF(${prevRevAddr}<>0, (${currRevAddr}-${prevRevAddr})/${prevRevAddr}, 0)`,
      );
      sheet.setFormatter(ROW_REV_GROWTH, col, '0.00%');

      const currProfitAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(ROW_NET_PROFIT, col, 1, 1),
      );
      const prevProfitAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(ROW_NET_PROFIT, prevCol, 1, 1),
      );
      sheet.setFormula(
        ROW_PROFIT_GROWTH,
        col,
        `IF(${prevProfitAddr}<>0, (${currProfitAddr}-${prevProfitAddr})/${prevProfitAddr}, 0)`,
      );
      sheet.setFormatter(ROW_PROFIT_GROWTH, col, '0.00%');
    }
    // Borders for growth cells
    sheet
      .getRange(ROW_REV_GROWTH, col, 1, 1)
      .setBorder(
        new GC.Spread.Sheets.LineBorder(
          'black',
          GC.Spread.Sheets.LineStyle.thin,
        ),
        { all: true },
      );
    sheet
      .getRange(ROW_PROFIT_GROWTH, col, 1, 1)
      .setBorder(
        new GC.Spread.Sheets.LineBorder(
          'black',
          GC.Spread.Sheets.LineStyle.thin,
        ),
        { all: true },
      );
  });

  // --- SECTION 2: QUARTERLY DATA ---
  // Ensure enough gap after Annual table (which ends at ROW_PROFIT_GROWTH)
  const startRowQuarter = ROW_PROFIT_GROWTH + 4;

  // Headers
  sheet.setRowHeight(startRowQuarter, 0); // Year header height (reduced slightly as it is merged vertically? No, it's 1 row).
  sheet.setRowHeight(startRowQuarter + 1, 50); // Sub-header (Q1... date...) height

  setCell(startRowQuarter, 0, 'Niên độ\nThông tin + chỉ số', {
    bold: true,
    align: 'center',
    border: true,
  });
  sheet.addSpan(startRowQuarter, 0, 2, 1); // Merge row 17-18 for this cell (Col 0)
  sheet.getCell(startRowQuarter, 0).wordWrap(true);

  // Prepare columns
  // We need to group by Year then Q1-Q4
  let quarterlyCols: {
    year: string;
    quarter: string;
    col: number;
    isForecast: boolean;
  }[] = [];
  let currentQCol = 1; // Start from col 1 (was 2)

  // Get all years from all sources to ensure continuity and sync with annual table
  const annualYearsKeys = Object.keys(annualData.value['netRevenue'] || {});
  const qYears = Object.keys(quarterlyData.value['netRevenue'] || {});

  // Include annual, quarterly and forecast years
  const initialQYears = Array.from(
    new Set([...annualYearsKeys, ...qYears, ...forecastYears.value]),
  ).sort();

  // Filter incomplete years BEFORE filling gaps
  let allQYears = filterIncompleteYears(initialQYears);

  // Fill gaps to ensure continuity (matching Annual table logic)
  if (allQYears.length > 0) {
    const minYear = parseInt(allQYears[0]!);
    const maxYear = parseInt(allQYears[allQYears.length - 1]!);
    const continuousYears: string[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      continuousYears.push(y.toString());
    }
    // Filter again after filling gaps to remove any incomplete years that were added
    allQYears = filterIncompleteYears(continuousYears);
  }

  const currentYear = new Date().getFullYear();

  allQYears.forEach((year) => {
    const yearInt = parseInt(year);

    // Determine Forecast Status for the Year (Same logic as Annual)
    // Rule:
    // Future (>= Current Year): Always Forecast
    // Past (<= Current Year - 2): Always Historical
    // Previous Year (Current Year - 1): Forecast IF incomplete (missing Q4), otherwise Historical

    let isYearForecast =
      forecastYears.value.includes(year) || yearInt >= currentYear;

    if (yearInt === currentYear - 1) {
      const hasQ4 = quarterlyData.value['netRevenue']?.[year]?.['Q4'];
      if (hasQ4 === undefined || hasQ4 === null) {
        isYearForecast = true;
      } else {
        isYearForecast = false;
      }
    }

    if (yearInt < currentYear - 1) {
      isYearForecast = false;
    }

    // Styles
    const headerStyle = {
      bold: true,
      align: 'center',
      border: true, // applied to range
      bg: isYearForecast ? '#FF1493' : '#70AD47', // Pink for Forecast, Green for History
    };

    // Create 4 columns for this year
    setCell(startRowQuarter, currentQCol, year, headerStyle);
    sheet.addSpan(startRowQuarter, currentQCol, 1, 4); // Merge 4 cells for Year Header

    // Apply border to the merged range
    sheet
      .getRange(startRowQuarter, currentQCol, 1, 4)
      .setBorder(
        new GC.Spread.Sheets.LineBorder(
          'black',
          GC.Spread.Sheets.LineStyle.thin,
        ),
        { all: true },
      );

    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, i) => {
      const actualQ = `${year}_${q}`;

      // Check if we have actual data for this quarter
      const hasActualData =
        quarterlyData.value['netRevenue']?.[year]?.[q] !== undefined &&
        quarterlyData.value['netRevenue']?.[year]?.[q] !== null;

      // Forecast IF it's in a forecast period AND we don't have actual data yet
      const isF =
        !hasActualData &&
        (forecastQuarters.value.includes(actualQ) ||
          forecastYears.value.includes(year) ||
          isYearForecast);

      sheet.setColumnWidth(currentQCol, 110); // Set width for quarterly columns

      // Update dates per quarter
      const dates = [
        '01/01-31/03',
        '01/04-30/06',
        '01/07-30/09',
        '01/10-31/12',
      ];

      setCell(
        startRowQuarter + 1,
        currentQCol,
        `${q}${isF ? ' (F)' : ''}\n${dates[i]}`,
        {
          bold: true,
          align: 'center',
          border: true,
          bg: isF ? '#FF1493' : '#70AD47', // Dynamic color based on individual quarter status
        },
      );

      sheet.getCell(startRowQuarter + 1, currentQCol).wordWrap(true);

      quarterlyCols.push({
        year,
        quarter: q,
        col: currentQCol,
        isForecast: isF,
      });
      currentQCol++;
    });
  });

  // Data Rows Constants
  const Q_ROW_REVENUE = startRowQuarter + 2;
  const Q_ROW_GROSS_PROFIT = startRowQuarter + 3;
  const Q_ROW_OPERATING_PROFIT = startRowQuarter + 4;
  const Q_ROW_GROSS_MARGIN = startRowQuarter + 5;
  const Q_ROW_NET_PROFIT = startRowQuarter + 6;
  const Q_ROW_SHARES = startRowQuarter + 7;
  const Q_ROW_NET_MARGIN = startRowQuarter + 8;
  const Q_ROW_EPS = startRowQuarter + 9;
  const Q_ROW_EPS_TTM = startRowQuarter + 10;
  const Q_ROW_PE = startRowQuarter + 11;
  const Q_ROW_REV_GROWTH = startRowQuarter + 12;
  const Q_ROW_PROFIT_GROWTH = startRowQuarter + 13;

  // Labels (Col 0)
  setCell(Q_ROW_REVENUE, 0, 'Doanh thu thuần', { border: true });
  setCell(Q_ROW_GROSS_PROFIT, 0, 'Lợi nhuận gộp', { border: true });
  setCell(Q_ROW_OPERATING_PROFIT, 0, 'LN từ HĐKD', { border: true });
  setCell(Q_ROW_GROSS_MARGIN, 0, 'Biên lợi nhuận gộp', { border: true });
  setCell(Q_ROW_NET_PROFIT, 0, 'LNST công ty mẹ', {
    border: true,
  });
  setCell(Q_ROW_SHARES, 0, 'KL CP lưu hành', { border: true });
  setCell(Q_ROW_NET_MARGIN, 0, 'Biên lợi nhuận ròng', { border: true });
  setCell(Q_ROW_EPS, 0, 'EPS quý', { border: true });
  setCell(Q_ROW_EPS_TTM, 0, 'EPS lũy kế', { border: true });
  setCell(Q_ROW_PE, 0, 'P/E', { border: true });
  setCell(Q_ROW_REV_GROWTH, 0, 'TT DT (%)', {
    border: true,
  });
  setCell(Q_ROW_PROFIT_GROWTH, 0, 'TT LNST (%)', { border: true });

  // Fill Data
  quarterlyCols.forEach(({ year, quarter, col, isForecast }) => {
    const rev = quarterlyData.value['netRevenue']?.[year]?.[quarter];
    const gross = quarterlyData.value['grossProfit']?.[year]?.[quarter];
    const operating = quarterlyData.value['operatingProfit']?.[year]?.[quarter];
    const profit = quarterlyData.value['netProfit']?.[year]?.[quarter];

    // Use logic to get shares or default
    const shares = outstandingShares.value; // Simplification, ideally per quarter

    // Revenue: Use formula for forecast quarters (YoY growth)
    if (isForecast) {
      // Find same quarter last year (col - 4, since 4 quarters per year)
      const prevYearCol = col - 4;
      if (prevYearCol >= 1) {
        // Formula: Same Quarter Last Year * (1 + Growth Rate)
        const prevRevAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
          sheet.getRange(Q_ROW_REVENUE, prevYearCol, 1, 1),
        );
        sheet.setFormula(
          Q_ROW_REVENUE,
          col,
          `${prevRevAddr} * (1 + ${REVENUE_GROWTH_CELL})`,
        );
        sheet.setFormatter(Q_ROW_REVENUE, col, '#,##0');
      } else {
        // No previous year data, use static value
        setCell(Q_ROW_REVENUE, col, rev, { format: '#,##0', border: true });
      }
    } else {
      setCell(Q_ROW_REVENUE, col, rev, { format: '#,##0', border: true });
    }

    // Apply border to revenue cell
    applyBorder(GC, sheet, Q_ROW_REVENUE, col);

    // Gross Profit: Use formula for forecast quarters (Revenue × Gross Margin %)
    if (isForecast) {
      // Formula: Revenue * Gross Margin %
      const revAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(Q_ROW_REVENUE, col, 1, 1),
      );
      sheet.setFormula(
        Q_ROW_GROSS_PROFIT,
        col,
        `${revAddr} * ${GROSS_MARGIN_CELL}`,
      );
      sheet.setFormatter(Q_ROW_GROSS_PROFIT, col, '#,##0');
    } else {
      setCell(Q_ROW_GROSS_PROFIT, col, gross, {
        format: '#,##0',
        border: true,
      });
    }

    // Apply border to gross profit cell
    applyBorder(GC, sheet, Q_ROW_GROSS_PROFIT, col);

    setCell(Q_ROW_OPERATING_PROFIT, col, operating, {
      format: '#,##0',
      border: true,
    });

    // Net Profit: Use formula for forecast quarters (YoY growth)
    if (isForecast) {
      const prevYearCol = col - 4;
      if (prevYearCol >= 1) {
        // Formula: Same Quarter Last Year * (1 + Growth Rate)
        const prevProfitAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
          sheet.getRange(Q_ROW_NET_PROFIT, prevYearCol, 1, 1),
        );
        sheet.setFormula(
          Q_ROW_NET_PROFIT,
          col,
          `${prevProfitAddr} * (1 + ${NET_PROFIT_GROWTH_CELL})`,
        );
        sheet.setFormatter(Q_ROW_NET_PROFIT, col, '#,##0');
      } else {
        setCell(Q_ROW_NET_PROFIT, col, profit, {
          format: '#,##0',
          border: true,
        });
      }
    } else {
      setCell(Q_ROW_NET_PROFIT, col, profit, { format: '#,##0', border: true });
    }

    // Apply border to net profit cell
    applyBorder(GC, sheet, Q_ROW_NET_PROFIT, col);

    setCell(Q_ROW_SHARES, col, shares, { format: '#,##0', border: true });

    // Formulas - Always create formulas for calculated fields
    // Gross Margin = Gross Profit / Revenue
    setDivisionFormula(
      GC,
      sheet,
      Q_ROW_GROSS_MARGIN,
      col,
      Q_ROW_GROSS_PROFIT,
      col,
      Q_ROW_REVENUE,
      col,
      '0.00%',
    );

    // Net Margin = Net Profit / Revenue
    setDivisionFormula(
      GC,
      sheet,
      Q_ROW_NET_MARGIN,
      col,
      Q_ROW_NET_PROFIT,
      col,
      Q_ROW_REVENUE,
      col,
      '0.00%',
    );

    // EPS Formula: NetProfit / Shares (* 1000 if unit is million)
    // Always create formula for auto-calculation
    const profitAddr = getCellAddr(GC, sheet, Q_ROW_NET_PROFIT, col);
    const sharesAddr = getCellAddr(GC, sheet, Q_ROW_SHARES, col);
    sheet.setFormula(
      Q_ROW_EPS,
      col,
      `IF(${sharesAddr}<>0, (${profitAddr} * 1000000) / ${sharesAddr}, 0)`,
    );
    sheet.setFormatter(Q_ROW_EPS, col, '#,##0');

    // EPS TTM (Trailing 4 Quarters)
    // We need current quarter + 3 previous quarters.
    // Columns are chronological starting from 1.
    // So we need col >= 4.
    // Note: This assumes columns are contiguous and contain sequential quarters.
    if (col >= 4) {
      const epsRange = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(Q_ROW_EPS, col - 3, 1, 4), // row, col, rowCount, colCount
      );
      sheet.setFormula(Q_ROW_EPS_TTM, col, `SUM(${epsRange})`);
      sheet.setFormatter(Q_ROW_EPS_TTM, col, '#,##0');
    }

    // P/E: Use API data for historical quarters, calculate for forecast quarters
    const peFromApi = quarterlyData.value['pe']?.[year]?.[quarter];

    if (!isForecast && peFromApi !== undefined && peFromApi !== null) {
      // Historical quarter with API data - use it directly
      setCell(Q_ROW_PE, col, peFromApi, { format: '0.00', border: true });
    } else if (isForecast && currentPrice.value && col >= 4) {
      // Forecast quarter: use Price / SUM(current EPS + previous 3 quarters EPS)
      // This calculates P/E based on trailing 4 quarters of EPS from row 33 (Q_ROW_EPS)
      const epsRange = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(Q_ROW_EPS, col - 3, 1, 4), // row 33, 4 quarters
      );
      sheet.setFormula(
        Q_ROW_PE,
        col,
        `IF(SUM(${epsRange}) <> 0, ${CURRENT_PRICE_CELL} / SUM(${epsRange}), 0)`,
      );
      sheet.setFormatter(Q_ROW_PE, col, '0.00');
    }

    // Growth Cells
    // Find column for same quarter last year (col - 4)
    const prevYearCol = col - 4;
    // Check if prevYearCol is valid (>= 1) and represents the same quarter (since we start at 1 now)
    // Start col is 1. Q1=1, Q2=2, Q3=3, Q4=4. Next year Q1=5. 5-4=1. Matches.
    if (prevYearCol >= 1) {
      const currRevAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(Q_ROW_REVENUE, col, 1, 1),
      );
      const prevRevAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(Q_ROW_REVENUE, prevYearCol, 1, 1),
      );
      sheet.setFormula(
        Q_ROW_REV_GROWTH,
        col,
        `IF(${prevRevAddr}<>0, (${currRevAddr}-${prevRevAddr})/${prevRevAddr}, 0)`,
      );
      sheet.setFormatter(Q_ROW_REV_GROWTH, col, '0.00%');

      const currProfitAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(Q_ROW_NET_PROFIT, col, 1, 1),
      );
      const prevProfitAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
        sheet.getRange(Q_ROW_NET_PROFIT, prevYearCol, 1, 1),
      );
      sheet.setFormula(
        Q_ROW_PROFIT_GROWTH,
        col,
        `IF(${prevProfitAddr}<>0, (${currProfitAddr}-${prevProfitAddr})/${prevProfitAddr}, 0)`,
      );
      sheet.setFormatter(Q_ROW_PROFIT_GROWTH, col, '0.00%');
    }

    // Borders
    for (let r = Q_ROW_GROSS_MARGIN; r <= Q_ROW_PROFIT_GROWTH; r++) {
      sheet
        .getRange(r, col, 1, 1)
        .setBorder(
          new GC.Spread.Sheets.LineBorder(
            'black',
            GC.Spread.Sheets.LineStyle.thin,
          ),
          { all: true },
        );
    }

    // Separate years by double border at Q4
    if (quarter === 'Q4') {
      sheet
        .getRange(
          startRowQuarter,
          col,
          Q_ROW_PROFIT_GROWTH - startRowQuarter + 1,
          1,
        )
        .setBorder(
          new GC.Spread.Sheets.LineBorder(
            'black',
            GC.Spread.Sheets.LineStyle.double,
          ),
          { right: true },
        );
    }
  });

  // --- UPDATE ANNUAL YEARS WITH QUARTERLY SUMS ---
  // For years that have quarterly data, add formulas to Annual table
  // Get unique years from quarterlyCols that have 4 quarters
  const uniqueQuarterlyYears = [...new Set(quarterlyCols.map((q) => q.year))];

  uniqueQuarterlyYears.forEach((year) => {
    const annualCol = annualColMap[year];
    if (!annualCol) return;

    // Find quarterly columns for this year
    const yearQuarters = quarterlyCols.filter((q) => q.year === year);

    if (yearQuarters.length === 4) {
      const q1Col = yearQuarters.find((q) => q.quarter === 'Q1')?.col;
      const q2Col = yearQuarters.find((q) => q.quarter === 'Q2')?.col;
      const q3Col = yearQuarters.find((q) => q.quarter === 'Q3')?.col;
      const q4Col = yearQuarters.find((q) => q.quarter === 'Q4')?.col;

      if (q1Col && q2Col && q3Col && q4Col) {
        const quarterCols = [q1Col, q2Col, q3Col, q4Col];

        // Sum formulas: Quarterly → Annual
        setQuarterlySumFormula(
          GC,
          sheet,
          Q_ROW_GROSS_PROFIT,
          ROW_GROSS_PROFIT,
          annualCol,
          quarterCols,
        );
        setQuarterlySumFormula(
          GC,
          sheet,
          Q_ROW_NET_PROFIT,
          ROW_NET_PROFIT,
          annualCol,
          quarterCols,
        );
        setQuarterlySumFormula(
          GC,
          sheet,
          Q_ROW_EPS,
          ROW_EPS,
          annualCol,
          quarterCols,
        );

        // P/E = Price / EPS
        const epsAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
          sheet.getRange(ROW_EPS, annualCol, 1, 1),
        );
        sheet.setFormula(
          ROW_PE,
          annualCol,
          `IF(${epsAddr}<>0, ${CURRENT_PRICE_CELL} / ${epsAddr}, 0)`,
        );
        sheet.setFormatter(ROW_PE, annualCol, '0.00');

        // ROS = Net Profit / Revenue
        const profitAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
          sheet.getRange(ROW_NET_PROFIT, annualCol, 1, 1),
        );
        const revAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
          sheet.getRange(ROW_NET_REVENUE, annualCol, 1, 1),
        );
        sheet.setFormula(
          ROW_ROS,
          annualCol,
          `IF(${revAddr}<>0, ${profitAddr} / ${revAddr}, 0)`,
        );
        sheet.setFormatter(ROW_ROS, annualCol, '0.00');
      }
    }
  });

  // --- SECTION 3: VALUATION TABLE ---
  const ROW_VALUATION_START = startRowQuarter + 20; // Ensure enough gap

  // 1. Get Previous Year P/E (as Default)
  // Usually Last Full Year. Current is 2026, so 2025 (Forecast).
  // Maybe user means "Last Historical Year"?
  // "giá trị default p/e của năm trước". Year - 1.
  // If Year - 1 is incomplete (Forecast), do we use it?
  // User said "default p/e của năm trước".
  // Let's use Data's P/E for (CurrentYear - 1) if available, or (CurrentYear - 2).
  // annualData keys are years.
  const prevYearStr = (currentYear - 1).toString();
  const prevYear2Str = (currentYear - 2).toString();
  let defaultPE =
    annualData.value['pe']?.[prevYearStr] ||
    annualData.value['pe']?.[prevYear2Str] ||
    10;

  // Format defaultPE to 2 decimals if needed? Input usually just number.
  // If it comes from DB strings, parse it.
  defaultPE = parseFloat(String(defaultPE));
  if (isNaN(defaultPE)) defaultPE = 10;

  // Scenarios
  const peScenarios = [9, defaultPE, 8, 7, 6, 5, 4];
  const totalValuationRows = 10;

  // Headers: Years (Replacing "Định giá VND (dong)")
  sheet.setRowHeight(ROW_VALUATION_START, 30);

  const valuationYears = [...new Set(quarterlyCols.map((q) => q.year))];
  valuationYears.forEach((year) => {
    const yearCols = quarterlyCols.filter((q) => q.year === year);
    if (yearCols.length === 0) return;

    const startCol = yearCols[0]!.col;
    const spanCount = yearCols.length;

    const yearInt = parseInt(year);
    const currentYear = new Date().getFullYear();
    let isYearForecast =
      forecastYears.value.includes(year) || yearInt >= currentYear;
    if (yearInt === currentYear - 1) {
      const hasQ4 = quarterlyData.value['netRevenue']?.[year]?.['Q4'];
      if (hasQ4 === undefined || hasQ4 === null) isYearForecast = true;
      else isYearForecast = false;
    }
    if (yearInt < currentYear - 1) isYearForecast = false;

    setCell(ROW_VALUATION_START, startCol, year, {
      bold: true,
      align: 'center',
      border: true,
      bg: isYearForecast ? '#FF1493' : '#70AD47',
    });

    if (spanCount > 1) {
      sheet.addSpan(ROW_VALUATION_START, startCol, 1, spanCount);
    }

    sheet
      .getRange(ROW_VALUATION_START, startCol, 1, spanCount)
      .setBorder(
        new GC.Spread.Sheets.LineBorder(
          'black',
          GC.Spread.Sheets.LineStyle.thin,
        ),
        { all: true },
      );
  });

  // Sub-headers (Quarter labels + Forecast colors)
  // Reuse `quarterlyCols` metadata to render headers
  quarterlyCols.forEach(({ year, quarter, col, isForecast }) => {
    const dates = ['01/01-31/03', '01/04-30/06', '01/07-30/09', '01/10-31/12'];
    // Quarter index for dates. Q1->0.
    const qIdx = parseInt(quarter.replace('Q', '')) - 1;

    // Determine correct color logic again or reuse `isForecast` from object?
    // `isForecast` in `quarterlyCols` was calculated based on year/quarter logic.
    // So detailed (Q1 vs Q2).
    // User said "Match style color".

    const yearInt = parseInt(year);
    // For coloring, use the same logic as before (Green vs Pink)
    // `quarterlyCols` has `isForecast` property.
    // Wait, `isForecast` in `quarterlyCols` maps to granular forecast.
    // But for color, we used `isYearForecast` logic in the loop above.
    // Let's re-evaluate `isYearForecast` for the color or just assume `isForecast` implies Pink?
    // "Previous Year (Current - 1): Forecast IF incomplete".
    // Let's assume `isForecast` on the QuarterCol reflects the status we want.
    // Or just check if `row` header above was Pink?
    // Simplest: Re-calculate or trust `isForecast`.
    // The `quarterlyCols` definition used `isF` which included `isYearForecast`.
    // So `isForecast` should be correct for Pink.

    const style = {
      bold: true,
      align: 'center',
      border: true,
      bg: isForecast ? '#FF1493' : '#70AD47',
    };

    setCell(
      ROW_VALUATION_START + 1,
      col,
      `${quarter}${isForecast ? ' (F)' : ''}\n${dates[qIdx]}`,
      style,
    );
    sheet.getCell(ROW_VALUATION_START + 1, col).wordWrap(true);
    sheet.setRowHeight(ROW_VALUATION_START + 1, 50);
  });

  // Row Headers (Giả sử P/E)
  setCell(ROW_VALUATION_START + 1, 0, 'Giả sử P/E:', {
    bold: true,
    border: true,
  });

  // Data Rows
  for (let r = 0; r < totalValuationRows; r++) {
    const currentRow = ROW_VALUATION_START + 2 + r;
    const peValue = peScenarios[r]; // Can be undefined if r >= 7

    // Input Cell (Col 0)
    setCell(currentRow, 0, peValue, {
      border: true, // Input box style
      align: 'center',
      format: '0.00', // Show 2 decimals for P/E
    });
    // Unlock for input?
    sheet.getCell(currentRow, 0).locked(false);

    // Styling for Default Row
    // Only highlight if it matches defaultPE AND is valid
    let isDefaultRow = false;
    if (peValue !== undefined && Math.abs(peValue - defaultPE) < 0.01) {
      isDefaultRow = true;
    }

    const rowStyle = isDefaultRow ? '#FFE4E1' : undefined; // Light pink/peach for highlight

    if (isDefaultRow) {
      sheet.getRange(currentRow, 0, 1, currentQCol).backColor('#FFE4E1');
    }

    // Fill Formulas across columns
    quarterlyCols.forEach(({ col }) => {
      // Price = P/E (Col 0) * EPS TTM (Col)
      // EPS TTM is at `Q_ROW_EPS_TTM`.
      // Formula: `A{currentRow} * {EPS_TTM_Cell}`
      // Use absolute reference for Col 0 ($A...)

      const peAddr = `$A${currentRow + 1}`; // A34... (1-based for Formula?)
      // Wait, rangeToFormula returns A1 notation.
      // Getting A column address for this row.
      const inputCell = sheet.getRange(currentRow, 0, 1, 1);
      // Abs col, Rel row? No, Rel row is fine if dragging, but here we set explicitly.
      // $A{row} is fine.

      const epsCell = sheet.getRange(Q_ROW_EPS_TTM, col, 1, 1);
      const epsAddr = GC.Spread.Sheets.CalcEngine.rangeToFormula(epsCell);

      // Formula
      sheet.setFormula(
        currentRow,
        col,
        `IF(ISNUMBER(${peAddr}), ${peAddr} * ${epsAddr}, "")`,
      );
      sheet.setFormatter(currentRow, col, '#,##0');

      // Apply border
      sheet
        .getCell(currentRow, col)
        .setBorder(
          new GC.Spread.Sheets.LineBorder(
            'black',
            GC.Spread.Sheets.LineStyle.thin,
          ),
          { all: true },
        );
    });

    // Also apply border to Input cell
    sheet
      .getCell(currentRow, 0)
      .setBorder(
        new GC.Spread.Sheets.LineBorder(
          'black',
          GC.Spread.Sheets.LineStyle.thin,
        ),
        { all: true },
      );
  }

  // Apply vertical double borders to separate years in Valuation Table
  quarterlyCols.forEach(({ quarter, col }) => {
    if (quarter === 'Q4') {
      sheet
        .getRange(ROW_VALUATION_START, col, totalValuationRows + 2, 1)
        .setBorder(
          new GC.Spread.Sheets.LineBorder(
            'black',
            GC.Spread.Sheets.LineStyle.double,
          ),
          { right: true },
        );
    }
  });

  sheet.autoFitColumn(0); // Fit Col 0 (restore this too if needed, or just keep layout logic)
  sheet.setColumnWidth(0, 340);

  // Set column count based on maximum usage
  const maxCol = Math.max(
    INPUT_COL + 3,
    currentQCol + 1,
    Object.values(annualColMap).reduce((a, b) => Math.max(a, b), 0) + 1,
    30, // Minimum 30 columns
  );
  sheet.setColumnCount(maxCol);

  // Sync forecastQuarters if they were somehow missed
  forecastYears.value.forEach((y) => {
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q) => {
      const qKey = `${y}_${q}`;
      if (!forecastQuarters.value.includes(qKey)) {
        forecastQuarters.value.push(qKey);
      }
    });
  });

  sheet.setRowCount(ROW_VALUATION_START + 2 + totalValuationRows + 2); // Header(1) + SubHeader(1) + Rows + Buffer
  sheet.frozenColumnCount(1);

  spread.options.scrollbarMaxAlign = true;
  spread.options.scrollbarShowMax = true;

  // Apply row highlight on selection
  applyRowHighlightOnSelect(GC, sheet);

  spread.resumePaint();
};

const addYear = () => {
  const years = Object.keys(annualData.value['netRevenue'] || {}).sort();
  const allYears = [...years, ...forecastYears.value].sort();
  const lastYear = allYears[allYears.length - 1];

  const nextYear = lastYear
    ? String(parseInt(lastYear) + 1)
    : String(new Date().getFullYear());

  forecastYears.value.push(nextYear);

  // Also add 4 quarters for this new year to forecastQuarters
  ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q) => {
    forecastQuarters.value.push(`${nextYear}_${q}`);
  });

  updateSpreadSheet();

  toast.add({
    title: 'Đã thêm năm',
    description: `Đã thêm năm ${nextYear} vào bảng phân tích`,
    color: 'success',
  });
};

// Data Watchers
watch(
  [annualData, quarterlyData, currentPrice, tradingDate],
  () => {
    updateSpreadSheet();
  },
  { deep: true },
);

// --- COPY LOGIC FROM ORIGINAL FILE ---

// Smart update
const smartUpdate = async () => {
  if (!stockSymbol.value) {
    toast.add({
      title: 'Lỗi',
      description: 'Không có mã cổ phiếu',
      color: 'error',
    });
    return;
  }
  isCloning.value = true;
  try {
    const response = await $fetch<any>('/api/stock/smart-update', {
      method: 'POST',
      body: { symbol: stockSymbol.value },
    });
    if (response.success && response.data) {
      quarterlyData.value = response.data.quarters;
      if (response.data.annual) annualData.value = response.data.annual;
      toast.add({
        title: response.data.newDataFetched
          ? 'Đã cập nhật'
          : 'Dữ liệu mới nhất',
        description: response.data.message,
        color: response.data.newDataFetched ? 'success' : 'info',
      });
    } else {
      toast.add({
        title: 'Lỗi',
        description: response.error || 'Không thể cập nhật dữ liệu',
        color: 'error',
      });
    }
  } catch (error: any) {
    toast.add({
      title: 'Lỗi cập nhật',
      description: error.message || 'Lỗi không xác định',
      color: 'error',
    });
  } finally {
    isCloning.value = false;
  }
};

// Refresh Data
const refreshData = async () => {
  if (!stockSymbol.value) {
    toast.add({
      title: 'Lỗi',
      description: 'Không có mã cổ phiếu',
      color: 'error',
    });
    return;
  }
  loadingStore.show('Đang cập nhật dữ liệu từ Vietstock...');
  try {
    const quarterlyResponse = await $fetch<any>('/api/stock/crawl', {
      method: 'POST',
      body: { symbol: stockSymbol.value, pages: 4 },
    });
    const yearlyResponse = await $fetch<any>('/api/stock/crawl-yearly', {
      method: 'POST',
      body: { symbol: stockSymbol.value, pages: 2 },
    });

    if (quarterlyResponse.success && yearlyResponse.success) {
      toast.add({
        title: 'Đã cập nhật',
        description: 'Crawled data successfully',
        color: 'success',
      });
      await loadAnalysis();
    } else {
      toast.add({
        title: 'Lỗi',
        description: 'Không thể crawl dữ liệu',
        color: 'error',
      });
    }
  } catch (error: any) {
    toast.add({
      title: 'Lỗi crawl',
      description: error.message,
      color: 'error',
    });
  } finally {
    loadingStore.hide();
  }
};

// Load Analysis
const loadAnalysis = async () => {
  if (!stockSymbol.value) return;
  loadingStore.show('Đang tải dữ liệu...');
  try {
    const response = await $fetch<any>('/api/stock/get', {
      query: { symbol: stockSymbol.value },
    });
    if (response.success && response.data) {
      const data = response.data;

      // Process Forecasts
      if (data.periods) {
        const fYears = new Set<string>();
        const fQuarters = new Set<string>();
        data.periods.forEach((p: any) => {
          if (p.is_forecast) {
            if (p.source === 'year' || p.quarter === 0)
              fYears.add(p.year.toString());
            else fQuarters.add(`${p.year}_Q${p.quarter}`);
          }
        });
        forecastYears.value = Array.from(fYears);
        forecastQuarters.value = Array.from(fQuarters);
      }

      if (data.tradingSnapshot) {
        if (data.tradingSnapshot.outstandingShares) {
          outstandingShares.value = data.tradingSnapshot.outstandingShares;
        }
        if (data.tradingSnapshot.lastPrice) {
          currentPrice.value = data.tradingSnapshot.lastPrice;
        }
        if (data.tradingSnapshot.tradingDate) {
          tradingDate.value = data.tradingSnapshot.tradingDate;
        }
      }

      // Fetch latest trading info from Vietstock
      try {
        const tradingInfoResponse = await $fetch<any>(
          '/api/stock/fetch-vietstock',
          {
            method: 'POST',
            body: { code: stockSymbol.value },
          },
        );

        if (
          tradingInfoResponse.success &&
          tradingInfoResponse.data?.tradingInfo
        ) {
          const tradingInfo = tradingInfoResponse.data.tradingInfo;
          if (tradingInfo.lastPrice) {
            currentPrice.value = tradingInfo.lastPrice;
            // Set trading date to today since this is live data from Vietstock
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            if (dateStr) {
              tradingDate.value = dateStr; // Format: YYYY-MM-DD
            }
          }
          if (tradingInfo.outstandingShares) {
            outstandingShares.value = tradingInfo.outstandingShares;
          }
          if (tradingInfo.min52W) {
            min52W.value = tradingInfo.min52W;
          }
          if (tradingInfo.max52W) {
            max52W.value = tradingInfo.max52W;
          }
          if (tradingInfo.listedShares) {
            // You can use listedShares if needed
          }
        }
      } catch (error) {
        console.error('Failed to fetch trading info:', error);
        // Continue with existing data
      }

      if (data.analysis && data.analysis.quarterlyData) {
        const savedData = data.analysis.quarterlyData;
        if (savedData.quarterlyData)
          quarterlyData.value = savedData.quarterlyData;
        if (savedData.annualData) annualData.value = savedData.annualData;
        if (savedData.peAssumptions)
          peAssumptions.value = savedData.peAssumptions;
        if (savedData.outstandingShares) {
          outstandingShares.value = savedData.outstandingShares;
        }
        if (savedData.currentPrice) {
          currentPrice.value = savedData.currentPrice;
        }
      }

      // 2. Overlay crawled quarterly data (metrics)
      // This ensures official data overrides manual input for overlapping periods
      if (data.metrics && Object.keys(data.metrics).length > 0) {
        const metricToIndicator: Record<string, string> = {
          REVENUE_NET: 'netRevenue',
          GROSS_PROFIT: 'grossProfit',
          OPERATING_PROFIT: 'operatingProfit',
          NET_PROFIT: 'netProfit',
          PROFIT_AFTER_TAX: 'netProfit',
          EPS_TTM: 'eps',
          PE: 'pe',
          ROS: 'netMargin',
          ROE: 'roe',
          ROA: 'roa',
          TOTAL_ASSETS: 'totalAssets',
          CURRENT_ASSETS: 'currentAssets',
          TOTAL_LIABILITIES: 'totalLiabilities',
          SHORT_TERM_LIABILITIES: 'shortTermLiabilities',
          EQUITY: 'equity',
          BVPS: 'bvps',
        };

        for (const [metricCode, periodValues] of Object.entries(data.metrics)) {
          const indicatorKey = metricToIndicator[metricCode];
          if (!indicatorKey) continue;

          // Ensure indicator object exists
          if (!quarterlyData.value[indicatorKey]) {
            quarterlyData.value[indicatorKey] = {};
          }

          for (const [periodKey, value] of Object.entries(
            periodValues as Record<string, string>,
          )) {
            const parts = periodKey.split('_');
            if (parts.length < 2) continue;
            const year = parts[0]!;
            const quarter = parts[1]!;

            // Ensure year object exists
            if (!quarterlyData.value[indicatorKey][year]) {
              quarterlyData.value[indicatorKey][year] = {};
            }

            // OVERWRITE with crawled value
            quarterlyData.value[indicatorKey][year][quarter] = parseFloat(
              value as string,
            );
          }
        }
        // Trigger reactivity
        quarterlyData.value = { ...quarterlyData.value };
      }

      // 3. Overlay crawled annual data (yearlyMetrics)
      if (data.yearlyMetrics && Object.keys(data.yearlyMetrics).length > 0) {
        const metricToIndicator: Record<string, string> = {
          REVENUE_NET: 'netRevenue',
          GROSS_PROFIT: 'grossProfit',
          OPERATING_PROFIT: 'operatingProfit',
          NET_PROFIT: 'netProfit',
          PROFIT_AFTER_TAX: 'netProfit',
          EPS_TTM: 'eps',
          PE: 'pe',
          ROS: 'ros',
          ROE: 'roe',
          ROA: 'roa',
        };

        for (const [metricCode, yearValues] of Object.entries(
          data.yearlyMetrics,
        )) {
          const indicatorKey = metricToIndicator[metricCode];
          if (!indicatorKey) continue;

          // Ensure indicator object exists
          if (!annualData.value[indicatorKey]) {
            annualData.value[indicatorKey] = {};
          }

          for (const [year, value] of Object.entries(
            yearValues as Record<string, string>,
          )) {
            // OVERWRITE with crawled value
            annualData.value[indicatorKey][year] = parseFloat(value);
          }
        }
        // Trigger reactivity
        annualData.value = { ...annualData.value };
      }

      // Note Logic
      if (data.analysis) {
        if (data.analysis.noteHtml)
          currentNoteHtml.value = data.analysis.noteHtml;
        if (tradingNoteRef.value) {
          tradingNoteRef.value.setValues({
            entryPrice: data.analysis.entryPrice,
            targetPrice: data.analysis.targetPrice,
            stopLoss: data.analysis.stopLoss,
          });
        }
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    loadingStore.hide();
  }
};

const saveAnalysis = async (tradingData: {
  noteHtml: string;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
}) => {
  if (!stockSymbol.value) {
    toast.add({
      title: 'Lỗi',
      description: 'Vui lòng nhập mã cổ phiếu',
      color: 'error',
    });
    return;
  }

  loadingStore.show('Đang lưu dữ liệu...');

  try {
    await $fetch('/api/stock/save', {
      method: 'POST',
      body: {
        symbol: stockSymbol.value,
        quarterlyData: {
          annualData: annualData.value,
          quarterlyData: quarterlyData.value,
          peAssumptions: peAssumptions.value,
          outstandingShares: outstandingShares.value,
          currentPrice: currentPrice.value,
        },
        entryPrice: tradingData.entryPrice,
        targetPrice: tradingData.targetPrice,
        stopLoss: tradingData.stopLoss,
        noteHtml: tradingData.noteHtml,
      },
    });

    toast.add({
      title: 'Đã lưu',
      description: `Kịch bản cho ${stockSymbol.value.toUpperCase()} đã được lưu`,
      color: 'success',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Lỗi không xác định';
    toast.add({
      title: 'Lỗi lưu dữ liệu',
      description: message,
      color: 'error',
    });
  } finally {
    loadingStore.hide();
  }
};

// Watch annualData for year changes and sync to quarterlyData
watch(
  annualData,
  (newAnnualData) => {
    if (!newAnnualData || Object.keys(newAnnualData).length === 0) return;

    // Extract years from annualData
    const annualYears = new Set<string>();
    for (const indicatorData of Object.values(newAnnualData)) {
      if (indicatorData && typeof indicatorData === 'object') {
        Object.keys(indicatorData).forEach((year) => annualYears.add(year));
      }
    }

    // Extract years from quarterlyData
    const quarterlyYears = new Set<string>();
    for (const indicatorData of Object.values(quarterlyData.value)) {
      if (indicatorData && typeof indicatorData === 'object') {
        Object.keys(indicatorData).forEach((year) => quarterlyYears.add(year));
      }
    }

    // Find years in annual but not in quarterly
    const yearsToAdd = Array.from(annualYears).filter(
      (year) => !quarterlyYears.has(year),
    );

    if (yearsToAdd.length > 0) {
      console.log('Syncing years to quarterlyData:', yearsToAdd);

      // Add missing years to quarterlyData
      for (const year of yearsToAdd) {
        // For each indicator in quarterlyData, add the year with empty quarters
        for (const indicatorKey of Object.keys(quarterlyData.value)) {
          if (!quarterlyData.value[indicatorKey]) {
            quarterlyData.value[indicatorKey] = {};
          }
          if (!quarterlyData.value[indicatorKey][year]) {
            quarterlyData.value[indicatorKey][year] = {
              Q1: null,
              Q2: null,
              Q3: null,
              Q4: null,
            };
          }
        }
      }

      // Trigger reactivity
      quarterlyData.value = { ...quarterlyData.value };
    }
  },
  { deep: true },
);

// Lifecycle
onMounted(() => {
  if (stockSymbol.value) {
    loadAnalysis();
  }
});

watch(stockSymbol, (val) => {
  if (val) loadAnalysis();
});

useHead({
  title: computed(() => `${stockSymbol.value} (SpreadJS) | Stock Analysis`),
});
</script>

<template>
  <div class="analysis-page p-6">
    <header class="page-header mb-4">
      <div
        class="header-content flex flex-col md:flex-row justify-between items-start md:items-center"
      >
        <div class="header-left">
          <nav
            class="breadcrumb text-sm mb-2 flex items-center gap-2 text-gray-500"
          >
            <NuxtLink to="/analysis">Phân tích</NuxtLink>
            <span>/</span>
            <span class="font-bold text-gray-900 dark:text-gray-100">{{
              stockSymbol
            }}</span>
          </nav>
          <h1 class="text-3xl font-bold flex items-center gap-2">
            {{ stockSymbol }}
            <span
              class="text-sm font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
              >SpreadJS View</span
            >
          </h1>
        </div>
      </div>
    </header>

    <main class="page-content space-y-6">
      <!-- Action Buttons -->
      <UCard>
        <div class="flex gap-2">
          <UButton
            color="primary"
            variant="soft"
            size="sm"
            icon="i-lucide-plus"
            @click="addYear"
          >
            Add Year
          </UButton>
          <UButton
            @click="refreshData"
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
          />
        </div>
      </UCard>

      <!-- SpreadJS Area -->
      <UCard class="p-0 overflow-hidden">
        <ClientOnly>
          <div class="h-[600px] w-full">
            <GcSpreadSheets
              class="h-full w-full"
              @workbookInitialized="initWorkbook"
            >
            </GcSpreadSheets>
          </div>
        </ClientOnly>
      </UCard>

      <!-- Trading Note -->
      <UCard>
        <AnalysisTradingNote
          ref="tradingNoteRef"
          :note-html="currentNoteHtml"
          @save="saveAnalysis"
        />
      </UCard>
    </main>
  </div>
</template>

<style scoped>
/* Ensure SpreadJS container has explicit height */
.spread-host {
  width: 100%;
  height: 100%;
}
</style>
