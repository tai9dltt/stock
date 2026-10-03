<script setup lang="ts">
import { computed, reactive } from "vue";
import { GChart } from "vue-google-charts";
import { GOOGLE_CHARTS_SETTINGS } from "~/utils/googleCharts";
import {
  annualFigures,
  marginSeries,
  profitGrowthBreakdown,
  quarterlyFigures,
  type GrowthBreakdown,
  type MarginPoint,
} from "~/utils/marginAnalysis";

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

// ─── Margins and what drives profit growth ──────────────────────────

// Validated categorical slots (dataviz reference palette); each entity keeps its colour
const COLOR = {
  grossMargin: "#2a78d6",
  netMargin: "#eb6834",
  revenueEffect: "#2a78d6",
  marginEffect: "#eb6834",
  total: "#52514e",
};
const AXIS = {
  gridlines: { color: "#e1e0d9" },
  baselineColor: "#c3c2b7",
  textStyle: { color: "#898781" },
};
const TITLE_STYLE = { fontSize: 16, bold: true, color: "#0b0b0b" };

/** Percent cell: plotted as a number, shown formatted in tooltips and tables */
const pct = (value: number | null, signed = false) =>
  value === null
    ? null
    : { v: value * 100, f: `${signed && value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%` };

const isBank = computed(() => props.stockType === "bank");

const quarterly = computed(() => quarterlyFigures(props.quarterlyData, getRevenueKey()));
const annual = computed(() => annualFigures(props.annualData, getRevenueKey()));

function marginChartData(points: MarginPoint[]) {
  // Banks have no gross profit, so only the net margin line
  if (isBank.value) {
    return [["Kỳ", "Biên LN ròng"], ...points.map((p) => [p.label, pct(p.netMargin)])];
  }
  return [
    ["Kỳ", "Biên LN gộp", "Biên LN ròng"],
    ...points.map((p) => [p.label, pct(p.grossMargin), pct(p.netMargin)]),
  ];
}

function marginOptions(title: string) {
  return {
    title,
    titleTextStyle: TITLE_STYLE,
    colors: isBank.value ? [COLOR.netMargin] : [COLOR.grossMargin, COLOR.netMargin],
    lineWidth: 2,
    pointSize: 8,
    interpolateNulls: false,
    vAxis: { ...AXIS, format: "#,##0'%'" },
    hAxis: { textStyle: AXIS.textStyle },
    // One series is named by the title; two get a legend
    legend: isBank.value ? { position: "none" } : { position: "top" },
    chartArea: { width: "85%", height: "68%" },
  };
}

function breakdownChartData(rows: GrowthBreakdown[]) {
  return [
    ["Kỳ", isBank.value ? "Do thu nhập lãi" : "Do doanh thu", "Do biên LN", "Tăng trưởng LNST"],
    ...rows.map((r) => [
      r.label,
      pct(r.revenueGrowth, true),
      pct(r.marginEffect, true),
      pct(r.profitGrowth, true),
    ]),
  ];
}

function breakdownOptions(title: string) {
  return {
    title,
    titleTextStyle: TITLE_STYLE,
    seriesType: "bars",
    isStacked: true,
    series: {
      0: { color: COLOR.revenueEffect },
      1: { color: COLOR.marginEffect },
      2: { type: "line", color: COLOR.total, lineWidth: 2, pointSize: 8 },
    },
    bar: { groupWidth: "55%" },
    vAxis: { ...AXIS, format: "#,##0'%'" },
    hAxis: { textStyle: AXIS.textStyle },
    legend: { position: "top" },
    chartArea: { width: "85%", height: "68%" },
  };
}

const marginSections = computed(() => {
  const quarterlyBreakdown = profitGrowthBreakdown(quarterly.value).slice(-12);
  const annualBreakdown = profitGrowthBreakdown(annual.value).slice(-8);
  const revenueLabel = isBank.value ? "thu nhập lãi" : "doanh thu";

  return [
    {
      title: "📉 Biên lợi nhuận",
      note: isBank.value ? "Biên LN ròng = LNST ÷ thu nhập lãi thuần" : "",
      charts: [
        {
          id: "annual-margin",
          type: "LineChart" as const,
          data: marginChartData(marginSeries(annual.value).slice(-8)),
          options: marginOptions(isBank.value ? "Biên LN ròng theo năm" : "Biên lợi nhuận theo năm"),
        },
        {
          id: "quarterly-margin",
          type: "LineChart" as const,
          data: marginChartData(marginSeries(quarterly.value).slice(-12)),
          options: marginOptions(isBank.value ? "Biên LN ròng theo quý" : "Biên lợi nhuận theo quý"),
        },
      ],
    },
    {
      title: "🧩 Tăng trưởng LNST đến từ đâu",
      note:
        `Tăng trưởng LNST = phần do ${revenueLabel} tăng (giữ nguyên biên LN năm trước) ` +
        "+ phần do biên LN thay đổi. Quý so với cùng quý năm trước; bỏ qua kỳ có LNST năm trước ≤ 0.",
      charts: [
        {
          id: "annual-breakdown",
          type: "ComboChart" as const,
          data: breakdownChartData(annualBreakdown),
          options: breakdownOptions("Theo năm"),
        },
        {
          id: "quarterly-breakdown",
          type: "ComboChart" as const,
          data: breakdownChartData(quarterlyBreakdown),
          options: breakdownOptions("Theo quý (so với cùng kỳ)"),
        },
      ],
    },
  ];
});

/** Rows of a chart's data as text, for the table view */
const asTable = (data: unknown[][]) =>
  data.map((row) => row.map((cell) => (cell === null ? "–" : typeof cell === "object" ? (cell as { f: string }).f : String(cell))));

const sections = computed(() => [
  {
    title: "📈 Biểu đồ theo Năm",
    charts: [
      { id: "annual-revenue", type: "ComboChart" as const, data: annualRevenueChartData.value, options: annualRevenueOptions },
      { id: "annual-profit", type: "ComboChart" as const, data: annualProfitChartData.value, options: annualProfitOptions },
    ],
  },
  {
    title: "📊 Biểu đồ theo Quý",
    charts: [
      { id: "quarterly-revenue", type: "ComboChart" as const, data: quarterlyRevenueChartData.value, options: quarterlyRevenueOptions },
      { id: "quarterly-profit", type: "ComboChart" as const, data: quarterlyProfitChartData.value, options: quarterlyProfitOptions },
    ],
  },
  ...marginSections.value,
]);
</script>

<template>
  <div class="chart-view p-4">
    <div v-if="hasData" class="space-y-8">
      <div v-for="section in sections" :key="section.title">
        <h3 class="text-lg font-semibold mb-1 text-gray-700 dark:text-gray-300">
          {{ section.title }}
        </h3>
        <p v-if="'note' in section && section.note" class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {{ section.note }}
        </p>
        <div v-else class="mb-3" />
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            v-for="chart in section.charts"
            :key="chart.id"
            class="chart-wrapper bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
          >
            <div v-if="!drawn.has(chart.id)" class="chart-placeholder animate-pulse" />
            <GChart
              :type="chart.type"
              :data="chart.data"
              :options="chart.options"
              :settings="GOOGLE_CHARTS_SETTINGS"
              style="height: 350px; width: 100%"
              :events="whenDrawn(chart.id)"
            />
            <details v-if="chart.id.endsWith('margin') || chart.id.endsWith('breakdown')" class="mt-2 text-sm">
              <summary class="cursor-pointer text-gray-500 dark:text-gray-400">Xem số liệu</summary>
              <table class="data-table mt-2 w-full">
                <thead>
                  <tr>
                    <th v-for="(cell, i) in asTable(chart.data)[0]" :key="i">{{ cell }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, r) in asTable(chart.data).slice(1)" :key="r">
                    <td v-for="(cell, i) in row" :key="i">{{ cell }}</td>
                  </tr>
                </tbody>
              </table>
            </details>
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
.data-table th,
.data-table td {
  padding: 2px 8px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid rgb(229 231 235);
}

.data-table th:first-child,
.data-table td:first-child {
  text-align: left;
}

.chart-placeholder {
  position: absolute;
  inset: 1rem;
  border-radius: 0.5rem;
  background: rgb(229 231 235);
}
</style>
