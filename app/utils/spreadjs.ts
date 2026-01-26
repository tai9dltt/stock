/**
 * SpreadJS Utility Functions
 * Helper functions for working with SpreadJS spreadsheets
 */

// Color constants
export const COLORS = {
  SELECTED: '#E3F2FD', // Light blue for selected row
  HEADER: '#1976D2',
  FORECAST: '#FF1493',
  HISTORICAL: '#70AD47',
  INPUT: '#FFF2CC',
  DISPLAY: '#E2EFDA',
}

/**
 * Apply thin border to a cell or range
 * @param GC - The GC.Spread.Sheets module
 * @param sheet - The SpreadJS worksheet
 * @param row - Row index
 * @param col - Column index
 * @param rowCount - Number of rows (default: 1)
 * @param colCount - Number of columns (default: 1)
 */
export function applyBorder(
  GC: any,
  sheet: any,
  row: number,
  col: number,
  rowCount: number = 1,
  colCount: number = 1
): void {
  sheet
    .getRange(row, col, rowCount, colCount)
    .setBorder(
      new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin),
      { all: true }
    );
}

/**
 * Get cell address formula string
 * @param GC - The GC.Spread.Sheets module
 * @param sheet - The SpreadJS worksheet
 * @param row - Row index
 * @param col - Column index
 */
export function getCellAddr(GC: any, sheet: any, row: number, col: number): string {
  return GC.Spread.Sheets.CalcEngine.rangeToFormula(sheet.getRange(row, col, 1, 1));
}

/**
 * Set a division formula with zero-check: IF(denominator<>0, numerator/denominator, 0)
 * @param GC - The GC.Spread.Sheets module
 * @param sheet - The SpreadJS worksheet
 * @param targetRow - Target row for formula
 * @param targetCol - Target column for formula
 * @param numeratorRow - Numerator cell row
 * @param numeratorCol - Numerator cell column
 * @param denominatorRow - Denominator cell row
 * @param denominatorCol - Denominator cell column
 * @param format - Number format (default: '0.00%')
 */
export function setDivisionFormula(
  GC: any,
  sheet: any,
  targetRow: number,
  targetCol: number,
  numeratorRow: number,
  numeratorCol: number,
  denominatorRow: number,
  denominatorCol: number,
  format: string = '0.00%'
): void {
  const numAddr = getCellAddr(GC, sheet, numeratorRow, numeratorCol);
  const denAddr = getCellAddr(GC, sheet, denominatorRow, denominatorCol);
  sheet.setFormula(targetRow, targetCol, `IF(${denAddr}<>0, ${numAddr}/${denAddr}, 0)`);
  sheet.setFormatter(targetRow, targetCol, format);
}

/**
 * Apply row highlight on cell selection
 * When a cell is clicked, the entire row will be highlighted
 *
 * @param GC - The GC.Spread.Sheets module
 * @param sheet - The SpreadJS worksheet
 * @param rowColor - Background color for highlighted row (default: light blue)
 * @param startRowOffset - Starting row offset (default: 0)
 * @param columnCount - Number of columns to highlight (default: all columns)
 * @param startColumnIndex - Starting column index (default: 0)
 */
export function applyRowHighlightOnSelect(
  GC: any,
  sheet: any, // GC.Spread.Sheets.Worksheet
  rowColor: string = COLORS.SELECTED,
  startRowOffset: number = 0,
  columnCount?: number,
  startColumnIndex: number = 0
): void {
  if (!GC || !sheet) {
    console.warn('GC or sheet not provided')
    return
  }

  const viewport = GC.Spread.Sheets.SheetArea.viewport
  const cfs = sheet.conditionalFormats

  // Clear existing conditional format rules
  cfs.clearRule()

  // Use provided columnCount if available, otherwise use all columns in the sheet
  const finalColumnCount = columnCount ?? sheet.getColumnCount(viewport)

  // Create style for highlighted row
  const rowStyle = new GC.Spread.Sheets.Style()
  rowStyle.backColor = rowColor

  // Define the range for highlighting
  const viewportRange = new GC.Spread.Sheets.Range(
    Math.max(0, startRowOffset),
    startColumnIndex ?? 0,
    Math.max(0, sheet.getRowCount(viewport) - Math.max(0, startRowOffset)),
    finalColumnCount
  )

  // Add row state rule for active row
  cfs.addRowStateRule(
    GC.Spread.Sheets.RowColumnStates.active,
    rowStyle,
    [viewportRange]
  )
}

/**
 * Apply column highlight on cell selection
 * When a cell is clicked, the entire column will be highlighted
 *
 * @param sheet - The SpreadJS worksheet
 * @param columnColor - Background color for highlighted column
 * @param startColumnOffset - Starting column offset (default: 0)
 * @param rowCount - Number of rows to highlight (default: all rows)
 * @param startRowIndex - Starting row index (default: 0)
 */
export function applyColumnHighlightOnSelect(
  sheet: any,
  columnColor: string = COLORS.SELECTED,
  startColumnOffset: number = 0,
  rowCount?: number,
  startRowIndex: number = 0
): void {
  const GC = (globalThis as any).GC
  if (!GC) return

  const viewport = GC.Spread.Sheets.SheetArea.viewport
  const cfs = sheet.conditionalFormats

  const finalRowCount = rowCount ?? sheet.getRowCount(viewport)

  const columnStyle = new GC.Spread.Sheets.Style()
  columnStyle.backColor = columnColor

  const viewportRange = new GC.Spread.Sheets.Range(
    startRowIndex ?? 0,
    Math.max(0, startColumnOffset),
    finalRowCount,
    Math.max(0, sheet.getColumnCount(viewport) - Math.max(0, startColumnOffset))
  )

  cfs.addColumnStateRule(
    GC.Spread.Sheets.RowColumnStates.active,
    columnStyle,
    [viewportRange]
  )
}

/**
 * Clear all conditional formatting rules from a sheet
 *
 * @param sheet - The SpreadJS worksheet
 */
export function clearConditionalFormats(sheet: any): void {
  const cfs = sheet.conditionalFormats
  cfs.clearRule()
}

/**
 * Set cell value and apply styling
 * Helper function to set cell value and apply various styles in one call
 *
 * @param GC - The GC.Spread.Sheets module
 * @param sheet - The SpreadJS worksheet
 * @param r - Row index
 * @param c - Column index
 * @param value - Cell value
 * @param style - Style options (bold, align, format, color, bg, border)
 */
export function setCell(
  GC: any,
  sheet: any,
  r: number,
  c: number,
  value: any,
  style: {
    bold?: boolean
    align?: 'left' | 'center' | 'right'
    format?: string
    color?: string
    bg?: string
    border?: boolean
    size?: number
  } = {}
): void {
  sheet.setValue(r, c, value)

  if (style.bold) {
    const fontSize = style.size || 11
    sheet.getCell(r, c).font(`bold ${fontSize}pt Calibri`)
  }

  if (style.align) {
    sheet
      .getCell(r, c)
      .hAlign(
        style.align === 'center'
          ? GC.Spread.Sheets.HorizontalAlign.center
          : style.align === 'right'
            ? GC.Spread.Sheets.HorizontalAlign.right
            : GC.Spread.Sheets.HorizontalAlign.left,
      )
  }

  if (style.format) sheet.setFormatter(r, c, style.format)
  if (style.color) sheet.getCell(r, c).foreColor(style.color)
  if (style.bg) sheet.getCell(r, c).backColor(style.bg)

  if (style.border) {
    sheet
      .getRange(r, c, 1, 1)
      .setBorder(
        new GC.Spread.Sheets.LineBorder(
          'black',
          GC.Spread.Sheets.LineStyle.thin,
        ),
        { all: true },
      )
  }
}

/**
 * Create a SUM formula from quarterly columns and set it to the annual cell
 * Helper function to reduce repetitive code when summing Q1-Q4 values for annual totals
 *
 * @param GC - The GC.Spread.Sheets module
 * @param sheet - The SpreadJS worksheet
 * @param quarterlyRow - Row index in quarterly table
 * @param annualRow - Row index in annual table
 * @param annualCol - Column index in annual table
 * @param quarterCols - Array of column indices [Q1, Q2, Q3, Q4]
 * @param format - Number format (default: '#,##0')
 */
export function setQuarterlySumFormula(
  GC: any,
  sheet: any,
  quarterlyRow: number,
  annualRow: number,
  annualCol: number,
  quarterCols: number[],
  format: string = '#,##0'
): void {
  if (quarterCols.length !== 4) return;

  const [q1Col, q2Col, q3Col, q4Col] = quarterCols;

  const q1Addr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
    sheet.getRange(quarterlyRow, q1Col, 1, 1)
  );
  const q2Addr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
    sheet.getRange(quarterlyRow, q2Col, 1, 1)
  );
  const q3Addr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
    sheet.getRange(quarterlyRow, q3Col, 1, 1)
  );
  const q4Addr = GC.Spread.Sheets.CalcEngine.rangeToFormula(
    sheet.getRange(quarterlyRow, q4Col, 1, 1)
  );

  sheet.setFormula(
    annualRow,
    annualCol,
    `${q1Addr} + ${q2Addr} + ${q3Addr} + ${q4Addr}`
  );
  sheet.setFormatter(annualRow, annualCol, format);
}

