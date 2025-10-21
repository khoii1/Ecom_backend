import { CategoryService } from "../services/category.service.js";
import { handle } from "./base.controller.js";

export const CategoryController = {
  // PUBLIC - Lấy danh sách categories
  list: handle(async (req, res) => {
    const categories = await CategoryService.list();
    res.json(categories);
  }),

  // PUBLIC - Lấy categories với thống kê
  listWithStats: handle(async (req, res) => {
    const categories = await CategoryService.listWithStats();
    res.json(categories);
  }),

  // PUBLIC - Lấy categories theo tree hierarchy
  tree: handle(async (req, res) => {
    const categoryTree = await CategoryService.getTree();
    res.json(categoryTree);
  }),

  // PUBLIC - Xem chi tiết category
  detail: handle(async (req, res) => {
    try {
      const category = await CategoryService.detail(req.params.categoryId);
      res.json(category);
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }
  }),

  // ADMIN ONLY - Tạo category
  create: handle(async (req, res) => {
    try {
      const created = await CategoryService.create(req.currentUser, req.body);
      res.status(201).json({
        message: "Tạo danh mục thành công",
        data: created,
      });
    } catch (error) {
      return res.status(403).json({ message: error.message });
    }
  }),

  // ADMIN ONLY - Sửa category
  update: handle(async (req, res) => {
    try {
      const updated = await CategoryService.update(
        req.currentUser,
        req.params.categoryId,
        req.body
      );
      res.json({
        message: "Cập nhật danh mục thành công",
        data: updated,
      });
    } catch (error) {
      if (error.message.includes("Admin")) {
        return res.status(403).json({ message: error.message });
      }
      return res.status(404).json({ message: error.message });
    }
  }),

  // ADMIN ONLY - Xóa category
  remove: handle(async (req, res) => {
    try {
      await CategoryService.remove(req.currentUser, req.params.categoryId);
      res.json({ message: "Xóa danh mục thành công" });
    } catch (error) {
      if (error.message.includes("Admin")) {
        return res.status(403).json({ message: error.message });
      }
      return res.status(404).json({ message: error.message });
    }
  }),
};
