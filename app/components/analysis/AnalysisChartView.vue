<script setup lang="ts">
import { computed, reactive } from "vue";
import { GChart } from "vue-google-charts";
import { GOOGLE_CHARTS_SETTINGS } from "~/utils/googleCharts";

// Props
const props = defineProps<{
  quarterlyData: Record<string, any>;
  annualData: Record<string, any>;
  stockType?: "industrial" | "bank" | "securities";
}>();

// Charts that finished drawing (a placeholder is shown until then)
const drawn = reactive(new Set<string>());

// GChart attaches { eventName: listener } to the chart; its typings describe
// the google.visualization.events API instead, hence the cast
const whenDrawn = (id: string) =>
  ({ ready: () => drawn.add(id) }) as unknown as InstanceType<typeof GChart>["$props"]["events"];

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
};

const hasData = computed(() => {
  return (
    quarterlyRevenueChartData.value.length > 1 ||
    quarterlyProfitChartData.value.length > 1 ||
    annualRevenueChartData.value.length > 1 ||
    annualProfitChartData.value.length > 1
  );
});

const sections = computed(() => [
  {
    title: "📈 Biểu đồ theo Năm",
    charts: [
      { id: "annual-revenue", data: annualRevenueChartData.value, options: annualRevenueOptions },
      { id: "annual-profit", data: annualProfitChartData.value, options: annualProfitOptions },
    ],
  },
  {
    title: "📊 Biểu đồ theo Quý",
    charts: [
      { id: "quarterly-revenue", data: quarterlyRevenueChartData.value, options: quarterlyRevenueOptions },
      { id: "quarterly-profit", data: quarterlyProfitChartData.value, options: quarterlyProfitOptions },
    ],
  },
]);
</script>

<template>
  <div class="chart-view p-4">
    <div v-if="hasData" class="space-y-8">
      <div v-for="section in sections" :key="section.title">
        <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">
          {{ section.title }}
        </h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            v-for="chart in section.charts"
            :key="chart.id"
            class="chart-wrapper bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
          >
            <div v-if="!drawn.has(chart.id)" class="chart-placeholder animate-pulse" />
            <GChart
              type="ComboChart"
              :data="chart.data"
              :options="chart.options"
              :settings="GOOGLE_CHARTS_SETTINGS"
              style="height: 350px; width: 100%"
              :events="whenDrawn(chart.id)"
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
  position: relative;
  min-height: 380px;
}

/* Shown over the chart area until Google Charts has drawn it */
.chart-placeholder {
  position: absolute;
  inset: 1rem;
  border-radius: 0.5rem;
  background: rgb(229 231 235);
}
</style>
