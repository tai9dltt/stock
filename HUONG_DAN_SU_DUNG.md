# 📊 Hướng Dẫn Sử Dụng Stock Analysis App

## 🎯 Tổng Quan

**Stock Analysis App** là công cụ phân tích và định giá cổ phiếu Việt Nam, giúp bạn:

- 📥 Clone dữ liệu tài chính từ Vietstock
- 📊 Tạo bảng dự phóng tăng trưởng
- 💰 Tính toán giá mục tiêu dựa trên P/E
- 📝 Lập kế hoạch giao dịch (Entry/Target/Stop Loss)
- 💾 Lưu và tải lại kịch bản phân tích

---

## 🚀 Khởi Động Ứng Dụng

### 1. Cài đặt dependencies (chỉ lần đầu)

```bash
npm install
```

### 2. Cấu hình Database

Đảm bảo MySQL đang chạy và database `stock_analysis` đã được tạo:

```bash
mysql -u root -p
CREATE DATABASE stock_analysis;
```

### 3. Chạy migration để tạo bảng

```bash
npx prisma migrate dev
```

### 4. Khởi động dev server

```bash
npm run dev
```

Ứng dụng sẽ chạy tại: **http://localhost:3000**

---

## 📖 Hướng Dẫn Sử Dụng Chi Tiết

### Bước 1: Truy cập trang phân tích

- Mở trình duyệt và truy cập: `http://localhost:3000/analysis`

### Bước 2: Clone dữ liệu từ Vietstock

#### 2.1. Lấy URL từ Vietstock

1. Truy cập [Vietstock Finance](https://finance.vietstock.vn/)
2. Tìm mã cổ phiếu bạn muốn phân tích (VD: HPG, VNM, FPT)
3. Vào trang **Báo cáo tài chính** của mã đó
4. Copy URL (VD: `https://finance.vietstock.vn/HPG/tai-chinh.htm`)

#### 2.2. Clone dữ liệu

1. **Nhập mã cổ phiếu** vào ô "Mã cổ phiếu" (VD: `HPG`)
2. **Paste URL Vietstock** vào ô "URL Vietstock"
3. Click nút **"Clone dữ liệu"** 📥
4. Đợi vài giây để hệ thống scrape dữ liệu

> ⚠️ **Lưu ý**: Bạn cần đã cấu hình `VIETSTOCK_COOKIE_RAW` trong file `.env` để clone thành công

### Bước 3: Phân tích và dự phóng

#### 3.1. Bảng dữ liệu tài chính

Sau khi clone thành công, bạn sẽ thấy:

- **Dữ liệu lịch sử**: Doanh thu, lợi nhuận các quý/năm trước
- **Ô nhập liệu**: Để bạn nhập dự phóng cho các quý tương lai

#### 3.2. Nhập dự phóng tăng trưởng

1. Tại các ô trống (Q1, Q2, Q3, Q4 của năm tới)
2. Nhập số liệu dự phóng của bạn
3. Hệ thống sẽ tự động tính toán tổng năm

#### 3.3. Điều chỉnh P/E giả định

- Tìm ô **"Assumed P/E"**
- Nhập hệ số P/E bạn cho là hợp lý (VD: 15, 20, 25)
- Giá mục tiêu sẽ được tính tự động: `Target Price = EPS × P/E`

### Bước 4: Lập kế hoạch giao dịch

Kéo xuống phần **"Kế hoạch giao dịch"**:

1. **Entry Price** (Giá vào lệnh): Giá bạn dự định mua
2. **Target Price** (Giá mục tiêu): Giá bạn dự định chốt lời
3. **Stop Loss** (Cắt lỗ): Giá bạn sẽ thoát nếu đi sai hướng

4. **Note** (Ghi chú): Viết lý do phân tích, chiến lược giao dịch
   - Hỗ trợ Rich Text Editor
   - Có thể format text, thêm bullet points, v.v.

### Bước 5: Lưu kịch bản

1. Click nút **"Lưu kịch bản"** 💾
2. Tất cả dữ liệu sẽ được lưu vào database:
   - Dự phóng tăng trưởng
   - P/E giả định
   - Entry/Target/Stop Loss
   - Ghi chú phân tích

### Bước 6: Tải lại kịch bản đã lưu

Khi muốn xem lại phân tích cũ:

1. Nhập **mã cổ phiếu** vào ô "Mã cổ phiếu"
2. Click nút **"Tải kịch bản"** 📂
3. Tất cả dữ liệu đã lưu sẽ được load lại

---

## 🔧 API Endpoints

Ứng dụng có 3 API chính:

### 1. **POST** `/api/stock/clone`

Clone dữ liệu tài chính từ Vietstock

**Request:**

```json
{
  "url": "https://finance.vietstock.vn/HPG/tai-chinh.htm",
  "symbol": "HPG"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    /* dữ liệu tài chính */
  }
}
```

### 2. **GET** `/api/stock/get?symbol=HPG`

Lấy kịch bản phân tích đã lưu

**Response:**

```json
{
  "success": true,
  "data": {
    "symbol": "HPG",
    "gridInputs": {
      /* dự phóng */
    },
    "assumedPE": 15,
    "entryPrice": 25000,
    "targetPrice": 30000,
    "stopLoss": 23000,
    "noteHtml": "<p>Lý do mua...</p>"
  }
}
```

### 3. **POST** `/api/stock/save`

Lưu kịch bản phân tích

**Request:**

```json
{
  "symbol": "HPG",
  "gridInputs": {
    /* dự phóng */
  },
  "assumedPE": 15,
  "entryPrice": 25000,
  "targetPrice": 30000,
  "stopLoss": 23000,
  "noteHtml": "<p>Lý do mua...</p>"
}
```

---

## 💡 Tips & Best Practices

### ✅ Workflow khuyến nghị:

1. **Research** → Tìm hiểu cổ phiếu trên Vietstock
2. **Clone** → Lấy dữ liệu lịch sử về
3. **Forecast** → Nhập dự phóng tăng trưởng
4. **Valuation** → Điều chỉnh P/E để tính giá mục tiêu
5. **Plan** → Lập kế hoạch Entry/Target/Stop Loss
6. **Save** → Lưu kịch bản để theo dõi
7. **Review** → Định kỳ load lại và cập nhật

### ⚠️ Lưu ý quan trọng:

- **Cookie hết hạn**: Cookie Vietstock thường hết hạn sau vài ngày. Nếu clone fail, hãy:
  1. Login lại vào Vietstock
  2. Copy cookie mới bằng lệnh `copy(document.cookie)` trong Console
  3. Update lại file `.env`

- **Database**: Đảm bảo MySQL đang chạy trước khi khởi động app

- **Port conflict**: Nếu port 3000 đã được sử dụng, Nuxt sẽ tự động chuyển sang port khác (3001, 3002...)

---

## 🐛 Troubleshooting

### Lỗi: "Cannot find name 'document'"

✅ **Đã fix**: File `clone.post.ts` đã được cập nhật với type assertion

### Lỗi: "Vietstock cookie not configured"

❌ **Nguyên nhân**: Chưa cấu hình cookie trong `.env`
✅ **Giải pháp**:

1. Login vào Vietstock
2. Mở DevTools Console
3. Chạy: `copy(document.cookie)`
4. Paste vào `VIETSTOCK_COOKIE_RAW` trong file `.env`

### Lỗi: "Failed to clone data"

❌ **Nguyên nhân**: Cookie hết hạn hoặc URL không đúng
✅ **Giải pháp**:

1. Kiểm tra URL có đúng format không
2. Update lại cookie mới
3. Thử lại

### Lỗi Database Connection

❌ **Nguyên nhân**: MySQL chưa chạy hoặc database chưa tạo
✅ **Giải pháp**:

```bash
# Khởi động MySQL
brew services start mysql  # macOS
# hoặc
sudo systemctl start mysql  # Linux

# Tạo database
mysql -u root -p
CREATE DATABASE stock_analysis;
```

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề, hãy kiểm tra:

1. ✅ MySQL đang chạy
2. ✅ Database `stock_analysis` đã được tạo
3. ✅ File `.env` đã cấu hình đúng
4. ✅ Cookie Vietstock còn hiệu lực
5. ✅ Dev server đang chạy (`npm run dev`)

---

**Happy Trading! 📈💰**
