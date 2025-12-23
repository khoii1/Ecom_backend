import { CategoryModel } from "../models/category.model.js";
import { ProductModel } from "../models/product.model.js";

// Helper function to convert category IDs to string for frontend compatibility
const formatCategoryForFrontend = (category) => {
  if (!category) return category;
  return {
    ...category,
    id: category._id.toString(),
    parent_id: category.parent_id
      ? category.parent_id.toString()
      : category.parent_id,
    created_at: category.createdAt ? category.createdAt.toISOString() : null,
    updated_at: category.updatedAt ? category.updatedAt.toISOString() : null,
  };
};

const formatCategoriesForFrontend = (categories) => {
  if (!Array.isArray(categories)) return categories;
  return categories.map(formatCategoryForFrontend);
};

export const CategoryService = {
  // Lấy tất cả categories - Public cho tất cả users
  list: async () => {
    const categories = await CategoryModel.find({}).lean();
    return formatCategoriesForFrontend(categories);
  },

  // Lấy categories với thống kê số sản phẩm
  listWithStats: async () => {
    const categories = await CategoryModel.find({}).lean();
    
    // Đếm số sản phẩm cho mỗi category
    // Sử dụng aggregation để đếm hiệu quả hơn
    const categoryIds = categories.map(cat => cat._id);
    
    // Đếm products theo category_id
    const productCounts = await ProductModel.aggregate([
      {
        $match: {
          category_id: { $in: categoryIds },
          status: 'active' // Chỉ đếm sản phẩm active
        }
      },
      {
        $group: {
          _id: '$category_id',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Tạo map để lookup nhanh
    const countMap = new Map();
    productCounts.forEach(item => {
      if (item._id) {
        countMap.set(item._id.toString(), item.count);
      }
    });
    
    // Thêm product_count vào mỗi category
    const categoriesWithStats = categories.map(category => {
      const categoryIdStr = category._id.toString();
      const productCount = countMap.get(categoryIdStr) || 0;
      return {
        ...category,
        product_count: productCount
      };
    });
    
    return formatCategoriesForFrontend(categoriesWithStats);
  },

  // Xem chi tiết category - Public
  detail: async (id) => {
    const category = await CategoryModel.findById(id).lean();
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }
    return formatCategoryForFrontend(category);
  },

  // Tạo category - CHỈ ADMIN
  create: async (currentUser, payload) => {
    // Kiểm tra quyền admin
    if (currentUser.role !== "ADMIN") {
      throw new Error("Chỉ Admin mới có thể tạo danh mục");
    }

    const category = await CategoryModel.create({
      name: payload.name,
      parent_id: payload.parent_id || null,
      image_url: payload.image_url || null,
    });
    
    return formatCategoryForFrontend(category.toObject());
  },

  // Sửa category - CHỈ ADMIN
  update: async (currentUser, id, patch) => {
    // Kiểm tra quyền admin
    if (currentUser.role !== "ADMIN") {
      throw new Error("Chỉ Admin mới có thể sửa danh mục");
    }

    // Kiểm tra category tồn tại
    const category = await CategoryModel.findById(id).lean();
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    const updatedCategory = await CategoryModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    
    return formatCategoryForFrontend(updatedCategory);
  },

  // Xóa category - CHỈ ADMIN
  remove: async (currentUser, id) => {
    // Kiểm tra quyền admin
    if (currentUser.role !== "ADMIN") {
      throw new Error("Chỉ Admin mới có thể xóa danh mục");
    }

    // Kiểm tra category tồn tại
    const category = await CategoryModel.findById(id).lean();
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    // Kiểm tra xem có products nào đang dùng category này không
    const productCount = await ProductModel.countDocuments({ 
      category_id: id 
    });
    
    if (productCount > 0) {
      throw new Error(
        `Không thể xóa danh mục này vì có ${productCount} sản phẩm đang sử dụng. ` +
        `Vui lòng chuyển hoặc xóa các sản phẩm trước khi xóa danh mục.`
      );
    }

    // Kiểm tra xem có subcategories nào (categories có parent_id = id này)
    const subcategoryCount = await CategoryModel.countDocuments({ 
      parent_id: id 
    });
    
    if (subcategoryCount > 0) {
      throw new Error(
        `Không thể xóa danh mục này vì có ${subcategoryCount} danh mục con. ` +
        `Vui lòng xóa hoặc chuyển các danh mục con trước.`
      );
    }

    // Nếu không có products và subcategories, mới xóa
    await CategoryModel.findByIdAndDelete(id);
    return true;
  },

  // Lấy categories theo hierarchy tree
  getTree: async () => {
    const categories = await CategoryModel.find({}).lean();
    const formattedCategories = formatCategoriesForFrontend(categories);
    return buildCategoryTree(formattedCategories);
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
