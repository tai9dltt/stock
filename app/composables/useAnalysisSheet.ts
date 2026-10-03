/**
 * SpreadJS workbook of the analysis page: loading SpreadJS, rendering the
 * analysis sheet and reading the user's edits back from it.
 */

import { computed, shallowRef } from 'vue';
import type { AnalysisSheetData, AnalysisSheetLayout, GrowthKind } from '~/spreadsheet/types';
import type { ForecastFigures } from '~/types';
import { buildAnalysisSheet, samePeriodLastYear } from '~/spreadsheet/buildAnalysisSheet';
import { styleGrowthInput } from '~/spreadsheet/cells';
import { peFormat, peLadder } from '~/spreadsheet/peLadder';
import { getCellAddr } from '~/utils/spreadjs';
import {
  INPUT_AREA, INPUT_FIELDS, inputRow, SPREADJS_COLORS, VALUATION_TABLE, type InputFieldName,
} from '~/constants/spreadJsConstants';
import { extractInputValues, extractPeValues, extractSharesPerQuarter } from '~/composables/useStockDataTransform';

export interface SheetEdits {
  inputs: ReturnType<typeof extractInputValues>;
  /** Revenue, net profit and EPS the forecast quarters show (forecast journal) */
  forecast?: ForecastFigures;
  peValues?: number[];
  sharesPerQuarter?: Record<string, Record<string, number>>;
}

/** A forecast quarter's growth was typed (value) or cleared (null) */
type GrowthEditedCallback = (kind: GrowthKind, period: string, value: number | null) => void;

/** P/E scenarios or shares per quarter were typed: their current values */
type TableEditedCallback = (edits: Pick<SheetEdits, 'peValues' | 'sharesPerQuarter'>) => void;

export function useAnalysisSheet() {
  let GC: any = null;
  const spread = shallowRef<any>(null);
  const layout = shallowRef<AnalysisSheetLayout | null>(null);
  const INPUT_COL = INPUT_AREA.COL + INPUT_AREA.VALUE_COL_OFFSET;
  let onInputEdited: ((field: InputFieldName, value: number) => void) | null = null;
  let onGrowthEdited: GrowthEditedCallback | null = null;
  let onTableEdited: TableEditedCallback | null = null;

  const GROWTH_INPUT: Record<GrowthKind, InputFieldName> = {
    revenue: 'revenueGrowth', grossMargin: 'grossMargin', netProfit: 'netProfitGrowth',
  };

  /**
   * After the user edits a forecast quarter's growth or margin cell: a number
   * is that quarter's own value; clearing it goes back to the input above the sheet.
   */
  function syncGrowthCell(sheet: any, row: number, col: number) {
    const current = layout.value;
    if (!current) return;
    const kind = (Object.keys(current.growthRows) as GrowthKind[]).find(k => current.growthRows[k] === row);
    const period = kind && current.quarterlyCols.find(c => c.col === col && c.isForecast);
    if (!kind || !period || sheet.getFormula(row, col)) return;

    const value = sheet.getValue(row, col);
    const typed = typeof value === 'number' && Number.isFinite(value);
    if (!typed) {
      sheet.setFormula(row, col, getCellAddr(GC, sheet, inputRow(GROWTH_INPUT[kind]), INPUT_COL));
    }
    styleGrowthInput(GC, sheet, row, col, typed);
    onGrowthEdited?.(kind, `${period.year}_${period.quarter}`, typed ? value : null);
  }

  async function init(spreadInstance: any) {
    if (!GC) {
      GC = await import('@mescius/spread-sheets');
      await import('@mescius/spread-sheets/styles/gc.spread.sheets.excel2013white.css');

      const licenseKey = useRuntimeConfig().public.spreadjsLicenseKey;
      if (licenseKey) GC.Spread.Sheets.LicenseKey = licenseKey;
    }
    spread.value = spreadInstance;
  }

  const isReady = () => !!spread.value && !!GC;

  // Outline on the cell one year before the selected one
  let comparisonRule: any = null;

  function showComparisonCell(sheet: any) {
    const current = layout.value;
    if (!current) return;
    const cfs = sheet.conditionalFormats;
    if (comparisonRule) cfs.removeRule(comparisonRule);
    comparisonRule = null;

    const target = samePeriodLastYear(current, sheet.getActiveRowIndex(), sheet.getActiveColumnIndex());
    if (!target) return;

    const border = new GC.Spread.Sheets.LineBorder(SPREADJS_COLORS.COMPARISON, GC.Spread.Sheets.LineStyle.thick);
    const style = new GC.Spread.Sheets.Style();
    style.borderLeft = border;
    style.borderTop = border;
    style.borderRight = border;
    style.borderBottom = border;
    // Borders only, so the cell keeps its colours
    comparisonRule = cfs.addFormulaRule('=TRUE', style, [new GC.Spread.Sheets.Range(target.row, target.col, 1, 1)]);
  }

  // Labels of the P/E ladder levels of the rendered stock
  let peLabels = new Map<number, string>();

  const isPeCell = (current: AnalysisSheetLayout, row: number, col: number) => {
    const first = current.valuationStartRow + 2;
    return col === 0 && row >= first && row < first + VALUATION_TABLE.TOTAL_ROWS;
  };
  const isSharesCell = (current: AnalysisSheetLayout, row: number, col: number) =>
    row === current.sharesRow && current.quarterlyCols.some(c => c.col === col);

  /** A P/E scenario was typed: label it if it is a ladder level, else plain */
  function relabelPeCell(sheet: any, row: number, col: number) {
    const current = layout.value;
    if (!current || !isPeCell(current, row, col)) return;
    const value = sheet.getValue(row, col);
    sheet.setFormatter(row, col, peFormat(typeof value === 'number' ? value : undefined, peLabels));
  }

  /**
   * P/E scenarios and shares typed into the sheet go to the page state right
   * away, so a re-render (add a year, apply an input, ...) keeps them.
   */
  function reportTableEdits(sheet: any, cells: Array<[row: number, col: number]>) {
    const current = layout.value;
    if (!current || !onTableEdited) return;
    const edits: Pick<SheetEdits, 'peValues' | 'sharesPerQuarter'> = {};
    if (cells.some(([r, c]) => isPeCell(current, r, c))) {
      edits.peValues = extractPeValues(sheet, current.valuationStartRow + 2, VALUATION_TABLE.TOTAL_ROWS);
    }
    if (cells.some(([r, c]) => isSharesCell(current, r, c))) {
      edits.sharesPerQuarter = extractSharesPerQuarter(sheet, current.sharesRow, current.quarterlyCols);
    }
    if (edits.peValues || edits.sharesPerQuarter) onTableEdited(edits);
  }

  function render(data: AnalysisSheetData) {
    if (!isReady()) return;
    peLabels = new Map(peLadder(data).filter(l => l.label).map(l => [l.value, l.label]));

    const workbook = spread.value;
    workbook.suspendPaint();

    let sheet = workbook.getSheet(0);
    if (!sheet) {
      workbook.addSheet(0, new GC.Spread.Sheets.Worksheet('Analysis'));
      sheet = workbook.getSheet(0);
    }
    sheet.name('Analysis');
    sheet.reset();

    // Don't recalculate formulas while building
    sheet.suspendCalcService(false);

    const defaultStyle = new GC.Spread.Sheets.Style();
    defaultStyle.font = '11pt Calibri';
    defaultStyle.vAlign = GC.Spread.Sheets.VerticalAlign.center;
    sheet.setDefaultStyle(defaultStyle);
    sheet.setColumnCount(100);

    layout.value = buildAnalysisSheet({ GC, spread: workbook, sheet }, data);

    // Report edits the user makes directly in the input cells
    sheet.unbind(GC.Spread.Sheets.Events.ValueChanged);
    sheet.bind(GC.Spread.Sheets.Events.ValueChanged, (_event: unknown, info: { row: number; col: number; newValue: unknown }) => {
      if (info.col !== INPUT_COL || !onInputEdited) return;
      const field = INPUT_FIELDS.find(f => inputRow(f) === info.row);
      if (field) onInputEdited(field, Number(info.newValue) || 0);
    });
    sheet.bind(GC.Spread.Sheets.Events.ValueChanged, (_event: unknown, info: { row: number; col: number }) => {
      syncGrowthCell(sheet, info.row, info.col);
      relabelPeCell(sheet, info.row, info.col);
      reportTableEdits(sheet, [[info.row, info.col]]);
    });
    // Delete key, paste and fill change ranges instead of single values
    sheet.unbind(GC.Spread.Sheets.Events.RangeChanged);
    sheet.bind(GC.Spread.Sheets.Events.RangeChanged, (_event: unknown, info: { row: number; col: number; rowCount: number; colCount: number }) => {
      const cells: Array<[number, number]> = [];
      for (let r = info.row; r < info.row + info.rowCount; r++) {
        for (let c = info.col; c < info.col + info.colCount; c++) {
          syncGrowthCell(sheet, r, c);
          relabelPeCell(sheet, r, c);
          cells.push([r, c]);
        }
      }
      reportTableEdits(sheet, cells);
    });

    // Selecting a period cell outlines the same period a year earlier
    comparisonRule = null;
    sheet.unbind(GC.Spread.Sheets.Events.SelectionChanged);
    sheet.bind(GC.Spread.Sheets.Events.SelectionChanged, () => showComparisonCell(sheet));

    sheet.resumeCalcService(false);
    workbook.resumePaint();
  }

  /** Write an input value into its cell; formulas that use it recalculate */
  function setInput(field: InputFieldName, value: number) {
    if (!isReady()) return;
    spread.value.getSheet(0)?.setValue(inputRow(field), INPUT_COL, value);
  }

  /**
   * Download the sheet as .xlsx, keeping formulas, number formats, colours,
   * borders and merged cells, so it recalculates in Excel.
   */
  async function exportExcel(fileName: string): Promise<void> {
    if (!isReady()) throw new Error('Bảng tính chưa sẵn sàng');

    // Registers the Excel import/export plugin on the SpreadJS module
    await import('@mescius/spread-sheets-io');

    const blob = await new Promise<Blob>((resolve, reject) => {
      spread.value.export(resolve, (error: unknown) => reject(error), {
        fileType: GC.Spread.Sheets.FileType.excel,
        includeStyles: true,
        includeFormulas: true,
      });
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Computed figures of the forecast quarters, rounded (amounts in million VND, EPS in VND) */
  function readForecast(sheet: any, current: AnalysisSheetLayout): ForecastFigures {
    const figure = (key: 'revenue' | 'netProfit' | 'eps', col: number) => {
      const row = current.quarterlyRows[key];
      const value = row === undefined ? null : Number(sheet.getValue(row, col));
      return value !== null && Number.isFinite(value) ? Math.round(value) : null;
    };
    return Object.fromEntries(current.quarterlyCols
      .filter(q => q.isForecast)
      .map(({ year, quarter, col }) => [`${year}_${quarter}`, {
        revenue: figure('revenue', col),
        netProfit: figure('netProfit', col),
        eps: figure('eps', col),
      }]));
  }

  /** Values the user may have edited: inputs, P/E scenarios, shares per quarter */
  function readEdits(): SheetEdits | null {
    if (!spread.value) return null;
    const sheet = spread.value.getActiveSheet();

    const edits: SheetEdits = {
      inputs: extractInputValues(sheet, INPUT_AREA.ROW_START, INPUT_AREA.COL + INPUT_AREA.VALUE_COL_OFFSET),
    };

    const current = layout.value;
    if (current && current.valuationStartRow > 0) {
      edits.peValues = extractPeValues(sheet, current.valuationStartRow + 2, VALUATION_TABLE.TOTAL_ROWS);
    }
    if (current && current.sharesRow > 0 && current.quarterlyCols.length > 0) {
      edits.sharesPerQuarter = extractSharesPerQuarter(sheet, current.sharesRow, current.quarterlyCols);
    }
    if (current) edits.forecast = readForecast(sheet, current);

    return edits;
  }

  /** "2026_Q3" of each forecast quarter the rendered sheet shows */
  const forecastPeriods = computed(() => new Set(
    (layout.value?.quarterlyCols ?? []).filter(c => c.isForecast).map(c => `${c.year}_${c.quarter}`),
  ));

  return {
    init,
    isReady,
    render,
    forecastPeriods,
    readEdits,
    exportExcel,
    setInput,
    onInputEdited: (callback: (field: InputFieldName, value: number) => void) => {
      onInputEdited = callback;
    },
    onGrowthEdited: (callback: GrowthEditedCallback) => {
      onGrowthEdited = callback;
    },
    onTableEdited: (callback: TableEditedCallback) => {
      onTableEdited = callback;
    },
  };
}
