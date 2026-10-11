import { describe, expect, it } from 'vitest'
import { typedPercent } from '~/utils/spreadjs'

describe('typedPercent', () => {
  it('reads "5%" typed into a percent cell (SpreadJS appends one more "%")', () => {
    expect(typedPercent('5%%')).toBe(0.05)
    expect(typedPercent('-5%%')).toBe(-0.05)
    expect(typedPercent(' 12.5 % %')).toBe(0.125)
    expect(typedPercent('7,5%%')).toBe(0.075)
  })

  it('reads a decimal comma ("7,5" typed shows as "7,5%")', () => {
    expect(typedPercent('7,5%')).toBe(0.075)
    expect(typedPercent('-7,5%')).toBe(-0.075)
  })

  it('leaves other input to SpreadJS', () => {
    expect(typedPercent('5%')).toBeNull() // "5" typed: SpreadJS already gives 0.05
    expect(typedPercent('7.5%')).toBeNull()
    expect(typedPercent('5')).toBeNull()
    expect(typedPercent('abc%%')).toBeNull()
    expect(typedPercent(null)).toBeNull()
  })
})
