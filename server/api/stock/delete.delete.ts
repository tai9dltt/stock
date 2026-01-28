import type { PoolConnection } from 'mysql2/promise';
import { transaction } from '../../utils/db';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const symbol = query.symbol as string;

  if (!symbol) {
    throw createError({
      statusCode: 400,
      message: 'Symbol is required',
    });
  }

  try {
    const result = await transaction(async (connection) => {
      // Find company by symbol
      const [companies] = await connection.query<any[]>(
        'SELECT id FROM companies WHERE symbol = ?',
        [symbol.toUpperCase()]
      );

      if (!companies || companies.length === 0) {
        throw createError({
          statusCode: 404,
          message: `Stock analysis for ${symbol} not found`,
        });
      }

      const companyId = companies[0].id;

      // Delete stock_analysis (CASCADE will handle related data)
      await connection.query(
        'DELETE FROM stock_analysis WHERE company_id = ?',
        [companyId]
      );

      // Check if there are any remaining references
      const [periods] = await connection.query<any[]>(
        'SELECT COUNT(*) as count FROM periods WHERE company_id = ?',
        [companyId]
      );

      const [snapshots] = await connection.query<any[]>(
        'SELECT COUNT(*) as count FROM trading_snapshots WHERE company_id = ?',
        [companyId]
      );

      // If no other data exists, delete the company
      if (periods[0].count === 0 && snapshots[0].count === 0) {
        await connection.query('DELETE FROM companies WHERE id = ?', [companyId]);
      }

      return { symbol: symbol.toUpperCase() };
    });

    return {
      success: true,
      message: `Stock analysis for ${result.symbol} deleted successfully`,
    };
  } catch (error: any) {
    console.error('Error deleting stock analysis:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete stock analysis',
    });
  }
});
