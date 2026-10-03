-- Growth the user typed for single forecast quarters, replacing the growth
-- assumption there: { "revenue": { "2026_Q3": 0.3 }, "netProfit": { ... } }
ALTER TABLE stock_analysis ADD COLUMN growth_overrides JSON AFTER shares_by_quarter;
