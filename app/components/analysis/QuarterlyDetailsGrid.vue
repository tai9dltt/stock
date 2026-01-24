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
  forecastQuarters?: string[]; // ['2024_Q1', '2024_Q2']
}>();

const emit = defineEmits<{
  (e: 'update:data', value: Record<string, any>): void;
}>();

const colorMode = useColorMode();

// ... (indicators list, no change)
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
    editable: true, // Allow editing to forecast share changes
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
    editable: true, // Allow editing growth to forecast
    calculated: false, // Growth can be manually set
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

const isForecast = (year: string, quarter?: string) => {
  if (props.forecastQuarters && props.forecastQuarters.length > 0) {
    if (quarter) {
      return props.forecastQuarters.includes(`${year}_${quarter}`);
    }
    // If checking year, consider forecast if any quarter is forecast?
    // Or prefer using quarter check in UI.
    return props.forecastQuarters.some((fq) => fq.startsWith(`${year}_`));
  }
  return forecastYears.value.includes(year);
};

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

      // Quarterly EPS: (Net Profit in millions / Outstanding Shares) × 10^6
      // Use per-quarter outstanding shares if available, otherwise use global value
      if (qepsRow && profit) {
        const sharesRow = rowData.value.find(
          (r) => r.indicatorKey === 'outstandingShares',
        );
        const quarterShares = sharesRow?.[key] as number | null;
        const shares = quarterShares || outstandingShares.value;

        if (shares) {
          const eps = (profit * 1000000) / shares;
          qepsRow[key] = eps;
        }
      }

      // Cumulative EPS (TTM - Trailing 12 Months): sum of last 4 quarters
      if (cepsRow && qepsRow) {
        let ttmEPS = 0;

        // Get current quarter index
        const currentQIdx = quarters.indexOf(quarter);

        // Collect last 4 quarters including current
        const last4Quarters: string[] = [];

        for (let i = 0; i < 4; i++) {
          const qIdx = currentQIdx - i;

          if (qIdx >= 0) {
            // Same year, previous quarters
            last4Quarters.push(getQuarterKey(year, quarters[qIdx]!));
          } else {
            // Previous year, wrap around
            const prevYearNum = parseInt(year) - 1;
            const prevYearStr = prevYearNum.toString();
            const prevQIdx = 4 + qIdx; // e.g., if qIdx = -1, prevQIdx = 3 (Q4)
            if (prevQIdx >= 0 && prevQIdx < 4) {
              last4Quarters.push(
                getQuarterKey(prevYearStr, quarters[prevQIdx]!),
              );
            }
          }
        }

        // Sum EPS from last 4 quarters
        for (const qKey of last4Quarters) {
          const qEPS = qepsRow[qKey] as number | null;
          if (qEPS !== null && qEPS !== undefined) {
            ttmEPS += qEPS;
          }
        }

        cepsRow[key] = ttmEPS;
      }

      // P/E based on TTM EPS
      if (peRow && cepsRow && currentPrice.value) {
        const ttmEPS = cepsRow[key] as number | null;
        if (ttmEPS && ttmEPS > 0) {
          peRow[key] = currentPrice.value / ttmEPS;
        }
      }

      // Growth rates - YoY (same quarter from previous year)
      const currentYear = parseInt(year);
      const prevYear = (currentYear - 1).toString();
      const prevYearKey = `${prevYear}_${quarter}`;

      if (revGrowthRow && revenueRow) {
        const prevYearRevenue = revenueRow[prevYearKey] as number | null;
        if (revenue && prevYearRevenue) {
          revGrowthRow[key] =
            ((revenue - prevYearRevenue) / prevYearRevenue) * 100;
        }
      }

      if (profitGrowthRow && profitRow) {
        const prevYearProfit = profitRow[prevYearKey] as number | null;
        if (profit && prevYearProfit) {
          profitGrowthRow[key] =
            ((profit - prevYearProfit) / prevYearProfit) * 100;
        }
      }
    }
  }

  emitData();

  // Force Vue to detect change by creating new array reference
  rowData.value = [...rowData.value];

  // Force grid refresh
  if (gridApi.value) {
    gridApi.value.refreshCells({ force: true });
    gridApi.value.redrawRows();
  }
};

const emitData = () => {
  // Don't emit if we're populating from external source
  if (isPopulating) return;

  const data: Record<string, any> = {};
  for (const ind of indicators) {
    // Emit all non-calculated indicators including outstandingShares
    if (!ind.calculated) {
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

  // Special handling for profit growth - apply YoY growth to all base metrics
  if (row.indicatorKey === 'profitGrowth' && newValue !== null) {
    const parts = field.split('_');
    const year = parts[0];
    const quarter = parts.length > 1 ? parts[1] : undefined;

    if (year && quarter) {
      // Get same quarter from previous year (YoY comparison)
      const currentYear = parseInt(year);
      const prevYear = (currentYear - 1).toString();
      const prevYearKey = `${prevYear}_${quarter}`;

      // Apply growth rate to all base metrics (revenue, gross profit, operating profit, net profit)
      const baseMetrics = [
        'netRevenue',
        'grossProfit',
        'operatingProfit',
        'netProfit',
      ];

      for (const metricKey of baseMetrics) {
        const metricRow = rowData.value.find(
          (r) => r.indicatorKey === metricKey,
        );
        if (metricRow) {
          const prevYearValue = metricRow[prevYearKey] as number | null;
          if (prevYearValue !== null && prevYearValue !== undefined) {
            // Apply YoY growth: current = previous_year_same_quarter * (1 + growth/100)
            const calculatedValue = prevYearValue * (1 + newValue / 100);
            (metricRow as any)[field] = calculatedValue;
            console.log(
              `YoY ${metricKey}: ${prevYearValue} × (1 + ${newValue}%) = ${calculatedValue.toFixed(0)}`,
            );
          }
        }
      }
    }
  }

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

  if (year) {
    // Extract quarter from field if possible: YYYY_QX
    const quarter = parts.length > 1 ? parts[1] : undefined;
    if (isForecast(year, quarter)) {
      classes.push('cell-forecast');
    } else if (historicalYears.value.includes(year)) {
      classes.push('cell-historical');
    }
  }

  if (row.isCalculated) {
    classes.push('cell-calculated');
  } else {
    const ind = indicators.find((i) => i.key === row.indicatorKey);
    if (ind?.editable) {
      classes.push('cell-editable');
    }
  }

  // Add border right for Q4 to separate years
  if (parts.length > 1 && parts[1] === 'Q4') {
    classes.push('cell-year-end');
  }

  return classes.join(' ');
};

const numberFormatter = (params: { value: number | null }) => {
  if (params.value === null || params.value === undefined) return '-';
  return new Intl.NumberFormat('vi-VN').format(params.value);
};

// Growth percentage formatter (integer only with % suffix)
const growthFormatter = (params: { value: number | null }) => {
  if (params.value === null || params.value === undefined) return '-';
  return (
    new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(params.value) + '%'
  );
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
      headerClass: 'header-center',
    },
  ];

  for (const year of years.value) {
    const yearCols: ColDef<QuarterlyDataRow>[] = [];
    const forecast = isForecast(year);

    for (const quarter of quarters) {
      const key = getQuarterKey(year, quarter);
      const isColForecast = isForecast(year, quarter);

      // Determine header class for year separation and centering
      const headerClasses = ['header-center'];
      if (quarter === 'Q4') {
        headerClasses.push('header-year-end');
      }

      yearCols.push({
        headerName: isColForecast ? `${quarter} (F)` : quarter,
        field: key,
        width: 130,
        editable: (p) => {
          const ind = indicators.find((i) => i.key === p.data?.indicatorKey);
          return ind?.editable || false;
        },
        valueSetter,
        cellClass: getCellClass,
        headerClass: headerClasses.join(' '),
        valueFormatter: (p) => {
          // Use integer formatter for growth and margin rows
          if (
            p.data?.indicatorKey === 'revenueGrowth' ||
            p.data?.indicatorKey === 'profitGrowth' ||
            p.data?.indicatorKey === 'netProfitMargin' ||
            p.data?.indicatorKey === 'grossMargin'
          ) {
            return growthFormatter(p);
          }
          return numberFormatter(p);
        },
      });
    }

    cols.push({
      headerName: year,
      children: yearCols,
      marryChildren: true,
      headerClass: 'header-center',
    });
  }

  return cols;
};

const columnDefs =
  ref<(ColDef<QuarterlyDataRow> | ColGroupDef<QuarterlyDataRow>)[]>(
    generateColumnDefs(),
  );

const getPreviousQuarterKey = (
  year: string,
  quarter: string,
): string | null => {
  const qIndex = quarters.indexOf(quarter);
  if (qIndex > 0) {
    return getQuarterKey(year, quarters[qIndex - 1]!);
  }

  const yIndex = years.value.indexOf(year);
  if (yIndex > 0) {
    const prevYear = years.value[yIndex - 1];
    if (prevYear) {
      return getQuarterKey(prevYear, 'Q4');
    }
  }

  return null;
};

const defaultColDef = ref<ColDef>({
  sortable: false,
  filter: false,
  resizable: true,
});

// Grid API
const gridApi = ref<any>(null);

const onGridReady = (params: any) => {
  gridApi.value = params.api;
  scrollToEnd();
};

const scrollToEnd = () => {
  if (gridApi.value && years.value.length > 0) {
    // Find the last column key
    const lastYear = years.value[years.value.length - 1];
    if (!lastYear) return;

    const lastQuarter = 'Q4'; // Or find the actual last quarter if data is partial
    const key = getQuarterKey(lastYear, lastQuarter);

    // Check if column exists, if not try Q3, Q2...
    // Actually, columns are generated for all Q1-Q4 for each year in years.value
    // So Q4 of last year should exist as a column definition

    setTimeout(() => {
      gridApi.value.ensureColumnVisible(key);
    }, 100);
  }
};

watch(
  () => props.outstandingShares,
  (val) => {
    if (val) {
      outstandingShares.value = val;

      // Update the row data with new global value
      const sharesRow = rowData.value.find(
        (r) => r.indicatorKey === 'outstandingShares',
      );
      if (sharesRow) {
        for (const year of years.value) {
          for (const quarter of quarters) {
            const key = getQuarterKey(year, quarter);
            (sharesRow as any)[key] = val;
          }
        }
      }

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

    // Scroll to end after data update
    nextTick(() => {
      scrollToEnd();
    });
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
          @grid-ready="onGridReady"
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

/* Year separation border */
.grid-wrapper :deep(.cell-year-end),
.grid-wrapper :deep(.header-year-end) {
  border-right: 2px solid var(--ui-border-accent, #cbd5e1) !important;
}

/* Center headers */
.grid-wrapper :deep(.header-center .ag-header-cell-label),
.grid-wrapper :deep(.header-center .ag-header-group-cell-label) {
  justify-content: center;
}

/* Dark mode specific for border */
:deep(.dark) .grid-wrapper .cell-year-end {
  border-right: 2px solid #475569 !important;
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
