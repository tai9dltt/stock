<script setup lang="ts">
import { ref, watch, onMounted, computed, defineAsyncComponent, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import type { ComponentPublicInstance } from 'vue';
import { detectStockType } from '~/spreadsheet/profiles';
import { withForecastYearQuarters } from '~/composables/useStockDataTransform';
import { useAnalysisSheet } from '~/composables/useAnalysisSheet';
import { useStockAnalysis, type TradingPlan } from '~/composables/useStockAnalysis';
import { preloadGoogleCharts } from '~/utils/googleCharts';
import { stockSummary } from '~/utils/stockSummary';

// Dynamically import SpreadJS components to avoid SSR issues
const GcSpreadSheets = defineAsyncComponent(() =>
  import('@mescius/spread-sheets-vue').then((m) => m.GcSpreadSheets),
);

interface TradingNoteInstance extends ComponentPublicInstance {
  setValues: (data: Partial<Omit<TradingPlan, 'noteHtml'>>) => void;
  getTradingData: () => TradingPlan;
}

const route = useRoute();
const stockSymbol = computed(
  () => (route.params.symbol as string)?.toUpperCase() || '',
);

const analysis = useStockAnalysis(stockSymbol);
const { state, savedAnalysis, isLoading } = analysis;
const sheet = useAnalysisSheet();

const tradingNoteRef = ref<TradingNoteInstance | null>(null);
const activeTab = ref('0'); // Index-based: 0 = spreadsheet, 1 = chart
const tabItems = [
  { label: 'Bảng tính', icon: 'i-lucide-table-2' },
  { label: 'Biểu đồ', icon: 'i-lucide-bar-chart-2' },
];

const stockType = computed(() =>
  detectStockType(stockSymbol.value, state.value.annualData, state.value.quarterlyData),
);
const noteHtml = computed(() => savedAnalysis.value?.noteHtml || '');

const summary = computed(() =>
  stockSummary({
    ...state.value,
    targetPrice: savedAnalysis.value?.targetPrice,
    stopLoss: savedAnalysis.value?.stopLoss,
  }),
);

// The chart tab is created on first open and then kept, so switching back is instant
const chartTabOpened = ref(false);
let widthWhenChartsHidden = 0;
watch(activeTab, async (tab, previous) => {
  if (tab === '1') {
    chartTabOpened.value = true;
    // Google Charts only redraws on window resize; catch up on a resize that happened while hidden
    if (widthWhenChartsHidden && widthWhenChartsHidden !== window.innerWidth) {
      await nextTick();
      window.dispatchEvent(new Event('resize'));
    }
  } else if (previous === '1') {
    widthWhenChartsHidden = window.innerWidth;
  }
});

// ============ SPREADSHEET ============

const renderSheet = () => {
  if (!sheet.isReady()) return;
  sheet.render(state.value);
  // Every quarter of a forecast year is a forecast quarter from now on
  state.value.forecastQuarters = withForecastYearQuarters(
    state.value.forecastYears,
    state.value.forecastQuarters,
  );
};

const initWorkbook = async (spread: any) => {
  await sheet.init(spread);
  renderSheet();
};

let renderTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  [
    () => state.value.annualData,
    () => state.value.quarterlyData,
    () => state.value.currentPrice,
    () => state.value.tradingDate,
  ],
  () => {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(renderSheet, 100);
  },
  { deep: true },
);

// ============ ACTIONS ============

const loadAnalysis = async () => {
  await analysis.load();
  const saved = savedAnalysis.value;
  if (saved && tradingNoteRef.value) {
    tradingNoteRef.value.setValues({
      entryPrice: saved.entryPrice,
      targetPrice: saved.targetPrice,
      stopLoss: saved.stopLoss,
    });
  }
};

const refreshData = async () => {
  if (await analysis.crawl()) await loadAnalysis();
};

const addYear = () => {
  analysis.addYear();
  renderSheet();
};

const toast = useToast();
const isExporting = ref(false);

const exportExcel = async () => {
  if (!sheet.isReady()) return;
  isExporting.value = true;
  try {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    await sheet.exportExcel(`${stockSymbol.value}_phan-tich_${date}.xlsx`);
  } catch (error) {
    toast.add({
      title: 'Không xuất được Excel',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    });
  } finally {
    isExporting.value = false;
  }
};

const handleGlobalSave = () => {
  if (!tradingNoteRef.value) return;
  analysis.save(tradingNoteRef.value.getTradingData(), sheet.readEdits());
};

// ============ LIFECYCLE ============

onMounted(async () => {
  if (stockSymbol.value) await loadAnalysis();
  preloadGoogleCharts();
});

watch(stockSymbol, (val) => {
  if (val) loadAnalysis();
});

useHead({
  title: computed(() => `${stockSymbol.value} · Phân tích`),
});
</script>

<template>
  <div class="analysis-page max-w-screen-2xl mx-auto px-4 md:px-6 py-4 md:py-6">
    <AnalysisStockSummaryBar
      :symbol="stockSymbol"
      :stock-type="stockType"
      :figures="summary"
      :price-date="state.tradingDate"
      :loading="isLoading"
    />

    <div class="flex items-center justify-end mt-4 mb-4">
      <UTabs
        v-model="activeTab"
        :items="tabItems"
        :ui="{ label: 'cursor-pointer' }"
        class="w-full sm:w-[320px]"
      />
    </div>

    <main class="page-content space-y-6">
      <!-- SpreadJS Area -->
      <UCard v-show="activeTab === '0'" class="p-0 overflow-hidden">
        <ClientOnly>
          <div class="h-[700px] w-full">
            <GcSpreadSheets
              class="h-full w-full"
              @workbook-initialized="initWorkbook"
            />
          </div>
        </ClientOnly>
      </UCard>

      <!-- Chart View -->
      <UCard v-if="chartTabOpened" v-show="activeTab === '1'" class="p-4">
        <AnalysisChartView
          :quarterly-data="state.quarterlyData"
          :annual-data="state.annualData"
          :stock-type="stockType"
        />
      </UCard>

      <!-- Trading Note -->
      <UCard>
        <AnalysisTradingNote
          ref="tradingNoteRef"
          :note-html="noteHtml"
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
            color="primary"
            variant="soft"
            size="md"
            class="cursor-pointer"
            icon="i-lucide-arrow-down-to-line"
            @click="refreshData"
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
          <UButton
            color="primary"
            variant="soft"
            size="md"
            class="cursor-pointer"
            icon="i-lucide-file-spreadsheet"
            :loading="isExporting"
            @click="exportExcel"
          >
            Export Excel
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
