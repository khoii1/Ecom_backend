import { BaseModel } from "./base.model.js";
const tableName = "products";
export const ProductModel = {
  findMany: (args = {}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  create: ({
    store_id,
    title,
    description = null,
    category_id = null,
    price,
    discount_percentage = null,
    rating = null,
    image_url = null,
    status = "active",
  }) =>
    BaseModel.insert({
      tableName,
      columns: [
        "store_id",
        "title",
        "description",
        "category_id",
        "price",
        "discount_percentage",
        "rating",
        "image_url",
        "status",
      ],
      values: [
        store_id,
        title,
        description,
        category_id,
        price,
        discount_percentage,
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

  // Tính toán giá sau khi giảm
  calculateFinalPrice: (price, discountPercentage) => {
    if (!discountPercentage || discountPercentage <= 0) {
      return price;
    }
    const discountAmount = (price * discountPercentage) / 100;
    return price - discountAmount;
  },

  // Lấy products với final_price được tính toán
  findManyWithFinalPrice: async (args = {}) => {
    const products = await BaseModel.findMany({ tableName, ...args });
    return products.map((product) => ({
      ...product,
      final_price: ProductModel.calculateFinalPrice(
        product.price,
        product.discount_percentage
      ),
    }));
  },
};
