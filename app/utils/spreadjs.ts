/**
 * SpreadJS Utility Functions
 * Helper functions for working with SpreadJS spreadsheets
 *
 * Performance optimizations:
 * - Cached LineBorder singletons (avoid creating hundreds of identical objects)
 * - Style-based cell styling (single getCell/setStyle call vs multiple)
 * - Range-based conditional formatting (2 rules per row vs per cell)
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

// ============ CACHED BORDER SINGLETONS ============

let _cachedThinBorder: any = null
let _cachedDoubleBorder: any = null
let _cachedBorderGC: any = null // Track which GC the borders were created for

/**
 * Get or create a cached thin LineBorder singleton
 */
export function getThinBorder(GC: any): any {
  if (!_cachedThinBorder || _cachedBorderGC !== GC) {
    _cachedThinBorder = new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.thin)
    _cachedBorderGC = GC
  }
  return _cachedThinBorder
}

/**
 * Get or create a cached double LineBorder singleton
 */
export function getDoubleBorder(GC: any): any {
  if (!_cachedDoubleBorder || _cachedBorderGC !== GC) {
    _cachedDoubleBorder = new GC.Spread.Sheets.LineBorder('black', GC.Spread.Sheets.LineStyle.double)
    _cachedBorderGC = GC
  }
  return _cachedDoubleBorder
}

// ============ CORE UTILITIES ============

/**
 * Apply thin border to a cell or range using cached border
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
    .setBorder(getThinBorder(GC), { all: true });
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

// ============ ROW/COLUMN HIGHLIGHT ============

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

// ============ CELL STYLING (OPTIMIZED) ============

/**
 * Set cell value and apply styling using a single Style object.
 * This is much faster than calling getCell() multiple times.
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

  // Only create Style object if any styling is needed
  const hasStyle = style.bold || style.align || style.color || style.bg || style.border
  if (hasStyle) {
    const cellStyle = new GC.Spread.Sheets.Style()

    if (style.bold) {
      const fontSize = style.size || 11
      cellStyle.font = `bold ${fontSize}pt Calibri`
    }

    if (style.align) {
      cellStyle.hAlign =
        style.align === 'center'
          ? GC.Spread.Sheets.HorizontalAlign.center
          : style.align === 'right'
            ? GC.Spread.Sheets.HorizontalAlign.right
            : GC.Spread.Sheets.HorizontalAlign.left
    }

    if (style.color) cellStyle.foreColor = style.color
    if (style.bg) cellStyle.backColor = style.bg

    if (style.border) {
      const border = getThinBorder(GC)
      cellStyle.borderLeft = border
      cellStyle.borderTop = border
      cellStyle.borderRight = border
      cellStyle.borderBottom = border
    }

    sheet.setStyle(r, c, cellStyle)
  }

  if (style.format) sheet.setFormatter(r, c, style.format)
}

// ============ FORMULA HELPERS ============

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

// ============ CONDITIONAL FORMATTING ============

/**
 * Apply conditional formatting to highlight growth cells (SINGLE CELL):
 * - Light green (#C6EFCE) when value > 20% (0.2)
 * - Light pink (#FFC7CE) when value < 0 (negative)
 *
 * @param GC - The GC.Spread.Sheets module
 * @param sheet - The SpreadJS worksheet
 * @param row - Row index
 * @param col - Column index
 */
export function applyGrowthHighlight(
  GC: any,
  sheet: any,
  row: number,
  col: number
): void {
  const cfs = sheet.conditionalFormats
  const range = [new GC.Spread.Sheets.Range(row, col, 1, 1)]
  const operators = GC.Spread.Sheets.ConditionalFormatting.ComparisonOperators
  const border = getThinBorder(GC)

  // Green for > 20%
  const greenStyle = new GC.Spread.Sheets.Style()
  greenStyle.backColor = '#C6EFCE'
  greenStyle.borderLeft = border
  greenStyle.borderTop = border
  greenStyle.borderRight = border
  greenStyle.borderBottom = border
  cfs.addCellValueRule(operators.greaterThan, 0.2, null, greenStyle, range)

  // Pink for < 0
  const pinkStyle = new GC.Spread.Sheets.Style()
  pinkStyle.backColor = '#FFC7CE'
  pinkStyle.borderLeft = border
  pinkStyle.borderTop = border
  pinkStyle.borderRight = border
  pinkStyle.borderBottom = border
  cfs.addCellValueRule(operators.lessThan, 0, null, pinkStyle, range)
}

/**
 * Apply conditional formatting to highlight an entire row range at once.
 * Uses 2 rules for the whole range instead of 2 rules per cell.
 * Much more efficient when applied to many columns.
 *
 * @param GC - The GC.Spread.Sheets module
 * @param sheet - The SpreadJS worksheet
 * @param row - Row index
 * @param startCol - Starting column index
 * @param colCount - Number of columns to cover
 */
export function applyGrowthHighlightRange(
  GC: any,
  sheet: any,
  row: number,
  startCol: number,
  colCount: number
): void {
  if (colCount <= 0) return

  const cfs = sheet.conditionalFormats
  const range = [new GC.Spread.Sheets.Range(row, startCol, 1, colCount)]
  const operators = GC.Spread.Sheets.ConditionalFormatting.ComparisonOperators
  const border = getThinBorder(GC)

  // Green for > 20%
  const greenStyle = new GC.Spread.Sheets.Style()
  greenStyle.backColor = '#C6EFCE'
  greenStyle.borderLeft = border
  greenStyle.borderTop = border
  greenStyle.borderRight = border
  greenStyle.borderBottom = border
  cfs.addCellValueRule(operators.greaterThan, 0.2, null, greenStyle, range)

  // Pink for < 0
  const pinkStyle = new GC.Spread.Sheets.Style()
  pinkStyle.backColor = '#FFC7CE'
  pinkStyle.borderLeft = border
  pinkStyle.borderTop = border
  pinkStyle.borderRight = border
  pinkStyle.borderBottom = border
  cfs.addCellValueRule(operators.lessThan, 0, null, pinkStyle, range)
}
