import { CategoryModel } from "../models/category.model.js";

export const CategoryService = {
  // Lấy tất cả categories - Public cho tất cả users
  list: () => {
    return CategoryModel.findMany({});
  },

  // Lấy categories với thống kê số sản phẩm
  listWithStats: () => {
    return CategoryModel.findWithChildren();
  },

  // Xem chi tiết category - Public
  detail: async (id) => {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }
    return category;
  },

  // Tạo category - CHỈ ADMIN
  create: (currentUser, payload) => {
    // Kiểm tra quyền admin
    if (currentUser.role !== "ADMIN") {
      throw new Error("Chỉ Admin mới có thể tạo danh mục");
    }

    return CategoryModel.create({
      name: payload.name,
      parent_id: payload.parent_id || null,
      image_url: payload.image_url || null,
    });
  },

  // Sửa category - CHỈ ADMIN
  update: async (currentUser, id, patch) => {
    // Kiểm tra quyền admin
    if (currentUser.role !== "ADMIN") {
      throw new Error("Chỉ Admin mới có thể sửa danh mục");
    }

    // Kiểm tra category tồn tại
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    return CategoryModel.updateById(id, {
      name: patch.name,
      parent_id: patch.parent_id,
      image_url: patch.image_url,
    });
  },

  // Xóa category - CHỈ ADMIN
  remove: async (currentUser, id) => {
    // Kiểm tra quyền admin
    if (currentUser.role !== "ADMIN") {
      throw new Error("Chỉ Admin mới có thể xóa danh mục");
    }

    // Kiểm tra category tồn tại
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    // TODO: Kiểm tra xem có products nào đang dùng category này không
    return CategoryModel.deleteById(id);
  },

  // Lấy categories theo hierarchy tree
  getTree: async () => {
    const categories = await CategoryModel.findMany({});
    return buildCategoryTree(categories);
  },
};

// Helper function để build category tree
function buildCategoryTree(categories) {
  const categoryMap = {};
  const tree = [];

  // Tạo map để lookup nhanh
  categories.forEach((cat) => {
    categoryMap[cat.id] = { ...cat, children: [] };
  });

  // Build tree structure
  categories.forEach((cat) => {
    if (cat.parent_id) {
      if (categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
      }
    } else {
      tree.push(categoryMap[cat.id]);
    }
  });

  return tree;
}
