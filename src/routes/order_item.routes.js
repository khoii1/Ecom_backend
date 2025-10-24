import { Router } from "express";
import { body, param } from "express-validator";
import { OrderItemController } from "../controllers/order_item.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const orderItemIdValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("orderItemId")
    .isInt({ min: 1 })
    .withMessage("ID mục đơn hàng không hợp lệ"),
];

const createOrderItemValidation = [
  body("order_id").isInt({ min: 1 }).withMessage("ID đơn hàng không hợp lệ"),

  body("product_id").isInt({ min: 1 }).withMessage("ID sản phẩm không hợp lệ"),
  body("unit_price")
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Giá đơn vị phải là số dương"),
  body("qty").isInt({ min: 1 }).withMessage("Số lượng phải là số nguyên dương"),
  body("variant_id")
    .optional()
    // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
    .isInt({ min: 1 })
    .withMessage("ID biến thể không hợp lệ"),
];

const updateOrderItemValidation = [
  ...orderItemIdValidation,
  body("unit_price")
    .optional()
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Giá đơn vị phải là số dương"),
  body("qty")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số lượng phải là số nguyên dương"),
];

// Routes - Admin only for direct order item management
router.get(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  OrderItemController.list
);

router.get(
  "/:orderItemId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  orderItemIdValidation,
  OrderItemController.detail
);

router.post(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  createOrderItemValidation,
  OrderItemController.create
);

router.put(
  "/:orderItemId",
  authentication(),
  updateOrderItemValidation,
  OrderItemController.update
);

router.delete(
  "/:orderItemId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  orderItemIdValidation,
  OrderItemController.remove
);

export default router;
