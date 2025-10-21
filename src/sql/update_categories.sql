-- Cập nhật bảng categories để thêm các cột mới
-- Chạy script này để đồng bộ database với schema mới

-- Thêm cột created_by và updated_by nếu chưa có
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Tạo index để query nhanh hơn
CREATE INDEX IF NOT EXISTS idx_categories_created_by ON categories(created_by);
CREATE INDEX IF NOT EXISTS idx_categories_updated_by ON categories(updated_by);

-- Cập nhật dữ liệu hiện có (nếu có)
-- Gán các category hiện có cho user đầu tiên có role ADMIN hoặc SELLER
UPDATE categories 
SET created_by = (
  SELECT id FROM users 
  WHERE role IN ('ADMIN', 'SELLER') 
  ORDER BY created_at ASC 
  LIMIT 1
),
updated_by = (
  SELECT id FROM users 
  WHERE role IN ('ADMIN', 'SELLER') 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE created_by IS NULL;

-- Hiển thị kết quả
SELECT 'Categories table updated successfully!' as message;
SELECT COUNT(*) as total_categories FROM categories;
SELECT COUNT(*) as categories_with_owner FROM categories WHERE created_by IS NOT NULL;