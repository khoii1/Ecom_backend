# Admin Panel - Hướng Dẫn Sử Dụng

## Tổng Quan

Admin Panel là giao diện web quản trị cho hệ thống E-commerce, cho phép quản lý người dùng, sản phẩm và danh mục sản phẩm.

## Truy Cập Admin Panel

1. **URL**: `http://localhost:8080/admin/login.html`
2. **Yêu cầu**: Tài khoản có role `ADMIN`

## Tính Năng

### 1. Dashboard

- Xem tổng quan thống kê hệ thống
- Theo dõi hoạt động gần đây
- Điều hướng nhanh đến các chức năng

### 2. Quản Lý Người Dùng

- **Xem danh sách**: Hiển thị tất cả người dùng với thông tin cơ bản
- **Thêm mới**: Tạo tài khoản người dùng mới
- **Chỉnh sửa**: Cập nhật thông tin người dùng
- **Xóa**: Xóa tài khoản người dùng
- **Lọc theo role**: ADMIN, SELLER, USER
- **Quản lý trạng thái**: active, pending, inactive

### 3. Quản Lý Danh Mục

- **Global Categories**: Danh mục toàn cầu, không thuộc về cửa hàng cụ thể
- **Thêm/Sửa/Xóa** danh mục
- **Upload hình ảnh**: Hỗ trợ URL hình ảnh
- **Quản lý trạng thái**: active/inactive

### 4. Quản Lý Sản Phẩm

- **Xem danh sách** với hình ảnh và thông tin chi tiết
- **Thêm sản phẩm mới** với đầy đủ thông tin
- **Chỉnh sửa** thông tin sản phẩm
- **Quản lý giá**: Giá gốc và giá khuyến mãi
- **Quản lý kho**: Số lượng tồn kho
- **Đánh giá**: Hiển thị rating sao
- **Hình ảnh**: Hỗ trợ nhiều URL hình ảnh

## Cấu Trúc File

```
public/admin/
├── css/
│   └── admin.css          # Stylesheet chính
├── js/
│   ├── common.js          # Utility functions chung
│   ├── auth.js            # Xử lý authentication
│   ├── dashboard.js       # Dashboard functionality
│   ├── users.js           # Quản lý người dùng
│   ├── categories.js      # Quản lý danh mục
│   └── products.js        # Quản lý sản phẩm
├── login.html             # Trang đăng nhập
├── index.html             # Dashboard chính
├── users.html             # Quản lý người dùng
├── categories.html        # Quản lý danh mục
└── products.html          # Quản lý sản phẩm
```

## API Endpoints Được Sử Dụng

### Authentication

- `POST /auth/login` - Đăng nhập
- `POST /auth/logout` - Đăng xuất

### Users

- `GET /users` - Lấy danh sách người dùng
- `POST /users` - Tạo người dùng mới
- `PUT /users/:id` - Cập nhật người dùng
- `DELETE /users/:id` - Xóa người dùng

### Categories

- `GET /categories` - Lấy danh sách danh mục
- `POST /categories` - Tạo danh mục mới
- `PUT /categories/:id` - Cập nhật danh mục
- `DELETE /categories/:id` - Xóa danh mục

### Products

- `GET /products` - Lấy danh sách sản phẩm
- `POST /products` - Tạo sản phẩm mới
- `PUT /products/:id` - Cập nhật sản phẩm
- `DELETE /products/:id` - Xóa sản phẩm

### Statistics

- `GET /users/count` - Thống kê người dùng
- `GET /products/count` - Thống kê sản phẩm
- `GET /categories/count` - Thống kê danh mục

## Bảo Mật

- **JWT Authentication**: Sử dụng token 24 giờ
- **Role-based Access**: Chỉ ADMIN được truy cập
- **Auto-logout**: Tự động đăng xuất khi token hết hạn
- **HTTPS Ready**: Sẵn sàng cho production với HTTPS

## Responsive Design

- **Desktop First**: Tối ưu cho màn hình desktop
- **Mobile Friendly**: Responsive trên tablet và mobile
- **Modern UI**: Sử dụng Font Awesome icons và CSS Grid

## Khắc Phục Sự Cố

### Không thể đăng nhập

1. Kiểm tra tài khoản có role ADMIN
2. Kiểm tra server backend đang chạy
3. Kiểm tra console browser để xem lỗi

### Không load được dữ liệu

1. Kiểm tra token còn hạn
2. Kiểm tra API endpoints hoạt động
3. Kiểm tra console network tab

### Lỗi khi thêm/sửa/xóa

1. Kiểm tra dữ liệu nhập vào
2. Kiểm tra quyền truy cập
3. Kiểm tra log server backend

## Development Notes

- **ES6+ JavaScript**: Sử dụng modern JavaScript
- **CSS Grid & Flexbox**: Layout hiện đại
- **Fetch API**: Không dependency jQuery
- **Modular Structure**: Code tách biệt theo chức năng
- **Error Handling**: Xử lý lỗi đầy đủ với user feedback
