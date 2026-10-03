import { z } from 'zod'
import { query } from '../../../utils/db'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Remove one entry of the forecast journal */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  await query('DELETE FROM forecast_snapshots WHERE id = ?', [id])
  return { success: true }
})
