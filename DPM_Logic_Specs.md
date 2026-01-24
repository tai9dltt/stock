Tài liệu này định nghĩa các biến số, công thức và quy trình tư vấn logic để hệ thống AI tự động hóa việc tính toán dữ liệu tài chính cho mã cổ phiếu DPM.

1. Định Nghĩa Biến Số (Variables Definition)
   A. Dữ liệu đầu vào (Inputs)$Net_Revenue: Thu nhập lãi thuần hoặc Doanh thu thuần.$Gross\*Profit: Lợi nhuận gộp.$Net_Profit: Lợi nhuận sau thuế của công ty mẹ.$Shares_Outstanding: Khối lượng cổ phiếu đang lưu hành (Mặc định DPM = 391,334,260).$Current_Price: Giá thị trường hiện tại của cổ phiếu.$PE_Assumed: Chỉ số P/E giả định để định giá.

B. Chỉ số thời gian (Timeframes)[T]: Kỳ hiện tại (Năm hoặc Quý).[T-1]: Kỳ liền kề trước đó (để tính tăng trưởng quý trước/năm trước).[T-4]: Kỳ cùng kỳ năm ngoái (để tính tăng trưởng YoY).

2. Hệ Thống Công Thức (Mathematical Logic)
   2.1. Nhóm Chỉ Số Hiệu Quả (Profitability)AI sử dụng LaTeX để xử lý các phép tính sau:Biên Lợi Nhuận Gộp (Gross Margin):$$Gross\_Margin = \frac{\$Gross\_Profit}{\$Net\_Revenue}$$Biên Lợi Nhuận Ròng (Net Margin):$$Net\_Margin = \frac{\$Net\_Profit}{\$Net\_Revenue}$$
   2.2. Nhóm Chỉ Số Tăng Trưởng (Growth)Tăng trưởng Doanh thu/Lợi nhuận:$$Growth = \frac{Value*{[T]} - Value*{[T-x]}}{Value*{[T-x]}}$$(Trong đó $x=1$ cho tăng trưởng liên tiếp, $x=4$ cho tăng trưởng cùng kỳ).
   2.3. Nhóm Chỉ Số Trên Mỗi Cổ Phần (Per Share)EPS Quý (Earnings Per Share):$$EPS*{Quarter} = \frac{\$Net_Profit \times 1,000,000}{\$Shares_Outstanding}$$EPS Lũy Kế 4 Quý (EPS Trailing 12 Months - TTM):$$EPS*{TTM} = \sum*{i=0}^{3} EPS*{Quarter[T-i]}$$
   2.4. Nhóm Định Giá (Valuation)Giá Mục Tiêu (Target Price):$$Target_Price = EPS\_{TTM} \times \$PE_Assumed$$

3. Quy Trình Logic Của Model (Reasoning Flow)Hệ thống AI khi đọc dữ liệu thô (CSV/Excel) phải tuân thủ các bước sau:
   Bước 1 - Trích xuất: Xác định các dòng chứa $Net_Revenue, $Net_Profit và khối lượng cổ phiếu.
Bước 2 - Kiểm tra đơn vị: Nếu lợi nhuận đơn vị là $10^6$, phải nhân với $1,000,000$ trước khi chia cho số lượng cổ phiếu để tính EPS.
   Bước 3 - Tính toán lũy kế: Để tính EPS Lũy kế, AI phải quét ngược 3 cột dữ liệu trước đó để cộng dồn vào quý hiện tại.
   Bước 4 - Phân tích độ nhạy: Tạo bảng ma trận giá với dải P/E chạy từ 4.0 đến 10.0 để dự báo các kịch bản giá.4. Ràng Buộc Dữ Liệu (Constraints)[!IMPORTANT]Zero Division: Tuyệt đối không thực hiện phép tính nếu $Net_Revenue hoặc $Shares_Outstanding bằng 0.Unit Consistency: Luôn kiểm tra đơn vị tính (Triệu đồng vs Tỷ đồng) để đảm bảo EPS không bị lệch 1000 lần.Forecast Label: Các kỳ có ký hiệu (F) là dữ liệu giả định (Forecast), cần được xử lý tách biệt với dữ liệu thực tế (Actual).
