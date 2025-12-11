import { Router } from "express";
import { body, param } from "express-validator";
import { OrderItemController } from "../controllers/order_item.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";
import { validate } from "../middleware/validation.js";

const router = Router();

// Validation middleware - MongoDB ObjectId
const orderItemIdValidation = [
  param("orderItemId")
    .isMongoId()
    .withMessage("ID mục đơn hàng không hợp lệ"),
  validate,
];

const createOrderItemValidation = [
  body("order_id").isMongoId().withMessage("ID đơn hàng không hợp lệ"),
  body("product_id").isMongoId().withMessage("ID sản phẩm không hợp lệ"),
  body("unit_price")
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Giá đơn vị phải là số dương"),
  body("qty").isInt({ min: 1 }).withMessage("Số lượng phải là số nguyên dương"),
  body("variant_id")
    .optional()
    .isMongoId()
    .withMessage("ID biến thể không hợp lệ"),
  validate,
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
  validate,
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
