import { Router } from "express";
import { body, param } from "express-validator";
import { ReturnController } from "../controllers/return.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const returnIdValidation = [
  param("returnId").isMongoId().withMessage("ID yêu cầu trả hàng không hợp lệ"),
  validate,
];

const storeIdValidation = [
  param("storeId").isMongoId().withMessage("ID cửa hàng không hợp lệ"),
  validate,
];

const createReturnValidation = [
  body("order_id").isMongoId().withMessage("ID đơn hàng không hợp lệ"),
  body("return_type")
    .optional()
    .isIn(["refund", "exchange", "both"])
    .withMessage("Loại trả hàng không hợp lệ"),
  body("reason")
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage("Lý do trả hàng phải từ 5-500 ký tự"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Mô tả tối đa 1000 ký tự"),
  body("items")
    .isArray({ min: 1 })
    .withMessage("Phải có ít nhất một sản phẩm để trả hàng"),
  body("items.*.order_item_id")
    .isMongoId()
    .withMessage("ID order item không hợp lệ"),
  body("items.*.qty")
    .isInt({ min: 1 })
    .withMessage("Số lượng phải là số nguyên dương"),
  body("items.*.reason")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Lý do cho từng sản phẩm tối đa 200 ký tự"),
  body("images").optional().isArray().withMessage("images phải là mảng"),
  body("images.*").optional().isURL().withMessage("URL ảnh không hợp lệ"),
  validate,
];

const approveReturnValidation = [
  ...returnIdValidation,
  body("admin_note")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Ghi chú tối đa 500 ký tự"),
  validate,
];

const rejectReturnValidation = [
  ...returnIdValidation,
  body("admin_note")
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage("Lý do từ chối phải từ 5-500 ký tự"),
  validate,
];

// Routes - Tất cả đều cần authentication
router.use(authentication());

// Customer routes
router.post("/", createReturnValidation, ReturnController.create);
router.get("/my", ReturnController.listMyReturns);
router.get("/:returnId", returnIdValidation, ReturnController.detail);
router.patch("/:returnId/cancel", returnIdValidation, ReturnController.cancel);

// Seller routes
router.get(
  "/store/:storeId",
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  storeIdValidation,
  ReturnController.listByStore
);
router.patch(
  "/:returnId/approve",
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  approveReturnValidation,
  ReturnController.approve
);
router.patch(
  "/:returnId/reject",
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  rejectReturnValidation,
  ReturnController.reject
);
router.patch(
  "/:returnId/process",
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  returnIdValidation,
  ReturnController.process
);
router.patch(
  "/:returnId/complete",
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  returnIdValidation,
  ReturnController.complete
);
router.post(
  "/:returnId/cancel",
  authentication(),
  returnIdValidation,
  ReturnController.cancel
);
router.post(
  "/:returnId/exchange-order",
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  returnIdValidation,
  ReturnController.createExchangeOrder
);

export default router;
