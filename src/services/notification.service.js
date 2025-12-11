import { NotificationModel } from "../models/notification.model.js";

export const NotificationService = {
  // Tạo notification mới
  async createNotification(user_id, { type, title, message, data = null }) {
    const notification = await NotificationModel.create({
      user_id,
      type,
      title,
      message,
      data,
    });
    
    return {
      ...notification.toObject(),
      id: notification._id.toString(),
      user_id: notification.user_id.toString(),
    };
  },
  
  // Lấy tất cả notifications của user
  async getMyNotifications(user_id, { limit = 50, offset = 0, unread_only = false } = {}) {
    const query = { user_id };
    if (unread_only) {
      query.is_read = false;
    }
    
    const notifications = await NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
    
    return notifications.map(notif => ({
      ...notif,
      id: notif._id.toString(),
      user_id: notif.user_id.toString(),
    }));
  },
  
  // Đếm số notification chưa đọc
  async getUnreadCount(user_id) {
    return await NotificationModel.countDocuments({
      user_id,
      is_read: false,
    });
  },
  
  // Đánh dấu đã đọc
  async markAsRead(notification_id, user_id) {
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: notification_id, user_id },
      { 
        $set: { 
          is_read: true,
          read_at: new Date(),
        } 
      },
      { new: true }
    ).lean();
    
    if (!notification) return null;
    
    return {
      ...notification,
      id: notification._id.toString(),
      user_id: notification.user_id.toString(),
    };
  },
  
  // Đánh dấu tất cả đã đọc
  async markAllAsRead(user_id) {
    await NotificationModel.updateMany(
      { user_id, is_read: false },
      { 
        $set: { 
          is_read: true,
          read_at: new Date(),
        } 
      }
    );
    return true;
  },
  
  // Xóa notification
  async deleteNotification(notification_id, user_id) {
    await NotificationModel.findOneAndDelete({
      _id: notification_id,
      user_id,
    });
    return true;
  },
};

