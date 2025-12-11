import { BannerService } from '../services/banner.service.js';
import { handle } from './base.controller.js';

export const BannerController = {
  // PUBLIC - Lấy danh sách banners (có thể lọc theo position, active_only)
  list: handle(async (req, res) => {
    const filters = {
      position: req.query.position,
      active_only: req.query.active_only,
      valid_only: req.query.valid_only,
    };

    const banners = await BannerService.list(filters);
    res.json(banners);
  }),

  // PUBLIC - Xem chi tiết banner
  detail: handle(async (req, res) => {
    try {
      const banner = await BannerService.detail(req.params.bannerId);
      res.json(banner);
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }
  }),

  // ADMIN ONLY - Tạo banner
  create: handle(async (req, res) => {
    try {
      // Xóa các trường không hợp lệ (nếu có)
      const { link_url, ...bannerData } = req.body;
      
      const created = await BannerService.create(
        bannerData,
        req.currentUser?.id
      );
      res.status(201).json({
        message: 'Tạo banner thành công',
        data: created,
      });
    } catch (error) {
      console.error('Banner create error:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi tạo banner' });
    }
  }),

  // ADMIN ONLY - Cập nhật banner
  update: handle(async (req, res) => {
    try {
      // Xóa các trường không hợp lệ (nếu có)
      const { link_url, ...bannerData } = req.body;
      
      const updated = await BannerService.update(
        req.params.bannerId,
        bannerData
      );
      res.json({
        message: 'Cập nhật banner thành công',
        data: updated,
      });
    } catch (error) {
      console.error('Banner update error:', error);
      return res.status(404).json({ message: error.message || 'Lỗi khi cập nhật banner' });
    }
  }),

  // ADMIN ONLY - Xóa banner
  remove: handle(async (req, res) => {
    try {
      await BannerService.delete(req.params.bannerId);
      res.json({ message: 'Xóa banner thành công' });
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }
  }),

  // PUBLIC - Tăng click count (khi user click vào banner)
  click: handle(async (req, res) => {
    try {
      await BannerService.incrementClick(req.params.bannerId);
      res.json({ message: 'Đã ghi nhận click' });
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }
  }),

  // ADMIN ONLY - Thống kê banners
  stats: handle(async (req, res) => {
    const stats = await BannerService.getStats();
    res.json(stats);
  }),
};

