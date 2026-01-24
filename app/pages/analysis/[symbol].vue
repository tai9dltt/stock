<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

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
const outstandingShares = ref(2666873613);
const currentPrice = ref(14000);

// Local input state (decoupled from grid updates)
const localOutstandingShares = ref(2666873613);
const localCurrentPrice = ref(14000);

const peAssumptions = ref<Record<string, number>>({});
const annualData = ref<Record<string, any>>({});
const quarterlyData = ref<Record<string, any>>({});

// Track manual edits separately from crawled data
const manualQuarterlyEdits = ref<Record<string, any>>({});
const manualAnnualEdits = ref<Record<string, any>>({});
const forecastYears = ref<string[]>([]);
const forecastQuarters = ref<string[]>([]);

const currentNoteHtml = ref('');

const isCloning = ref(false);
const loadingStore = useLoadingStore();

// Component refs
const tradingNoteRef = ref<TradingNoteInstance | null>(null);

// Toast
const toast = useToast();

// Formatted inputs with thousand separators (bound to local state)
const formattedOutstandingShares = computed({
  get: () => {
    if (!localOutstandingShares.value) return '';
    return new Intl.NumberFormat('vi-VN').format(localOutstandingShares.value);
  },
  set: (val: string) => {
    // Remove all non-digit characters
    const numericValue = val.replace(/\D/g, '');
    localOutstandingShares.value = numericValue ? parseInt(numericValue) : 0;
  },
});

const formattedCurrentPrice = computed({
  get: () => {
    if (!localCurrentPrice.value) return '';
    return new Intl.NumberFormat('vi-VN').format(localCurrentPrice.value);
  },
  set: (val: string) => {
    // Remove all non-digit characters
    const numericValue = val.replace(/\D/g, '');
    localCurrentPrice.value = numericValue ? parseInt(numericValue) : 0;
  },
});

// Smart update - check DB and fetch only new data from Vietstock
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
    const response = await $fetch('/api/stock/smart-update', {
      method: 'POST',
      body: {
        symbol: stockSymbol.value,
      },
    });

    if (response.success && response.data) {
      // Update quarterly data with merged result
      quarterlyData.value = response.data.quarters;

      // Update annual data if available
      if (response.data.annual) {
        annualData.value = response.data.annual;
        console.log('Updated annual data:', response.data.annual);
      }

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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Lỗi không xác định';
    toast.add({
      title: 'Lỗi cập nhật',
      description: message,
      color: 'error',
    });
  } finally {
    isCloning.value = false;
  }
};

// Refresh data from Vietstock (manual crawl)
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
    // Crawl quarterly data
    const quarterlyResponse = await $fetch('/api/stock/crawl', {
      method: 'POST',
      body: {
        symbol: stockSymbol.value,
        pages: 4,
      },
    });

    // Crawl yearly data (fetch 2 pages = 8 years to get historical data)
    const yearlyResponse = await $fetch('/api/stock/crawl-yearly', {
      method: 'POST',
      body: {
        symbol: stockSymbol.value,
        pages: 2,
      },
    });

    if (quarterlyResponse.success && yearlyResponse.success) {
      const qData = (quarterlyResponse as any).data;
      const yData = (yearlyResponse as any).data;

      toast.add({
        title: 'Đã cập nhật',
        description: `Crawled ${qData?.periodsProcessed || 0} quarters, ${yData?.periodsProcessed || 0} years`,
        color: 'success',
      });

      // Reload data from DB
      await loadAnalysis();
    } else {
      toast.add({
        title: 'Lỗi',
        description: 'Không thể crawl dữ liệu từ Vietstock',
        color: 'error',
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Lỗi không xác định';
    toast.add({
      title: 'Lỗi crawl',
      description: message,
      color: 'error',
    });
  } finally {
    loadingStore.hide();
  }
};

// Apply current input values to grids (without loading from DB)
const applyInputValues = () => {
  // Commit local values to main state
  // This triggers the reactivity in the grids
  outstandingShares.value = localOutstandingShares.value;
  currentPrice.value = localCurrentPrice.value;

  toast.add({
    title: 'Đã áp dụng',
    description: 'Kịch bản đã được tải với giá trị hiện tại',
    color: 'success',
  });
};

// Auto-load on page mount
onMounted(() => {
  console.log('=== MOUNTED ===');
  console.log('stockSymbol.value:', stockSymbol.value);
  console.log('route.params.symbol:', route.params.symbol);
  if (stockSymbol.value) {
    console.log('Calling loadAnalysis from onMounted');
    loadAnalysis();
  } else {
    console.log('No symbol, skipping loadAnalysis');
  }
});

// Auto-load data when stock symbol changes (with debounce)
let loadTimeout: ReturnType<typeof setTimeout> | null = null;
watch(stockSymbol, (newSymbol) => {
  if (loadTimeout) clearTimeout(loadTimeout);

  if (newSymbol && newSymbol.length >= 3) {
    loadTimeout = setTimeout(() => {
      loadAnalysis();
    }, 1000); // Wait 1 second after user stops typing
  }
});

// Initialize P/E assumptions for forecast years
watch(
  forecastYears,
  (years) => {
    if (!years || years.length === 0) return;

    years.forEach((year) => {
      if (peAssumptions.value[year] === undefined) {
        peAssumptions.value[year] = 15; // default P/E
      }
    });
  },
  { immediate: true, deep: true },
);

// Load saved analysis
const loadAnalysis = async () => {
  console.log('=== loadAnalysis START ===');
  console.log('stockSymbol.value:', stockSymbol.value);

  if (!stockSymbol.value) {
    toast.add({
      title: 'Lỗi',
      description: 'Vui lòng nhập mã cổ phiếu',
      color: 'error',
    });
    return;
  }

  loadingStore.show('Đang tải dữ liệu...');

  try {
    const response = await $fetch<{
      success: boolean;
      data: any;
      message?: string;
    }>('/api/stock/get', {
      query: { symbol: stockSymbol.value },
    });

    console.log('API Response:', response);

    if (response.success && response.data) {
      const data = response.data;

      // Process periods for forecast status
      if (data.periods) {
        const fYears = new Set<string>();
        const fQuarters = new Set<string>();

        data.periods.forEach((p: any) => {
          if (p.is_forecast) {
            if (p.source === 'year' || p.quarter === 0) {
              fYears.add(p.year.toString());
            } else {
              fQuarters.add(`${p.year}_Q${p.quarter}`);
            }
          }
        });
        forecastYears.value = Array.from(fYears);
        forecastQuarters.value = Array.from(fQuarters);
      }

      // 1. Load from trading snapshot first (as defaults)
      if (data.tradingSnapshot) {
        if (data.tradingSnapshot.outstandingShares) {
          outstandingShares.value = data.tradingSnapshot.outstandingShares;
          localOutstandingShares.value = data.tradingSnapshot.outstandingShares;
        }
        if (data.tradingSnapshot.lastPrice) {
          currentPrice.value = data.tradingSnapshot.lastPrice;
          localCurrentPrice.value = data.tradingSnapshot.lastPrice;
        }
      }

      // 2. Load saved manual data (if available) - this will override tradingSnapshot
      if (data.analysis && data.analysis.quarterlyData) {
        const savedData = data.analysis.quarterlyData;
        console.log('Loaded saved data:', savedData);

        if (savedData.quarterlyData) {
          quarterlyData.value = savedData.quarterlyData;
        }
        if (savedData.annualData) {
          annualData.value = savedData.annualData;
        }
        if (savedData.peAssumptions) {
          peAssumptions.value = savedData.peAssumptions;
        }
        // Override with saved shares/price if they exist
        if (savedData.outstandingShares) {
          outstandingShares.value = savedData.outstandingShares;
          localOutstandingShares.value = savedData.outstandingShares;
        }
        if (savedData.currentPrice) {
          currentPrice.value = savedData.currentPrice;
          localCurrentPrice.value = savedData.currentPrice;
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
          if (!quarterlyData.value[indicatorKey!]) {
            quarterlyData.value[indicatorKey!] = {};
          }

          for (const [periodKey, value] of Object.entries(
            periodValues as Record<string, string>,
          )) {
            const parts = periodKey.split('_');
            if (parts.length < 2) continue;
            const [year, quarter] = parts;

            // Ensure year object exists
            if (!quarterlyData.value[indicatorKey!][year]) {
              quarterlyData.value[indicatorKey!][year] = {};
            }

            // OVERWRITE with crawled value
            quarterlyData.value[indicatorKey!][year][quarter] = parseFloat(
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

      // Populate trading note data from analysis
      if (data.analysis) {
        if (data.analysis.noteHtml) {
          currentNoteHtml.value = data.analysis.noteHtml;
        }

        if (tradingNoteRef.value) {
          tradingNoteRef.value.setValues({
            entryPrice: data.analysis.entryPrice,
            targetPrice: data.analysis.targetPrice,
            stopLoss: data.analysis.stopLoss,
          });
        }
      }

      toast.add({
        title: 'Đã tải dữ liệu',
        description: `${data.periods?.length || 0} periods loaded`,
        color: 'success',
      });
    } else if (response.message) {
      // Company not found - offer to crawl
      toast.add({
        title: 'Chưa có dữ liệu',
        description: response.message,
        color: 'warning',
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Lỗi không xác định';
    toast.add({
      title: 'Lỗi tải dữ liệu',
      description: message,
      color: 'error',
    });
  } finally {
    loadingStore.hide();
  }
};

// Save analysis
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

// Page meta
useHead({
  title: computed(
    () => `${stockSymbol.value || 'Phân tích'} | Stock Analysis App`,
  ),
});
</script>

<template>
  <div class="analysis-page">
    <!-- Header -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-left">
          <!-- Breadcrumb -->
          <nav class="breadcrumb">
            <NuxtLink to="/analysis" class="breadcrumb-link">
              <UIcon name="i-lucide-trending-up" />
              Phân tích
            </NuxtLink>
            <UIcon name="i-lucide-chevron-right" class="breadcrumb-separator" />
            <span class="breadcrumb-current">{{ stockSymbol || '...' }}</span>
          </nav>

          <div class="flex items-center gap-3 mt-2">
            <h1 class="page-title">{{ stockSymbol }}</h1>
            <UBadge size="lg" color="primary" variant="subtle">
              Live Data
            </UBadge>
          </div>
        </div>
        <UColorModeButton size="lg" />
      </div>
    </header>

    <!-- Main Content -->
    <main class="page-content">
      <!-- Stock Input Section -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/10">
                <UIcon name="i-lucide-settings" class="text-xl text-primary" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">Thông số cơ bản</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Cấu hình thông tin cổ phiếu
                </p>
              </div>
            </div>
          </div>
        </template>

        <div class="space-y-6">
          <!-- Input Fields -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UFormGroup
              label="Số lượng CP lưu hành"
              name="outstandingShares"
              help="Tổng số cổ phiếu đang lưu hành trên thị trường"
            >
              <UInput
                v-model="formattedOutstandingShares"
                type="text"
                size="lg"
                placeholder="2,666,873,613"
              >
                <template #leading>
                  <UIcon name="i-lucide-hash" class="text-gray-400" />
                </template>
              </UInput>
            </UFormGroup>

            <UFormGroup
              label="Giá CP hiện tại"
              name="currentPrice"
              help="Giá cổ phiếu hiện tại (VNĐ)"
            >
              <UInput
                v-model="formattedCurrentPrice"
                type="text"
                size="lg"
                placeholder="14,000"
              >
                <template #leading>
                  <UIcon name="i-lucide-dollar-sign" class="text-gray-400" />
                </template>
                <template #trailing>
                  <span class="text-xs text-gray-500">VNĐ</span>
                </template>
              </UInput>
            </UFormGroup>
          </div>

          <UDivider />

          <!-- Action Buttons -->
          <div class="flex flex-wrap gap-3">
            <UButton
              :loading="loadingStore.isLoading"
              color="neutral"
              variant="outline"
              size="lg"
              @click="loadAnalysis"
            >
              <template #leading>
                <UIcon name="i-lucide-database" />
              </template>
              Load từ DB
            </UButton>

            <UButton
              color="neutral"
              variant="solid"
              size="lg"
              @click="applyInputValues"
            >
              <template #leading>
                <UIcon name="i-lucide-play" />
              </template>
              Tải kịch bản
            </UButton>

            <UButton
              :loading="loadingStore.isLoading"
              color="primary"
              variant="solid"
              size="lg"
              @click="refreshData"
            >
              <template #leading>
                <UIcon name="i-lucide-refresh-cw" />
              </template>
              Refresh Data từ Vietstock
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Table 1: Annual Summary -->
      <UCard class="mb-6">
        <AnalysisAnnualSummaryGrid
          :outstanding-shares="outstandingShares"
          :quarterly-data="quarterlyData"
          :annual-data="annualData"
          :forecast-years="forecastYears"
          @update:data="annualData = $event"
        />
      </UCard>

      <!-- Table 2: Quarterly Details -->
      <UCard class="mb-6">
        <AnalysisQuarterlyDetailsGrid
          :data="quarterlyData"
          :outstanding-shares="outstandingShares"
          :current-price="currentPrice"
          :forecast-quarters="forecastQuarters"
          @update:data="quarterlyData = $event"
        />
      </UCard>

      <!-- Table 3: P/E Assumptions -->
      <UCard class="mb-6">
        <AnalysisPEAssumptions
          v-model:peAssumptions="peAssumptions"
          :forecast-years="forecastYears"
        />
      </UCard>

      <!-- Trading Plan Section -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/10">
                <UIcon
                  name="i-lucide-notebook-pen"
                  class="text-xl text-primary"
                />
              </div>
              <div>
                <h2 class="text-lg font-semibold">Kế hoạch giao dịch</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Ghi chú và chiến lược đầu tư
                </p>
              </div>
            </div>
          </div>
        </template>

        <AnalysisTradingNote
          ref="tradingNoteRef"
          :note-html="currentNoteHtml"
          @save="saveAnalysis"
        />
      </UCard>
    </main>
  </div>
</template>
