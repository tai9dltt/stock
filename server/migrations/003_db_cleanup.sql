-- 1. Drop indexes no query uses, or that duplicate the leading columns of a unique key.
--    metric_values keeps uk_value (lookups by company), idx_metric_period (FK metric_id)
--    and period_id (FK period_id).
ALTER TABLE metric_values
  DROP INDEX idx_company_metric,  -- prefix of uk_value
  DROP INDEX idx_company_period,
  DROP INDEX idx_symbol_metric;

ALTER TABLE periods
  DROP INDEX idx_company_year,    -- prefix of uk_period
  DROP INDEX idx_symbol_year;

ALTER TABLE trading_snapshots
  DROP INDEX idx_company_time,    -- same columns as uk_snapshot
  DROP INDEX idx_symbol_time;

-- 2. Periods ended on the first day of their last month (2025-03-01 for Q1);
--    the crawler now stores the real last day.
UPDATE periods SET period_end = LAST_DAY(period_end) WHERE period_end IS NOT NULL;

-- 3. Deleting a company also deletes its analysis, like its other data.
ALTER TABLE stock_analysis DROP FOREIGN KEY stock_analysis_ibfk_1;
ALTER TABLE stock_analysis
  ADD CONSTRAINT stock_analysis_ibfk_1 FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE;
