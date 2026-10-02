/**
 * Shared HTTP client for Vietstock AJAX endpoints.
 *
 * - Injects cookie + __RequestVerificationToken from the cached session
 * - Detects auth failures (3xx redirect or HTML login page), clears the
 *   session and re-logs in once
 * - Retries network errors / timeouts / 429 / 5xx with exponential backoff
 */

import { clearVietstockSession, getVietstockCredentials } from './auth'
import { USER_AGENT, VIETSTOCK_BASE } from './constants'

const REQUEST_TIMEOUT_MS = 15_000
const MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 500

export class VietstockAuthError extends Error {
  constructor(message = 'Vietstock session is not authenticated') {
    super(message)
    this.name = 'VietstockAuthError'
  }
}

class RetryableError extends Error {}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function postOnce(
  path: string,
  params: Record<string, string>,
  symbol: string,
  cookie: string,
  token: string
): Promise<unknown> {
  const body = new URLSearchParams(params)
  if (token) body.set('__RequestVerificationToken', token)

  let res: Response
  try {
    res = await fetch(`${VIETSTOCK_BASE}${path}`, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': cookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${VIETSTOCK_BASE}/${symbol}`,
        'Origin': VIETSTOCK_BASE,
        'User-Agent': USER_AGENT,
      },
      body: body.toString(),
    })
  } catch (error) {
    // Network error or timeout
    throw new RetryableError(error instanceof Error ? error.message : String(error))
  }

  if (res.status >= 300 && res.status < 400) {
    throw new VietstockAuthError(`${path} redirected (${res.status}) - session expired`)
  }
  if (res.status === 429 || res.status >= 500) {
    throw new RetryableError(`${path} returned ${res.status}`)
  }
  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}`)
  }

  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new VietstockAuthError(`${path} returned HTML (login page) - session expired`)
  }

  return text ? JSON.parse(text) : null
}

/**
 * POST a form to a Vietstock endpoint and return the parsed JSON body.
 */
export async function vietstockPost<T = unknown>(
  path: string,
  params: Record<string, string>,
  symbol: string
): Promise<T> {
  let reloggedIn = false
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { cookie, token } = await getVietstockCredentials()

    try {
      return await postOnce(path, params, symbol, cookie, token) as T
    } catch (error) {
      lastError = error

      if (error instanceof VietstockAuthError) {
        if (reloggedIn) throw error
        console.warn(`🔄 ${error.message}, re-login and retry...`)
        clearVietstockSession()
        reloggedIn = true
        continue
      }

      if (error instanceof RetryableError && attempt < MAX_ATTEMPTS) {
        const delay = BACKOFF_BASE_MS * 2 ** (attempt - 1)
        console.warn(`⏳ ${error.message}, retry ${attempt}/${MAX_ATTEMPTS - 1} in ${delay}ms`)
        await sleep(delay)
        continue
      }

      throw error
    }
  }

  throw lastError
}
