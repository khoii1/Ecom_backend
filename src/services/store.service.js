import { StoreModel } from "../models/store.model.js";
import { ROLES } from "../constants/roles.js";

export const StoreService = {
  // Lấy tất cả stores
  list: () => StoreModel.findMany({}),

  // Lấy stores của user hiện tại (cho seller)
  listByOwner: (ownerId) => StoreModel.findByOwnerId(ownerId),

  // Chi tiết store
  detail: (id) => StoreModel.findById(id),

  // Tạo store
  async create(currentUser, payload) {
    const owner_id =
      currentUser.role === ROLES.ADMIN && payload.owner_id
        ? payload.owner_id
        : currentUser.id;

    return StoreModel.create({
      owner_id,
      name: payload.name,
      status: payload.status || "active",
    });
  },

  // Cập nhật store - chỉ owner hoặc admin
  async update(currentUser, id, patch) {
    const store = await StoreModel.findById(id);
    if (!store) {
      throw new Error("Không tìm thấy cửa hàng");
    }

    if (currentUser.role !== ROLES.ADMIN && store.owner_id !== currentUser.id) {
      throw new Error("Bạn không có quyền chỉnh sửa cửa hàng này");
    }

    return StoreModel.updateById(id, patch);
  },

  // Xóa store - chỉ owner hoặc admin
  async remove(currentUser, id) {
    const store = await StoreModel.findById(id);
    if (!store) {
      throw new Error("Không tìm thấy cửa hàng");
    }

    if (currentUser.role !== ROLES.ADMIN && store.owner_id !== currentUser.id) {
      throw new Error("Bạn không có quyền xóa cửa hàng này");
    }

    return StoreModel.deleteById(id);
  },
};
