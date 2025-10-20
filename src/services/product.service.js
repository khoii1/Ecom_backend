import { ProductModel } from "../models/product.model.js";
import { StoreModel } from "../models/store.model.js";
import { ROLES } from "../constants/roles.js";
import slugify from "slugify";

export const ProductService = {
  list: () => ProductModel.findMany({}),
  detail: (id) => ProductModel.findById(id),
  async create(currentUser, payload) {
    const store = await StoreModel.findById(payload.store_id);
    if (!store) throw new Error("STORE_NOT_FOUND");
    if (currentUser.role !== ROLES.ADMIN && store.owner_id !== currentUser.id)
      throw new Error("FORBIDDEN");
    const slug =
      payload.slug || slugify(payload.title, { lower: true, strict: true });
    return ProductModel.create({ ...payload, slug });
  },
  async update(currentUser, id, patch) {
    const product = await ProductModel.findById(id);
    if (!product) return null;
    if (currentUser.role !== ROLES.ADMIN) {
      const store = await StoreModel.findById(product.store_id);
      if (!store || store.owner_id !== currentUser.id)
        throw new Error("FORBIDDEN");
    }
    return ProductModel.updateById(id, patch);
  },
  async remove(currentUser, id) {
    const product = await ProductModel.findById(id);
    if (!product) return true;
    if (currentUser.role !== ROLES.ADMIN) {
      const store = await StoreModel.findById(product.store_id);
      if (!store || store.owner_id !== currentUser.id)
        throw new Error("FORBIDDEN");
    }
    return ProductModel.deleteById(id);
  },
};
