import { StoreModel } from "../models/store.model.js";
import { ROLES } from "../constants/roles.js";
import slugify from "slugify";

export const StoreService = {
  list: () => StoreModel.findMany({}),
  detail: (id) => StoreModel.findById(id),
  async create(currentUser, payload) {
    const owner_id =
      currentUser.role === ROLES.ADMIN && payload.owner_id
        ? payload.owner_id
        : currentUser.id;
    const slug =
      payload.slug || slugify(payload.name, { lower: true, strict: true });
    return StoreModel.create({
      owner_id,
      name: payload.name,
      slug,
      status: payload.status || "active",
    });
  },
  async update(currentUser, id, patch) {
    const store = await StoreModel.findById(id);
    if (!store) return null;
    if (currentUser.role !== ROLES.ADMIN && store.owner_id !== currentUser.id)
      throw new Error("Bạn không có quyền chỉnh sửa cửa hàng này");
    return StoreModel.updateById(id, patch);
  },
  async remove(currentUser, id) {
    const store = await StoreModel.findById(id);
    if (!store) return true;
    if (currentUser.role !== ROLES.ADMIN && store.owner_id !== currentUser.id)
      throw new Error("Bạn không có quyền xóa cửa hàng này");
    return StoreModel.deleteById(id);
  },
};
