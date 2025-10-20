import { CategoryService } from '../services/category.service.js';
import { handle } from './base.controller.js';

export const CategoryController = {
  list: handle(async (req, res) => res.json(await CategoryService.list())),
  detail: handle(async (req, res) => {
    const data = await CategoryService.detail(req.params.categoryId);
    if (!data) return res.status(404).json({ message: 'Danh mục không tồn tại' });
    res.json(data);
  }),
  create: handle(async (req, res) => {
    const created = await CategoryService.create(req.currentUser || {}, req.body);
    res.status(201).json(created);
  }),
  update: handle(async (req, res) => {
    try {
      const updated = await CategoryService.update(req.currentUser || {}, req.params.categoryId, req.body);
      if (!updated) return res.status(404).json({ message: 'Danh mục không tồn tại' });
      res.json(updated);
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
  remove: handle(async (req, res) => {
    try {
      await CategoryService.remove(req.currentUser || {}, req.params.categoryId);
      res.json({ message: 'Đã xóa' });
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
};
