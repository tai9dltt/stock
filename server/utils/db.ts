import mysql from 'mysql2/promise'

// Create MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // No password for local MySQL
  database: 'stock_analysis_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Export the pool for direct queries
export const db = pool

// Helper function to execute queries
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

// Helper function to execute single query
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows.length > 0 ? rows[0] : null
}

// Helper function to get a database connection
export async function getDb() {
  return pool.getConnection()
}

// Helper function to execute queries within a transaction
export async function transaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection()

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
