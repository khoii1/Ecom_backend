import { ProductModel } from "../models/product.model.js";
import { StoreModel } from "../models/store.model.js";
import { CartItemModel } from "../models/cart_item.model.js"; // Giữ lại import này
import { ROLES } from "../constants/roles.js";

// --- SỬA: BẮT ĐẦU THÊM MỚI ---
// Helper functions để chuyển đổi ID thành String cho frontend
const formatProductForFrontend = (product) => {
  if (!product) return product;
  // Tính toán final_price trước khi chuyển đổi ID
  const finalPrice = ProductModel.calculateFinalPrice(
    product.price,
    product.discount_percentage
  );
  return {
    ...product,
    // Chuyển đổi ID (integer) thành String
    id: product.id.toString(),
    store_id: product.store_id.toString(),
    // Chỉ chuyển đổi category_id nếu nó tồn tại
    category_id: product.category_id ? product.category_id.toString() : null,
    // Giữ lại final_price đã tính
    final_price: finalPrice,
  };
};

const formatProductsForFrontend = (products) => {
  if (!Array.isArray(products)) return products;
  // Áp dụng hàm format cho mỗi sản phẩm trong danh sách
  return products.map(formatProductForFrontend);
};
// --- SỬA: KẾT THÚC THÊM MỚI ---

export const ProductService = {
  // Lấy tất cả products với final_price
  // SỬA: Thay thế findManyWithFinalPrice bằng findMany + format
  list: async () => {
    const products = await ProductModel.findMany({});
    return formatProductsForFrontend(products);
  },

  // Lấy products theo store (cho seller)
  // SỬA: Thêm async/await và hàm format
  listByStore: async (storeId) => {
    const products = await ProductModel.findByStoreId(storeId);
    return formatProductsForFrontend(products);
  },

  // Lấy products theo category (cho buyers)
  // SỬA: Thêm async/await và hàm format
  listByCategory: async (categoryId) => {
    const products = await ProductModel.findByCategoryId(categoryId);
    return formatProductsForFrontend(products);
  },

  // Chi tiết sản phẩm với final_price
  // SỬA: Thêm hàm format
  detail: async (id) => {
    const product = await ProductModel.findById(id);
    // Hàm formatProductForFrontend đã bao gồm tính final_price
    return formatProductForFrontend(product);
  },

  // Tạo sản phẩm - chỉ owner của store
  async create(currentUser, payload) {
    const store = await StoreModel.findById(payload.store_id);
    if (!store) {
      throw new Error("Không tìm thấy cửa hàng");
    }

    // Kiểm tra ownership
    if (currentUser.role !== ROLES.ADMIN && store.owner_id !== currentUser.id) {
      throw new Error("Bạn không có quyền thêm sản phẩm vào cửa hàng này");
    }

    // Validation business logic cho discount_percentage
    if (
      payload.discount_percentage !== null &&
      payload.discount_percentage !== undefined
    ) {
      if (
        Number(payload.discount_percentage) < 0 ||
        Number(payload.discount_percentage) > 100
      ) {
        throw new Error("Phần trăm giảm giá phải từ 0 đến 100");
      }
    }

    // SỬA: Thêm hàm format cho kết quả trả về
    const newProduct = await ProductModel.create(payload);
    return formatProductForFrontend(newProduct);
  },

  // Cập nhật sản phẩm - chỉ owner của store
  async update(currentUser, id, patch) {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Kiểm tra ownership qua store
    if (currentUser.role !== ROLES.ADMIN) {
      const store = await StoreModel.findById(product.store_id);
      if (!store || store.owner_id !== currentUser.id) {
        throw new Error("Bạn không có quyền chỉnh sửa sản phẩm này");
      }
    }

    // Validation business logic cho discount_percentage khi update
    if (
      patch.discount_percentage !== null &&
      patch.discount_percentage !== undefined
    ) {
      if (
        Number(patch.discount_percentage) < 0 ||
        Number(patch.discount_percentage) > 100
      ) {
        throw new Error("Phần trăm giảm giá phải từ 0 đến 100");
      }
    }

    // SỬA: Thêm hàm format cho kết quả trả về
    const updatedProduct = await ProductModel.updateById(id, patch);
    return formatProductForFrontend(updatedProduct);
  },

  // Xóa sản phẩm - chỉ owner của store
  async remove(currentUser, id) {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Kiểm tra ownership qua store
    if (currentUser.role !== ROLES.ADMIN) {
      const store = await StoreModel.findById(product.store_id);
      if (!store || store.owner_id !== currentUser.id) {
        throw new Error("Bạn không có quyền xóa sản phẩm này");
      }
    }

    // Xóa tất cả cart items liên quan đến sản phẩm này trước
    // SỬA: Truy vấn đúng cách để lấy cart_items theo product_id
    const { databasePool } = await import("../config/database.js"); // Cần import pool
    const cartItemsResult = await databasePool.query(
      "SELECT id FROM cart_items WHERE product_id = $1",
      [id]
    );
    const cartItems = cartItemsResult.rows;

    if (cartItems.length > 0) {
      // Xóa từng cart item
      for (const cartItem of cartItems) {
        await CartItemModel.deleteById(cartItem.id);
      }
      console.log(
        `Đã xóa ${cartItems.length} cart items liên quan đến sản phẩm ${id}`
      );
    } else {
      console.log(
        `Không tìm thấy cart items nào liên quan đến sản phẩm ${id} để xóa.`
      );
    }

    // Sau đó mới xóa sản phẩm
    return ProductModel.deleteById(id);
  },
};
