<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';
import type {
  ColDef,
  ValueSetterParams,
  CellClassParams,
  ColGroupDef,
} from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

// Register all community modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Types
interface QuarterData {
  [key: string]: number | null;
}

interface FinancialRow {
  indicator: string;
  indicatorKey: string;
  isCalculated: boolean;
  [key: string]: string | number | null | boolean; // Dynamic quarter columns
}

interface QuarterlyAnalysisData {
  years: string[];
  quarters: Record<string, Record<string, QuarterData>>;
  forecastStartYear: string;
  forecastStartQuarter: string;
  outstandingShares: number | null;
  currentPrice: number | null;
}

// Props and emits
const props = defineProps<{
  quarterlyData?: QuarterlyAnalysisData;
  outstandingShares?: number;
  currentPrice?: number;
}>();

const emit = defineEmits<{
  (e: 'update:data', value: QuarterlyAnalysisData): void;
}>();

// Color mode for AG Grid theme
const colorMode = useColorMode();

// Financial indicators configuration
const indicators = [
  {
    key: 'revenue',
    name: 'Thu nhập lãi thuần',
    unit: 'triệu',
    editable: true,
    calculated: false,
  },
  {
    key: 'netProfit',
    name: 'LNST công ty mẹ',
    unit: 'triệu',
    editable: true,
    calculated: false,
  },
  {
    key: 'outstandingShares',
    name: 'KL CP lưu hành',
    unit: 'CP',
    editable: false,
    calculated: false,
  },
  {
    key: 'netProfitMargin',
    name: 'Biên LN ròng',
    unit: '%',
    editable: false,
    calculated: true,
  },
  {
    key: 'quarterlyEPS',
    name: 'EPS quý',
    unit: 'đồng',
    editable: false,
    calculated: true,
  },
  {
    key: 'cumulativeEPS',
    name: 'EPS lũy kế',
    unit: 'đồng',
    editable: false,
    calculated: true,
  },
  { key: 'pe', name: 'P/E', unit: '', editable: false, calculated: true },
  {
    key: 'revenueGrowth',
    name: 'TT Doanh thu',
    unit: '%',
    editable: false,
    calculated: true,
  },
  {
    key: 'profitGrowth',
    name: 'TT LNST',
    unit: '%',
    editable: false,
    calculated: true,
  },
];

// Quarters constant
const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

// Reactive data - years extracted dynamically from props
const years = ref<string[]>(props.quarterlyData?.years || []);
const outstandingShares = ref<number>(props.outstandingShares || 2666873613);
const currentPrice = ref<number>(props.currentPrice || 14000);

// Compute forecast start based on current year
const currentYear = new Date().getFullYear();
const forecastStartYear = ref<string>(
  props.quarterlyData?.forecastStartYear || String(currentYear),
);
const forecastStartQuarter = ref<string>(
  props.quarterlyData?.forecastStartQuarter || 'Q1',
);

// Grid data
const rowData = ref<FinancialRow[]>([]);

// Helper: Check if a quarter is forecast
const isForecast = (year: string, quarter: string): boolean => {
  const yearNum = parseInt(year);
  const forecastYearNum = parseInt(forecastStartYear.value);

  if (yearNum > forecastYearNum) return true;
  if (yearNum < forecastYearNum) return false;

  // Same year, check quarter
  const quarterIndex = quarters.indexOf(quarter);
  const forecastQuarterIndex = quarters.indexOf(forecastStartQuarter.value);
  return quarterIndex >= forecastQuarterIndex;
};

// Helper: Get quarter key
const getQuarterKey = (year: string, quarter: string): string => {
  return `${year}_${quarter}`;
};

// Helper: Get previous quarter key
const getPreviousQuarterKey = (
  year: string,
  quarter: string,
): string | null => {
  const quarterIndex = quarters.indexOf(quarter);
  if (quarterIndex > 0) {
    const prevQuarter = quarters[quarterIndex - 1];
    if (!prevQuarter) return null;
    return getQuarterKey(year, prevQuarter);
  }

  // Previous year Q4
  const yearIndex = years.value.indexOf(year);
  if (yearIndex > 0) {
    const prevYear = years.value[yearIndex - 1];
    if (!prevYear) return null;
    return getQuarterKey(prevYear, 'Q4');
  }

  return null;
};

// Calculate net profit margin
const calculateNetProfitMargin = (
  revenue: number | null,
  netProfit: number | null,
): number | null => {
  if (!revenue || !netProfit || revenue === 0) return null;
  return (netProfit / revenue) * 100;
};

// Calculate quarterly EPS
const calculateQuarterlyEPS = (netProfit: number | null): number | null => {
  if (!netProfit || !outstandingShares.value) return null;
  return (netProfit * 1000000000) / outstandingShares.value; // Convert to đồng
};

// Calculate cumulative EPS for a year
const calculateCumulativeEPS = (
  year: string,
  quarter: string,
): number | null => {
  let sum = 0;
  let hasData = false;

  for (const q of quarters) {
    const quarterKey = getQuarterKey(year, q);
    const epsRow = rowData.value.find((r) => r.indicatorKey === 'quarterlyEPS');
    const eps = epsRow?.[quarterKey] as number | null;

    if (eps !== null && eps !== undefined) {
      sum += eps;
      hasData = true;
    }

    if (q === quarter) break;
  }

  return hasData ? sum : null;
};

// Calculate P/E ratio
const calculatePE = (cumulativeEPS: number | null): number | null => {
  if (!cumulativeEPS || cumulativeEPS === 0 || !currentPrice.value) return null;
  return currentPrice.value / cumulativeEPS;
};

// Calculate growth rate
const calculateGrowth = (
  current: number | null,
  previous: number | null,
): number | null => {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

// Initialize row data
const initializeRowData = () => {
  const rows: FinancialRow[] = [];

  for (const indicator of indicators) {
    const row: FinancialRow = {
      indicator: indicator.name,
      indicatorKey: indicator.key,
      isCalculated: indicator.calculated,
    };

    // Add columns for each quarter
    for (const year of years.value) {
      for (const quarter of quarters) {
        const quarterKey = getQuarterKey(year, quarter);

        // Special handling for outstanding shares (constant across quarters)
        if (indicator.key === 'outstandingShares') {
          row[quarterKey] = outstandingShares.value;
        } else {
          // Get saved data or null
          const savedValue =
            props.quarterlyData?.quarters?.[year]?.[quarter]?.[indicator.key] ??
            null;
          row[quarterKey] = savedValue;
        }
      }
    }

    rows.push(row);
  }

  rowData.value = rows;
  recalculateAll();
};

// Recalculate all calculated fields
const recalculateAll = () => {
  for (const year of years.value) {
    for (const quarter of quarters) {
      const quarterKey = getQuarterKey(year, quarter);

      // Get base values
      const revenueRow = rowData.value.find(
        (r) => r.indicatorKey === 'revenue',
      );
      const netProfitRow = rowData.value.find(
        (r) => r.indicatorKey === 'netProfit',
      );

      const revenue = revenueRow?.[quarterKey] as number | null;
      const netProfit = netProfitRow?.[quarterKey] as number | null;

      // Calculate net profit margin
      const marginRow = rowData.value.find(
        (r) => r.indicatorKey === 'netProfitMargin',
      );
      if (marginRow) {
        marginRow[quarterKey] = calculateNetProfitMargin(revenue, netProfit);
      }

      // Calculate quarterly EPS
      const qepsRow = rowData.value.find(
        (r) => r.indicatorKey === 'quarterlyEPS',
      );
      if (qepsRow) {
        qepsRow[quarterKey] = calculateQuarterlyEPS(netProfit);
      }

      // Calculate cumulative EPS
      const cepsRow = rowData.value.find(
        (r) => r.indicatorKey === 'cumulativeEPS',
      );
      if (cepsRow) {
        cepsRow[quarterKey] = calculateCumulativeEPS(year, quarter);
      }

      // Calculate P/E
      const peRow = rowData.value.find((r) => r.indicatorKey === 'pe');
      if (peRow && cepsRow) {
        const cumulativeEPS = cepsRow[quarterKey] as number | null;
        peRow[quarterKey] = calculatePE(cumulativeEPS);
      }

      // Calculate revenue growth
      const revGrowthRow = rowData.value.find(
        (r) => r.indicatorKey === 'revenueGrowth',
      );
      if (revGrowthRow) {
        const prevKey = getPreviousQuarterKey(year, quarter);
        const prevRevenue = prevKey
          ? (revenueRow?.[prevKey] as number | null)
          : null;
        revGrowthRow[quarterKey] = calculateGrowth(revenue, prevRevenue);
      }

      // Calculate profit growth
      const profitGrowthRow = rowData.value.find(
        (r) => r.indicatorKey === 'profitGrowth',
      );
      if (profitGrowthRow) {
        const prevKey = getPreviousQuarterKey(year, quarter);
        const prevProfit = prevKey
          ? (netProfitRow?.[prevKey] as number | null)
          : null;
        profitGrowthRow[quarterKey] = calculateGrowth(netProfit, prevProfit);
      }
    }
  }

  emitData();
};

// Emit data to parent
const emitData = () => {
  const quarters: Record<string, Record<string, QuarterData>> = {};

  for (const year of years.value) {
    quarters[year] = {};
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
      const quarterData: QuarterData = {};
      const quarterKey = getQuarterKey(year, quarter);

      for (const indicator of indicators) {
        if (!indicator.calculated) {
          const row = rowData.value.find(
            (r) => r.indicatorKey === indicator.key,
          );
          if (row) {
            quarterData[indicator.key] = row[quarterKey] as number | null;
          }
        }
      }

      quarters[year][quarter] = quarterData;
    }
  }

  emit('update:data', {
    years: years.value,
    quarters,
    forecastStartYear: forecastStartYear.value,
    forecastStartQuarter: forecastStartQuarter.value,
    outstandingShares: outstandingShares.value,
    currentPrice: currentPrice.value,
  });
};

// Value setter for editable cells
const valueSetterFunction = (
  params: ValueSetterParams<FinancialRow>,
): boolean => {
  const field = params.colDef.field as string;
  const row = params.data;

  if (!row || !field) return false;

  // Check if cell is editable
  const indicator = indicators.find((ind) => ind.key === row.indicatorKey);
  if (!indicator || !indicator.editable) return false;

  const newValue =
    params.newValue === '' || params.newValue === null
      ? null
      : Number(params.newValue);
  if (newValue !== null && isNaN(newValue)) return false;

  row[field] = newValue;
  recalculateAll();

  return true;
};

// Cell class rules
const getCellClass = (params: CellClassParams): string => {
  const field = params.colDef.field;
  if (!field || field === 'indicator') return 'cell-indicator-name';

  const row = params.data as FinancialRow;
  if (!row) return '';

  // Extract year and quarter from field
  const parts = field.split('_');
  const year = parts[0];
  const quarter = parts[1];
  if (!year || !quarter) return 'cell-number';

  const forecast = isForecast(year, quarter);

  const classes: string[] = ['cell-number'];

  if (row.isCalculated) {
    classes.push('cell-calculated');
  } else {
    const indicator = indicators.find((ind) => ind.key === row.indicatorKey);
    if (indicator?.editable) {
      classes.push('cell-editable');
    }
  }

  if (forecast) {
    classes.push('cell-forecast');
  } else {
    classes.push('cell-historical');
  }

  return classes.join(' ');
};

// Number formatter
const numberFormatter = (params: { value: number | null }) => {
  if (params.value === null || params.value === undefined) return '-';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(params.value);
};

// Generate column definitions
const generateColumnDefs = (): (
  | ColDef<FinancialRow>
  | ColGroupDef<FinancialRow>
)[] => {
  const cols: (ColDef<FinancialRow> | ColGroupDef<FinancialRow>)[] = [
    {
      headerName: 'Chỉ tiêu',
      field: 'indicator',
      pinned: 'left',
      width: 180,
      cellClass: 'cell-indicator-name',
    },
  ];

  // Group by year
  for (const year of years.value) {
    const yearCols: ColDef<FinancialRow>[] = [];

    for (const quarter of quarters) {
      const quarterKey = getQuarterKey(year, quarter);
      const forecast = isForecast(year, quarter);

      yearCols.push({
        headerName: forecast ? `${quarter} (F)` : quarter,
        field: quarterKey,
        width: 100,
        editable: (params) => {
          const row = params.data as FinancialRow;
          if (!row) return false;
          const indicator = indicators.find(
            (ind) => ind.key === row.indicatorKey,
          );
          return indicator?.editable || false;
        },
        valueSetter: valueSetterFunction,
        cellClass: getCellClass,
        valueFormatter: numberFormatter,
      });
    }

    cols.push({
      headerName: year,
      children: yearCols,
      marryChildren: true,
    });
  }

  return cols;
};

const columnDefs =
  ref<(ColDef<FinancialRow> | ColGroupDef<FinancialRow>)[]>(
    generateColumnDefs(),
  );

// Default column definitions
const defaultColDef = ref<ColDef>({
  sortable: false,
  filter: false,
  resizable: true,
});

// Watch for prop changes
watch(
  () => props.quarterlyData,
  (newData) => {
    if (newData?.years && newData.years.length > 0) {
      years.value = newData.years;
      // Regenerate columns when years change
      columnDefs.value = generateColumnDefs();
    }
    initializeRowData();
  },
  { deep: true, immediate: true },
);

watch(
  () => props.outstandingShares,
  (val) => {
    if (val) {
      outstandingShares.value = val;
      recalculateAll();
    }
  },
);

watch(
  () => props.currentPrice,
  (val) => {
    if (val) {
      currentPrice.value = val;
      recalculateAll();
    }
  },
);

// Initialize on mount
onMounted(() => {
  initializeRowData();
});

// Computed theme class
const gridTheme = computed(() =>
  colorMode.value === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz',
);
</script>

<template>
  <div class="stock-grid-container">
    <!-- Configuration Panel -->
    <div class="grid-header">
      <div class="config-row">
        <div class="config-item">
          <label for="outstanding-shares">KL CP lưu hành:</label>
          <UInput
            id="outstanding-shares"
            v-model.number="outstandingShares"
            type="number"
            size="sm"
            class="w-32"
            @update:model-value="recalculateAll"
          />
        </div>
        <div class="config-item">
          <label for="current-price">Giá CP hiện tại:</label>
          <UInput
            id="current-price"
            v-model.number="currentPrice"
            type="number"
            size="sm"
            class="w-24"
            @update:model-value="recalculateAll"
          />
          <span class="unit">đồng</span>
        </div>
      </div>
    </div>

    <!-- AG Grid -->
    <div :class="gridTheme" class="grid-wrapper">
      <AgGridVue
        :row-data="rowData"
        :column-defs="columnDefs"
        :default-col-def="defaultColDef"
        dom-layout="autoHeight"
        :suppress-row-click-selection="true"
        :enable-cell-text-selection="true"
        :group-header-height="40"
      />
    </div>

    <!-- Legend -->
    <div class="grid-legend">
      <div class="legend-item">
        <span class="legend-color editable"></span>
        <span>Ô nhập liệu</span>
      </div>
      <div class="legend-item">
        <span class="legend-color calculated"></span>
        <span>Ô tính toán tự động</span>
      </div>
      <div class="legend-item">
        <span class="legend-color forecast"></span>
        <span>Dự phóng (F)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color historical"></span>
        <span>Lịch sử</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stock-grid-container {
  width: 100%;
}

.grid-header {
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--ui-bg-elevated);
  border-radius: 0.5rem;
}

.config-row {
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.config-item label {
  font-weight: 500;
  font-size: 0.875rem;
  white-space: nowrap;
}

.config-item .unit {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}

.grid-wrapper {
  width: 100%;
  border-radius: 0.5rem;
  overflow: hidden;
}

.grid-wrapper :deep(.cell-indicator-name) {
  font-weight: 600;
  background-color: var(--ui-bg-elevated);
}

.grid-wrapper :deep(.cell-number) {
  text-align: right;
  font-family: 'Courier New', monospace;
}

.grid-wrapper :deep(.cell-editable) {
  background-color: rgba(255, 235, 59, 0.15);
  cursor: text;
}

.grid-wrapper :deep(.cell-editable:hover) {
  background-color: rgba(255, 235, 59, 0.25);
}

.grid-wrapper :deep(.cell-calculated) {
  background-color: rgba(76, 175, 80, 0.1);
  font-style: italic;
  color: var(--ui-text-muted);
}

.grid-wrapper :deep(.cell-forecast) {
  border-left: 2px solid rgba(33, 150, 243, 0.5);
}

.grid-legend {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}

.legend-color {
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
}

.legend-color.editable {
  background-color: rgba(255, 235, 59, 0.3);
  border: 1px solid rgba(255, 235, 59, 0.5);
}

.legend-color.calculated {
  background-color: rgba(76, 175, 80, 0.3);
  border: 1px solid rgba(76, 175, 80, 0.5);
}

.legend-color.forecast {
  background: linear-gradient(
    to right,
    transparent 0%,
    transparent 40%,
    rgba(33, 150, 243, 0.5) 40%,
    rgba(33, 150, 243, 0.5) 100%
  );
  border: 1px solid rgba(33, 150, 243, 0.5);
}

.legend-color.historical {
  background-color: var(--ui-bg);
  border: 1px solid var(--ui-border);
}
</style>
