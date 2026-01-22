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
const pe2022 = ref(15);
const pe2023 = ref(15);
const annualData = ref<Record<string, any>>({});
const quarterlyData = ref<Record<string, any>>({});
const currentNoteHtml = ref('');
const isLoading = ref(false);
const isCloning = ref(false);
const isSaving = ref(false);

// Component refs
const tradingNoteRef = ref<TradingNoteInstance | null>(null);

// Toast
const toast = useToast();

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

  isLoading.value = true;

  try {
    const response = await $fetch<{
      success: boolean;
      data: any;
      message?: string;
    }>('/api/stock/get', {
      query: { symbol: stockSymbol.value },
    });

    console.log('API Response:', response);
    console.log('response.success:', response.success);
    console.log('response.data:', response.data);

    if (response.success && response.data) {
      const data = response.data;

      // Populate quarterly data if exists
      if (data.quarterly_data) {
        console.log('Setting data from quarterly_data:', data.quarterly_data);

        // Extract nested quarterlyData structure for the grid
        if (data.quarterly_data.quarterlyData) {
          quarterlyData.value = data.quarterly_data.quarterlyData;
        }

        // Extract other fields
        if (data.quarterly_data.currentPrice) {
          currentPrice.value = data.quarterly_data.currentPrice;
        }
        if (data.quarterly_data.outstandingShares) {
          outstandingShares.value = data.quarterly_data.outstandingShares;
        }
        if (data.quarterly_data.pe2022) {
          pe2022.value = data.quarterly_data.pe2022;
        }
        if (data.quarterly_data.pe2023) {
          pe2023.value = data.quarterly_data.pe2023;
        }
        if (data.quarterly_data.annualData) {
          annualData.value = data.quarterly_data.annualData;
        }

        console.log('quarterlyData.value after set:', quarterlyData.value);
      } else {
        console.log('No quarterly_data in response');
      }

      // Populate trading note data if exists
      if (data.note_html) {
        currentNoteHtml.value = data.note_html;
      }

      // Set trading values in the trading note component
      if (
        tradingNoteRef.value &&
        (data.entry_price || data.target_price || data.stop_loss)
      ) {
        tradingNoteRef.value.setValues({
          entryPrice: data.entry_price ? Number(data.entry_price) : null,
          targetPrice: data.target_price ? Number(data.target_price) : null,
          stopLoss: data.stop_loss ? Number(data.stop_loss) : null,
        });
      }

      toast.add({
        title: 'Đã tải',
        description: `Đã tải kịch bản cho ${stockSymbol.value.toUpperCase()}`,
        color: 'success',
      });
    } else {
      toast.add({
        title: 'Thông báo',
        description:
          response.message ||
          `Không tìm thấy kịch bản cho ${stockSymbol.value.toUpperCase()}`,
        color: 'info',
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
    isLoading.value = false;
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

  isSaving.value = true;

  try {
    await $fetch('/api/stock/save', {
      method: 'POST',
      body: {
        symbol: stockSymbol.value,
        quarterlyData: {
          annualData: annualData.value,
          quarterlyData: quarterlyData.value,
          pe2022: pe2022.value,
          pe2023: pe2023.value,
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
    isSaving.value = false;
  }
};

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

          <h1 class="page-title">{{ stockSymbol }}</h1>
          <p class="page-subtitle">Tầm soát theo Excel - 3 Tables riêng biệt</p>
        </div>
        <UColorModeButton size="lg" />
      </div>
    </header>

    <!-- Main Content -->
    <main class="page-content">
      <!-- Stock Input Section -->
      <section class="input-section">
        <div class="stock-inputs">
          <div class="input-row">
            <div class="input-field">
              <label for="outstanding-shares">Số lượng CP lưu hành</label>
              <UInput
                id="outstanding-shares"
                v-model.number="outstandingShares"
                type="number"
                size="lg"
              />
            </div>

            <div class="input-field">
              <label for="current-price">Giá CP hiện tại (đồng)</label>
              <UInput
                id="current-price"
                v-model.number="currentPrice"
                type="number"
                size="lg"
              />
            </div>
          </div>

          <div class="action-buttons">
            <UButton
              :loading="isLoading"
              color="neutral"
              variant="outline"
              icon="i-lucide-folder-open"
              @click="loadAnalysis"
            >
              Tải kịch bản
            </UButton>
          </div>
        </div>
      </section>

      <!-- Table 1: Annual Summary -->
      <section class="grid-section">
        <AnalysisAnnualSummaryGrid
          :outstanding-shares="outstandingShares"
          :quarterly-data="quarterlyData"
          :annual-data="annualData"
          @update:data="annualData = $event"
        />
      </section>

      <!-- Table 2: Quarterly Details -->
      <section class="grid-section">
        <AnalysisQuarterlyDetailsGrid
          :data="quarterlyData"
          :outstanding-shares="outstandingShares"
          :current-price="currentPrice"
          @update:data="quarterlyData = $event"
        />
      </section>

      <!-- Table 3: P/E Assumptions -->
      <section class="grid-section">
        <AnalysisPEAssumptions
          v-model:pe2022="pe2022"
          v-model:pe2023="pe2023"
        />
      </section>

      <!-- Trading Plan Section -->
      <section class="trading-section">
        <AnalysisTradingNote
          ref="tradingNoteRef"
          :note-html="currentNoteHtml"
          @save="saveAnalysis"
        />
      </section>
    </main>

    <!-- Loading Overlay -->
    <div v-if="isSaving" class="saving-overlay">
      <div class="saving-content">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-4xl" />
        <span>Đang lưu...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-page {
  min-height: 100vh;
  background: var(--ui-bg);
}

.page-header {
  background: var(--ui-bg-elevated);
  border-bottom: 1px solid var(--ui-border);
  padding: 1.5rem 2rem;
}

.header-content {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}

.breadcrumb-link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--ui-text-muted);
  text-decoration: none;
  transition: color 0.2s;
}

.breadcrumb-link:hover {
  color: var(--ui-primary);
}

.breadcrumb-separator {
  font-size: 1rem;
  opacity: 0.5;
}

.breadcrumb-current {
  font-weight: 600;
  color: var(--ui-text);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ui-text);
  margin: 0;
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  margin: 0.25rem 0 0 0;
}

.page-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.input-section {
  background: var(--ui-bg-elevated);
  border-radius: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--ui-border);
}

.stock-inputs {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ui-text-muted);
}

.input-field :deep(input) {
  text-transform: uppercase;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.grid-section,
.trading-section {
  background: var(--ui-bg-elevated);
  border-radius: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--ui-border);
}

.saving-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.saving-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: white;
  font-size: 1.25rem;
}
</style>
