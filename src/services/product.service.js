import { ProductModel } from "../models/product.model.js";
import { StoreModel } from "../models/store.model.js";
import { CartItemModel } from "../models/cart_item.model.js";
import { ROLES } from "../constants/roles.js";

export const ProductService = {
  // Lấy tất cả products với final_price
  list: () => ProductModel.findManyWithFinalPrice({}),

  // Lấy products theo store (cho seller)
  listByStore: async (storeId) => {
    const products = await ProductModel.findByStoreId(storeId);
    return products.map((product) => ({
      ...product,
      final_price: ProductModel.calculateFinalPrice(
        product.price,
        product.discount_percentage
      ),
    }));
  },

  // Lấy products theo category (cho buyers)
  listByCategory: async (categoryId) => {
    const products = await ProductModel.findByCategoryId(categoryId);
    return products.map((product) => ({
      ...product,
      final_price: ProductModel.calculateFinalPrice(
        product.price,
        product.discount_percentage
      ),
    }));
  },

  // Chi tiết sản phẩm với final_price
  detail: async (id) => {
    const product = await ProductModel.findById(id);
    if (!product) return null;
    return {
      ...product,
      final_price: ProductModel.calculateFinalPrice(
        product.price,
        product.discount_percentage
      ),
    };
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

    return ProductModel.create(payload);
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

    return ProductModel.updateById(id, patch);
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
    const cartItems = await CartItemModel.findMany({
      where: { product_id: id },
    });

    if (cartItems.length > 0) {
      // Xóa từng cart item
      for (const cartItem of cartItems) {
        await CartItemModel.deleteById(cartItem.id);
      }
    }

    // Sau đó mới xóa sản phẩm
    return ProductModel.deleteById(id);
  },
};
