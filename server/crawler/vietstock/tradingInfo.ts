/**
 * Vietstock trading info endpoint (/company/tradinginfo)
 */

import { vietstockPost } from './client'

export interface TradingInfo {
  lastPrice?: number
  outstandingShares?: number
  listedShares?: number
  min52W?: number
  max52W?: number
  vol52W?: number
}

/**
 * Fetch raw trading info (LastPrice, KLCPLH, KLCPNY, Min52W, ...).
 */
export async function fetchTradingInfoRaw(symbol: string): Promise<Record<string, any> | null> {
  const data = await vietstockPost<Record<string, any> | null>('/company/tradinginfo', {
    code: symbol,
    s: '0',
    t: '',
  }, symbol)

  return data && typeof data === 'object' ? data : null
}

export function toTradingInfo(raw: Record<string, any>): TradingInfo {
  return {
    lastPrice: raw.LastPrice,
    outstandingShares: raw.KLCPLH,
    listedShares: raw.KLCPNY,
    min52W: raw.Min52W,
    max52W: raw.Max52W,
    vol52W: raw.Vol52W,
  }
}
