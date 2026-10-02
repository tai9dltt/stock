-- stock_analysis.quarterly_data held a full copy of the crawled metrics plus a
-- few user inputs. Crawled data lives in metric_values, so keep only the
-- inputs, as typed columns.

ALTER TABLE stock_analysis
  -- Forecast assumptions (fractions, 0.25 = 25%)
  ADD COLUMN revenue_growth DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER symbol,
  ADD COLUMN gross_margin DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER revenue_growth,
  ADD COLUMN net_profit_growth DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER gross_margin,
  -- P/E scenarios of the valuation table: [9.5, 11, ...]
  ADD COLUMN pe_scenarios JSON AFTER net_profit_growth,
  -- Outstanding shares per quarter as edited in the sheet: {"2025": {"Q1": 123}}
  ADD COLUMN shares_by_quarter JSON AFTER pe_scenarios,
  -- Market data last shown in the sheet; only used when no live price or snapshot exists
  ADD COLUMN current_price DECIMAL(15,2) AFTER shares_by_quarter,
  ADD COLUMN outstanding_shares BIGINT AFTER current_price,
  ADD COLUMN max_52w DECIMAL(15,2) AFTER outstanding_shares,
  ADD COLUMN min_52w DECIMAL(15,2) AFTER max_52w;

UPDATE stock_analysis SET
  revenue_growth = COALESCE(JSON_VALUE(quarterly_data, '$.revenueGrowth' RETURNING DECIMAL(12,6)), 0),
  gross_margin = COALESCE(JSON_VALUE(quarterly_data, '$.grossMargin' RETURNING DECIMAL(12,6)), 0),
  net_profit_growth = COALESCE(JSON_VALUE(quarterly_data, '$.netProfitGrowth' RETURNING DECIMAL(12,6)), 0),
  pe_scenarios = JSON_EXTRACT(quarterly_data, '$.peAssumptions.values'),
  shares_by_quarter = JSON_EXTRACT(quarterly_data, '$.quarterlyData.outstandingShares'),
  current_price = NULLIF(JSON_VALUE(quarterly_data, '$.currentPrice' RETURNING DECIMAL(15,2)), 0),
  outstanding_shares = NULLIF(JSON_VALUE(quarterly_data, '$.outstandingShares' RETURNING SIGNED), 0),
  max_52w = NULLIF(JSON_VALUE(quarterly_data, '$.max52W' RETURNING DECIMAL(15,2)), 0),
  min_52w = NULLIF(JSON_VALUE(quarterly_data, '$.min52W' RETURNING DECIMAL(15,2)), 0),
  updated_at = updated_at  -- not a user edit, keep the last-modified time
WHERE quarterly_data IS NOT NULL;

ALTER TABLE stock_analysis
  DROP COLUMN quarterly_data,
  DROP COLUMN pe_assumptions;  -- never written; P/E scenarios were inside quarterly_data
