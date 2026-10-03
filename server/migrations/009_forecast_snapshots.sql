-- Forecast journal: what each save projected, to compare with the actual
-- figures once they are reported.
CREATE TABLE forecast_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- { revenueGrowth, grossMargin, netProfitGrowth, growthOverrides, currentPrice, targetPrice }
  assumptions JSON NOT NULL,
  -- { "2026_Q3": { "revenue": 7390637, "netProfit": 166440, "eps": 753 } }
  forecast JSON NOT NULL,
  KEY idx_company_created (company_id, created_at),
  CONSTRAINT fk_forecast_snapshots_company
    FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
);
