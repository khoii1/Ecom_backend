# Hướng dẫn cài đặt Cloudinary cho Upload Hình Ảnh

## 1. Tạo tài khoản Cloudinary (Miễn phí)

1. Truy cập: https://cloudinary.com/
2. Đăng ký tài khoản miễn phí
3. Sau khi đăng ký, vào Dashboard để lấy thông tin:
   - Cloud Name
   - API Key
   - API Secret

## 2. Cấu hình Environment Variables

Tạo file `.env` từ `.env.example` và điền thông tin Cloudinary:

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

## 3. Tính năng Upload Hình Ảnh

### API Endpoints:

1. **Upload Image**: `POST /products/upload-image`

   - Header: `Authorization: Bearer {access_token}`
   - Body: `form-data` với key `image` (file)
   - Response: Trả về `image_url` từ Cloudinary

2. **Create Product**: `POST /products`
   - Có thể sử dụng `image_url` từ response của upload API
   - Hoặc nhập trực tiếp URL hình ảnh

### Tính năng Cloudinary:

- ✅ **Tự động resize**: Ảnh sẽ được resize về 800x800px
- ✅ **Tối ưu chất lượng**: Auto quality optimization
- ✅ **Multiple formats**: Hỗ trợ JPG, PNG, GIF, WebP
- ✅ **CDN Global**: Tải ảnh nhanh toàn cầu
- ✅ **Free tier**: 25GB storage + 25GB bandwidth/tháng

### Workflow sử dụng:

1. **Upload Image trước** → Lấy `image_url`
2. **Create Product** → Sử dụng `image_url` vừa upload

Hoặc:

1. **Create Product** → Nhập trực tiếp URL ảnh từ internet

## 4. Test với Postman

1. Chạy API `Upload Product Image` trước
2. Copy `image_url` từ response
3. Dùng API `Create Product with Uploaded Image`
4. `{{uploaded_image_url}}` sẽ tự động được set

## 5. Lợi ích so với Local Storage

| Local Storage         | Cloudinary            |
| --------------------- | --------------------- |
| ❌ Cần quản lý server | ✅ Cloudinary quản lý |
| ❌ Backup phức tạp    | ✅ Auto backup        |
| ❌ Không có CDN       | ✅ Global CDN         |
| ❌ Không tối ưu ảnh   | ✅ Auto optimization  |
| ❌ Giới hạn storage   | ✅ Scalable           |

## 6. Production Ready

- ✅ Không cần lo về disk space
- ✅ Không cần backup ảnh
- ✅ Tự động compress và optimize
- ✅ HTTPS secure URLs
- ✅ Fast loading worldwide
