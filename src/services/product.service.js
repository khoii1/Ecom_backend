import { ProductModel } from "../models/product.model.js";
import { StoreModel } from "../models/store.model.js";
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

    return ProductModel.deleteById(id);
  },
};
