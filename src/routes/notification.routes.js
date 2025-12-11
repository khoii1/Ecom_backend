import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller.js";
import { authentication } from "../middleware/authentication.js";
import { param } from "express-validator";
import { validate } from "../middleware/validation.js";

const router = Router();

// Tất cả routes đều cần authentication
router.use(authentication());

// GET /notifications - Lấy danh sách thông báo
router.get("/", NotificationController.getMyNotifications);

// GET /notifications/unread-count - Lấy số lượng thông báo chưa đọc
router.get("/unread-count", NotificationController.getUnreadCount);

// PATCH /notifications/:notificationId/read - Đánh dấu đã đọc
router.patch(
  "/:notificationId/read",
  [param("notificationId").isMongoId().withMessage("ID thông báo không hợp lệ"), validate],
  NotificationController.markAsRead
);

// PATCH /notifications/read-all - Đánh dấu tất cả đã đọc
router.patch("/read-all", NotificationController.markAllAsRead);

// DELETE /notifications/:notificationId - Xóa thông báo
router.delete(
  "/:notificationId",
  [param("notificationId").isMongoId().withMessage("ID thông báo không hợp lệ"), validate],
  NotificationController.delete
);

export default router;

