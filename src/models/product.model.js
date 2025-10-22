import { BaseModel } from "./base.model.js";
const tableName = "products";
export const ProductModel = {
  findMany: (args = {}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  create: ({
    store_id,
    title,
    category_id = null,
    price,
    discounted_price = null,
    rating = null,
    image_url = null,
    status = "active",
  }) =>
    BaseModel.insert({
      tableName,
      columns: [
        "store_id",
        "title",
        "category_id",
        "price",
        "discounted_price",
        "rating",
        "image_url",
        "status",
      ],
      values: [
        store_id,
        title,
        category_id,
        price,
        discounted_price,
        rating,
        image_url,
        status,
      ],
    }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),

  // Helper methods cho store ownership
  findByStoreId: (storeId) =>
    BaseModel.findMany({ tableName, where: { store_id: storeId } }),
  findByCategoryId: (categoryId) =>
    BaseModel.findMany({ tableName, where: { category_id: categoryId } }),
};
