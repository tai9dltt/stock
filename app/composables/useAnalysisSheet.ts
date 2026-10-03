/**
 * SpreadJS workbook of the analysis page: loading SpreadJS, rendering the
 * analysis sheet and reading the user's edits back from it.
 */

import { shallowRef } from 'vue';
import type { AnalysisSheetData, AnalysisSheetLayout } from '~/spreadsheet/types';
import { buildAnalysisSheet } from '~/spreadsheet/buildAnalysisSheet';
import { INPUT_AREA, INPUT_FIELDS, inputRow, VALUATION_TABLE, type InputFieldName } from '~/constants/spreadJsConstants';
import { extractInputValues, extractPeValues, extractSharesPerQuarter } from '~/composables/useStockDataTransform';

export interface SheetEdits {
  inputs: ReturnType<typeof extractInputValues>;
  peValues?: number[];
  sharesPerQuarter?: Record<string, Record<string, number>>;
}

export function useAnalysisSheet() {
  let GC: any = null;
  const spread = shallowRef<any>(null);
  const layout = shallowRef<AnalysisSheetLayout | null>(null);
  const INPUT_COL = INPUT_AREA.COL + INPUT_AREA.VALUE_COL_OFFSET;
  let onInputEdited: ((field: InputFieldName, value: number) => void) | null = null;

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

  function render(data: AnalysisSheetData) {
    if (!isReady()) return;

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

    return edits;
  }

  return {
    init,
    isReady,
    render,
    readEdits,
    exportExcel,
    setInput,
    onInputEdited: (callback: (field: InputFieldName, value: number) => void) => {
      onInputEdited = callback;
    },
  };
}
