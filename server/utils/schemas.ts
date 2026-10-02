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

export const saveBodySchema = z.object({
  symbol: symbolSchema,
  // Current format sent by the analysis page (stored as-is in stock_analysis.quarterly_data)
  quarterlyData: z.record(z.string(), z.unknown()).optional(),
  // Older format, still accepted
  manualEdits: z.object({
    quarterly: z.record(z.string(), z.unknown()).optional(),
    annual: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  pe2022: nullableNumber,
  pe2023: nullableNumber,
  outstandingShares: nullableNumber,
  currentPrice: nullableNumber,
  entryPrice: nullableNumber,
  targetPrice: nullableNumber,
  stopLoss: nullableNumber,
  noteHtml: z.string().max(1_000_000).nullable().optional(),
})

export const chatBodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(20_000),
  })).min(1).max(100),
})

export const vietstockLoginBodySchema = z.object({
  email: z.email().optional(),
  password: z.string().min(1).optional(),
}).default({})
