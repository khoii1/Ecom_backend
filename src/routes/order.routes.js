import { Router } from "express";
import { param } from "express-validator";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { OrderController } from "../controllers/order.controller.js";

const router = Router();

// Validation middleware (Đã sửa isInt - Chính xác)
const orderIdValidation = [
  param("orderId").isInt({ min: 1 }).withMessage("ID đơn hàng không hợp lệ"),
  validate,
];
const storeIdValidation = [
  param("storeId").isInt({ min: 1 }).withMessage("ID cửa hàng không hợp lệ"),
  validate,
];

// Routes - all require authentication
router.use(authentication());

// Create order from cart (POST /orders/) - Sẽ dùng endpoint này
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

router.get(
  "/:orderId/status",
  orderIdValidation,
  handle(async (req, res) => {
    // Dùng handle từ base.controller
    const orderId = parseInt(req.params.orderId, 10);
    const currentUser = req.currentUser;

    const order = await OrderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    console.log(
      `Checking permission: Order Buyer ID = ${
        order.buyer_id
      } (Type: ${typeof order.buyer_id}), Current User ID = ${
        currentUser.id
      } (Type: ${typeof currentUser.id}), Role = ${currentUser.role}`
    );

    // Kiểm tra quyền xem: Chỉ chủ đơn hàng hoặc Admin
    if (order.buyer_id !== currentUser.id && currentUser.role !== ROLES.ADMIN) {
      return res
        .status(403)
        .json({ message: "Không có quyền xem đơn hàng này" });
    }

    res.json({ status: order.status });
  })
);

export default router;

import { handle } from "../controllers/base.controller.js";
import { OrderModel } from "../models/order.model.js";
