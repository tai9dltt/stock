import { getVietstockSessionStatus } from '../../utils/vietstockAuth'

/**
 * GET /api/auth/vietstock-status
 * 
 * Check current Vietstock authentication status.
 */
export default defineEventHandler(() => {
  return getVietstockSessionStatus()
})
