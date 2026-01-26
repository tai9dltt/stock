-- -- Migration: Add quarterly_data column to stock_analysis table
-- -- Run this script manually or use Prisma migrate

-- -- Add quarterly_data column (will fail if column exists, that's OK)
-- ALTER TABLE stock_analysis
-- ADD COLUMN quarterly_data JSON AFTER grid_inputs;

-- -- Note: If column already exists, you can ignore the error
-- -- or check first with: SHOW COLUMNS FROM stock_analysis LIKE 'quarterly_data';
