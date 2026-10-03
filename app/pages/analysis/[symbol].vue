<script setup lang="ts">
import { ref, watch, onMounted, computed, defineAsyncComponent, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import type { ComponentPublicInstance } from 'vue';
import { detectStockType, STOCK_PROFILES } from '~/spreadsheet/profiles';
import type { InputFieldName } from '~/constants/spreadJsConstants';
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
const toast = useToast();

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
const scheduleRender = () => {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(renderSheet, 100);
};

// Rebuild the sheet when a stock is (re)loaded or its figures change.
// Inputs are not watched: they are written into their cells (see updateInput).
watch(() => state.value, scheduleRender);
watch([() => state.value.annualData, () => state.value.quarterlyData], scheduleRender, { deep: true });

// ============ INPUTS (assumptions form ⇄ sheet input cells) ============

const profile = computed(() => STOCK_PROFILES[stockType.value]);
const assumptionValues = computed(() => ({
  currentPrice: state.value.currentPrice,
  outstandingShares: state.value.outstandingShares,
  revenueGrowth: state.value.revenueGrowth,
  grossMargin: state.value.grossMargin,
  netProfitGrowth: state.value.netProfitGrowth,
}));

const applyInput = (field: InputFieldName, value: number) => {
  state.value[field] = value;
  // Quarters without their own share count use this one, so they need a rebuild
  if (field === 'outstandingShares') scheduleRender();
};

/** "Áp dụng" in the form: update the state and the input cells (formulas recalculate) */
const applyAssumptions = (changes: Partial<Record<InputFieldName, number>>) => {
  for (const [field, value] of Object.entries(changes) as [InputFieldName, number][]) {
    applyInput(field, value);
    if (field !== 'outstandingShares') sheet.setInput(field, value);
  }
  toast.add({ title: 'Đã áp dụng giả định', description: 'Bảng tính đã được tính lại', color: 'success' });
};

/** From the sheet: the user typed into an input cell */
sheet.onInputEdited(applyInput);

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

const secondaryActions = computed(() => [
  {
    label: 'Cập nhật dữ liệu',
    title: 'Tải báo cáo tài chính mới nhất từ Vietstock',
    icon: 'i-lucide-refresh-cw',
    loading: false,
    onClick: refreshData,
  },
  {
    label: 'Thêm năm',
    title: 'Thêm một năm dự phóng vào bảng tính',
    icon: 'i-lucide-calendar-plus',
    loading: false,
    onClick: addYear,
  },
  {
    label: 'Xuất Excel',
    title: 'Tải bảng tính về dạng .xlsx',
    icon: 'i-lucide-file-spreadsheet',
    loading: isExporting.value,
    onClick: exportExcel,
  },
]);

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
  <div class="analysis-page max-w-screen-2xl mx-auto px-3 md:px-4 py-4 md:py-6">
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
      <AnalysisAssumptionsForm
        v-show="activeTab === '0'"
        :values="assumptionValues"
        :labels="profile.inputLabels"
        :notes="profile.inputNotes"
        @apply="applyAssumptions"
      />

      <!-- SpreadJS Area -->
      <UCard v-show="activeTab === '0'" class="overflow-hidden" :ui="{ body: 'p-2 sm:p-3' }">
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
      <UCard v-if="chartTabOpened" v-show="activeTab === '1'" :ui="{ body: 'p-2 sm:p-3' }">
        <AnalysisChartView
          :quarterly-data="state.quarterlyData"
          :annual-data="state.annualData"
          :stock-type="stockType"
        />
      </UCard>

      <!-- Trading Note -->
      <UCard :ui="{ body: 'p-3 sm:p-4' }">
        <AnalysisTradingNote
          ref="tradingNoteRef"
          :note-html="noteHtml"
        />
      </UCard>
    </main>

    <!-- Fixed bottom bar: secondary actions on the left (icons only on phones), save on the right -->
    <div
      class="fixed bottom-0 left-0 right-0 z-100 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 py-3 flex justify-center"
    >
      <div class="w-full max-w-screen-2xl flex items-center justify-between gap-2 px-3 md:px-4">
        <div class="flex gap-1 sm:gap-2">
          <UButton
            v-for="action in secondaryActions"
            :key="action.label"
            color="neutral"
            variant="outline"
            :icon="action.icon"
            :loading="action.loading"
            :aria-label="action.label"
            :title="action.title"
            @click="action.onClick"
          >
            <span class="hidden sm:inline">{{ action.label }}</span>
          </UButton>
        </div>

        <UButton color="primary" icon="i-lucide-save" class="px-4" @click="handleGlobalSave">
          Lưu
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
</style>
