import { Router } from "express";
import { param } from "express-validator";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { OrderController } from "../controllers/order.controller.js";

const router = Router();

// Validation middleware
const orderIdValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("orderId").isInt({ min: 1 }).withMessage("ID đơn hàng không hợp lệ"),
  validate,
];

const storeIdValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("storeId").isInt({ min: 1 }).withMessage("ID cửa hàng không hợp lệ"),
  validate,
];

// Routes - all require authentication
router.use(authentication());

// Create order from cart
router.post("/", OrderController.createFromCart);

// Get my orders (for customers)
router.get("/my", OrderController.listMyOrders);

// Get order detail
router.get("/:orderId", orderIdValidation, OrderController.detail);

// Get orders by store (for sellers/admins)
router.get(
  "/store/:storeId",
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  storeIdValidation,
  OrderController.listByStore
);

export default router;
