import { describe, expect, it } from 'vitest'
import { crawlBodySchema, saveBodySchema, symbolSchema } from '../../server/utils/schemas'

describe('symbolSchema', () => {
  it('normalizes case and whitespace', () => {
    expect(symbolSchema.parse(' fpt ')).toBe('FPT')
    expect(symbolSchema.parse('E1VFVN30')).toBe('E1VFVN30')
  })

  it.each(['', 'F', 'FPT;DROP', 'FPT VCB', 'ABCDEFGHIJK'])('rejects %j', (value) => {
    expect(symbolSchema.safeParse(value).success).toBe(false)
  })
})

describe('crawlBodySchema', () => {
  it('defaults type to all', () => {
    expect(crawlBodySchema.parse({ symbol: 'fpt' })).toEqual({ symbol: 'FPT', type: 'all' })
  })

  it('rejects unknown type and excessive page counts', () => {
    expect(crawlBodySchema.safeParse({ symbol: 'FPT', type: 'x' }).success).toBe(false)
    expect(crawlBodySchema.safeParse({ symbol: 'FPT', quarterPages: 500 }).success).toBe(false)
  })
})

describe('saveBodySchema', () => {
  it('accepts the payload sent by the analysis page', () => {
    const result = saveBodySchema.safeParse({
      symbol: 'FPT',
      quarterlyData: { annualData: {}, quarterlyData: {}, currentPrice: 62100 },
      entryPrice: null,
      targetPrice: 80000,
      stopLoss: null,
      noteHtml: '<p>note</p>',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-numeric prices', () => {
    expect(saveBodySchema.safeParse({ symbol: 'FPT', entryPrice: 'abc' }).success).toBe(false)
  })
})
