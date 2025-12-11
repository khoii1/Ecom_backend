import { NotificationService } from "../services/notification.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const NotificationController = {
  getMyNotifications: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unread_only === 'true';
    
    logger.debug('NOTIFICATION', 'Lấy danh sách thông báo', { userId, limit, offset, unreadOnly });
    const notifications = await NotificationService.getMyNotifications(userId, {
      limit,
      offset,
      unread_only: unreadOnly,
    });
    logger.info('NOTIFICATION', `Trả về ${notifications.length} thông báo`, { userId });
    res.json(notifications);
  }),

  getUnreadCount: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.debug('NOTIFICATION', 'Lấy số lượng thông báo chưa đọc', { userId });
    const count = await NotificationService.getUnreadCount(userId);
    res.json({ count });
  }),

  markAsRead: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const notificationId = req.params.notificationId;
    logger.info('NOTIFICATION', 'Đánh dấu đã đọc', { userId, notificationId });
    const notification = await NotificationService.markAsRead(notificationId, userId);
    if (!notification) {
      return res.status(404).json({ message: "Thông báo không tồn tại" });
    }
    res.json(notification);
  }),

  markAllAsRead: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.info('NOTIFICATION', 'Đánh dấu tất cả đã đọc', { userId });
    await NotificationService.markAllAsRead(userId);
    res.json({ message: "Đã đánh dấu tất cả thông báo là đã đọc" });
  }),

  delete: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const notificationId = req.params.notificationId;
    logger.info('NOTIFICATION', 'Xóa thông báo', { userId, notificationId });
    await NotificationService.deleteNotification(notificationId, userId);
    res.json({ message: "Đã xóa thông báo" });
  }),
};

