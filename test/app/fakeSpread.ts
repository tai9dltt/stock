/**
 * Minimal in-memory stand-in for the SpreadJS API used by the sheet builders.
 *
 * It records the final state of the sheet (values, formulas, styles, borders,
 * spans, sizes, conditional formats) so a build can be serialized and compared
 * against a snapshot. It mirrors SpreadJS semantics that affect the result:
 * setStyle replaces a cell's whole style, setValue clears a formula and vice versa.
 */

type Style = Record<string, unknown>

class LineBorder {
  constructor(public color: string, public style: string) {}
  toString() {
    return `${this.style}`
  }
}

class Range {
  constructor(public row: number, public col: number, public rowCount: number, public colCount: number) {}
}

class FakeStyle {
  [key: string]: unknown
}

function colName(col: number): string {
  let name = ''
  let n = col + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

const addr = (row: number, col: number) => `${colName(col)}${row + 1}`

export const FakeGC = {
  Spread: {
    Sheets: {
      Style: FakeStyle,
      LineBorder,
      Range,
      LineStyle: { thin: 'thin', double: 'double' },
      HorizontalAlign: { left: 'left', center: 'center', right: 'right' },
      VerticalAlign: { center: 'center' },
      SheetArea: { viewport: 'viewport' },
      RowColumnStates: { active: 'active' },
      ConditionalFormatting: { ComparisonOperators: { greaterThan: '>', lessThan: '<' } },
      CalcEngine: {
        rangeToFormula(range: Range) {
          const start = addr(range.row, range.col)
          if (range.rowCount === 1 && range.colCount === 1) return start
          return `${start}:${addr(range.row + range.rowCount - 1, range.col + range.colCount - 1)}`
        },
      },
    },
  },
}

interface Cell {
  value?: unknown
  formula?: string
  style: Style
}

interface CfRule {
  kind: string
  op?: string
  value?: unknown
  style: Style
  ranges: Range[]
}

function serializeStyle(style: Style): Style {
  const out: Style = {}
  for (const key of Object.keys(style).sort()) {
    const v = style[key]
    if (v === undefined) continue
    out[key] = v instanceof LineBorder ? v.toString() : v
  }
  return out
}

export function createFakeSheet() {
  const cells = new Map<string, Cell>()
  const spans: string[] = []
  const rowHeights = new Map<number, number>()
  const colWidths = new Map<number, number>()
  const cfRules: CfRule[] = []
  const meta: Record<string, unknown> = {}

  const cell = (r: number, c: number): Cell => {
    const key = `${r},${c}`
    let entry = cells.get(key)
    if (!entry) {
      entry = { style: {} }
      cells.set(key, entry)
    }
    return entry
  }

  const forEachCell = (range: Range, fn: (r: number, c: number) => void) => {
    for (let r = range.row; r < range.row + range.rowCount; r++) {
      for (let c = range.col; c < range.col + range.colCount; c++) fn(r, c)
    }
  }

  const sheet = {
    options: {} as Record<string, unknown>,
    conditionalFormats: {
      addCellValueRule(op: string, value: unknown, _v2: unknown, style: Style, ranges: Range[]) {
        cfRules.push({ kind: 'cellValue', op, value, style: { ...style }, ranges })
      },
      addFormulaRule(formula: string, style: Style, ranges: Range[]) {
        cfRules.push({ kind: 'formula', value: ` ${formula}`, style: { ...style }, ranges })
      },
      addRowStateRule(state: string, style: Style, ranges: Range[]) {
        cfRules.push({ kind: `rowState:${state}`, style: { ...style }, ranges })
      },
    },
    setValue(r: number, c: number, value: unknown) {
      const entry = cell(r, c)
      entry.value = value
      delete entry.formula
    },
    getValue(r: number, c: number) {
      return cells.get(`${r},${c}`)?.value
    },
    setFormula(r: number, c: number, formula: string) {
      const entry = cell(r, c)
      entry.formula = formula
      delete entry.value
    },
    setFormatter(r: number, c: number, format: string) {
      cell(r, c).style.formatter = format
    },
    setStyle(r: number, c: number, style: Style) {
      cell(r, c).style = { ...style }
    },
    getCell(r: number, c: number) {
      // Like SpreadJS: no argument reads the value (without creating the
      // cell), an argument sets it
      const setter = (key: string) => (...args: unknown[]) => {
        if (args.length === 0) return cells.get(`${r},${c}`)?.style[key]
        cell(r, c).style[key] = args[0]
        return api
      }
      const api = {
        wordWrap: setter('wordWrap'),
        locked: setter('locked'),
        hAlign: setter('hAlign'),
        backColor: setter('backColor'),
      }
      return api
    },
    getRange(row: number, col: number, rowCount: number, colCount: number) {
      const range = new Range(row, col, rowCount, colCount)
      return Object.assign(range, {
        setBorder(border: LineBorder, opts: Record<string, boolean>) {
          const lastRow = range.row + range.rowCount - 1
          const lastCol = range.col + range.colCount - 1
          const left = opts.left || opts.outline
          const right = opts.right || opts.outline
          const top = opts.top || opts.outline
          const bottom = opts.bottom || opts.outline
          forEachCell(range, (r, c) => {
            const sides = {
              borderLeft: opts.all || (left && c === range.col),
              borderRight: opts.all || (right && c === lastCol),
              borderTop: opts.all || (top && r === range.row),
              borderBottom: opts.all || (bottom && r === lastRow),
            }
            // Only touch cells that get a border (an outline leaves the inside alone)
            for (const [side, on] of Object.entries(sides)) if (on) cell(r, c).style[side] = border
          })
        },
        backColor(color: string) {
          forEachCell(range, (r, c) => {
            cell(r, c).style.backColor = color
          })
        },
      })
    },
    addSpan(row: number, col: number, rowCount: number, colCount: number) {
      spans.push(`${addr(row, col)}+${rowCount}x${colCount}`)
    },
    setRowHeight(r: number, h: number) {
      rowHeights.set(r, h)
    },
    setColumnWidth(c: number, w: number) {
      colWidths.set(c, w)
    },
    setColumnCount(n: number) {
      meta.columnCount = n
    },
    setRowCount(n: number) {
      meta.rowCount = n
    },
    getColumnCount() {
      return meta.columnCount ?? 100
    },
    getRowCount() {
      return meta.rowCount ?? 200
    },
    frozenColumnCount(n: number) {
      meta.frozenColumnCount = n
    },
    autoFitColumn(c: number) {
      meta.autoFitColumn = c
    },
  }

  /** Stable, diff-friendly text dump of the sheet */
  function serialize(): string {
    const lines: string[] = []

    const sortedCells = [...cells.entries()]
      .map(([key, value]) => {
        const [r, c] = key.split(',').map(Number) as [number, number]
        return { r, c, value }
      })
      .sort((a, b) => a.r - b.r || a.c - b.c)

    for (const { r, c, value } of sortedCells) {
      const parts: string[] = [addr(r, c)]
      if (value.formula !== undefined) parts.push(`=${value.formula}`)
      else if (value.value !== undefined) {
        parts.push(value.value instanceof Date ? `date:${value.value.toISOString()}` : JSON.stringify(value.value))
      }
      const style = serializeStyle(value.style)
      if (Object.keys(style).length > 0) parts.push(JSON.stringify(style))
      lines.push(parts.join(' | '))
    }

    // Conditional formats: expand range rules into per-cell rules so a range
    // rule and equivalent per-cell rules serialize the same way.
    const cfPerCell = new Map<string, string[]>()
    for (const rule of cfRules) {
      const desc = `${rule.kind}${rule.op ?? ''}${rule.value ?? ''} ${JSON.stringify(serializeStyle(rule.style))}`
      if (rule.kind.startsWith('rowState')) {
        const r = rule.ranges[0]!
        lines.push(`cf ${desc} rows ${r.row}+${r.rowCount} cols ${r.col}+${r.colCount}`)
        continue
      }
      for (const range of rule.ranges) {
        forEachCell(range, (r, c) => {
          const key = addr(r, c)
          cfPerCell.set(key, [...(cfPerCell.get(key) ?? []), desc])
        })
      }
    }
    for (const [key, descs] of [...cfPerCell.entries()].sort()) {
      lines.push(`cf ${key} ${[...descs].sort().join(' ; ')}`)
    }

    lines.push(`spans ${[...spans].sort().join(' ')}`)
    lines.push(`rowHeights ${JSON.stringify([...rowHeights.entries()].sort((a, b) => a[0] - b[0]))}`)
    lines.push(`colWidths ${JSON.stringify([...colWidths.entries()].sort((a, b) => a[0] - b[0]))}`)
    lines.push(`meta ${JSON.stringify(meta)}`)

    return lines.join('\n') + '\n'
  }

  return { sheet, serialize }
}

export function createFakeSpread() {
  return { options: {} as Record<string, unknown> }
}
