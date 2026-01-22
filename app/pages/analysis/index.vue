<script setup lang="ts">
interface StockSummary {
  id: number;
  symbol: string;
  created_at: string;
  updated_at: string;
  entry_price: string | null;
  target_price: string | null;
  stop_loss: string | null;
}

const stocks = ref<StockSummary[]>([]);
const isLoading = ref(false);
const searchQuery = ref('');
const toast = useToast();

// Load stock list
const loadStocks = async () => {
  isLoading.value = true;
  try {
    const response = await $fetch<{
      success: boolean;
      data: StockSummary[];
    }>('/api/stock/list');

    if (response.success) {
      stocks.value = response.data;
    }
  } catch (error) {
    toast.add({
      title: 'Lỗi',
      description: 'Không thể tải danh sách cổ phiếu',
      color: 'error',
    });
  } finally {
    isLoading.value = false;
  }
};

// Filtered stocks based on search
const filteredStocks = computed(() => {
  if (!searchQuery.value) return stocks.value;
  const query = searchQuery.value.toLowerCase();
  return stocks.value.filter((s) => s.symbol.toLowerCase().includes(query));
});

// Format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format price
const formatPrice = (price: string | null) => {
  if (!price) return '-';
  return new Intl.NumberFormat('vi-VN').format(Number(price));
};

// Navigate to detail page
const viewStock = (symbol: string) => {
  navigateTo(`/analysis/${symbol}`);
};

// New analysis modal
const showNewModal = ref(false);
const newSymbol = ref('');

const createNewAnalysis = () => {
  if (!newSymbol.value) return;
  navigateTo(`/analysis/${newSymbol.value.toUpperCase()}`);
  showNewModal.value = false;
  newSymbol.value = '';
};

onMounted(() => {
  loadStocks();
});

useHead({
  title: 'Danh sách phân tích | Stock Analysis App',
});
</script>

<template>
  <div class="stock-list-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <UIcon name="i-lucide-trending-up" class="mr-3" />
          Danh sách phân tích cổ phiếu
        </h1>
        <p class="page-subtitle">
          Quản lý và xem các kịch bản phân tích đã lưu
        </p>
      </div>

      <UButton
        icon="i-lucide-plus-circle"
        size="lg"
        color="primary"
        @click="showNewModal = true"
      >
        Phân tích mới
      </UButton>
    </div>

    <!-- Search -->
    <div class="search-section">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        size="lg"
        placeholder="Tìm kiếm mã cổ phiếu..."
        :ui="{ icon: { trailing: { pointer: '' } } }"
      >
        <template #trailing>
          <UButton
            v-show="searchQuery !== ''"
            color="gray"
            variant="link"
            icon="i-lucide-x"
            :padded="false"
            @click="searchQuery = ''"
          />
        </template>
      </UInput>
    </div>

    <!-- Stock List -->
    <div v-if="isLoading" class="loading-state">
      <UIcon name="i-lucide-loader-2" class="animate-spin" />
      <p>Đang tải danh sách...</p>
    </div>

    <div v-else-if="filteredStocks.length === 0" class="empty-state">
      <UIcon name="i-lucide-inbox" class="empty-icon" />
      <h3>
        {{ searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có phân tích nào' }}
      </h3>
      <p>
        {{
          searchQuery
            ? 'Thử tìm kiếm với từ khóa khác'
            : 'Bắt đầu bằng cách tạo phân tích mới'
        }}
      </p>
      <UButton
        v-if="!searchQuery"
        icon="i-lucide-plus-circle"
        size="lg"
        class="mt-4"
        @click="showNewModal = true"
      >
        Tạo phân tích đầu tiên
      </UButton>
    </div>

    <div v-else class="stock-table">
      <table>
        <thead>
          <tr>
            <th>Mã CP</th>
            <th>Cập nhật</th>
            <th class="text-right">Giá vào</th>
            <th class="text-right">Mục tiêu</th>
            <th class="text-right">Cắt lỗ</th>
            <th class="text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="stock in filteredStocks"
            :key="stock.id"
            class="stock-row"
            @click="viewStock(stock.symbol)"
          >
            <td>
              <span class="symbol">{{ stock.symbol }}</span>
            </td>
            <td class="date-cell">{{ formatDate(stock.updated_at) }}</td>
            <td class="price-cell text-right">
              {{ formatPrice(stock.entry_price) }}
            </td>
            <td class="price-cell text-right">
              {{ formatPrice(stock.target_price) }}
            </td>
            <td class="price-cell text-right">
              {{ formatPrice(stock.stop_loss) }}
            </td>
            <td class="text-center">
              <UButton
                icon="i-lucide-eye"
                size="sm"
                color="primary"
                variant="ghost"
                @click.stop="viewStock(stock.symbol)"
              >
                Xem
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- New Analysis Modal -->
    <UModal v-model="showNewModal">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Tạo phân tích mới</h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-lucide-x"
              @click="showNewModal = false"
            />
          </div>
        </template>

        <div class="modal-content">
          <label for="new-symbol" class="block font-medium mb-2"
            >Mã cổ phiếu</label
          >
          <UInput
            id="new-symbol"
            v-model="newSymbol"
            size="lg"
            placeholder="VD: PVD, VCB, HPG..."
            class="uppercase"
            @keyup.enter="createNewAnalysis"
          />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showNewModal = false">
              Hủy
            </UButton>
            <UButton
              icon="i-lucide-arrow-right"
              :disabled="!newSymbol"
              @click="createNewAnalysis"
            >
              Tiếp tục
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<style scoped>
.stock-list-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 2rem;
}

.header-content {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  font-size: 2rem;
  font-weight: 700;
  color: var(--ui-text);
  margin-bottom: 0.5rem;
}

.page-subtitle {
  color: var(--ui-text-muted);
  font-size: 1rem;
}

.search-section {
  margin-bottom: 2rem;
  max-width: 500px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--ui-text-muted);
}

.loading-state svg {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ui-text);
  margin-bottom: 0.5rem;
}

.stock-table {
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
  overflow: hidden;
}

.stock-table table {
  width: 100%;
  border-collapse: collapse;
}

.stock-table thead {
  background: var(--ui-bg-elevated);
  border-bottom: 2px solid var(--ui-border);
}

.stock-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stock-row {
  border-bottom: 1px solid var(--ui-border);
  cursor: pointer;
  transition: background-color 0.2s;
}

.stock-row:hover {
  background: var(--ui-bg-elevated);
}

.stock-row:last-child {
  border-bottom: none;
}

.stock-row td {
  padding: 1rem;
}

.symbol {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--ui-primary);
}

.date-cell {
  color: var(--ui-text-muted);
  font-size: 0.875rem;
}

.price-cell {
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.modal-content {
  padding: 1rem 0;
}
</style>
