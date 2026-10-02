import mysql from 'mysql2/promise'

// Create MySQL connection pool using environment variables
const config = useRuntimeConfig()
const pool = mysql.createPool({
  host: config.dbHost || 'localhost',
  port: Number(config.dbPort) || 3306,
  user: config.dbUser || 'root',
  password: config.dbPassword || '',
  database: config.dbName || 'stock_analysis_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

/**
 * mysql2 connection failures (e.g. ECONNREFUSED) come as errors with an empty
 * message, so rethrow them with a readable one. The original error is kept as `cause`.
 */
function wrapDbError(error: unknown): unknown {
  if (!(error instanceof Error) || error.message) return error

  const { code, address, port } = error as Error & { code?: string; address?: string; port?: number }
  const target = address ? ` ${address}:${port}` : ` ${config.dbHost || 'localhost'}`
  return new Error(`Không kết nối được MySQL (${code || error.name}${target})`, { cause: error })
}

// Export the pool for direct queries
export const db = pool

// Helper function to execute queries
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  try {
    const [rows] = await pool.execute(sql, params)
    return rows as T[]
  } catch (error) {
    throw wrapDbError(error)
  }
}

// Helper function to execute single query
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

// Helper function to get a database connection
export async function getDb() {
  return pool.getConnection().catch((error) => {
    throw wrapDbError(error)
  })
}

// Helper function to execute queries within a transaction
export async function transaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getDb()

  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
