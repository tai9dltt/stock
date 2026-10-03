<script setup lang="ts">
import type { StockType } from '~/spreadsheet/types';
import type { StockSummaryFigures } from '~/utils/stockSummary';
import { formatDate, formatNumber, formatPercent, formatVndCompact } from '~/utils/format';

const props = defineProps<{
  symbol: string;
  stockType: StockType;
  figures: StockSummaryFigures;
  priceDate: string;
  loading?: boolean;
}>();

const TYPE_LABEL: Record<StockType, string> = {
  industrial: 'Doanh nghiệp',
  bank: 'Ngân hàng',
  securities: 'Chứng khoán',
};

const metrics = computed(() => {
  const f = props.figures;
  const quarter = f.latestQuarter ? ` (${f.latestQuarter})` : '';
  return [
    { label: 'Vốn hóa', value: formatVndCompact(f.marketCap) },
    { label: 'P/E 4 quý', value: formatNumber(f.pe, 2), hint: `Giá ÷ EPS 4 quý${quarter}` },
    { label: 'P/B', value: formatNumber(f.pb, 2), hint: `Giá ÷ giá trị sổ sách/CP${quarter}` },
    { label: 'EPS 4 quý', value: formatNumber(f.epsTtm), hint: `Vietstock${quarter}` },
    {
      label: 'Biên độ 52 tuần',
      value: f.min52W && f.max52W ? `${formatNumber(f.min52W)} – ${formatNumber(f.max52W)}` : '–',
    },
  ];
});
</script>

<template>
  <section
    class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 md:px-5 pt-4 md:pt-5"
    :class="{ 'pb-4 md:pb-5': !$slots.tabs }"
    aria-label="Tóm tắt cổ phiếu"
  >
    <div class="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
      <!-- Symbol and price -->
      <div class="flex items-end justify-between lg:justify-start gap-6 shrink-0">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ symbol }}</h1>
            <UBadge color="neutral" variant="subtle" size="sm">{{ TYPE_LABEL[stockType] }}</UBadge>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Giá ngày {{ formatDate(priceDate) }}
          </p>
        </div>
        <div class="text-right lg:text-left">
          <div class="text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
            <span v-if="loading" class="inline-block w-28 h-8 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <template v-else>{{ formatNumber(figures.price) }}</template>
          </div>
        </div>
      </div>

      <!-- Key metrics -->
      <dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-x-6 gap-y-3 flex-1 lg:border-l lg:pl-8 border-gray-200 dark:border-gray-800">
        <div v-for="m in metrics" :key="m.label" :title="m.hint">
          <dt class="text-xs text-gray-500 dark:text-gray-400">{{ m.label }}</dt>
          <dd class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">{{ m.value }}</dd>
        </div>

        <div title="Giá mục tiêu trong kế hoạch giao dịch, so với giá hiện tại">
          <dt class="text-xs text-gray-500 dark:text-gray-400">Mục tiêu</dt>
          <dd class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
            {{ formatNumber(figures.targetPrice) }}
            <span
              v-if="figures.upside !== null"
              class="ml-1 text-xs font-medium"
              :class="figures.upside >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >{{ formatPercent(figures.upside, 1, true) }}</span>
          </dd>
        </div>
        <div title="Giá cắt lỗ trong kế hoạch giao dịch, so với giá hiện tại">
          <dt class="text-xs text-gray-500 dark:text-gray-400">Cắt lỗ</dt>
          <dd class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
            {{ formatNumber(figures.stopLoss) }}
            <span v-if="figures.downside !== null" class="ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ formatPercent(figures.downside, 1, true) }}
            </span>
          </dd>
        </div>
      </dl>
    </div>

    <!-- Page tabs, attached to the bottom edge of the card -->
    <div v-if="$slots.tabs" class="mt-3 -mb-px border-t border-gray-100 dark:border-gray-800">
      <slot name="tabs" />
    </div>
  </section>
</template>
