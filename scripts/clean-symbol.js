#!/usr/bin/env node
/**
 * Clean Symbol Data Script
 * This script will delete all data for a specific stock symbol from the database
 *
 * Usage:
 *   npm run db:clean-symbol -- MSH
 */

import mysql from 'mysql2/promise'
import { dbConfig } from './db-config.mjs'

const pool = mysql.createPool(dbConfig)

async function cleanSymbolData(symbol) {
  if (!symbol) {
    console.error('❌ Error: Symbol is required')
    console.log('Usage: npm run db:clean-symbol -- <SYMBOL>')
    process.exit(1)
  }

  const upperSymbol = symbol.toUpperCase()
  const connection = await pool.getConnection()

  try {
    console.log(`🧹 Cleaning data for symbol: ${upperSymbol}...\n`)

    // Start transaction
    await connection.beginTransaction()

    // Get company ID
    const [companies] = await connection.query(
      'SELECT id FROM companies WHERE symbol = ?',
      [upperSymbol]
    )

    if (!companies || companies.length === 0) {
      console.log(`ℹ️  Symbol ${upperSymbol} not found in database. Nothing to clean.`)
      await connection.rollback()
      return
    }

    const companyId = companies[0].id

    // Delete data in order (respecting foreign keys)
    console.log('Deleting data...')

    // 1. Delete metric values
    const [metricValuesResult] = await connection.query(
      'DELETE FROM metric_values WHERE company_id = ?',
      [companyId]
    )
    console.log(`  ✓ metric_values: ${metricValuesResult.affectedRows} rows deleted`)

    // 2. Delete trading snapshots
    const [tradingResult] = await connection.query(
      'DELETE FROM trading_snapshots WHERE company_id = ?',
      [companyId]
    )
    console.log(`  ✓ trading_snapshots: ${tradingResult.affectedRows} rows deleted`)

    // 3. Delete stock analysis
    const [analysisResult] = await connection.query(
      'DELETE FROM stock_analysis WHERE company_id = ?',
      [companyId]
    )
    console.log(`  ✓ stock_analysis: ${analysisResult.affectedRows} rows deleted`)

    // 4. Delete periods
    const [periodsResult] = await connection.query(
      'DELETE FROM periods WHERE company_id = ?',
      [companyId]
    )
    console.log(`  ✓ periods: ${periodsResult.affectedRows} rows deleted`)

    // 5. Delete company
    const [companyResult] = await connection.query(
      'DELETE FROM companies WHERE id = ?',
      [companyId]
    )
    console.log(`  ✓ companies: ${companyResult.affectedRows} rows deleted`)

    // Commit transaction
    await connection.commit()

    console.log(`\n✅ Successfully cleaned all data for symbol: ${upperSymbol}`)
    console.log(`\n📊 Summary:`)
    console.log(`  Metric values: ${metricValuesResult.affectedRows}`)
    console.log(`  Trading snapshots: ${tradingResult.affectedRows}`)
    console.log(`  Stock analysis: ${analysisResult.affectedRows}`)
    console.log(`  Periods: ${periodsResult.affectedRows}`)
    console.log(`  Company: ${companyResult.affectedRows}`)

  } catch (error) {
    await connection.rollback()
    console.error('❌ Error cleaning symbol data:', error)
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

// Get symbol from command line argument
const symbol = process.argv[2]

// Run the script
cleanSymbolData(symbol)
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message)
    process.exit(1)
  })
