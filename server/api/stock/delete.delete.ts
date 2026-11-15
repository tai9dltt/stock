import { transaction } from '../../utils/db';
import { symbolQuerySchema } from '../../utils/schemas';

export default defineEventHandler(async (event) => {
  const { symbol } = await getValidatedQuery(event, symbolQuerySchema.parse);

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

      // The user's inputs only: crawled figures and price snapshots are kept,
      // so opening the stock again shows them without a new crawl
      await connection.query(
        'DELETE FROM stock_analysis WHERE company_id = ?',
        [companyId]
      );
      // and the forecast journal
      await connection.query('DELETE FROM forecast_snapshots WHERE company_id = ?', [companyId]);

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
