import { ProductModel } from "../models/product.model.js";
import { StoreModel } from "../models/store.model.js";
import { CartItemModel } from "../models/cart_item.model.js";
import { ROLES } from "../constants/roles.js";

export const ProductService = {
  // Lấy tất cả products
  list: () => ProductModel.findMany({}),

  // Lấy products theo store (cho seller)
  listByStore: (storeId) => ProductModel.findByStoreId(storeId),

  // Lấy products theo category (cho buyers)
  listByCategory: (categoryId) => ProductModel.findByCategoryId(categoryId),

  // Chi tiết sản phẩm
  detail: (id) => ProductModel.findById(id),

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

    // Validation business logic cho discounted_price
    if (payload.discounted_price && payload.price) {
      if (Number(payload.discounted_price) > Number(payload.price)) {
        throw new Error("Giá sau giảm phải nhỏ hơn hoặc bằng giá gốc");
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

    // Validation business logic cho discounted_price khi update
    if (patch.discounted_price) {
      const currentPrice = patch.price || product.price;
      if (Number(patch.discounted_price) > Number(currentPrice)) {
        throw new Error("Giá sau giảm phải nhỏ hơn hoặc bằng giá gốc");
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
