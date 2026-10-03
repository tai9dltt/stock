<script setup lang="ts">
import { ref, watch, onMounted, computed, defineAsyncComponent, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import type { ComponentPublicInstance } from 'vue';
import { detectStockType } from '~/spreadsheet/profiles';
import { withForecastYearQuarters } from '~/composables/useStockDataTransform';
import { useAnalysisSheet } from '~/composables/useAnalysisSheet';
import { useStockAnalysis, type TradingPlan } from '~/composables/useStockAnalysis';
import { preloadGoogleCharts } from '~/utils/googleCharts';

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
const { state, savedAnalysis } = analysis;
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
        <div class="header-right mt-4 md:mt-0">
          <UTabs
            v-model="activeTab"
            :items="tabItems"
            :ui="{ label: 'cursor-pointer' }"
            class="w-full md:w-[320px]"
          />
        </div>
      </div>
    </header>

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
