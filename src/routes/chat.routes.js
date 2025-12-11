import { Router } from "express";
import { body, param } from "express-validator";
import { ChatController } from "../controllers/chat.controller.js";
import { authentication } from "../middleware/authentication.js";
import { validate } from "../middleware/validation.js";
import { handle } from "../controllers/base.controller.js";
import { uploadSingle } from "../middleware/upload.js";

const router = Router();

// Validation
const createConversationValidation = [
  body("store_id")
    .isMongoId()
    .withMessage("ID cửa hàng không hợp lệ"),
  body("product_id")
    .optional()
    .isMongoId()
    .withMessage("ID sản phẩm không hợp lệ"),
  body("order_id")
    .optional()
    .isMongoId()
    .withMessage("ID đơn hàng không hợp lệ"),
  validate,
];

const sendMessageValidation = [
  body("message")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Tin nhắn tối đa 2000 ký tự"),
  body("message_type")
    .optional()
    .isIn(["text", "image", "system", "product"])
    .withMessage("Loại tin nhắn không hợp lệ"),
  body("image_url")
    .optional()
    .isURL()
    .withMessage("URL ảnh không hợp lệ"),
  body("product_id")
    .optional()
    .isMongoId()
    .withMessage("ID sản phẩm không hợp lệ"),
  validate,
];

const conversationIdValidation = [
  param("id").isMongoId().withMessage("ID conversation không hợp lệ"),
  validate,
];

// Routes
// GET /conversations - Lấy danh sách conversations
router.get(
  "/",
  authentication(),
  ChatController.getConversations
);

// POST /conversations - Tạo conversation mới
router.post(
  "/",
  authentication(),
  createConversationValidation,
  ChatController.createConversation
);

// GET /conversations/:id - Lấy chi tiết conversation
router.get(
  "/:id",
  authentication(),
  conversationIdValidation,
  ChatController.getConversation
);

// GET /conversations/:id/messages - Lấy messages
router.get(
  "/:id/messages",
  authentication(),
  conversationIdValidation,
  ChatController.getMessages
);

// POST /conversations/:id/messages - Gửi message
router.post(
  "/:id/messages",
  authentication(),
  conversationIdValidation,
  sendMessageValidation,
  ChatController.sendMessage
);

// DELETE /conversations/:id - Xóa cuộc hội thoại
router.delete(
  "/:id",
  authentication(),
  conversationIdValidation,
  ChatController.deleteConversation
);

// POST /conversations/upload-image - Upload ảnh cho chat
router.post(
  "/upload-image",
  authentication(),
  uploadSingle("image"),
  handle(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: "Vui lòng chọn ảnh để upload",
      });
    }

    // Cloudinary tự động trả về secure_url sau khi upload
    const imageUrl = req.file.path;

    res.json({
      message: "Upload ảnh thành công",
      image_url: imageUrl,
    });
  })
);

export default router;

