<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { GChart } from "vue-google-charts";

// Props
const props = defineProps<{
  quarterlyData: Record<string, any>;
  annualData: Record<string, any>;
  stockType?: "industrial" | "bank" | "securities";
}>();

// Loading state
const loadingStore = useLoadingStore();
const isChartReady = ref(false);

onMounted(() => {
  loadingStore.show("Đang tải biểu đồ...");
  // Simulate brief loading for smooth transition
  setTimeout(() => {
    isChartReady.value = true;
    loadingStore.hide();
  }, 300);
});

// Get revenue key based on stock type
const getRevenueKey = () => {
  if (props.stockType === "bank") return "netInterestIncome";
  return "netRevenue";
};

// Extract quarterly data and calculate YoY growth
const extractQuarterlyChartData = (metricKey: string) => {
  const data = props.quarterlyData[metricKey];
  if (!data) return [];

  const result: { label: string; value: number; yoyGrowth: number | null }[] =
    [];
  const years = Object.keys(data).sort();

  years.forEach((year) => {
    const quarters = data[year];
    if (!quarters) return;

    ["Q1", "Q2", "Q3", "Q4"].forEach((q) => {
      const value = quarters[q];
      if (value === null || value === undefined) return;

      const prevYear = (parseInt(year) - 1).toString();
      const prevValue = data[prevYear]?.[q];
      const yoyGrowth =
        prevValue && prevValue !== 0
          ? ((value - prevValue) / Math.abs(prevValue)) * 100
          : null;

      result.push({
        label: `${q}/${year.slice(-2)}`,
        value: value,
        yoyGrowth: yoyGrowth,
      });
    });
  });

  return result.slice(-12);
};

// Extract annual data and calculate YoY growth
const extractAnnualChartData = (metricKey: string) => {
  const data = props.annualData[metricKey];
  if (!data) return [];

  const result: { label: string; value: number; yoyGrowth: number | null }[] =
    [];
  const years = Object.keys(data).sort();

  years.forEach((year) => {
    const value = data[year];
    if (value === null || value === undefined) return;

    const prevYear = (parseInt(year) - 1).toString();
    const prevValue = data[prevYear];
    const yoyGrowth =
      prevValue && prevValue !== 0
        ? ((value - prevValue) / Math.abs(prevValue)) * 100
        : null;

    result.push({
      label: year,
      value: value,
      yoyGrowth: yoyGrowth,
    });
  });

  return result.slice(-8);
};

// Quarterly Revenue Chart Data
const quarterlyRevenueChartData = computed(() => {
  const chartData = extractQuarterlyChartData(getRevenueKey());
  if (chartData.length === 0) return [["Quý", "Doanh thu", "Tăng trưởng (%)"]];

  const header = ["Quý", "Doanh thu (tỷ)", "Tăng trưởng YoY (%)"];
  const rows = chartData.map((item) => [
    item.label,
    item.value / 1000,
    item.yoyGrowth ?? 0,
  ]);
  return [header, ...rows];
});

// Quarterly Profit Chart Data
const quarterlyProfitChartData = computed(() => {
  const chartData = extractQuarterlyChartData("netProfit");
  if (chartData.length === 0) return [["Quý", "LNST", "Tăng trưởng (%)"]];

  const header = ["Quý", "LNST (tỷ)", "Tăng trưởng YoY (%)"];
  const rows = chartData.map((item) => [
    item.label,
    item.value / 1000,
    item.yoyGrowth ?? 0,
  ]);
  return [header, ...rows];
});

// Annual Revenue Chart Data
const annualRevenueChartData = computed(() => {
  const chartData = extractAnnualChartData(getRevenueKey());
  if (chartData.length === 0) return [["Năm", "Doanh thu", "Tăng trưởng (%)"]];

  const header = ["Năm", "Doanh thu (tỷ)", "Tăng trưởng YoY (%)"];
  const rows = chartData.map((item) => [
    item.label,
    item.value / 1000,
    item.yoyGrowth ?? 0,
  ]);
  return [header, ...rows];
});

// Annual Profit Chart Data
const annualProfitChartData = computed(() => {
  const chartData = extractAnnualChartData("netProfit");
  if (chartData.length === 0) return [["Năm", "LNST", "Tăng trưởng (%)"]];

  const header = ["Năm", "LNST (tỷ)", "Tăng trưởng YoY (%)"];
  const rows = chartData.map((item) => [
    item.label,
    item.value / 1000,
    item.yoyGrowth ?? 0,
  ]);
  return [header, ...rows];
});

// Chart options
const quarterlyRevenueOptions = {
  title: "Doanh thu theo quý",
  titleTextStyle: { fontSize: 16, bold: true },
  vAxes: {
    0: { title: "Tỷ VND", format: "#,##0" },
    1: { title: "Tăng trưởng YoY (%)", format: "0'%'" },
  },
  hAxis: { title: "Quý" },
  seriesType: "bars",
  series: {
    0: { targetAxisIndex: 0, color: "#4285F4" },
    1: { targetAxisIndex: 1, type: "line", color: "#EA4335", lineWidth: 3 },
  },
  legend: { position: "top" },
  chartArea: { width: "80%", height: "65%" },
  animation: { startup: true, duration: 500 },
};

const quarterlyProfitOptions = {
  title: "LNST theo quý",
  titleTextStyle: { fontSize: 16, bold: true },
  vAxes: {
    0: { title: "Tỷ VND", format: "#,##0" },
    1: { title: "Tăng trưởng YoY (%)", format: "0'%'" },
  },
  hAxis: { title: "Quý" },
  seriesType: "bars",
  series: {
    0: { targetAxisIndex: 0, color: "#34A853" },
    1: { targetAxisIndex: 1, type: "line", color: "#FBBC04", lineWidth: 3 },
  },
  legend: { position: "top" },
  chartArea: { width: "80%", height: "65%" },
  animation: { startup: true, duration: 500 },
};

const annualRevenueOptions = {
  title: "Doanh thu theo năm",
  titleTextStyle: { fontSize: 16, bold: true },
  vAxes: {
    0: { title: "Tỷ VND", format: "#,##0" },
    1: { title: "Tăng trưởng YoY (%)", format: "0'%'" },
  },
  hAxis: { title: "Năm" },
  seriesType: "bars",
  series: {
    0: { targetAxisIndex: 0, color: "#673AB7" },
    1: { targetAxisIndex: 1, type: "line", color: "#FF5722", lineWidth: 3 },
  },
  legend: { position: "top" },
  chartArea: { width: "80%", height: "65%" },
  animation: { startup: true, duration: 500 },
};

const annualProfitOptions = {
  title: "LNST theo năm",
  titleTextStyle: { fontSize: 16, bold: true },
  vAxes: {
    0: { title: "Tỷ VND", format: "#,##0" },
    1: { title: "Tăng trưởng YoY (%)", format: "0'%'" },
  },
  hAxis: { title: "Năm" },
  seriesType: "bars",
  series: {
    0: { targetAxisIndex: 0, color: "#009688" },
    1: { targetAxisIndex: 1, type: "line", color: "#E91E63", lineWidth: 3 },
  },
  legend: { position: "top" },
  chartArea: { width: "80%", height: "65%" },
  animation: { startup: true, duration: 500 },
};

const hasData = computed(() => {
  return (
    quarterlyRevenueChartData.value.length > 1 ||
    quarterlyProfitChartData.value.length > 1 ||
    annualRevenueChartData.value.length > 1 ||
    annualProfitChartData.value.length > 1
  );
});
</script>

<template>
  <div class="chart-view p-4">
    <!-- Loading skeleton -->
    <div v-if="!isChartReady" class="space-y-6">
      <div class="animate-pulse">
        <div class="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="h-80 bg-gray-200 rounded"></div>
          <div class="h-80 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>

    <div v-else-if="hasData" class="space-y-8">
      <!-- Annual Charts -->
      <div>
        <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">
          📈 Biểu đồ theo Năm
        </h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            class="chart-wrapper bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
          >
            <GChart
              type="ComboChart"
              :data="annualRevenueChartData"
              :options="annualRevenueOptions"
              style="height: 350px; width: 100%"
            />
          </div>
          <div
            class="chart-wrapper bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
          >
            <GChart
              type="ComboChart"
              :data="annualProfitChartData"
              :options="annualProfitOptions"
              style="height: 350px; width: 100%"
            />
          </div>
        </div>
      </div>

      <!-- Quarterly Charts -->
      <div>
        <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">
          📊 Biểu đồ theo Quý
        </h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            class="chart-wrapper bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
          >
            <GChart
              type="ComboChart"
              :data="quarterlyRevenueChartData"
              :options="quarterlyRevenueOptions"
              style="height: 350px; width: 100%"
            />
          </div>
          <div
            class="chart-wrapper bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
          >
            <GChart
              type="ComboChart"
              :data="quarterlyProfitChartData"
              :options="quarterlyProfitOptions"
              style="height: 350px; width: 100%"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-data text-center py-12 text-gray-500">
      <UIcon
        name="i-lucide-bar-chart-2"
        class="w-12 h-12 mx-auto mb-4 opacity-50"
      />
      <p>Chưa có dữ liệu để hiển thị biểu đồ</p>
      <p class="text-sm mt-2">Vui lòng crawl dữ liệu trước</p>
    </div>
  </div>
</template>

<style scoped>
.chart-view {
  min-height: 450px;
}

.chart-wrapper {
  min-height: 380px;
}
</style>
