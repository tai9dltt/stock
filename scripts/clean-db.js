#!/usr/bin/env node
/**
 * Delete all crawled and analysis data. Reference data (metrics,
 * report_components) and the schema are kept.
 *
 * Usage:
 *   npm run db:clean
 */

import mysql from 'mysql2/promise'
import { dbConfig } from './db-config.mjs'

const DATA_TABLES = ['metric_values', 'trading_snapshots', 'stock_analysis', 'periods', 'companies']

const connection = await mysql.createConnection(dbConfig)

try {
  console.log(`🧹 Cleaning ${dbConfig.database}...\n`)

  await connection.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const table of DATA_TABLES) {
    await connection.query(`TRUNCATE TABLE ${table}`)
    console.log(`  ✓ ${table}`)
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1')

  const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM metrics')
  console.log(`\n✅ Done. Kept ${count} metrics.`)
} catch (error) {
  console.error('❌ Error cleaning database:', error)
  process.exitCode = 1
} finally {
  await connection.end()
}
