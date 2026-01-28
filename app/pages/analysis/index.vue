<script setup lang="ts">
import type { StockSummary } from '~/services';
import { getStockList, deleteStockAnalysis } from '~/services';

const stocks = ref<StockSummary[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const toast = useToast();
const loadingStore = useLoadingStore();

// Load stock list
const loadStocks = async () => {
  isLoading.value = true;
  loadingStore.show('Đang tải danh sách cổ phiếu...');
  try {
    const response = await getStockList();

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
    loadingStore.hide();
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

// New analysis
const newSymbol = ref('');
const createNewAnalysis = () => {
  if (!newSymbol.value) return;
  navigateTo(`/analysis/${newSymbol.value.toUpperCase()}`);
};

// Delete analysis
const showDeleteModal = ref(false);
const stockToDelete = ref<string | null>(null);

const confirmDelete = (symbol: string) => {
  stockToDelete.value = symbol;
  showDeleteModal.value = true;
};

const handleDelete = async () => {
  if (!stockToDelete.value) return;

  loadingStore.show(`Đang xóa ${stockToDelete.value}...`);
  try {
    const response = await deleteStockAnalysis(stockToDelete.value);

    if (response.success) {
      toast.add({
        title: 'Thành công',
        description: response.message,
        color: 'success',
      });

      // Refresh list
      await loadStocks();
    }
  } catch (error: any) {
    toast.add({
      title: 'Lỗi',
      description: error.data?.message || 'Không thể xóa phân tích',
      color: 'error',
    });
  } finally {
    loadingStore.hide();
    showDeleteModal.value = false;
    stockToDelete.value = null;
  }
};

onMounted(async () => {
  await nextTick();
  loadStocks();
});

useHead({
  title: 'Danh sách phân tích | Stock Analysis App',
});
</script>

<template>
  <div class="max-w-7xl mx-auto p-8">
    <!-- Header -->
    <div class="flex justify-between items-start mb-8 gap-8">
      <div class="flex-1">
        <h1
          class="flex items-center text-3xl font-bold text-gray-900 dark:text-white mb-2"
        >
          <UIcon name="i-lucide-trending-up" class="mr-3" />
          Danh sách phân tích cổ phiếu
        </h1>
      </div>
      <div class="flex gap-2">
        <UInput
          id="new-symbol"
          v-model="newSymbol"
          size="lg"
          placeholder="VD: PVD, VCB, HPG..."
          class="uppercase w-48"
          @keyup.enter="createNewAnalysis"
        />
        <UButton
          icon="i-lucide-arrow-right"
          size="lg"
          :disabled="!newSymbol"
          @click="createNewAnalysis"
        >
          Đi đến
        </UButton>
      </div>
    </div>

    <!-- Search -->
    <div class="mb-8 max-w-md">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        size="lg"
        placeholder="Tìm kiếm mã cổ phiếu..."
      >
        <template #trailing>
          <UButton
            v-show="searchQuery !== ''"
            color="neutral"
            variant="link"
            icon="i-lucide-x"
            :padded="false"
            @click="searchQuery = ''"
          />
        </template>
      </UInput>
    </div>

    <!-- Empty State -->
    <div
      v-if="!isLoading && filteredStocks.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center text-gray-500 dark:text-gray-400"
    >
      <UIcon name="i-lucide-inbox" class="text-6xl mb-4 opacity-50" />
      <h3 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        {{ searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có phân tích nào' }}
      </h3>
      <p>
        {{
          searchQuery
            ? 'Thử tìm kiếm với từ khóa khác'
            : 'Bắt đầu bằng cách tạo phân tích mới'
        }}
      </p>
    </div>

    <!-- Stock Table -->
    <div
      v-else
      class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden"
    >
      <table class="w-full">
        <thead
          class="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700"
        >
          <tr>
            <th
              class="px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Mã CP
            </th>
            <th
              class="px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Cập nhật
            </th>
            <th
              class="px-4 py-3 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Giá vào
            </th>
            <th
              class="px-4 py-3 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Mục tiêu
            </th>
            <th
              class="px-4 py-3 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Cắt lỗ
            </th>
            <th
              class="px-4 py-3 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            ></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="stock in filteredStocks"
            :key="stock.id"
            class="border-b border-gray-200 dark:border-gray-700 last:border-b-0 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            @click="viewStock(stock.symbol)"
          >
            <td class="px-4 py-4">
              <span class="font-bold text-sm text-primary-500 cursor-pointer">{{
                stock.symbol
              }}</span>
            </td>
            <td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDate(stock.updated_at) }}
            </td>
            <td class="px-4 py-4 text-right font-mono font-medium">
              {{ formatPrice(stock.entry_price) }}
            </td>
            <td class="px-4 py-4 text-right font-mono font-medium">
              {{ formatPrice(stock.target_price) }}
            </td>
            <td class="px-4 py-4 text-right font-mono font-medium">
              {{ formatPrice(stock.stop_loss) }}
            </td>
            <td class="px-4 py-4 text-center">
              <UButton
                icon="i-lucide-eye"
                size="md"
                color="primary"
                class="cursor-pointer"
                variant="ghost"
                @click.stop="viewStock(stock.symbol)"
              >
                Xem
              </UButton>
              <UButton
                icon="i-lucide-trash-2"
                size="md"
                color="error"
                variant="ghost"
                @click.stop="confirmDelete(stock.symbol)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="showDeleteModal" title="Xác nhận xóa">
      <template #footer>
        <div class="flex justify-end gap-4 w-full">
          <UButton
            color="neutral"
            variant="outline"
            class="cursor-pointer"
            @click="showDeleteModal = false"
          >
            Hủy
          </UButton>
          <UButton
            class="cursor-pointer"
            icon="i-lucide-trash-2"
            color="error"
            @click="handleDelete"
          >
            Xóa
          </UButton>
        </div>
      </template>

      <template #body>
        <p class="text-gray-700 dark:text-gray-300">
          Bạn có chắc chắn muốn xóa phân tích cho mã
          <strong>{{ stockToDelete }}</strong
          >?
        </p>
      </template>
    </UModal>
  </div>
</template>
