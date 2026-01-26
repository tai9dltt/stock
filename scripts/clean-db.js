#!/usr/bin/env node
/**
 * Clean Database Script
 * This script will delete all data from all tables while preserving the schema
 *
 * Usage:
 *   node scripts/clean-db.js
 */

import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // No password for local MySQL
  database: 'stock_analysis_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

async function cleanDatabase() {
  const connection = await pool.getConnection()

  try {
    console.log('🧹 Starting database cleanup...\n')

    // Disable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')

    // Truncate all tables
    console.log('Truncating tables...')
    await connection.query('TRUNCATE TABLE metric_values')
    console.log('  ✓ metric_values')

    await connection.query('TRUNCATE TABLE trading_snapshots')
    console.log('  ✓ trading_snapshots')

    await connection.query('TRUNCATE TABLE stock_analysis')
    console.log('  ✓ stock_analysis')

    await connection.query('TRUNCATE TABLE periods')
    console.log('  ✓ periods')

    await connection.query('TRUNCATE TABLE companies')
    console.log('  ✓ companies')

    await connection.query('TRUNCATE TABLE metrics')
    console.log('  ✓ metrics')

    await connection.query('TRUNCATE TABLE report_components')
    console.log('  ✓ report_components')

    await connection.query('TRUNCATE TABLE audited_status')
    console.log('  ✓ audited_status')

    await connection.query('TRUNCATE TABLE united_types')
    console.log('  ✓ united_types')

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')

    console.log('\n📝 Re-inserting default data...')

    // Re-insert report components
    await connection.query(`
      INSERT INTO report_components (code, name, name_en, ordering) VALUES
      ('income_statement', 'Kết quả kinh doanh', 'Income Statement', 1),
      ('balance_sheet', 'Cân đối kế toán', 'Balance Sheet', 2),
      ('ratios', 'Chỉ số tài chính', 'Financial Ratios', 3),
      ('plan', 'Kế hoạch', 'Planning', 4)
    `)
    console.log('  ✓ report_components (4 rows)')

    // Re-insert metrics
    await connection.query(`
      INSERT INTO metrics (code, component_id, name, name_en, unit, display_order) VALUES
      -- Income Statement
      ('REVENUE_NET', 1, 'Doanh thu thuần', 'Net Revenue', 'VND', 1),
      ('COST_OF_GOODS_SOLD', 1, 'Giá vốn hàng bán', 'Cost of Goods Sold', 'VND', 2),
      ('GROSS_PROFIT', 1, 'Lợi nhuận gộp', 'Gross Profit', 'VND', 3),
      ('OPERATING_PROFIT', 1, 'LN thuần từ HĐKD', 'Operating Profit', 'VND', 4),
      ('PROFIT_BEFORE_TAX', 1, 'Lợi nhuận trước thuế', 'Profit Before Tax', 'VND', 5),
      ('PROFIT_AFTER_TAX', 1, 'LNST thu nhập DN', 'Profit After Tax', 'VND', 6),
      ('NET_PROFIT', 1, 'LNST của CĐ cty mẹ', 'Net Profit (Parent)', 'VND', 7),

      -- Balance Sheet
      ('TOTAL_ASSETS', 2, 'Tổng tài sản', 'Total Assets', 'VND', 1),
      ('CURRENT_ASSETS', 2, 'Tài sản ngắn hạn', 'Current Assets', 'VND', 2),
      ('NON_CURRENT_ASSETS', 2, 'Tài sản dài hạn', 'Non-current Assets', 'VND', 3),
      ('TOTAL_LIABILITIES', 2, 'Nợ phải trả', 'Total Liabilities', 'VND', 4),
      ('SHORT_TERM_LIABILITIES', 2, 'Nợ ngắn hạn', 'Short-term Liabilities', 'VND', 5),
      ('LONG_TERM_LIABILITIES', 2, 'Nợ dài hạn', 'Long-term Liabilities', 'VND', 6),
      ('EQUITY', 2, 'Vốn chủ sở hữu', 'Shareholders Equity', 'VND', 7),
      ('PAID_IN_CAPITAL', 2, 'Vốn góp của chủ sở hữu', 'Paid-in Capital', 'VND', 8),
      ('MINORITY_INTEREST', 2, 'Lợi ích của CĐ thiểu số', 'Minority Interest', 'VND', 9),

      -- Ratios
      ('EPS_TTM', 3, 'EPS 4 quý', 'EPS TTM', 'VND', 1),
      ('EPS_BASIC', 3, 'EPS cơ bản', 'EPS Basic', 'VND', 2),
      ('BVPS', 3, 'BVPS cơ bản', 'Book Value Per Share', 'VND', 3),
      ('PE', 3, 'P/E cơ bản', 'P/E Ratio', '', 4),
      ('PB', 3, 'P/B cơ bản', 'P/B Ratio', '', 5),
      ('ROS', 3, 'ROS', 'Return on Sales', '%', 6),
      ('ROE', 3, 'ROE', 'Return on Equity', '%', 7),
      ('ROA', 3, 'ROA', 'Return on Assets', '%', 8),
      ('GROSS_MARGIN', 3, 'Biên lợi nhuận gộp', 'Gross Margin', '%', 9),
      ('NET_MARGIN', 3, 'Biên lợi nhuận ròng', 'Net Margin', '%', 10),

      -- Planning
      ('PLAN_REVENUE', 4, 'Doanh thu kế hoạch', 'Planned Revenue', 'VND', 1),
      ('PLAN_PBT', 4, 'LN trước thuế kế hoạch', 'Planned PBT', 'VND', 2),
      ('PLAN_PAT', 4, 'LN sau thuế kế hoạch', 'Planned PAT', 'VND', 3),
      ('PLAN_DIVIDEND_CASH', 4, 'Cổ tức tiền mặt', 'Cash Dividend', '%', 4),
      ('PLAN_DIVIDEND_STOCK', 4, 'Cổ tức cổ phiếu', 'Stock Dividend', '%', 5),
      ('PLAN_DIVIDEND_TOTAL', 4, 'Tổng cổ tức', 'Total Dividend', '%', 6),

      -- Shares
      ('OUTSTANDING_SHARES', 4, 'Số CP lưu hành', 'Outstanding Shares', 'shares', 10),
      ('LISTED_SHARES', 4, 'Số CP niêm yết', 'Listed Shares', 'shares', 11)
    `)
    console.log('  ✓ metrics (31 rows)')

    // Show summary
    const [companies] = await connection.query('SELECT COUNT(*) as count FROM companies')
    const [stockAnalysis] = await connection.query('SELECT COUNT(*) as count FROM stock_analysis')
    const [metrics] = await connection.query('SELECT COUNT(*) as count FROM metrics')
    const [components] = await connection.query('SELECT COUNT(*) as count FROM report_components')

    console.log('\n✅ Database cleaned successfully!\n')
    console.log('Summary:')
    console.log(`  Companies: ${companies[0].count}`)
    console.log(`  Stock Analysis: ${stockAnalysis[0].count}`)
    console.log(`  Metrics: ${metrics[0].count}`)
    console.log(`  Report Components: ${components[0].count}`)

  } catch (error) {
    console.error('❌ Error cleaning database:', error)
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

// Run the script
cleanDatabase()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error)
    process.exit(1)
  })
