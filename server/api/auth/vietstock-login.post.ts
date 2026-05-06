import type { H3Event } from 'h3'
import { loginVietstock, clearVietstockSession } from '../../utils/vietstockAuth'

interface LoginRequest {
  email?: string
  password?: string
}

/**
 * POST /api/auth/vietstock-login
 * 
 * Trigger Vietstock login manually.
 * Uses provided email/password or falls back to env vars.
 */
export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody<LoginRequest>(event)
  const config = useRuntimeConfig()

  const email = body.email || config.vietstockEmail
  const password = body.password || config.vietstockPassword

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required. Provide them in the request body or set VIETSTOCK_EMAIL/VIETSTOCK_PASSWORD in .env',
    })
  }

  try {
    // Clear existing session to force re-login
    clearVietstockSession()

    const session = await loginVietstock(email as string, password as string)

    return {
      success: true,
      message: `Đăng nhập Vietstock thành công với ${session.email}`,
      expiresAt: session.expiresAt
        ? new Date(session.expiresAt).toISOString()
        : null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Vietstock login error:', message)
    
    return {
      success: false,
      message: `Đăng nhập thất bại: ${message}`,
    }
  }
})
