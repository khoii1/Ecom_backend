import { BaseModel } from "./base.model.js";
const tableName = "categories";
export const CategoryModel = {
  findMany: (args = {}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  create: ({ name, parent_id = null, image_url = null }) =>
    BaseModel.insert({
      tableName,
      columns: ["name", "parent_id", "image_url"],
      values: [name, parent_id, image_url],
    }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),

  // Helper method để lấy categories theo hierarchy
  findWithChildren: async () => {
    const query = `
      SELECT 
        c.*,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `;
    return BaseModel.query(query);
  },
};
