# Stock Analysis App

Ứng dụng phân tích cổ phiếu Việt Nam với tích hợp dữ liệu từ Vietstock và công cụ phân tích tài chính.

## Setup

Install dependencies:

```bash
npm install
```

## Environment Variables

Create `.env` file in the root directory:

```env
VIETSTOCK_COOKIE=your_vietstock_cookie
VIETSTOCK_TOKEN=your_vietstock_token
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
npm run dev
```

## Database Scripts

### Clean Entire Database

Xóa toàn bộ data trong database (giữ lại schema):

```bash
node scripts/clean-db.js
```

### Clean Specific Symbol

Xóa data của một mã cổ phiếu cụ thể:

```bash
node scripts/clean-symbol.js MSH
node scripts/clean-symbol.js VNM
```

**Khi nào dùng:**

- `clean-symbol.js`: Khi cần re-crawl data cho một cổ phiếu cụ thể
- `clean-db.js`: Khi cần reset toàn bộ database

## Features

- ✅ Crawl dữ liệu tài chính từ Vietstock (quarterly & annual)
- ✅ Hiển thị báo cáo tài chính với SpreadJS
- ✅ Tính toán chỉ số tài chính tự động
- ✅ Dự báo tài chính
- ✅ Bảng định giá cổ phiếu
- ✅ Hỗ trợ cả doanh nghiệp thường và ngân hàng

## Tech Stack

- **Frontend**: Nuxt 3, Vue 3, TypeScript
- **UI**: Nuxt UI (Tailwind CSS)
- **Spreadsheet**: SpreadJS
- **Backend**: Nitro
- **Database**: MySQL
- **Data Source**: Vietstock API

## Production

Build the application:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```
