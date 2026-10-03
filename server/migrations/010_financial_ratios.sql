-- Quarterly financial ratios from Vietstock "Chỉ số tài chính" (CSTC)
INSERT IGNORE INTO metrics (code, component_id, name, name_en, unit, display_order) VALUES
('CFO_TO_OPERATING_PROFIT', 3, 'Dòng tiền từ HĐKD trên Lợi nhuận thuần từ HĐKD', 'Operating Cash Flow / Operating Profit', '%', 20),
('BORROWINGS_TO_EQUITY', 3, 'Tỷ số Nợ vay trên Vốn chủ sở hữu', 'Borrowings / Equity', '%', 21),
('DEBT_TO_EQUITY', 3, 'Tỷ số Nợ trên Vốn chủ sở hữu', 'Liabilities / Equity', '%', 22),
('CURRENT_RATIO', 3, 'Tỷ số thanh toán hiện hành (ngắn hạn)', 'Current Ratio', 'times', 23),
('INVENTORY_TURNOVER', 3, 'Vòng quay hàng tồn kho', 'Inventory Turnover', 'times', 24),
('INTEREST_COVERAGE', 3, 'Khả năng thanh toán lãi vay', 'Interest Coverage', 'times', 25),
('NIM', 3, 'Tỷ lệ thu nhập lãi thuần (NIM)', 'Net Interest Margin', '%', 26),
('CIR', 3, 'Tỷ lệ chi phí hoạt động/Tổng thu nhập HĐKD trước dự phòng (CIR)', 'Cost to Income', '%', 27),
('LDR', 3, 'Dư nợ cho vay khách hàng/Tổng vốn huy động (LDR)', 'Loan to Deposit', '%', 28);
