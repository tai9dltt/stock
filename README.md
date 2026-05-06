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

Tạo file `.env` tại thư mục gốc của dự án và điền thông tin xác thực Vietstock (để crawl dữ liệu):

```env
# Vietstock Credentials (Lấy từ cookie trình duyệt khi đăng nhập Vietstock)
VIETSTOCK_COOKIE=your_vietstock_cookie
VIETSTOCK_TOKEN=your_vietstock_token
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

Dự án cung cấp các script tiện ích để quản lý dữ liệu crawl:

### Xóa toàn bộ dữ liệu

Để xóa sạch dữ liệu trong database (chỉ giữ lại cấu trúc bảng), dùng lệnh:

```bash
node scripts/clean-db.js
```

_Sử dụng khi cần reset hoàn toàn dữ liệu._

### Xóa dữ liệu theo mã cổ phiếu

Để xóa dữ liệu của một mã cổ phiếu cụ thể (ví dụ muốn crawl lại từ đầu):

```bash
node scripts/clean-symbol.js [MÃ_CỔ_PHIẾU]
```

**Ví dụ:**

```bash
node scripts/clean-symbol.js MSHgi
node scripts/clean-symbol.js VNM
```
