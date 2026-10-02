-- Initial schema (baseline). Applied once by scripts/migrate.mjs.
-- To wipe data use scripts/clean-db.js; never re-run this file on a live database.

ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 📋 audited_status
CREATE TABLE audited_status (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) UNIQUE,
  name VARCHAR(100),
  name_en VARCHAR(100)
);

-- 📋 united_types
CREATE TABLE united_types (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) UNIQUE,
  name VARCHAR(100),
  name_en VARCHAR(100)
);

-- 🏢 companies
CREATE TABLE companies (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  exchange VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_symbol (symbol)
);

-- 📅 periods
CREATE TABLE periods (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  symbol VARCHAR(20) NOT NULL, -- Added symbol

  year INT NOT NULL,
  quarter TINYINT NOT NULL DEFAULT 0,  -- 1..4, 0 = yearly
  period_begin DATE,
  period_end DATE,

  audited_status_code VARCHAR(10),
  united_code VARCHAR(10),
  source ENUM('quarter','year','plan') NOT NULL,
  is_forecast BOOLEAN DEFAULT FALSE,

  UNIQUE KEY uk_period (company_id, year, quarter, source),
  INDEX idx_company_year (company_id, year),
  INDEX idx_symbol_year (symbol, year),

  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (audited_status_code) REFERENCES audited_status(code),
  FOREIGN KEY (united_code) REFERENCES united_types(code)
);

-- 📚 report_components
CREATE TABLE report_components (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE,  -- income_statement, balance_sheet, ratios, plan
  name VARCHAR(255),
  name_en VARCHAR(255),
  ordering INT
);

-- Insert default components
INSERT INTO report_components (code, name, name_en, ordering) VALUES
('income_statement', 'Kết quả kinh doanh', 'Income Statement', 1),
('balance_sheet', 'Cân đối kế toán', 'Balance Sheet', 2),
('ratios', 'Chỉ số tài chính', 'Financial Ratios', 3),
('plan', 'Kế hoạch', 'Planning', 4);

-- metrics
CREATE TABLE metrics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,  -- REVENUE_NET, NET_PROFIT, EPS_TTM...
  component_id BIGINT NOT NULL,

  name VARCHAR(255),
  name_en VARCHAR(255),
  unit VARCHAR(50),
  display_order INT,

  INDEX idx_component (component_id),
  FOREIGN KEY (component_id) REFERENCES report_components(id)
);

-- Insert base metrics
INSERT INTO metrics (code, component_id, name, name_en, unit, display_order) VALUES
-- Income Statement (component_id = 1)
('REVENUE_NET', 1, 'Doanh thu thuần', 'Net Revenue', 'VND', 1),
('COST_OF_GOODS_SOLD', 1, 'Giá vốn hàng bán', 'Cost of Goods Sold', 'VND', 2),
('GROSS_PROFIT', 1, 'Lợi nhuận gộp', 'Gross Profit', 'VND', 3),
('OPERATING_PROFIT', 1, 'LN thuần từ HĐKD', 'Operating Profit', 'VND', 4),
('PROFIT_BEFORE_TAX', 1, 'Lợi nhuận trước thuế', 'Profit Before Tax', 'VND', 5),
('PROFIT_AFTER_TAX', 1, 'LNST thu nhập DN', 'Profit After Tax', 'VND', 6),
('NET_PROFIT', 1, 'LNST của CĐ cty mẹ', 'Net Profit (Parent)', 'VND', 7),

-- Balance Sheet (component_id = 2)
('TOTAL_ASSETS', 2, 'Tổng tài sản', 'Total Assets', 'VND', 1),
('CURRENT_ASSETS', 2, 'Tài sản ngắn hạn', 'Current Assets', 'VND', 2),
('NON_CURRENT_ASSETS', 2, 'Tài sản dài hạn', 'Non-current Assets', 'VND', 3),
('TOTAL_LIABILITIES', 2, 'Nợ phải trả', 'Total Liabilities', 'VND', 4),
('SHORT_TERM_LIABILITIES', 2, 'Nợ ngắn hạn', 'Short-term Liabilities', 'VND', 5),
('LONG_TERM_LIABILITIES', 2, 'Nợ dài hạn', 'Long-term Liabilities', 'VND', 6),
('EQUITY', 2, 'Vốn chủ sở hữu', 'Shareholders Equity', 'VND', 7),
('PAID_IN_CAPITAL', 2, 'Vốn góp của chủ sở hữu', 'Paid-in Capital', 'VND', 8),
('MINORITY_INTEREST', 2, 'Lợi ích của CĐ thiểu số', 'Minority Interest', 'VND', 9),

-- Ratios (component_id = 3)
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

-- Planning (component_id = 4)
('PLAN_REVENUE', 4, 'Doanh thu kế hoạch', 'Planned Revenue', 'VND', 1),
('PLAN_PBT', 4, 'LN trước thuế kế hoạch', 'Planned PBT', 'VND', 2),
('PLAN_PAT', 4, 'LN sau thuế kế hoạch', 'Planned PAT', 'VND', 3),
('PLAN_DIVIDEND_CASH', 4, 'Cổ tức tiền mặt', 'Cash Dividend', '%', 4),
('PLAN_DIVIDEND_STOCK', 4, 'Cổ tức cổ phiếu', 'Stock Dividend', '%', 5),
('PLAN_DIVIDEND_TOTAL', 4, 'Tổng cổ tức', 'Total Dividend', '%', 6),

-- Bank-specific metrics (component_id = 1)
('NET_INTEREST_INCOME', 1, 'Thu nhập lãi thuần', 'Net Interest Income', 'VND', 20),
('OPERATING_EXPENSES', 1, 'Chi phí hoạt động', 'Operating Expenses', 'VND', 21),
('TOTAL_OPERATING_INCOME', 1, 'Tổng TNTT', 'Total Operating Income', 'VND', 22),
('TOTAL_NET_PROFIT', 1, 'Tổng LNST', 'Total Net Profit After Tax', 'VND', 23),

-- Shares (component_id = 4)
('OUTSTANDING_SHARES', 4, 'Số CP lưu hành', 'Outstanding Shares', 'shares', 10),
('LISTED_SHARES', 4, 'Số CP niêm yết', 'Listed Shares', 'shares', 11);

-- metric_values
CREATE TABLE metric_values (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  company_id BIGINT NOT NULL,
  symbol VARCHAR(20) NOT NULL, -- Added symbol
  metric_id BIGINT NOT NULL,
  period_id BIGINT NOT NULL,

  value DECIMAL(20,4),
  source ENUM('vietstock','plan','manual') DEFAULT 'vietstock',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_value (company_id, metric_id, period_id),
  INDEX idx_metric_period (metric_id, period_id),
  INDEX idx_company_period (company_id, period_id),
  INDEX idx_symbol_metric (symbol, metric_id),
  INDEX idx_company_metric (company_id, metric_id),

  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (metric_id) REFERENCES metrics(id),
  FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
);

-- 📉 trading_snapshots
CREATE TABLE trading_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  company_id BIGINT NOT NULL,
  symbol VARCHAR(20) NOT NULL, -- Renamed from stock_code

  trading_date DATE NOT NULL,

  -- Shares
  outstanding_shares BIGINT,
  listed_shares BIGINT,

  -- Prices
  last_price DECIMAL(12,2),
  open_price DECIMAL(12,2),
  high_price DECIMAL(12,2),
  low_price DECIMAL(12,2),
  avg_price DECIMAL(12,2),
  prior_close_price DECIMAL(12,2),

  ceiling_price DECIMAL(12,2),
  floor_price DECIMAL(12,2),

  -- Volume / Value
  total_volume BIGINT,
  total_value BIGINT,

  -- Market
  market_cap BIGINT,
  beta DECIMAL(6,3),

  -- Valuation
  eps DECIMAL(12,4),
  pe DECIMAL(10,2),
  feps DECIMAL(12,4),
  bvps DECIMAL(12,2),
  pb DECIMAL(10,2),

  -- Foreign room
  total_room BIGINT,
  current_room BIGINT,
  remain_room_ratio DECIMAL(6,2),

  foreign_buy_volume BIGINT,
  foreign_buy_value BIGINT,
  foreign_sell_volume BIGINT,
  foreign_sell_value BIGINT,

  -- Order book
  outstanding_buy BIGINT,
  outstanding_sell BIGINT,

  -- Dividend
  dividend DECIMAL(12,2),
  dividend_yield DECIMAL(6,4),

  -- 52W
  min_52w_price DECIMAL(12,2),
  max_52w_price DECIMAL(12,2),
  vol_52w BIGINT,

  -- Status
  market_status INT,
  status_name VARCHAR(100),
  stock_status VARCHAR(100),

  source VARCHAR(50) DEFAULT 'vietstock',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_snapshot (company_id, trading_date),
  INDEX idx_company_time (company_id, trading_date),
  INDEX idx_symbol_time (symbol, trading_date),

  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 📝 stock_analysis (User's analysis data)
CREATE TABLE stock_analysis (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  symbol VARCHAR(20) NOT NULL, -- Added symbol

  entry_price DECIMAL(15,2),
  quarterly_data JSON,
  target_price DECIMAL(15,2),
  stop_loss DECIMAL(15,2),
  note_html MEDIUMTEXT,
  pe_assumptions JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_company (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
