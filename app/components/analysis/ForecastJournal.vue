<script setup lang="ts">
import type { StockType } from '~/spreadsheet/types';
import type { ForecastSnapshot } from '~/types';
import { deleteForecastSnapshot, getForecastJournal } from '~/services';
import { compareSnapshot, forecastBias } from '~/utils/forecastJournal';
import { formatNumber, formatPercent } from '~/utils/format';

const props = defineProps<{
  symbol: string;
  stockType: StockType;
  /** Reported figures, to compare with */
  quarterlyData: Record<string, any>;
  /** Changes after each save, to reload the journal */
  reloadKey: number;
}>();

const toast = useToast();
const snapshots = ref<ForecastSnapshot[]>([]);
const selectedId = ref<number | null>(null);
const isLoading = ref(false);

// Banks report net interest income instead of revenue
const revenueIndicator = computed(() => (props.stockType === 'bank' ? 'netInterestIncome' : 'netRevenue'));
const revenueLabel = computed(() => (props.stockType === 'bank' ? 'TN lãi thuần' : 'Doanh thu'));

const load = async () => {
  if (!props.symbol) return;
  isLoading.value = true;
  try {
    const response = await getForecastJournal(props.symbol);
    snapshots.value = response.data;
    if (!snapshots.value.some(s => s.id === selectedId.value)) selectedId.value = snapshots.value[0]?.id ?? null;
  } catch {
    toast.add({ title: 'Lỗi', description: 'Không tải được nhật ký dự phóng', color: 'error' });
  } finally {
    isLoading.value = false;
  }
};

watch(() => [props.symbol, props.reloadKey], load, { immediate: true });

const selected = computed(() => snapshots.value.find(s => s.id === selectedId.value) ?? null);
const rows = computed(() =>
  selected.value ? compareSnapshot(selected.value, props.quarterlyData, revenueIndicator.value) : []);
const bias = computed(() => forecastBias(snapshots.value, props.quarterlyData, revenueIndicator.value));

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Within ±10%: accurate; above: too optimistic; below: too pessimistic */
const errorClass = (error: number | null) => {
  if (error === null) return 'text-gray-400';
  if (Math.abs(error) < 0.1) return 'text-green-700 dark:text-green-400';
  return error > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400';
};

const biasText = (error: number | null) => {
  if (error === null) return '–';
  if (Math.abs(error) < 0.1) return `sát thực tế (${formatPercent(error, 1, true)})`;
  return error > 0 ? `cao hơn thực tế ${formatPercent(error, 1)}` : `thấp hơn thực tế ${formatPercent(-error, 1)}`;
};

const remove = async (snapshot: ForecastSnapshot) => {
  try {
    await deleteForecastSnapshot(snapshot.id);
    snapshots.value = snapshots.value.filter(s => s.id !== snapshot.id);
    if (selectedId.value === snapshot.id) selectedId.value = snapshots.value[0]?.id ?? null;
  } catch {
    toast.add({ title: 'Lỗi', description: 'Không xoá được mục nhật ký', color: 'error' });
  }
};
</script>

<template>
  <section aria-label="Nhật ký dự phóng" class="space-y-4">
    <div>
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">Nhật ký dự phóng</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Mỗi lần Lưu ghi lại doanh thu và LNST của các quý (F). Khi có báo cáo thật, so sánh để biết mình dự phóng lạc quan hay bi quan.
      </p>
    </div>

    <!-- Overall bias -->
    <div
      v-if="bias.quarters > 0"
      class="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3"
    >
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">Quý đã có báo cáo để so</div>
        <div class="text-sm font-semibold tabular-nums">{{ bias.quarters }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">LNST dự phóng trung bình</div>
        <div class="text-sm font-semibold" :class="errorClass(bias.netProfit)">{{ biasText(bias.netProfit) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ revenueLabel }} dự phóng trung bình</div>
        <div class="text-sm font-semibold" :class="errorClass(bias.revenue)">{{ biasText(bias.revenue) }}</div>
      </div>
    </div>

    <div v-if="isLoading && snapshots.length === 0" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-12 rounded-lg bg-gray-200/70 dark:bg-gray-800 animate-pulse" />
    </div>

    <div
      v-else-if="snapshots.length === 0"
      class="py-10 text-center text-sm text-gray-500 dark:text-gray-400 rounded-lg border border-dashed border-gray-300 dark:border-gray-700"
    >
      Chưa có lần lưu nào. Bấm <strong>Lưu</strong> để ghi lại dự phóng hiện tại.
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <!-- Saves, newest first -->
      <ul class="space-y-1.5 lg:max-h-[520px] lg:overflow-y-auto" aria-label="Các lần lưu">
        <li v-for="s in snapshots" :key="s.id">
          <div
            class="group flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors"
            :class="s.id === selectedId
              ? 'border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/40'
              : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50'"
            role="button"
            tabindex="0"
            :aria-pressed="s.id === selectedId"
            @click="selectedId = s.id"
            @keydown.enter="selectedId = s.id"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{ formatDateTime(s.createdAt) }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 tabular-nums mt-0.5">
                DT {{ formatPercent(s.assumptions.revenueGrowth, 0, true) }}
                · Biên {{ formatPercent(s.assumptions.grossMargin, 0) }}
                · LNST {{ formatPercent(s.assumptions.netProfitGrowth, 0, true) }}
                <template v-if="s.assumptions.targetPrice"> · Mục tiêu {{ formatNumber(s.assumptions.targetPrice) }}</template>
              </div>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              class="opacity-60 group-hover:opacity-100"
              :aria-label="`Xoá lần lưu ${formatDateTime(s.createdAt)}`"
              @click.stop="remove(s)"
            />
          </div>
        </li>
      </ul>

      <!-- Forecast vs reported, per quarter -->
      <div v-if="selected" class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table class="w-full text-sm tabular-nums">
          <thead class="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500 dark:text-gray-400">
            <tr>
              <th rowspan="2" class="px-3 py-2 text-left font-medium">Quý</th>
              <th colspan="3" class="px-3 pt-2 text-center font-medium border-l border-gray-200 dark:border-gray-700">{{ revenueLabel }} (tr. đồng)</th>
              <th colspan="3" class="px-3 pt-2 text-center font-medium border-l border-gray-200 dark:border-gray-700">LNST (tr. đồng)</th>
            </tr>
            <tr>
              <th class="px-3 pb-2 text-right font-normal border-l border-gray-200 dark:border-gray-700">Dự phóng</th>
              <th class="px-3 pb-2 text-right font-normal">Thực tế</th>
              <th class="px-3 pb-2 text-right font-normal">Sai lệch</th>
              <th class="px-3 pb-2 text-right font-normal border-l border-gray-200 dark:border-gray-700">Dự phóng</th>
              <th class="px-3 pb-2 text-right font-normal">Thực tế</th>
              <th class="px-3 pb-2 text-right font-normal">Sai lệch</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="r in rows" :key="r.period">
              <td class="px-3 py-2 font-medium">{{ r.label }}</td>
              <td class="px-3 py-2 text-right border-l border-gray-100 dark:border-gray-800">{{ formatNumber(r.revenue.forecast) }}</td>
              <td class="px-3 py-2 text-right">{{ r.revenue.actual === null ? 'Chưa có' : formatNumber(r.revenue.actual) }}</td>
              <td class="px-3 py-2 text-right" :class="errorClass(r.revenue.error)">{{ formatPercent(r.revenue.error, 1, true) }}</td>
              <td class="px-3 py-2 text-right border-l border-gray-100 dark:border-gray-800">{{ formatNumber(r.netProfit.forecast) }}</td>
              <td class="px-3 py-2 text-right">{{ r.netProfit.actual === null ? 'Chưa có' : formatNumber(r.netProfit.actual) }}</td>
              <td class="px-3 py-2 text-right" :class="errorClass(r.netProfit.error)">{{ formatPercent(r.netProfit.error, 1, true) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
          Sai lệch = (dự phóng − thực tế) ÷ thực tế. Xanh: trong ±10%; đỏ: dự phóng cao hơn; vàng: dự phóng thấp hơn.
        </p>
      </div>
    </div>
  </section>
</template>
