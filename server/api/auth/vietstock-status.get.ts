import { getVietstockSessionStatus } from '../../crawler/vietstock/auth'

/**
 * GET /api/auth/vietstock-status
 * 
 * Check current Vietstock authentication status.
 */
export default defineEventHandler(() => {
  return getVietstockSessionStatus()
})
