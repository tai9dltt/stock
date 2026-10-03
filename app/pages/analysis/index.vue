<script setup lang="ts">
import type { StockSummary } from '~/services';
import { getStockList, deleteStockAnalysis } from '~/services';
import { formatDate, formatNumber, formatPercent } from '~/utils/format';

const stocks = ref<StockSummary[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const toast = useToast();
const loadingStore = useLoadingStore();

const loadStocks = async () => {
  isLoading.value = true;
  try {
    const response = await getStockList();
    if (response.success) stocks.value = response.data;
  } catch {
    toast.add({ title: 'Lỗi', description: 'Không thể tải danh sách cổ phiếu', color: 'error' });
  } finally {
    isLoading.value = false;
  }
};

const num = (v: string | null) => (v === null || v === '' ? null : Number(v));

/** Row with the trading plan compared to the latest price */
const rows = computed(() => {
  const query = searchQuery.value.trim().toUpperCase();
  return stocks.value
    .filter((s) => !query || s.symbol.includes(query))
    .map((s) => {
      const price = num(s.last_price);
      const vsPrice = (level: number | null) => (price && level ? level / price - 1 : null);
      return {
        ...s,
        price,
        entry: num(s.entry_price),
        target: num(s.target_price),
        stop: num(s.stop_loss),
        upside: vsPrice(num(s.target_price)),
        downside: vsPrice(num(s.stop_loss)),
      };
    });
});

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const viewStock = (symbol: string) => navigateTo(`/analysis/${symbol}`);

// Start a new analysis from the empty state
const newSymbol = ref('');
const createNewAnalysis = () => {
  const symbol = newSymbol.value.trim().toUpperCase();
  if (symbol) viewStock(symbol);
};

// Delete
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
      toast.add({ title: 'Đã xóa', description: response.message, color: 'success' });
      await loadStocks();
    }
  } catch (error: any) {
    toast.add({ title: 'Lỗi', description: error.data?.message || 'Không thể xóa phân tích', color: 'error' });
  } finally {
    loadingStore.hide();
    showDeleteModal.value = false;
    stockToDelete.value = null;
  }
};

onMounted(loadStocks);

useHead({ title: 'Danh sách phân tích' });
</script>

<template>
  <div class="max-w-screen-2xl mx-auto px-3 md:px-4 py-6 md:py-8">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Danh sách phân tích</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          <template v-if="!isLoading">{{ stocks.length }} mã đang theo dõi</template>
          <template v-else>Đang tải…</template>
        </p>
      </div>
      <UInput
        v-if="stocks.length > 0"
        v-model="searchQuery"
        icon="i-lucide-filter"
        placeholder="Lọc theo mã…"
        class="w-full sm:w-64"
        :ui="{ base: 'uppercase placeholder:normal-case' }"
      >
        <template v-if="searchQuery" #trailing>
          <UButton
            color="neutral"
            variant="link"
            icon="i-lucide-x"
            aria-label="Xóa bộ lọc"
            @click="() => { searchQuery = '' }"
          />
        </template>
      </UInput>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-16 rounded-lg bg-gray-200/70 dark:bg-gray-800 animate-pulse" />
    </div>

    <!-- Empty: nothing saved yet -->
    <div
      v-else-if="stocks.length === 0"
      class="flex flex-col items-center text-center py-16 px-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
    >
      <span class="flex items-center justify-center size-12 rounded-full bg-primary-50 dark:bg-primary-950 mb-4">
        <UIcon name="i-lucide-chart-candlestick" class="size-6 text-primary-600" />
      </span>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Chưa có phân tích nào</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6 max-w-sm">
        Nhập mã cổ phiếu để tải báo cáo tài chính từ Vietstock và bắt đầu dự phóng, định giá.
      </p>
      <form class="flex w-full max-w-xs gap-2" @submit.prevent="createNewAnalysis">
        <UInput
          v-model="newSymbol"
          placeholder="VD: FPT, VCB, HPG"
          class="flex-1"
          :ui="{ base: 'uppercase placeholder:normal-case' }"
        />
        <UButton type="submit" icon="i-lucide-arrow-right" :disabled="!newSymbol">Phân tích</UButton>
      </form>
    </div>

    <!-- Empty: filter matches nothing -->
    <div v-else-if="rows.length === 0" class="py-16 text-center text-gray-500 dark:text-gray-400">
      Không có mã nào khớp “{{ searchQuery }}”
    </div>

    <!-- Table -->
    <div
      v-else
      class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
    >
      <table class="w-full text-sm tabular-nums">
        <thead class="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500 dark:text-gray-400">
          <tr>
            <th class="px-4 py-3 text-left font-medium">Mã</th>
            <th class="px-4 py-3 text-right font-medium">Giá hiện tại</th>
            <th class="px-4 py-3 text-right font-medium hidden md:table-cell">Giá vào</th>
            <th class="px-4 py-3 text-right font-medium">Mục tiêu</th>
            <th class="px-4 py-3 text-right font-medium hidden sm:table-cell">Cắt lỗ</th>
            <th class="px-4 py-3 text-right font-medium hidden lg:table-cell">Cập nhật</th>
            <th class="px-2 py-3 w-12"><span class="sr-only">Thao tác</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr
            v-for="row in rows"
            :key="row.id"
            class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            @click="viewStock(row.symbol)"
          >
            <td class="px-4 py-3">
              <span class="font-semibold text-gray-900 dark:text-white">{{ row.symbol }}</span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="font-medium text-gray-900 dark:text-white">{{ formatNumber(row.price) }}</div>
              <div class="text-xs text-gray-400">{{ formatDate(row.price_date) }}</div>
            </td>
            <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300 hidden md:table-cell">
              {{ formatNumber(row.entry) }}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="text-gray-700 dark:text-gray-300">{{ formatNumber(row.target) }}</div>
              <div
                v-if="row.upside !== null"
                class="text-xs font-medium"
                :class="row.upside >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
              >
                {{ formatPercent(row.upside, 1, true) }}
              </div>
            </td>
            <td class="px-4 py-3 text-right hidden sm:table-cell">
              <div class="text-gray-700 dark:text-gray-300">{{ formatNumber(row.stop) }}</div>
              <div v-if="row.downside !== null" class="text-xs text-gray-400">
                {{ formatPercent(row.downside, 1, true) }}
              </div>
            </td>
            <td class="px-4 py-3 text-right text-xs text-gray-400 hidden lg:table-cell whitespace-nowrap">
              {{ formatDateTime(row.updated_at) }}
            </td>
            <td class="px-2 py-3 text-right">
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="`Xóa phân tích ${row.symbol}`"
                @click.stop="confirmDelete(row.symbol)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="showDeleteModal" title="Xóa phân tích">
      <template #body>
        <p class="text-gray-700 dark:text-gray-300">
          Xóa giả định, kịch bản P/E, kế hoạch giao dịch và ghi chú của
          <strong>{{ stockToDelete }}</strong>? Số liệu tài chính đã crawl vẫn được giữ.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="() => { showDeleteModal = false }">Hủy</UButton>
          <UButton icon="i-lucide-trash-2" color="error" @click="handleDelete">Xóa</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
