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
// The assumptions form opens from the "Giả định" button next to the tabs
const showAssumptions = ref(false);
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

/** From the sheet: growth typed for one forecast quarter (null = follow the assumption again) */
sheet.onGrowthEdited((kind, period, value) => {
  const { [period]: _previous, ...others } = state.value.growthOverrides[kind] ?? {};
  state.value.growthOverrides[kind] = value === null ? others : { ...others, [period]: value };
});

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

// Remounted on reset so the form drops edits it has not applied
const formKey = ref(0);

const resetChanges = () => {
  analysis.reset();
  formKey.value++;
  toast.add({ title: 'Đã đặt lại', description: 'Bảng tính quay về lần lưu gần nhất', color: 'info' });
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
    label: 'Đặt lại',
    title: 'Bỏ các thay đổi chưa lưu (giả định, ô đã sửa trong bảng tính, năm vừa thêm)',
    icon: 'i-lucide-rotate-ccw',
    loading: false,
    onClick: resetChanges,
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
    >
      <template #tabs>
        <div class="flex items-center gap-2">
          <UTabs
            v-model="activeTab"
            :items="tabItems"
            :content="false"
            variant="link"
            size="md"
            :ui="{
              root: 'w-auto',
              list: 'border-none p-0 gap-1 w-auto',
              // Underline drawn inside the tab, so the card edge does not cut it
              indicator: 'hidden',
              trigger: [
                'cursor-pointer px-4 py-3 rounded-t-lg text-sm font-medium text-gray-600 dark:text-gray-400',
                'hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white',
                'data-[state=active]:font-semibold data-[state=active]:bg-primary-50 dark:data-[state=active]:bg-primary-950/40',
                'data-[state=active]:shadow-[inset_0_-3px_0_var(--ui-primary)]',
              ].join(' '),
              leadingIcon: 'size-5',
            }"
          />
          <!-- Assumptions form: hidden until asked for (sheet tab only) -->
          <UButton
            v-if="activeTab === '0'"
            :icon="showAssumptions ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
            :color="showAssumptions ? 'primary' : 'neutral'"
            :variant="showAssumptions ? 'soft' : 'ghost'"
            :aria-expanded="showAssumptions"
            aria-controls="assumptions-form"
            title="Hiện / ẩn giả định dự phóng và định giá"
            class="ml-auto shrink-0"
            @click="() => { showAssumptions = !showAssumptions }"
          >
            Giả định
          </UButton>
        </div>
      </template>
    </AnalysisStockSummaryBar>

    <main class="page-content space-y-6 mt-4">
      <AnalysisAssumptionsForm
        v-show="activeTab === '0' && showAssumptions"
        id="assumptions-form"
        :key="formKey"
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
