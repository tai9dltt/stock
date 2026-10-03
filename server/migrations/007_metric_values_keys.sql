-- 1. Amounts are crawled with Unit=1000000, so they are stored in million VND.
--    Per-share figures (EPS, BVPS) are in VND.
UPDATE metrics SET unit = 'million VND'
WHERE unit = 'VND' AND code NOT IN ('EPS_BASIC', 'EPS_TTM', 'BVPS');

-- 2. metric_values: natural primary key, company_id tied to the period's company

-- Lets metric_values reference (period, company) together
ALTER TABLE periods ADD UNIQUE KEY uk_period_company (id, company_id);

ALTER TABLE metric_values
  DROP FOREIGN KEY metric_values_ibfk_1,
  DROP FOREIGN KEY metric_values_ibfk_3;

ALTER TABLE metric_values
  DROP PRIMARY KEY,
  DROP COLUMN id,
  DROP INDEX uk_value,
  DROP INDEX period_id,
  DROP COLUMN source,                       -- always 'vietstock'
  MODIFY value DECIMAL(20,4) NOT NULL,      -- missing data has no row
  -- When Vietstock last changed the figure (an upsert with the same value keeps it)
  CHANGE created_at updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Clustered by company: loading a stock reads one contiguous range
  ADD PRIMARY KEY (company_id, period_id, metric_id),
  ADD INDEX idx_period_company (period_id, company_id);

ALTER TABLE metric_values
  ADD CONSTRAINT fk_metric_values_company
    FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
  -- The period must belong to the same company
  ADD CONSTRAINT fk_metric_values_period
    FOREIGN KEY (period_id, company_id) REFERENCES periods (id, company_id) ON DELETE CASCADE;
