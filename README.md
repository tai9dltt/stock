# Stock Analysis App

Ứng dụng phân tích cổ phiếu Việt Nam với tích hợp dữ liệu từ Vietstock và công cụ phân tích tài chính chuyên sâu.

## 🚀 Tính Năng Chính

- ✅ **Crawl dữ liệu tự động**: Lấy dữ liệu tài chính (quý & năm) từ Vietstock.
- ✅ **Báo cáo tài chính**: Hiển thị dưới dạng bảng tính chuyên nghiệp với SpreadJS.
- ✅ **Chỉ số tài chính**: Tự động tính toán các chỉ số quan trọng (EPS, P/E, ROE, ROA...).
- ✅ **Định giá & Dự báo**: Công cụ hỗ trợ định giá cổ phiếu và dự báo tương lai.
- ✅ **Đa dạng mô hình**: Hỗ trợ cả doanh nghiệp sản xuất/thương mại và ngân hàng.

## 🛠 Cài Đặt (Installation)

### 1. Yêu cầu hệ thống

- Node.js (Khuyến nghị phiên bản mới nhất, v18+)
- MySQL Database

### 2. Cài đặt dependencies

Chạy lệnh sau để cài đặt các thư viện cần thiết:

```bash
npm install
```

### 3. Cấu hình môi trường

Copy `.env.example` thành `.env` và điền thông tin:

```env
# Tài khoản Vietstock (app tự đăng nhập để crawl dữ liệu)
VIETSTOCK_EMAIL=you@example.com
VIETSTOCK_PASSWORD=your_password

# Database (mặc định: root@localhost:3306, database stock_analysis_db)
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=
# DB_NAME=stock_analysis_db
```

### 4. Tạo database

Cần MySQL 8. Lệnh sau tạo database (nếu chưa có) và chạy các migration còn thiếu trong `server/migrations`:

```bash
npm run db:migrate
```

## 💻 Sử Dụng (Usage)

### Môi trường phát triển (Development)

Khởi chạy server development tại `http://localhost:3000`:

```bash
npm run dev
```

### Môi trường sản xuất (Production)

Build và preview ứng dụng:

```bash
# Build ứng dụng
npm run build

# Xem trước bản build
npm run preview
```

## 🗄 Quản Lý Database (Database Scripts)

Các script đọc cấu hình DB từ `.env`.

### Migration

```bash
npm run db:migrate            # chạy các migration chưa áp dụng
npm run db:migrate -- --dry   # chỉ liệt kê migration chưa áp dụng
```

Thay đổi schema: thêm file `server/migrations/NNN_mo_ta.sql` (số thứ tự tăng dần). Migration đã chạy được ghi trong bảng `schema_migrations` nên mỗi file chỉ chạy một lần. Không sửa migration đã chạy, hãy thêm file mới.

### Xóa toàn bộ dữ liệu

Xóa dữ liệu crawl và phân tích, giữ lại cấu trúc bảng và danh mục chỉ tiêu (`metrics`):

```bash
npm run db:clean
```

### Xóa dữ liệu theo mã cổ phiếu

Xóa dữ liệu của một mã (ví dụ để crawl lại từ đầu):

```bash
npm run db:clean-symbol -- VNM
```
