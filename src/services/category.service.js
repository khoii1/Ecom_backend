import { CategoryModel } from "../models/category.model.js";
import slugify from "slugify";

export const CategoryService = {
  list: (currentUser = null) => {
    // Nếu là SELLER, chỉ lấy categories của mình
    if (currentUser && currentUser.role === "SELLER") {
      return CategoryModel.findMany({ created_by: currentUser.id });
    }
    // ADMIN hoặc không có user thì lấy tất cả
    return CategoryModel.findMany({});
  },

  detail: async (id, currentUser = null) => {
    const category = await CategoryModel.findById(id);
    if (!category) return null;

    // Nếu là SELLER, chỉ được xem categories của mình
    if (
      currentUser &&
      currentUser.role === "SELLER" &&
      category.created_by !== currentUser.id
    ) {
      return null; // Hoặc throw error
    }

    return category;
  },

  create: (currentUser, payload) => {
    const slug =
      payload.slug || slugify(payload.name, { lower: true, strict: true });

    return CategoryModel.create({
      ...payload,
      slug,
      created_by: currentUser.id,
      updated_by: currentUser.id,
    });
  },

  update: async (currentUser, id, patch) => {
    // Kiểm tra category có tồn tại và quyền ownership
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    // SELLER chỉ được sửa categories của mình
    if (
      currentUser.role !== "ADMIN" &&
      category.created_by !== currentUser.id
    ) {
      throw new Error("FORBIDDEN");
    }

    return CategoryModel.updateById(id, {
      ...patch,
      updated_by: currentUser.id,
    });
  },

  remove: async (currentUser, id) => {
    // Kiểm tra category có tồn tại và quyền ownership
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    // SELLER chỉ được xóa categories của mình
    if (
      currentUser.role !== "ADMIN" &&
      category.created_by !== currentUser.id
    ) {
      throw new Error("FORBIDDEN");
    }

    return CategoryModel.deleteById(id);
  },
};
