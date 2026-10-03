-- Banks' "Tổng TNTT" (thu nhập trước thuế = profit before tax) was stored as
-- TOTAL_OPERATING_INCOME. The crawler now maps it to PROFIT_BEFORE_TAX; drop
-- the mislabelled values ("Cập nhật dữ liệu" stores them again correctly).
-- TOTAL_OPERATING_INCOME keeps "Tổng thu nhập từ hoạt động" only.
DELETE mv FROM metric_values mv
JOIN metrics m ON m.id = mv.metric_id
WHERE m.code = 'TOTAL_OPERATING_INCOME';

UPDATE metrics SET name = 'Tổng thu nhập từ hoạt động' WHERE code = 'TOTAL_OPERATING_INCOME';
