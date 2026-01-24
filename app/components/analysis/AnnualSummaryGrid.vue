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
  forecastYears?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:data', value: Record<string, any>): void;
}>();

// Color mode
const colorMode = useColorMode();

// Indicators for annual summary
const indicators = [
  // ... (indicators list, no change)
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
  if (props.forecastYears && props.forecastYears.length > 0) {
    return years.value.filter((y) => !props.forecastYears!.includes(y));
  }
  return years.value.filter((y) => parseInt(y) < currentYear);
});
const forecastYears = computed(() => {
  if (props.forecastYears && props.forecastYears.length > 0) {
    return years.value.filter((y) => props.forecastYears!.includes(y));
  }
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

// Grid API
const gridApi = ref<any>(null);

const onGridReady = (params: any) => {
  gridApi.value = params.api;
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

// Sum quarters to annual (lightweight version that doesn't reinitialize)
const sumQuartersToAnnual = () => {
  if (!props.quarterlyData) return;

  console.log('Summing quarters to annual...');

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

      let quarterCount = 0;
      for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const qValue = yearData[quarter];
        if (qValue !== null && qValue !== undefined) {
          yearTotal += Number(qValue);
          quarterCount++;
          hasData = true;
        }
      }

      // ONLY sum if all 4 quarters have data
      if (hasData && quarterCount === 4) {
        (annualRow as any)[yearKey] = yearTotal;
        console.log(`Summed ${aKey} for ${year}: ${yearTotal}`);
      } else {
        (annualRow as any)[yearKey] = null;
      }
    }
  }

  recalculateAll();
};

// Helper: Get all years from both annual and quarterly data
const getAllYears = (): string[] => {
  const allYears = new Set<string>();

  // Years from annualData
  if (props.annualData) {
    for (const ind of indicators) {
      if (props.annualData[ind.key]) {
        Object.keys(props.annualData[ind.key]).forEach((y) => allYears.add(y));
      }
    }
  }

  // Years from quarterlyData
  if (props.quarterlyData) {
    const quarterlyKeys = [
      'netRevenue',
      'grossProfit',
      'operatingProfit',
      'netProfit',
    ];
    for (const key of quarterlyKeys) {
      if (props.quarterlyData[key]) {
        Object.keys(props.quarterlyData[key]).forEach((y) => allYears.add(y));
      }
    }
  }

  return Array.from(allYears).sort();
};

// Helper: Check if a year has yearly crawl data
const hasYearlyData = (year: string): boolean => {
  if (!props.annualData) return false;

  // Check if any base indicator has data for this year
  const baseIndicators = [
    'netRevenue',
    'grossProfit',
    'operatingProfit',
    'netProfit',
  ];
  for (const key of baseIndicators) {
    const value = props.annualData[key]?.[year];
    if (value !== null && value !== undefined) {
      return true;
    }
  }
  return false;
};

// Smart merge: Prioritize yearly data for past years, quarterly sum for current/future
const mergeAnnualAndQuarterlyData = () => {
  console.log('=== Merging annual and quarterly data ===');
  isPopulating = true;

  // Get all years from both sources
  years.value = getAllYears();

  if (years.value.length === 0) {
    console.log('No years found in data');
    isPopulating = false;
    return;
  }

  console.log('All years:', years.value);

  // Get current year for comparison
  const currentYear = new Date().getFullYear();
  console.log('Current year:', currentYear);

  // Reinitialize grid with all years
  initializeData();
  columnDefs.value = generateColumnDefs();

  // Map quarterly keys to annual keys
  const quarterlyToAnnualMap: Record<string, string> = {
    netRevenue: 'netRevenue',
    grossProfit: 'grossProfit',
    operatingProfit: 'operatingProfit',
    netProfit: 'netProfit',
  };

  // Helper: Check if year has incomplete quarterly data
  const hasIncompleteQuarters = (year: string): boolean => {
    if (!props.quarterlyData) return false;

    // Check any base indicator for missing quarters
    for (const qKey of Object.keys(quarterlyToAnnualMap)) {
      const yearData = props.quarterlyData[qKey]?.[year];
      if (yearData) {
        // Count how many quarters have data
        let quarterCount = 0;
        for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
          if (yearData[quarter] !== null && yearData[quarter] !== undefined) {
            quarterCount++;
          }
        }
        // If has some data but not all 4 quarters, it's incomplete
        if (quarterCount > 0 && quarterCount < 4) {
          return true;
        }
      }
    }
    return false;
  };

  // For each indicator
  for (const ind of indicators) {
    const row = rowData.value.find((r) => r.indicatorKey === ind.key);
    if (!row) continue;

    // For each year
    for (const year of years.value) {
      const yearKey = getYearKey(year);
      const yearNum = parseInt(year);

      // Check if this is a base indicator that can be summed from quarterly
      const quarterlyKey = Object.keys(quarterlyToAnnualMap).find(
        (k) => quarterlyToAnnualMap[k] === ind.key,
      );

      // Priority logic:
      // 1. For current year or future years: ALWAYS sum from quarterly (to allow forecast)
      // 2. For years with incomplete quarters: ALWAYS sum from quarterly
      // 3. For past complete years: Use yearly data if available, otherwise sum from quarterly

      const isIncomplete = hasIncompleteQuarters(year);

      if (yearNum >= currentYear || isIncomplete) {
        // Current/future year OR incomplete year: Always sum from quarterly
        if (quarterlyKey && props.quarterlyData?.[quarterlyKey]?.[year]) {
          const yearData = props.quarterlyData[quarterlyKey][year];
          let yearTotal = 0;
          let hasData = false;

          let quarterCount = 0;

          for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
            const qValue = yearData[quarter];
            if (qValue !== null && qValue !== undefined) {
              yearTotal += Number(qValue);
              quarterCount++;
              hasData = true;
            }
          }

          // ONLY sum if all 4 quarters have data
          if (hasData && quarterCount === 4) {
            row[yearKey] = yearTotal;
            const reason =
              yearNum >= currentYear
                ? 'current/future year'
                : 'incomplete year';
            console.log(
              `→ Summed from quarterly for ${ind.key} ${year}: ${yearTotal} (${reason})`,
            );
            continue;
          }
        }
      } else {
        // Past year: Prefer yearly data if available
        if (
          hasYearlyData(year) &&
          props.annualData?.[ind.key]?.[year] !== undefined
        ) {
          const value = props.annualData[ind.key][year];
          if (value !== null && value !== undefined) {
            row[yearKey] = Number(value);
            console.log(
              `✓ Using yearly data for ${ind.key} ${year}: ${value} (past complete year)`,
            );
            continue;
          }
        }

        // Fallback: Sum from quarterly if yearly not available
        if (quarterlyKey && props.quarterlyData?.[quarterlyKey]?.[year]) {
          const yearData = props.quarterlyData[quarterlyKey][year];
          let yearTotal = 0;
          let hasData = false;

          let quarterCount = 0;

          for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
            const qValue = yearData[quarter];
            if (qValue !== null && qValue !== undefined) {
              yearTotal += Number(qValue);
              quarterCount++;
              hasData = true;
            }
          }

          // ONLY sum if all 4 quarters have data
          if (hasData && quarterCount === 4) {
            row[yearKey] = yearTotal;
            console.log(
              `→ Summed from quarterly for ${ind.key} ${year}: ${yearTotal} (past year, no yearly data)`,
            );
          }
        }
      }
    }
  }

  // Populate ratio indicators from annual data (they can't be summed from quarterly)
  const ratioIndicators = ['eps', 'pe', 'ros', 'roe', 'roa'];
  for (const ratioKey of ratioIndicators) {
    const row = rowData.value.find((r) => r.indicatorKey === ratioKey);
    if (!row || !props.annualData?.[ratioKey]) continue;

    for (const year of years.value) {
      const yearKey = getYearKey(year);
      const value = props.annualData[ratioKey][year];

      if (value !== null && value !== undefined) {
        row[yearKey] = Number(value);
        console.log();
      }
    }
  }

  recalculateAll();
  isPopulating = false;
  console.log('=== Merge complete ===');
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

  // Force Vue to detect change by creating new array reference
  rowData.value = [...rowData.value];

  // Force grid refresh
  if (gridApi.value) {
    gridApi.value.refreshCells({ force: true });
    gridApi.value.redrawRows();
  }
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

// Add a new year
const addYear = () => {
  // Calculate next year (max year + 1)
  const lastYear = years.value[years.value.length - 1];
  const nextYear = lastYear
    ? String(parseInt(lastYear) + 1)
    : String(new Date().getFullYear());

  // Add to years array
  years.value.push(nextYear);
  years.value.sort();

  // Add new year column to all rows
  const yearKey = getYearKey(nextYear);
  for (const row of rowData.value) {
    (row as any)[yearKey] = null;
  }

  // Regenerate column definitions
  columnDefs.value = generateColumnDefs();

  // Recalculate all formulas
  recalculateAll();

  console.log(`Added year ${nextYear} to annual grid`);
};

// Remove a year
const removeYear = (year: string) => {
  const index = years.value.indexOf(year);
  if (index === -1) return;

  // Remove from years array
  years.value.splice(index, 1);

  // Remove year column from all rows
  const yearKey = getYearKey(year);
  for (const row of rowData.value) {
    delete (row as any)[yearKey];
  }

  // Regenerate column definitions
  columnDefs.value = generateColumnDefs();

  // Recalculate all formulas
  recalculateAll();

  console.log(`Removed year ${year} from annual grid`);
};

// Expose functions for parent component if needed
defineExpose({
  addYear,
  removeYear,
});

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
      width: 150,
      editable: (p) => {
        const ind = indicators.find((i) => i.key === p.data?.indicatorKey);
        return ind?.editable || false;
      },
      valueSetter,
      cellClass: getCellClass,
      valueFormatter: (p) => {
        // Use integer formatter for growth, margin, and ratio percentage rows
        const percentageRows = [
          'revenueGrowth',
          'profitGrowth',
          'netProfitMargin',
          'grossMargin',
          'ros',
          'roe',
          'roa',
        ];
        if (
          p.data?.indicatorKey &&
          percentageRows.includes(p.data.indicatorKey)
        ) {
          return growthFormatter(p);
        }
        return numberFormatter(p);
      },
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

      // Update the row data with new global value
      const sharesRow = rowData.value.find(
        (r) => r.indicatorKey === 'outstandingShares',
      );
      if (sharesRow) {
        for (const year of years.value) {
          const yearKey = getYearKey(year);
          (sharesRow as any)[yearKey] = val;
        }
      }

      recalculateAll();
    }
  },
);

// Watch for data changes - smart merge annual and quarterly
// Priority: yearly crawl data > quarterly sum
watch(
  [() => props.annualData, () => props.quarterlyData],
  () => {
    mergeAnnualAndQuarterlyData();
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
      <div class="header-row">
        <h3 class="grid-title">
          <UIcon name="i-lucide-calendar" class="mr-2" />
          {{ titleText }}
        </h3>
        <UButton
          color="primary"
          variant="soft"
          size="sm"
          icon="i-lucide-plus"
          @click="addYear"
        >
          Add Year
        </UButton>
      </div>
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
          @grid-ready="onGridReady"
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

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
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
