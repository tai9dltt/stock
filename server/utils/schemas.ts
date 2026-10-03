/**
 * Shared zod schemas for validating API input.
 * Use with h3's readValidatedBody / getValidatedQuery: invalid input becomes a 400.
 */

import { z } from 'zod'

/** Stock symbol, normalized to upper case (e.g. "fpt " → "FPT") */
export const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,10}$/, 'Invalid stock symbol')

export const symbolQuerySchema = z.object({ symbol: symbolSchema })

const nullableNumber = z.number().nullable().optional()

export const crawlBodySchema = z.object({
  symbol: symbolSchema,
  type: z.enum(['all', 'quarter', 'year']).default('all'),
  quarterPages: z.number().int().min(1).max(10).optional(),
  yearPages: z.number().int().min(1).max(5).optional(),
})

const nonNegative = z.number().min(0).nullable().optional()

export const saveBodySchema = z.object({
  symbol: symbolSchema,
  // Forecast assumptions as fractions (0.25 = 25%)
  revenueGrowth: z.number().default(0),
  grossMargin: z.number().default(0),
  netProfitGrowth: z.number().default(0),
  peScenarios: z.array(z.number()).max(50).nullable().optional(),
  // Years added with "Add Year" (stored as forecast periods)
  forecastYears: z.array(z.string().regex(/^\d{4}$/)).max(30).default([]),
  // { "2025": { "Q1": 123456 } }
  sharesByQuarter: z.record(z.string(), z.record(z.string(), z.number())).nullable().optional(),
  // What the forecast quarters show, for the forecast journal: { "2026_Q3": { revenue, netProfit, eps } }
  forecast: z.record(
    z.string().regex(/^\d{4}_Q[1-4]$/),
    z.object({ revenue: z.number().nullable(), netProfit: z.number().nullable(), eps: z.number().nullable() })
  ).optional(),
  // Growth or gross margin typed for single forecast quarters: { "revenue": { "2026_Q3": 0.3 } }
  growthOverrides: z.object({
    revenue: z.record(z.string().regex(/^\d{4}_Q[1-4]$/), z.number()).optional(),
    grossMargin: z.record(z.string().regex(/^\d{4}_Q[1-4]$/), z.number()).optional(),
    netProfit: z.record(z.string().regex(/^\d{4}_Q[1-4]$/), z.number()).optional(),
  }).nullable().optional(),
  // Market data shown in the sheet (fallback when no live price is available)
  currentPrice: nonNegative,
  outstandingShares: nonNegative,
  max52W: nonNegative,
  min52W: nonNegative,
  // Trading plan
  entryPrice: nullableNumber,
  targetPrice: nullableNumber,
  stopLoss: nullableNumber,
  noteHtml: z.string().max(1_000_000).nullable().optional(),
})

export const vietstockLoginBodySchema = z.object({
  email: z.email().optional(),
  password: z.string().min(1).optional(),
}).default({})
