<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';
import type {
  ColDef,
  ColGroupDef,
  ValueSetterParams,
  CellClassParams,
} from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

// Types
interface QuarterlyDataRow {
  indicator: string;
  indicatorKey: string;
  isCalculated: boolean;
  [key: string]: string | number | null | boolean;
}

// Props
const props = defineProps<{
  outstandingShares?: number;
  currentPrice?: number;
  data?: Record<string, any>; // External data to populate grid
}>();

const emit = defineEmits<{
  (e: 'update:data', value: Record<string, any>): void;
}>();

const colorMode = useColorMode();

// Indicators
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
    key: 'outstandingShares',
    name: 'KL CP lưu hành',
    editable: false,
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
  { key: 'quarterlyEPS', name: 'EPS quý', editable: false, calculated: true },
  {
    key: 'cumulativeEPS',
    name: 'EPS lũy kế',
    editable: false,
    calculated: true,
  },
  { key: 'pe', name: 'P/E', editable: false, calculated: true },
  {
    key: 'revenueGrowth',
    name: 'TT DT (%)',
    editable: false,
    calculated: true,
  },
  {
    key: 'profitGrowth',
    name: 'TT LNST (%)',
    editable: false,
    calculated: true,
  },
];

const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

// Extract years dynamically from data - START EMPTY
const years = ref<string[]>([]);
const historicalYears = computed(() => {
  const currentYear = new Date().getFullYear();
  return years.value.filter((y) => parseInt(y) < currentYear);
});
const forecastYears = computed(() => {
  const currentYear = new Date().getFullYear();
  return years.value.filter((y) => parseInt(y) >= currentYear);
});

const rowData = ref<QuarterlyDataRow[]>([]);
const outstandingShares = ref<number>(props.outstandingShares || 2666873613);
const currentPrice = ref<number>(props.currentPrice || 14000);

// Flag to prevent emit loop during external populate
let isPopulating = false;

const getQuarterKey = (year: string, quarter: string) => `${year}_${quarter}`;

const isForecast = (year: string) => forecastYears.value.includes(year);

const initializeData = () => {
  rowData.value = indicators.map((ind) => {
    const row: QuarterlyDataRow = {
      indicator: ind.name,
      indicatorKey: ind.key,
      isCalculated: ind.calculated,
    };

    for (const year of years.value) {
      for (const quarter of quarters) {
        const key = getQuarterKey(year, quarter);
        if (ind.key === 'outstandingShares') {
          row[key] = outstandingShares.value;
        } else {
          row[key] = null;
        }
      }
    }

    return row;
  });

  recalculateAll();
};

const getPreviousQuarterKey = (
  year: string,
  quarter: string,
): string | null => {
  const qIndex = quarters.indexOf(quarter);
  if (qIndex > 0) {
    return getQuarterKey(year, quarters[qIndex - 1]);
  }

  const yIndex = years.value.indexOf(year);
  if (yIndex > 0) {
    return getQuarterKey(years.value[yIndex - 1], 'Q4');
  }

  return null;
};

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
  const qepsRow = rowData.value.find((r) => r.indicatorKey === 'quarterlyEPS');
  const cepsRow = rowData.value.find((r) => r.indicatorKey === 'cumulativeEPS');
  const peRow = rowData.value.find((r) => r.indicatorKey === 'pe');
  const revGrowthRow = rowData.value.find(
    (r) => r.indicatorKey === 'revenueGrowth',
  );
  const profitGrowthRow = rowData.value.find(
    (r) => r.indicatorKey === 'profitGrowth',
  );

  for (const year of years.value) {
    let yearCumulativeEPS = 0;

    for (const quarter of quarters) {
      const key = getQuarterKey(year, quarter);
      const revenue = revenueRow?.[key] as number | null;
      const profit = profitRow?.[key] as number | null;

      // Margins
      if (marginRow && revenue && profit) {
        marginRow[key] = (profit / revenue) * 100;
      }

      const grossProfit = grossProfitRow?.[key] as number | null;
      if (grossMarginRow && revenue && grossProfit) {
        grossMarginRow[key] = (grossProfit / revenue) * 100;
      }

      // Quarterly EPS
      if (qepsRow && profit && outstandingShares.value) {
        const eps = (profit * 1000000000) / outstandingShares.value;
        qepsRow[key] = eps;
        yearCumulativeEPS += eps;
      }

      // Cumulative EPS
      if (cepsRow) {
        cepsRow[key] = yearCumulativeEPS;
      }

      // P/E
      if (peRow && yearCumulativeEPS && currentPrice.value) {
        peRow[key] = currentPrice.value / yearCumulativeEPS;
      }

      // Growth rates
      const prevKey = getPreviousQuarterKey(year, quarter);
      if (prevKey) {
        if (revGrowthRow && revenueRow) {
          const prevRevenue = revenueRow[prevKey] as number | null;
          if (revenue && prevRevenue) {
            revGrowthRow[key] = ((revenue - prevRevenue) / prevRevenue) * 100;
          }
        }

        if (profitGrowthRow && profitRow) {
          const prevProfit = profitRow[prevKey] as number | null;
          if (profit && prevProfit) {
            profitGrowthRow[key] = ((profit - prevProfit) / prevProfit) * 100;
          }
        }
      }
    }
  }

  emitData();
};

const emitData = () => {
  // Don't emit if we're populating from external source
  if (isPopulating) return;

  const data: Record<string, any> = {};
  for (const ind of indicators) {
    if (!ind.calculated && ind.key !== 'outstandingShares') {
      data[ind.key] = {};
      for (const year of years.value) {
        data[ind.key][year] = {};
        for (const quarter of quarters) {
          const key = getQuarterKey(year, quarter);
          const row = rowData.value.find((r) => r.indicatorKey === ind.key);
          data[ind.key][year][quarter] = row?.[key] ?? null;
        }
      }
    }
  }
  emit('update:data', data);
};

const valueSetter = (params: ValueSetterParams<QuarterlyDataRow>): boolean => {
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

const getCellClass = (params: CellClassParams): string => {
  const field = params.colDef.field;
  if (!field || field === 'indicator') return 'cell-indicator';

  const row = params.data as QuarterlyDataRow;
  if (!row) return '';

  const parts = field.split('_');
  const year = parts[0];

  const classes = ['cell-number'];

  if (year && historicalYears.value.includes(year)) {
    classes.push('cell-historical');
  } else if (year && forecastYears.value.includes(year)) {
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

const numberFormatter = (params: { value: number | null }) => {
  if (params.value === null || params.value === undefined) return '-';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(params.value);
};

const generateColumnDefs = (): (
  | ColDef<QuarterlyDataRow>
  | ColGroupDef<QuarterlyDataRow>
)[] => {
  const cols: (ColDef<QuarterlyDataRow> | ColGroupDef<QuarterlyDataRow>)[] = [
    {
      headerName: 'Chỉ tiêu',
      field: 'indicator',
      pinned: 'left',
      width: 160,
      cellClass: 'cell-indicator',
    },
  ];

  for (const year of years.value) {
    const yearCols: ColDef<QuarterlyDataRow>[] = [];
    const forecast = isForecast(year);

    for (const quarter of quarters) {
      const key = getQuarterKey(year, quarter);

      yearCols.push({
        headerName: forecast ? `${quarter} (F)` : quarter,
        field: key,
        width: 100,
        editable: (p) => {
          const ind = indicators.find((i) => i.key === p.data?.indicatorKey);
          return ind?.editable || false;
        },
        valueSetter,
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
  ref<(ColDef<QuarterlyDataRow> | ColGroupDef<QuarterlyDataRow>)[]>(
    generateColumnDefs(),
  );

const defaultColDef = ref<ColDef>({
  sortable: false,
  filter: false,
  resizable: true,
});

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

// Populate grid from external data
const populateFromExternalData = (externalData: Record<string, any>) => {
  if (!externalData) return;

  console.log('Populating grid from external data:', externalData);
  isPopulating = true; // Prevent emit loop

  // Extract years from data
  const dataYears = new Set<string>();
  for (const ind of indicators) {
    if (externalData[ind.key]) {
      Object.keys(externalData[ind.key]).forEach((year) => dataYears.add(year));
    }
  }
  if (dataYears.size > 0) {
    years.value = Array.from(dataYears).sort();
    console.log('Extracted years from data:', JSON.stringify(years.value));
    console.log('Years array:', years.value);

    // Reinitialize grid with new years to create columns
    initializeData();

    // Regenerate column definitions
    columnDefs.value = generateColumnDefs();
    console.log('Regenerated columns for years:', JSON.stringify(years.value));
  }

  // Update each indicator row with data from external source
  for (const ind of indicators) {
    const row = rowData.value.find((r) => r.indicatorKey === ind.key);
    if (!row || !externalData[ind.key]) continue;

    const indicatorData = externalData[ind.key];

    for (const year of years.value) {
      if (!indicatorData[year]) continue;

      for (const quarter of quarters) {
        const key = getQuarterKey(year, quarter);
        const value = indicatorData[year][quarter];

        if (value !== null && value !== undefined) {
          (row as any)[key] = Number(value);
        }
      }
    }
  }

  recalculateAll();
  isPopulating = false; // Clear flag
};

// Watch for external data changes
watch(
  () => props.data,
  (newData) => {
    if (newData) {
      populateFromExternalData(newData);
    }
  },
  { deep: true, immediate: true },
);

onMounted(() => {
  initializeData();

  // Populate if data already exists on mount
  if (props.data) {
    populateFromExternalData(props.data);
  }
});

const gridTheme = computed(() =>
  colorMode.value === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz',
);
</script>

<template>
  <div class="quarterly-grid">
    <div class="grid-header">
      <h3 class="grid-title">
        <UIcon name="i-lucide-bar-chart-3" class="mr-2" />
        Table 2: Chi tiết theo Quý (2020 Q1 → 2023 Q4)
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
          :group-header-height="40"
        />
      </ClientOnly>
    </div>

    <div class="grid-legend">
      <div class="legend-item">
        <span class="legend-color historical"></span>
        <span>Quá khứ (2020-2021)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color forecast"></span>
        <span>Dự phóng (2022-2023)</span>
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
.quarterly-grid {
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
  font-size: 0.875rem;
}

.grid-wrapper :deep(.cell-historical) {
  background-color: rgba(255, 0, 0, 0.08);
}

.grid-wrapper :deep(.cell-forecast) {
  background-color: rgba(255, 235, 59, 0.15);
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
