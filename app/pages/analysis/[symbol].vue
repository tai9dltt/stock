<script setup lang="ts">
import { ref, watch, onMounted, computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import type { ComponentPublicInstance } from 'vue';
import type { QuarterlyColumnInfo } from '~/types/spreadJsTypes';
import {
  INPUT_AREA,
  VALUATION_TABLE,
  isBankStock,
} from '~/constants/spreadJsConstants';
import {
  buildTitleSection,
  buildInputSection,
  buildAnnualTable,
  buildQuarterlyTable,
  linkAnnualToQuarterly,
  buildValuationTable,
  applyFinalStyling,
} from '~/composables/useSpreadJSBuilder';
import {
  buildBankTitleSection,
  buildBankInputSection,
  buildBankAnnualTable,
  buildBankQuarterlyTable,
} from '~/composables/useBank';
import {
  processForecasts,
  overlayQuarterlyMetrics,
  overlayAnnualMetrics,
  extractSharesPerQuarter,
  extractPeValues,
  extractInputValues,
} from '~/composables/useStockDataTransform';
import {
  getStockData,
  fetchTradingInfo,
  crawlQuarterlyData,
  crawlYearlyData,
  saveStockAnalysis,
} from '~/services';

// Dynamically import SpreadJS components to avoid SSR issues
const GcSpreadSheets = defineAsyncComponent(() =>
  import('@mescius/spread-sheets-vue').then((m) => m.GcSpreadSheets),
);

// ============ ROUTE & SYMBOL ============
const route = useRoute();
const stockSymbol = computed(
  () => (route.params.symbol as string)?.toUpperCase() || '',
);

// ============ TYPES ============
interface TradingNoteInstance extends ComponentPublicInstance {
  setValues: (data: {
    entryPrice?: number | null;
    targetPrice?: number | null;
    stopLoss?: number | null;
  }) => void;
  getTradingData: () => {
    noteHtml: string;
    entryPrice: number | null;
    targetPrice: number | null;
    stopLoss: number | null;
  };
}

// ============ REACTIVE STATE ============
const outstandingShares = ref(0);
const currentPrice = ref(0);
const min52W = ref(0);
const max52W = ref(0);
const revenueGrowth = ref(0);
const grossMargin = ref(0);
const netProfitGrowth = ref(0);
const tradingDate = ref<string>('');
const peValuationStartRow = ref(0);
const sharesRowPosition = ref(0);
const quarterlyColsInfo = ref<QuarterlyColumnInfo[]>([]);

const peAssumptions = ref<Record<string, any>>({});
const annualData = ref<Record<string, any>>({});
const quarterlyData = ref<Record<string, any>>({});
const forecastYears = ref<string[]>([]);
const forecastQuarters = ref<string[]>([]);
const currentNoteHtml = ref('');
const isCloning = ref(false);
const loadingStore = useLoadingStore();

// Component refs
const tradingNoteRef = ref<TradingNoteInstance | null>(null);

// SpreadJS refs
const spreadInstance = ref<any>(null);
let GC: any = null;

// Toast
const toast = useToast();

// ============ SPREADSHEET ============

const initWorkbook = async (spread: any) => {
  spreadInstance.value = spread;
  console.log('SpreadJS Initialized', spread);

  if (!GC) {
    GC = await import('@mescius/spread-sheets');
    await import('@mescius/spread-sheets/styles/gc.spread.sheets.excel2013white.css');
  }

  updateSpreadSheet();
};

const updateSpreadSheet = () => {
  if (!spreadInstance.value || !GC) return;

  const spread = spreadInstance.value;
  spread.suspendPaint();

  // Get or create sheet
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
  sheet.setColumnCount(100);

  const ctx = { GC, spread, sheet };

  // Detect if this is a bank stock
  const isBank = isBankStock(annualData.value, quarterlyData.value);
  console.log(`Stock type: ${isBank ? 'Bank' : 'Industrial'}`);

  // Build sections - use bank or regular builder based on stock type
  if (isBank) {
    buildBankTitleSection(ctx, stockSymbol.value);
  } else {
    buildTitleSection(ctx, stockSymbol.value);
  }

  const inputRefs = isBank
    ? buildBankInputSection(ctx, {
        tradingDate: tradingDate.value,
        currentPrice: currentPrice.value,
        outstandingShares: outstandingShares.value,
        max52W: max52W.value,
        min52W: min52W.value,
        revenueGrowth: revenueGrowth.value,
        grossMargin: grossMargin.value,
        netProfitGrowth: netProfitGrowth.value,
      })
    : buildInputSection(ctx, {
        tradingDate: tradingDate.value,
        currentPrice: currentPrice.value,
        outstandingShares: outstandingShares.value,
        max52W: max52W.value,
        min52W: min52W.value,
        revenueGrowth: revenueGrowth.value,
        grossMargin: grossMargin.value,
        netProfitGrowth: netProfitGrowth.value,
      });

  const {
    colMap: annualColMap,
    rows: annualRows,
    sortedYears,
  } = isBank
    ? buildBankAnnualTable(
        ctx,
        {
          annualData: annualData.value,
          quarterlyData: quarterlyData.value,
          forecastYears: forecastYears.value,
        },
        inputRefs,
      )
    : buildAnnualTable(
        ctx,
        {
          annualData: annualData.value,
          quarterlyData: quarterlyData.value,
          forecastYears: forecastYears.value,
        },
        inputRefs,
      );

  const {
    cols: quarterlyCols,
    rows: quarterlyRows,
    currentCol,
  } = isBank
    ? buildBankQuarterlyTable(
        ctx,
        {
          annualData: annualData.value,
          quarterlyData: quarterlyData.value,
          forecastYears: forecastYears.value,
          forecastQuarters: forecastQuarters.value,
          outstandingShares: outstandingShares.value,
        },
        inputRefs,
        annualRows,
      )
    : buildQuarterlyTable(
        ctx,
        {
          annualData: annualData.value,
          quarterlyData: quarterlyData.value,
          forecastYears: forecastYears.value,
          forecastQuarters: forecastQuarters.value,
          outstandingShares: outstandingShares.value,
        },
        inputRefs,
        annualRows,
      );

  // Store positions for save
  sharesRowPosition.value = quarterlyRows.shares;
  quarterlyColsInfo.value = quarterlyCols.map((q) => ({
    year: q.year,
    quarter: q.quarter,
    col: q.col,
    isForecast: q.isForecast,
  }));

  linkAnnualToQuarterly(
    ctx,
    annualColMap,
    annualRows,
    quarterlyCols,
    quarterlyRows,
    inputRefs,
  );

  const valuationStartRow = buildValuationTable(
    ctx,
    quarterlyCols,
    quarterlyRows,
    {
      quarterlyData: quarterlyData.value,
      forecastYears: forecastYears.value,
      peAssumptions: peAssumptions.value,
      annualData: annualData.value,
    },
  );
  peValuationStartRow.value = valuationStartRow;

  // Sync forecast quarters
  forecastYears.value.forEach((y) => {
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q) => {
      const qKey = `${y}_${q}`;
      if (!forecastQuarters.value.includes(qKey)) {
        forecastQuarters.value.push(qKey);
      }
    });
  });

  const maxCol = Math.max(
    INPUT_AREA.COL + 3,
    currentCol + 1,
    (Object.values(annualColMap) as number[]).reduce(
      (a, b) => Math.max(a, b),
      0,
    ) + 1,
    30,
  );

  applyFinalStyling(ctx, maxCol, valuationStartRow);

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

// ============ DATA WATCHERS ============

watch(
  [annualData, quarterlyData, currentPrice, tradingDate],
  () => updateSpreadSheet(),
  { deep: true },
);

watch(
  annualData,
  (newAnnualData) => {
    if (!newAnnualData || Object.keys(newAnnualData).length === 0) return;

    const annualYears = new Set<string>();
    for (const indicatorData of Object.values(newAnnualData)) {
      if (indicatorData && typeof indicatorData === 'object') {
        Object.keys(indicatorData).forEach((year) => annualYears.add(year));
      }
    }

    const quarterlyYears = new Set<string>();
    for (const indicatorData of Object.values(quarterlyData.value)) {
      if (indicatorData && typeof indicatorData === 'object') {
        Object.keys(indicatorData).forEach((year) => quarterlyYears.add(year));
      }
    }

    const yearsToAdd = Array.from(annualYears).filter(
      (year) => !quarterlyYears.has(year),
    );

    if (yearsToAdd.length > 0) {
      for (const year of yearsToAdd) {
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
      quarterlyData.value = { ...quarterlyData.value };
    }
  },
  { deep: true },
);

// ============ API FUNCTIONS ============

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
    const quarterlyResponse = await crawlQuarterlyData(stockSymbol.value, 4);
    const yearlyResponse = await crawlYearlyData(stockSymbol.value, 2);

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

const loadAnalysis = async () => {
  if (!stockSymbol.value) return;

  loadingStore.show('Đang tải dữ liệu...');

  try {
    const response = await getStockData(stockSymbol.value);
    if (!response.success || !response.data) return;

    const data = response.data;

    // Process forecasts
    if (data.periods) {
      const forecasts = processForecasts(data.periods);
      forecastYears.value = forecasts.forecastYears;
      forecastQuarters.value = forecasts.forecastQuarters;
    }

    // Trading snapshot
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

    // Fetch latest trading info
    try {
      const tradingInfoResponse = await fetchTradingInfo(stockSymbol.value);
      if (
        tradingInfoResponse.success &&
        tradingInfoResponse.data?.tradingInfo
      ) {
        const tradingInfo = tradingInfoResponse.data.tradingInfo;
        if (tradingInfo.lastPrice) {
          currentPrice.value = tradingInfo.lastPrice;
          const today = new Date();
          const dateStr = today.toISOString().split('T')[0];
          if (dateStr) tradingDate.value = dateStr;
        }
        if (tradingInfo.outstandingShares)
          outstandingShares.value = tradingInfo.outstandingShares;
        if (tradingInfo.min52W) min52W.value = tradingInfo.min52W;
        if (tradingInfo.max52W) max52W.value = tradingInfo.max52W;
      }
    } catch (error) {
      console.error('Failed to fetch trading info:', error);
    }

    // Saved analysis data
    if (data.analysis?.quarterlyData) {
      const savedData = data.analysis.quarterlyData;
      if (savedData.quarterlyData)
        quarterlyData.value = savedData.quarterlyData;
      if (savedData.annualData) annualData.value = savedData.annualData;
      if (savedData.peAssumptions)
        peAssumptions.value = savedData.peAssumptions;
      if (savedData.outstandingShares && !outstandingShares.value) {
        outstandingShares.value = savedData.outstandingShares;
      }
      if (savedData.currentPrice && !currentPrice.value) {
        currentPrice.value = savedData.currentPrice;
      }
      if (savedData.max52W && !max52W.value) max52W.value = savedData.max52W;
      if (savedData.min52W && !min52W.value) min52W.value = savedData.min52W;
      if (savedData.revenueGrowth !== undefined)
        revenueGrowth.value = savedData.revenueGrowth;
      if (savedData.grossMargin !== undefined)
        grossMargin.value = savedData.grossMargin;
      if (savedData.netProfitGrowth !== undefined)
        netProfitGrowth.value = savedData.netProfitGrowth;
    }

    // Overlay crawled metrics
    if (data.metrics && Object.keys(data.metrics).length > 0) {
      quarterlyData.value = overlayQuarterlyMetrics(
        data.metrics,
        quarterlyData.value,
      );
      quarterlyData.value = { ...quarterlyData.value };
    }

    if (data.yearlyMetrics && Object.keys(data.yearlyMetrics).length > 0) {
      annualData.value = overlayAnnualMetrics(
        data.yearlyMetrics,
        annualData.value,
      );
      annualData.value = { ...annualData.value };
    }

    // Notes
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

  // Sync input values from spreadsheet
  if (spreadInstance.value) {
    const sheet = spreadInstance.value.getActiveSheet();
    const inputRowStart = INPUT_AREA.ROW_START;
    const valueCol = INPUT_AREA.COL + INPUT_AREA.VALUE_COL_OFFSET;

    const inputValues = extractInputValues(sheet, inputRowStart, valueCol);
    currentPrice.value = inputValues.currentPrice;
    outstandingShares.value = inputValues.outstandingShares;
    max52W.value = inputValues.max52W;
    min52W.value = inputValues.min52W;
    revenueGrowth.value = inputValues.revenueGrowth;
    grossMargin.value = inputValues.grossMargin;
    netProfitGrowth.value = inputValues.netProfitGrowth;

    // Read PE values
    if (peValuationStartRow.value > 0) {
      const peValues = extractPeValues(
        sheet,
        peValuationStartRow.value + 2,
        VALUATION_TABLE.TOTAL_ROWS,
      );
      peAssumptions.value = { values: peValues };
    }

    // Read shares per quarter
    if (sharesRowPosition.value > 0 && quarterlyColsInfo.value.length > 0) {
      const sharesPerQuarter = extractSharesPerQuarter(
        sheet,
        sharesRowPosition.value,
        quarterlyColsInfo.value,
      );
      quarterlyData.value['outstandingShares'] = sharesPerQuarter;
    }
  }

  loadingStore.show('Đang lưu dữ liệu...');

  try {
    await saveStockAnalysis({
      symbol: stockSymbol.value,
      quarterlyData: {
        annualData: annualData.value,
        quarterlyData: quarterlyData.value,
        peAssumptions: peAssumptions.value,
        outstandingShares: outstandingShares.value,
        currentPrice: currentPrice.value,
        max52W: max52W.value,
        min52W: min52W.value,
        revenueGrowth: revenueGrowth.value,
        grossMargin: grossMargin.value,
        netProfitGrowth: netProfitGrowth.value,
      },
      entryPrice: tradingData.entryPrice,
      targetPrice: tradingData.targetPrice,
      stopLoss: tradingData.stopLoss,
      noteHtml: tradingData.noteHtml,
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

const handleGlobalSave = () => {
  if (tradingNoteRef.value) {
    const tradingData = tradingNoteRef.value.getTradingData();
    saveAnalysis(tradingData);
  }
};

// ============ LIFECYCLE ============

onMounted(() => {
  if (stockSymbol.value) loadAnalysis();
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
            <span
              class="text-2xl font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
            >
              {{ stockSymbol }}
            </span>
          </nav>
        </div>
      </div>
    </header>

    <main class="page-content space-y-6">
      <!-- SpreadJS Area -->
      <UCard class="p-0 overflow-hidden">
        <ClientOnly>
          <div class="h-[600px] w-full">
            <GcSpreadSheets
              class="h-full w-full"
              @workbookInitialized="initWorkbook"
            />
          </div>
        </ClientOnly>
      </UCard>

      <!-- Trading Note -->
      <UCard>
        <AnalysisTradingNote
          ref="tradingNoteRef"
          :note-html="currentNoteHtml"
        />
      </UCard>
    </main>

    <!-- Fixed Bottom Bar -->
    <div
      class="fixed bottom-0 left-0 right-0 z-100 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 shadow-lg flex justify-center"
    >
      <div class="w-full flex justify-between px-3">
        <div class="flex gap-2">
          <UButton
            @click="refreshData"
            color="primary"
            variant="soft"
            size="md"
            class="cursor-pointer"
            icon="i-lucide-arrow-down-to-line"
          >
            Crawl
          </UButton>
          <UButton
            color="primary"
            variant="soft"
            size="md"
            class="cursor-pointer"
            icon="i-lucide-plus"
            @click="addYear"
          >
            Add Year
          </UButton>
        </div>

        <UButton
          color="primary"
          size="md"
          icon="i-lucide-save"
          class="save-btn-floating"
          @click="handleGlobalSave"
        >
          Save
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spread-host {
  width: 100%;
  height: 100%;
}

.analysis-page {
  padding-bottom: 100px;
}

.save-btn-floating {
  box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.3);
  transition: transform 0.2s ease;
}

.save-btn-floating:hover {
  transform: translateY(-2px);
}
</style>
