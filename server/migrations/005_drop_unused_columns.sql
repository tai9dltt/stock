-- Remove columns and tables nothing reads or writes.

-- 1. symbol was copied into every table; all queries go through company_id
ALTER TABLE periods DROP COLUMN symbol;
ALTER TABLE metric_values DROP COLUMN symbol;
ALTER TABLE stock_analysis DROP COLUMN symbol;
ALTER TABLE trading_snapshots DROP COLUMN symbol;

-- 2. Audit status / consolidation type lookups were never filled
ALTER TABLE periods
  DROP FOREIGN KEY periods_ibfk_2,
  DROP FOREIGN KEY periods_ibfk_3;
ALTER TABLE periods
  DROP COLUMN audited_status_code,
  DROP COLUMN united_code;
DROP TABLE audited_status;
DROP TABLE united_types;

-- 3. trading_snapshots: keep the fields the trading info endpoint stores
ALTER TABLE trading_snapshots
  DROP COLUMN open_price,
  DROP COLUMN high_price,
  DROP COLUMN low_price,
  DROP COLUMN avg_price,
  DROP COLUMN prior_close_price,
  DROP COLUMN ceiling_price,
  DROP COLUMN floor_price,
  DROP COLUMN total_volume,
  DROP COLUMN total_value,
  DROP COLUMN beta,
  DROP COLUMN eps,
  DROP COLUMN pe,
  DROP COLUMN feps,
  DROP COLUMN bvps,
  DROP COLUMN pb,
  DROP COLUMN total_room,
  DROP COLUMN current_room,
  DROP COLUMN remain_room_ratio,
  DROP COLUMN foreign_buy_volume,
  DROP COLUMN foreign_buy_value,
  DROP COLUMN foreign_sell_volume,
  DROP COLUMN foreign_sell_value,
  DROP COLUMN outstanding_buy,
  DROP COLUMN outstanding_sell,
  DROP COLUMN dividend,
  DROP COLUMN dividend_yield,
  DROP COLUMN market_status,
  DROP COLUMN status_name,
  DROP COLUMN stock_status;
