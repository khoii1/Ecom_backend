import { StoreModel } from "../models/store.model.js";
import { ROLES } from "../constants/roles.js";

const formatStoreForFrontend = (store) => {
  if (!store) return store;
  return {
    ...store,
    // Chuyển đổi ID (integer) thành String
    id: store.id.toString(),
    // Cũng chuyển đổi owner_id để đảm bảo nhất quán
    owner_id: store.owner_id.toString(),
  };
};

const formatStoresForFrontend = (stores) => {
  if (!Array.isArray(stores)) return stores;
  // Áp dụng hàm format cho mỗi cửa hàng trong danh sách
  return stores.map(formatStoreForFrontend);
};

export const StoreService = {
  // Lấy tất cả stores
  // SỬA: Thêm async/await và hàm format
  list: async () => {
    const stores = await StoreModel.findMany({});
    return formatStoresForFrontend(stores);
  },

  // Lấy stores của user hiện tại (cho seller)
  // SỬA: Thêm async/await và hàm format
  listByOwner: async (ownerId) => {
    const stores = await StoreModel.findByOwnerId(ownerId);
    return formatStoresForFrontend(stores);
  },

  // Chi tiết store
  // SỬA: Thêm async/await và hàm format
  detail: async (id) => {
    const store = await StoreModel.findById(id);
    return formatStoreForFrontend(store);
  },

  // Tạo store
  async create(currentUser, payload) {
    const owner_id =
      currentUser.role === ROLES.ADMIN && payload.owner_id
        ? payload.owner_id
        : currentUser.id;

    // SỬA: Thêm hàm format cho kết quả trả về
    const newStore = await StoreModel.create({
      owner_id,
      name: payload.name,
      status: payload.status || "active",
    });
    return formatStoreForFrontend(newStore);
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

    // SỬA: Thêm hàm format cho kết quả trả về
    const updatedStore = await StoreModel.updateById(id, patch);
    return formatStoreForFrontend(updatedStore);
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
