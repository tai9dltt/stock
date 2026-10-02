/**
 * DB connection settings for scripts, from the same env vars as the app
 * (run scripts with `node --env-file-if-exists=.env ...`, see package.json).
 */
export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stock_analysis_db',
}
