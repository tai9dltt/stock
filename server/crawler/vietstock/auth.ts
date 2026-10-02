/**
 * Vietstock Authentication Utility
 * 
 * Manages automatic login to Vietstock using email/password.
 * Caches authenticated cookies in memory and auto-refreshes when expired.
 */

import { USER_AGENT, VIETSTOCK_BASE } from './constants'

const LOGIN_URL = `${VIETSTOCK_BASE}/Account/Login`

// ─── In-memory session cache ────────────────────────────────────────

interface VietstockSession {
  cookie: string
  token: string
  loginTime: number
  expiresAt: number | null
  email: string
}

let cachedSession: VietstockSession | null = null
// Shared in-flight auto-login so concurrent requests don't log in twice
let pendingLogin: Promise<VietstockSession> | null = null

// ─── Cookie parsing helpers ─────────────────────────────────────────

/**
 * Extract Set-Cookie values from response headers and merge into a cookie string
 */
function extractCookies(response: Response, existingCookies: string = ''): string {
  const cookieMap = new Map<string, string>()

  // Parse existing cookies
  if (existingCookies) {
    existingCookies.split(';').forEach(c => {
      const [key, ...val] = c.trim().split('=')
      if (key && val.length > 0) {
        cookieMap.set(key.trim(), val.join('=').trim())
      }
    })
  }

  // Parse Set-Cookie headers from response
  const setCookieHeaders = response.headers.getSetCookie?.() || []
  for (const setCookie of setCookieHeaders) {
    // Extract just the key=value part (before first ;)
    const cookiePart = setCookie.split(';')[0]
    if (cookiePart) {
      const [key, ...val] = cookiePart.trim().split('=')
      if (key && val.length > 0) {
        cookieMap.set(key.trim(), val.join('=').trim())
      }
    }
  }

  // Rebuild cookie string
  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

/**
 * Extract a specific cookie value from a cookie string
 */
function getCookieValue(cookieStr: string, name: string): string | null {
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match?.[1] ?? null
}

/**
 * Decode JWT payload to get expiration time
 */
function decodeJwtExpiry(jwt: string): number | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64').toString())
    return payload.exp ? payload.exp * 1000 : null // Convert to milliseconds
  } catch {
    return null
  }
}

/**
 * Extract __RequestVerificationToken from HTML page
 * Handles both quoted (value="token") and unquoted (value=token) attributes
 */
const FORM_TOKEN_PATTERNS = [
  /name="__RequestVerificationToken"[^>]*value="([^"]+)"/, // quoted
  /value="([^"]+)"[^>]*name="__RequestVerificationToken"/, // quoted, reverse order
  /name=__RequestVerificationToken[^>]*value=([^\s>]+)/, // unquoted
  /value=([^\s>]+)[^>]*name=__RequestVerificationToken/, // unquoted, reverse order
]

function extractFormToken(html: string): string | null {
  for (const pattern of FORM_TOKEN_PATTERNS) {
    const token = html.match(pattern)?.[1]
    if (token) return token
  }
  return null
}

// ─── Core authentication functions ──────────────────────────────────

/**
 * Step 1: Fetch the Vietstock homepage to get initial cookies and CSRF token
 */
async function fetchInitialPage(): Promise<{ cookies: string; formToken: string }> {
  console.log('🔐 Step 1: Fetching Vietstock homepage for CSRF token...')

  const response = await fetch(VIETSTOCK_BASE, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      'User-Agent': USER_AGENT,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Vietstock homepage: ${response.status}`)
  }

  const html = await response.text()
  const cookies = extractCookies(response)
  const formToken = extractFormToken(html)

  if (!formToken) {
    throw new Error('Could not find __RequestVerificationToken in Vietstock page')
  }

  console.log('✅ Got initial cookies and CSRF token')
  return { cookies, formToken }
}

/**
 * Step 2: POST login with email/password
 */
async function postLogin(
  email: string,
  password: string,
  cookies: string,
  formToken: string
): Promise<VietstockSession> {
  console.log(`🔐 Step 2: Logging in as ${email}...`)

  const body = new URLSearchParams({
    '__RequestVerificationToken': formToken,
    'Email': email,
    'Password': password,
    'responseCaptchaLoginPopup': '',
    'g-recaptcha-response': '',
    'Remember': 'false',
    'X-Requested-With': 'XMLHttpRequest',
  }).toString()

  const response = await fetch(LOGIN_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': cookies,
      'Referer': `${VIETSTOCK_BASE}/`,
      'Origin': VIETSTOCK_BASE,
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': USER_AGENT,
    },
    body,
  })

  // Merge response cookies with existing ones
  const mergedCookies = extractCookies(response, cookies)

  // Check if login was successful by looking for CookieLogin
  const cookieLogin = getCookieValue(mergedCookies, 'CookieLogin')
  if (!cookieLogin) {
    // Try to read response body for error message
    let errorMsg = 'Login failed - no CookieLogin received'
    try {
      const responseText = await response.text()
      if (responseText) {
        // Vietstock returns JSON with error messages
        const responseData = JSON.parse(responseText)
        if (responseData && typeof responseData === 'object') {
          errorMsg = responseData.Message || responseData.message || errorMsg
        }
      }
    } catch {
      // Ignore parse errors
    }
    throw new Error(errorMsg)
  }

  // Get expiration from JWT
  const expiresAt = decodeJwtExpiry(cookieLogin)

  // Step 3: Fetch a page with authenticated cookies to get the form token
  // The cookie __RequestVerificationToken and body/form token are DIFFERENT in ASP.NET
  console.log('🔐 Step 3: Fetching form token for API calls...')
  try {
    const pageResponse = await fetch(VIETSTOCK_BASE, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': mergedCookies,
        'User-Agent': USER_AGENT,
      },
    })
    const pageHtml = await pageResponse.text()
    // Update cookies from this response too
    const finalCookies = extractCookies(pageResponse, mergedCookies)
    const apiFormToken = extractFormToken(pageHtml) || ''
    if (apiFormToken) {
      console.log('✅ Got form token for API calls')
    }
    
    const session: VietstockSession = {
      cookie: finalCookies,
      token: apiFormToken,
      loginTime: Date.now(),
      expiresAt,
      email,
    }

    console.log(`✅ Login successful as ${email}`)
    if (expiresAt) {
      const expiryDate = new Date(expiresAt)
      console.log(`📅 Session expires at: ${expiryDate.toISOString()}`)
    }

    return session
  } catch {
    console.warn('⚠️ Could not fetch form token, using cookie token as fallback')
    // Fallback: use cookie token
    const verificationToken = getCookieValue(mergedCookies, '__RequestVerificationToken') || ''
    
    const session: VietstockSession = {
      cookie: mergedCookies,
      token: verificationToken,
      loginTime: Date.now(),
      expiresAt,
      email,
    }

    console.log(`✅ Login successful as ${email}`)
    return session
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Perform full Vietstock login flow
 */
export async function loginVietstock(email: string, password: string): Promise<VietstockSession> {
  const { cookies, formToken } = await fetchInitialPage()
  const session = await postLogin(email, password, cookies, formToken)

  // Cache the session
  cachedSession = session
  return session
}

/**
 * Check if current session is still valid
 */
export function isSessionValid(): boolean {
  if (!cachedSession) return false

  // Check JWT expiry
  if (cachedSession.expiresAt) {
    // Add 5 minute buffer before actual expiry
    const buffer = 5 * 60 * 1000
    if (Date.now() >= cachedSession.expiresAt - buffer) {
      console.log('⚠️ Vietstock session expired or about to expire')
      return false
    }
  }

  // If no expiry info, assume valid for 24 hours
  const maxAge = 24 * 60 * 60 * 1000
  if (Date.now() - cachedSession.loginTime > maxAge) {
    console.log('⚠️ Vietstock session older than 24 hours, refreshing...')
    return false
  }

  return true
}

/**
 * Get Vietstock credentials, auto-login if needed.
 * Falls back to env vars (VIETSTOCK_COOKIE_RAW, VIETSTOCK_TOKEN) if email/password not configured.
 */
export async function getVietstockCredentials(): Promise<{ cookie: string; token: string }> {
  // If we have a valid cached session, use it
  if (cachedSession && isSessionValid()) {
    return { cookie: cachedSession.cookie, token: cachedSession.token }
  }

  const config = useRuntimeConfig()

  // Try auto-login with email/password
  const email = config.vietstockEmail
  const password = config.vietstockPassword

  if (email && password) {
    try {
      if (!pendingLogin) {
        console.log('🔄 Auto-login to Vietstock...')
        pendingLogin = loginVietstock(email, password).finally(() => {
          pendingLogin = null
        })
      }
      const session = await pendingLogin
      return { cookie: session.cookie, token: session.token }
    } catch (error) {
      console.error('❌ Auto-login failed:', error instanceof Error ? error.message : error)
      // Fall through to env var fallback
    }
  }

  // Fallback: use raw cookie/token from env
  const cookie = config.vietstockCookie
  const token = config.vietstockToken

  if (cookie) {
    return { cookie: cookie as string, token: token as string }
  }

  throw new Error(
    'Vietstock credentials not configured. Set VIETSTOCK_EMAIL/VIETSTOCK_PASSWORD or VIETSTOCK_COOKIE_RAW/VIETSTOCK_TOKEN in .env'
  )
}

/**
 * Get current session status (for status endpoint)
 */
export function getVietstockSessionStatus(): {
  authenticated: boolean
  email: string | null
  expiresAt: string | null
  loginTime: string | null
  source: 'auto-login' | 'env-cookie' | 'none'
} {
  if (cachedSession && isSessionValid()) {
    return {
      authenticated: true,
      email: cachedSession.email,
      expiresAt: cachedSession.expiresAt
        ? new Date(cachedSession.expiresAt).toISOString()
        : null,
      loginTime: new Date(cachedSession.loginTime).toISOString(),
      source: 'auto-login',
    }
  }

  const config = useRuntimeConfig()
  if (config.vietstockCookie) {
    return {
      authenticated: true,
      email: null,
      expiresAt: null,
      loginTime: null,
      source: 'env-cookie',
    }
  }

  return {
    authenticated: false,
    email: null,
    expiresAt: null,
    loginTime: null,
    source: 'none',
  }
}

/**
 * Clear cached session (force re-login on next request)
 */
export function clearVietstockSession(): void {
  cachedSession = null
  console.log('🗑️ Vietstock session cache cleared')
}
