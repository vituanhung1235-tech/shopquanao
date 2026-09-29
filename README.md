# Anh Khải Shop - Full-Stack E-Commerce (Cloudflare Pages + Workers + D1 + R2)

Hệ thống website thời trang hiện đại được xây dựng chuẩn **Mobile First**, tích hợp toàn bộ hệ sinh thái serverless của **Cloudflare**:

1. 📱 **Mobile First Architecture**: Giao diện tối ưu tuyệt đối trên điện thoại di động trước, tự động co giãn linh hoạt trên Tablet & Desktop.
2. ⚡ **Cloudflare Workers Backend API**: Serverless API tự động mở rộng, xử lý Auth, CRUD Sản Phẩm, Đơn Hàng và tư vấn sản phẩm bằng Workers AI (`functions/api/[[path]].js`).
3. 🖼️ **Cloudflare R2 Bucket**: Lưu trữ và phân phối hình ảnh sản phẩm không tốn chi phí băng thông (`MY_R2_BUCKET`).
4. 🗄️ **Cloudflare D1 (SQLite)**: Cơ sở dữ liệu SQLite Serverless lưu trữ Người dùng, Sản phẩm và Đơn hàng (`functions/api/schema.sql`).
5. 🔄 **Full-Stack Frontend / Backend**: Tách biệt rõ ràng API & Giao diện người dùng.
6. 👤 **Hệ thống User & Admin (Phân quyền)**:
   - **User**: Xem sản phẩm, tìm kiếm, lọc danh mục, thêm giỏ hàng, đặt hàng.
   - **Admin**: Đăng nhập tài khoản Quản trị, truy cập Dashboard `admin.html`, thêm/sửa/ẩn/hiện/xóa sản phẩm, cập nhật tồn kho, tải ảnh lên R2, quản lý đơn hàng.

---

## 📁 Cấu trúc Project

```
shopquanao/
│
├── index.html              # Frontend Trang chủ + Giỏ hàng + Modal Đăng Nhập / Đăng Ký
├── admin.html              # Trang Dashboard Quản trị dành cho Admin (CRUD Sản phẩm, R2 Upload, Đơn hàng)
├── style.css               # CSS Mobile First, Responsive, Toast, Modal, Admin Panel
├── script.js               # Frontend JavaScript, Giỏ hàng LocalStorage, Workers API Integration
├── wrangler.toml           # Cấu hình Cloudflare Pages, D1 Database & R2 Bucket Binding
│
├── functions/              # Backend Serverless Functions chạy trên Cloudflare Workers
│   └── api/
│       ├── [[path]].js     # Router xử lý API /api/auth, /api/products, /api/orders, /api/upload
│       └── schema.sql      # Schema khởi tạo cơ sở dữ liệu D1 SQLite
│
├── assets/
│   ├── images/             # Lưu trữ hình ảnh sản phẩm (khoacgc.jpg, giayjd.jpg, tuilv.jpg...)
│   └── icons/
│       └── favicon.svg     # Favicon SVG
└── README.md               # Hướng dẫn chi tiết
```

---

## 🔑 Tài khoản Đăng nhập Quản trị (Admin Demo)

- **Tên đăng nhập**: `admin` (hoặc `admin@anhkhaishop.com`)
- **Mật khẩu**: `admin123`
- Khi đăng nhập bằng tài khoản Admin, trên Header sẽ xuất hiện nút **"Quản trị"** dẫn đến trang `admin.html`.

---

## ☁️ Hướng dẫn Khởi tạo D1 Database & R2 Bucket trên Cloudflare

### Bật chatbot RAG tư vấn sản phẩm
Chatbot dùng Workers AI để tạo embedding tiếng Việt (`@cf/baai/bge-m3`), tìm tối đa 5 sản phẩm gần nhất trong Vectorize rồi mới gọi LLM (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`). Sản phẩm có điểm tương đồng thấp hơn `CHAT_MIN_SCORE` (mặc định `0.45`) không được đưa vào prompt; khi không có kết quả phù hợp, API trả câu từ chối cố định mà không gọi LLM. Có thể chọn model nhẹ hơn bằng biến môi trường `CHAT_MODEL=@cf/meta/llama-3.1-8b-instruct`.

Tạo index Vectorize đúng 1024 chiều, khớp embedding `bge-m3`:
```bash
npx wrangler vectorize create shoplite-products --dimensions=1024 --metric=cosine
```

Các binding `AI` và `VECTORIZE` đã khai báo trong cấu hình Wrangler. Khi deploy Pages qua Dashboard, thêm Workers AI binding tên `AI` và Vectorize binding tên `VECTORIZE`, trỏ tới index `shoplite-products`. Workers AI/Vectorize được tính theo giới hạn và mức sử dụng tài khoản Cloudflare.

Schema mới đã có cột `products.is_active`. Với D1 đã tồn tại, chạy migration một lần: `npx wrangler d1 execute anhkhaishop-db --file=./functions/api/migrations/0002_products_is_active.sql`.

Để bootstrap hoặc sửa index sau khi deploy, đặt secret `CHAT_REINDEX_SECRET` trong Pages Settings → Variables and Secrets (hoặc `npx wrangler pages secret put CHAT_REINDEX_SECRET --project-name=anhkhaishop`), rồi gọi:
```bash
curl -X POST https://<domain>/api/chat/reindex -H "Authorization: Bearer <CHAT_REINDEX_SECRET>"
```

Thao tác thêm/sửa/xóa sản phẩm sẽ upsert hoặc xóa vector tương ứng. Dữ liệu kho dùng trường `stock` hiện có trong D1; câu trả lời không khẳng định tồn kho nếu nguồn không có giá trị. Endpoint `/api/chat` là public, hãy tạo Cloudflare rate-limiting rule cho đường dẫn này trước khi chạy production.

### Bước 1: Khởi tạo D1 Database (SQLite)
Dùng Wrangler CLI trên terminal của bạn:
```bash
# Tạo cơ sở dữ liệu D1
npx wrangler d1 create anhkhaishop-db

# Tạo bảng dữ liệu từ schema.sql
npx wrangler d1 execute anhkhaishop-db --file=./functions/api/schema.sql
```
*(Sau đó copy `database_id` cập nhật vào file `wrangler.toml`)*.

### Bước 2: Khởi tạo R2 Bucket (Lưu trữ ảnh)
```bash
# Tạo bucket lưu ảnh R2
npx wrangler r2 bucket create anhkhaishop-images
```

---

## 🚀 Deploy lên Cloudflare Pages

### Cách 1: Kết nối GitHub (Tự động Deploy)
1. Commit và Push toàn bộ project lên GitHub:
```bash
git add .
git commit -m "Nâng cấp Full-Stack Cloudflare Workers, D1, R2, Admin Dashboard & Auth"
git push origin main
```
2. Vào Cloudflare Dashboard → **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**.
3. Chọn repository → **Save and Deploy**.
4. Vào cài đặt Pages → **Settings** → **Functions** → Gắn binding:
   - **D1 Database binding**: Đặt tên `DB` → Chọn database `anhkhaishop-db`
   - **R2 Bucket binding**: Đặt tên `MY_R2_BUCKET` → Chọn bucket `anhkhaishop-images`
   - **Workers AI binding**: Đặt tên `AI`

### Cách 2: Deploy trực tiếp qua CLI
```bash
npx wrangler pages deploy . --project-name=anhkhaishop
```

---

## 📱 Kiểm tra Responsive Mobile First
- Mobile (375px - 414px): Giao diện 1 cột, menu hamburger, bộ lọc vuốt ngang, giỏ hàng trượt mượt mà.
- Tablet (768px): Giao diện 2 cột.
- Desktop (1024px+): Giao diện 3 cột full tính năng.

---

## 📝 License
© 2026 Anh Khải Shop. Tất cả quyền được bảo lưu.
