<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';
import type {
  ColDef,
  ValueSetterParams,
  CellClassParams,
} from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

// Types
interface AnnualDataRow {
  indicator: string;
  indicatorKey: string;
  isCalculated: boolean;
  [key: string]: string | number | null | boolean;
}

// Props
const props = defineProps<{
  outstandingShares?: number;
  quarterlyData?: Record<string, any>; // Data from Table 2
  annualData?: Record<string, any>; // Annual data from Vietstock
}>();

const emit = defineEmits<{
  (e: 'update:data', value: Record<string, any>): void;
}>();

// Color mode
const colorMode = useColorMode();

// Indicators for annual summary
const indicators = [
  {
    key: 'netRevenue',
    name: 'Doanh thu thuần',
    editable: true,
    calculated: false,
  },
  {
    key: 'grossProfit',
    name: 'Lợi nhuận gộp',
    editable: true,
    calculated: false,
  },
  {
    key: 'operatingProfit',
    name: 'LN từ HĐKD',
    editable: true,
    calculated: false,
  },
  {
    key: 'netProfit',
    name: 'LNST công ty mẹ',
    editable: true,
    calculated: false,
  },
  {
    key: 'netProfitMargin',
    name: 'Biên LN ròng (%)',
    editable: false,
    calculated: true,
  },
  {
    key: 'grossMargin',
    name: 'Biên LN gộp (%)',
    editable: false,
    calculated: true,
  },
  { key: 'eps', name: 'EPS (Vietstock)', editable: false, calculated: false },
  { key: 'pe', name: 'P/E (Vietstock)', editable: false, calculated: false },
  { key: 'ros', name: 'ROS (%)', editable: false, calculated: false },
  { key: 'roe', name: 'ROE (%)', editable: false, calculated: false },
  { key: 'roa', name: 'ROA (%)', editable: false, calculated: false },
  {
    key: 'revenueGrowth',
    name: 'TT tăng trưởng DT',
    editable: false,
    calculated: true,
  },
  {
    key: 'profitGrowth',
    name: 'TT tăng trưởng LNST',
    editable: false,
    calculated: true,
  },
];

// Dynamic years - extracted from data
const years = ref<string[]>([]);
const historicalYears = computed(() => {
  const currentYear = new Date().getFullYear();
  return years.value.filter((y) => parseInt(y) < currentYear);
});
const forecastYears = computed(() => {
  const currentYear = new Date().getFullYear();
  return years.value.filter((y) => parseInt(y) >= currentYear);
});

// Computed dynamic title and legend ranges
const titleText = computed(() => {
  if (years.value.length === 0) return 'Table 1: Tóm tắt theo Năm';
  const minYear = years.value[0];
  const maxYear = years.value[years.value.length - 1];
  return `Table 1: Tóm tắt theo Năm (${minYear}-${maxYear})`;
});

const historicalRange = computed(() => {
  if (historicalYears.value.length === 0) return '';
  const min = historicalYears.value[0];
  const max = historicalYears.value[historicalYears.value.length - 1];
  return `Quá khứ (${min}-${max})`;
});

const forecastRange = computed(() => {
  if (forecastYears.value.length === 0) return '';
  const min = forecastYears.value[0];
  const max = forecastYears.value[forecastYears.value.length - 1];
  return `Dự phóng (${min}-${max})`;
});

// Row data
const rowData = ref<AnnualDataRow[]>([]);
const outstandingShares = ref<number>(props.outstandingShares || 2666873613);

// Flag to prevent emit loop during external populate
let isPopulating = false;

const getYearKey = (year: string) => `year${year}`;

// Initialize data
const initializeData = () => {
  rowData.value = indicators.map((ind) => {
    const row: AnnualDataRow = {
      indicator: ind.name,
      indicatorKey: ind.key,
      isCalculated: ind.calculated,
    };

    for (const year of years.value) {
      row[getYearKey(year)] = null;
    }

    return row;
  });

  recalculateAll();
};

// Update annual data from quarterly data (auto-sum quarters)
const updateFromQuarterlyData = () => {
  if (!props.quarterlyData) return;

  console.log('Updating annual from quarterly:', props.quarterlyData);
  isPopulating = true;

  // Extract years from quarterly data
  const dataYears = new Set<string>();
  for (const ind of indicators) {
    if (props.quarterlyData[ind.key]) {
      Object.keys(props.quarterlyData[ind.key]).forEach((year) =>
        dataYears.add(year),
      );
    }
  }

  if (dataYears.size > 0) {
    years.value = Array.from(dataYears).sort();
    console.log(
      'Extracted years from quarterly data:',
      JSON.stringify(years.value),
    );

    // Reinitialize grid with new years
    initializeData();

    // Regenerate column definitions
    columnDefs.value = generateColumnDefs();
    console.log(
      'Regenerated annual columns for years:',
      JSON.stringify(years.value),
    );
  }

  // Map quarterly keys to annual indicator keys
  const quarterlyToAnnualMap: Record<string, string> = {
    netRevenue: 'netRevenue',
    grossProfit: 'grossProfit',
    operatingProfit: 'operatingProfit',
    netProfit: 'netProfit',
  };

  for (const [qKey, aKey] of Object.entries(quarterlyToAnnualMap)) {
    const quarterlyDataForIndicator = props.quarterlyData[qKey];
    if (!quarterlyDataForIndicator) continue;

    const annualRow = rowData.value.find((r) => r.indicatorKey === aKey);
    if (!annualRow) continue;

    // Sum quarters for each year
    for (const year of years.value) {
      const yearData = quarterlyDataForIndicator[year];
      if (!yearData) continue;

      const yearKey = getYearKey(year);
      let yearTotal = 0;
      let hasData = false;

      for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const qValue = yearData[quarter];
        if (qValue !== null && qValue !== undefined) {
          yearTotal += Number(qValue);
          hasData = true;
        }
      }

      if (hasData) {
        (annualRow as any)[yearKey] = yearTotal;
        console.log(`Updated ${aKey} for ${year}: ${yearTotal}`);
      }
    }
  }

  recalculateAll();
  isPopulating = false;
};

// Populate from annual data (directly from Vietstock API)
const populateFromAnnualData = () => {
  if (!props.annualData) return;

  console.log('Populating from annual data:', props.annualData);
  isPopulating = true;

  // Extract years from annual data
  const dataYears = new Set<string>();
  for (const ind of indicators) {
    if (props.annualData[ind.key]) {
      Object.keys(props.annualData[ind.key]).forEach((year) =>
        dataYears.add(year),
      );
    }
  }

  if (dataYears.size > 0) {
    years.value = Array.from(dataYears).sort();
    console.log(
      'Extracted years from annual data:',
      JSON.stringify(years.value),
    );

    // Reinitialize grid with new years
    initializeData();

    // Regenerate column definitions
    columnDefs.value = generateColumnDefs();
  }

  // Populate all indicators from annual data
  for (const ind of indicators) {
    const annualDataForIndicator = props.annualData[ind.key];
    if (!annualDataForIndicator) continue;

    const row = rowData.value.find((r) => r.indicatorKey === ind.key);
    if (!row) continue;

    for (const year of years.value) {
      const yearKey = getYearKey(year);
      const value = annualDataForIndicator[year];

      if (value !== null && value !== undefined) {
        (row as any)[yearKey] = Number(value);
      }
    }
  }

  recalculateAll();
  isPopulating = false;
};

// Calculate net profit margin
const calculateMargin = (
  revenue: number | null,
  profit: number | null,
): number | null => {
  if (!revenue || !profit || revenue === 0) return null;
  return (profit / revenue) * 100;
};

// Calculate EPS
const calculateEPS = (profit: number | null): number | null => {
  if (!profit || !outstandingShares.value) return null;
  return (profit * 1000000000) / outstandingShares.value;
};

// Calculate growth
const calculateGrowth = (
  current: number | null,
  previous: number | null,
): number | null => {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

// Recalculate all calculated fields
const recalculateAll = () => {
  const revenueRow = rowData.value.find((r) => r.indicatorKey === 'netRevenue');
  const grossProfitRow = rowData.value.find(
    (r) => r.indicatorKey === 'grossProfit',
  );
  const profitRow = rowData.value.find((r) => r.indicatorKey === 'netProfit');
  const marginRow = rowData.value.find(
    (r) => r.indicatorKey === 'netProfitMargin',
  );
  const grossMarginRow = rowData.value.find(
    (r) => r.indicatorKey === 'grossMargin',
  );
  const epsRow = rowData.value.find((r) => r.indicatorKey === 'eps');
  const revGrowthRow = rowData.value.find(
    (r) => r.indicatorKey === 'revenueGrowth',
  );
  const profitGrowthRow = rowData.value.find(
    (r) => r.indicatorKey === 'profitGrowth',
  );

  for (const year of years.value) {
    const yearKey = getYearKey(year);
    const revenue = revenueRow?.[yearKey] as number | null;
    const profit = profitRow?.[yearKey] as number | null;

    // Calculate margins
    if (marginRow) {
      marginRow[yearKey] = calculateMargin(revenue, profit);
    }

    const grossProfit = grossProfitRow?.[yearKey] as number | null;
    if (grossMarginRow) {
      grossMarginRow[yearKey] = calculateMargin(revenue, grossProfit);
    }

    // Calculate EPS
    if (epsRow) {
      epsRow[yearKey] = calculateEPS(profit);
    }

    // Calculate growth
    const yearIndex = years.value.indexOf(year);
    if (yearIndex > 0) {
      const prevYear = years.value[yearIndex - 1];
      if (!prevYear) continue;
      const prevYearKey = getYearKey(prevYear);

      if (revGrowthRow && revenueRow) {
        const prevRevenue = revenueRow[prevYearKey] as number | null;
        revGrowthRow[yearKey] = calculateGrowth(revenue, prevRevenue);
      }

      if (profitGrowthRow && profitRow) {
        const prevProfit = profitRow[prevYearKey] as number | null;
        profitGrowthRow[yearKey] = calculateGrowth(profit, prevProfit);
      }
    }
  }

  emitData();
};

// Emit data
const emitData = () => {
  if (isPopulating) return;

  const data: Record<string, any> = {};
  for (const ind of indicators) {
    if (!ind.calculated) {
      data[ind.key] = {};
      for (const year of years.value) {
        const yearKey = getYearKey(year);
        const row = rowData.value.find((r) => r.indicatorKey === ind.key);
        data[ind.key][year] = row?.[yearKey] ?? null;
      }
    }
  }
  emit('update:data', data);
};

// Value setter
const valueSetter = (params: ValueSetterParams<AnnualDataRow>): boolean => {
  const field = params.colDef.field;
  const row = params.data;

  if (!row || !field) return false;

  const ind = indicators.find((i) => i.key === row.indicatorKey);
  if (!ind || !ind.editable) return false;

  const newValue =
    params.newValue === '' || params.newValue === null
      ? null
      : Number(params.newValue);
  if (newValue !== null && isNaN(newValue)) return false;

  (row as any)[field] = newValue;
  recalculateAll();

  return true;
};

// Cell class
const getCellClass = (params: CellClassParams): string => {
  const field = params.colDef.field;
  if (!field || field === 'indicator') return 'cell-indicator';

  const row = params.data as AnnualDataRow;
  if (!row) return '';

  const year = field.replace('year', '');
  const classes = ['cell-number'];

  if (historicalYears.value.includes(year)) {
    classes.push('cell-historical');
  } else if (forecastYears.value.includes(year)) {
    classes.push('cell-forecast');
  }

  if (row.isCalculated) {
    classes.push('cell-calculated');
  } else {
    const ind = indicators.find((i) => i.key === row.indicatorKey);
    if (ind?.editable) {
      classes.push('cell-editable');
    }
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

// Generate column definitions dynamically
const generateColumnDefs = (): ColDef<AnnualDataRow>[] => {
  const cols: ColDef<AnnualDataRow>[] = [
    {
      headerName: 'Chỉ tiêu',
      field: 'indicator',
      pinned: 'left',
      width: 180,
      cellClass: 'cell-indicator',
    },
  ];

  for (const year of years.value) {
    const yearKey = getYearKey(year);
    const isForecast = forecastYears.value.includes(year);

    cols.push({
      headerName: isForecast ? `${year} (F)` : year,
      field: yearKey,
      width: 110,
      editable: (p) => {
        const ind = indicators.find((i) => i.key === p.data?.indicatorKey);
        return ind?.editable || false;
      },
      valueSetter,
      cellClass: getCellClass,
      valueFormatter: numberFormatter,
    });
  }

  return cols;
};

// Column definitions
const columnDefs = ref<ColDef<AnnualDataRow>[]>(generateColumnDefs());

const defaultColDef = ref<ColDef>({
  sortable: false,
  filter: false,
  resizable: true,
});

// Watch for outstanding shares changes
watch(
  () => props.outstandingShares,
  (val) => {
    if (val) {
      outstandingShares.value = val;
      recalculateAll();
    }
  },
);

// Watch for quarterly data changes - auto-update annual totals
watch(
  () => props.quarterlyData,
  () => {
    // Only update from quarterly if no annual data available
    if (!props.annualData || Object.keys(props.annualData).length === 0) {
      updateFromQuarterlyData();
    }
  },
  { deep: true },
);

// Watch for annual data changes - use Vietstock annual data directly
watch(
  () => props.annualData,
  () => {
    populateFromAnnualData();
  },
  { deep: true, immediate: true },
);

// Initialize on mount
onMounted(() => {
  initializeData();

  // Prioritize annual data, fallback to quarterly
  if (props.annualData && Object.keys(props.annualData).length > 0) {
    populateFromAnnualData();
  } else if (props.quarterlyData) {
    updateFromQuarterlyData();
  }
});

// Computed theme
const gridTheme = computed(() =>
  colorMode.value === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz',
);
</script>

<template>
  <div class="annual-grid">
    <div class="grid-header">
      <h3 class="grid-title">
        <UIcon name="i-lucide-calendar" class="mr-2" />
        {{ titleText }}
      </h3>
    </div>

    <div :class="gridTheme" class="grid-wrapper">
      <ClientOnly>
        <AgGridVue
          :row-data="rowData"
          :column-defs="columnDefs"
          :default-col-def="defaultColDef"
          dom-layout="autoHeight"
          :suppress-row-click-selection="true"
          :enable-cell-text-selection="true"
        />
      </ClientOnly>
    </div>

    <div class="grid-legend">
      <div v-if="historicalRange" class="legend-item">
        <span class="legend-color historical"></span>
        <span>{{ historicalRange }}</span>
      </div>
      <div v-if="forecastRange" class="legend-item">
        <span class="legend-color forecast"></span>
        <span>{{ forecastRange }}</span>
      </div>
      <div class="legend-item">
        <span class="legend-color editable"></span>
        <span>Ô nhập liệu</span>
      </div>
      <div class="legend-item">
        <span class="legend-color calculated"></span>
        <span>Tự động tính</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.annual-grid {
  width: 100%;
}

.grid-header {
  margin-bottom: 1rem;
}

.grid-title {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ui-text);
}

.grid-wrapper {
  width: 100%;
  border-radius: 0.5rem;
  overflow: hidden;
}

.grid-wrapper :deep(.cell-indicator) {
  font-weight: 600;
  background-color: var(--ui-bg-elevated);
}

.grid-wrapper :deep(.cell-number) {
  text-align: right;
  font-family: 'Courier New', monospace;
}

.grid-wrapper :deep(.cell-historical) {
  background-color: rgba(255, 0, 0, 0.08);
  border-left: 2px solid rgba(255, 0, 0, 0.3);
}

.grid-wrapper :deep(.cell-forecast) {
  background-color: rgba(255, 235, 59, 0.15);
  border-left: 2px solid rgba(255, 193, 7, 0.4);
}

.grid-wrapper :deep(.cell-editable) {
  cursor: text;
}

.grid-wrapper :deep(.cell-editable:hover) {
  background-color: rgba(59, 130, 246, 0.1);
}

.grid-wrapper :deep(.cell-calculated) {
  font-style: italic;
  color: var(--ui-text-muted);
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

.legend-color.historical {
  background-color: rgba(255, 0, 0, 0.15);
  border: 1px solid rgba(255, 0, 0, 0.4);
}

.legend-color.forecast {
  background-color: rgba(255, 235, 59, 0.3);
  border: 1px solid rgba(255, 193, 7, 0.5);
}

.legend-color.editable {
  background-color: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.legend-color.calculated {
  background-color: rgba(156, 163, 175, 0.2);
  border: 1px solid rgba(156, 163, 175, 0.4);
}
</style>
