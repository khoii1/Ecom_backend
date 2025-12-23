import { Router } from "express";
import { param, body } from "express-validator";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { OrderController } from "../controllers/order.controller.js";
import { logger } from "../utils/logger.js";
import { handle } from "../controllers/base.controller.js";

const router = Router();

// Validation middleware - MongoDB ObjectId
const orderIdValidation = [
  param("orderId").isMongoId().withMessage("ID đơn hàng không hợp lệ"),
  validate,
];
const storeIdValidation = [
  param("storeId").isMongoId().withMessage("ID cửa hàng không hợp lệ"),
  validate,
];

// Validation for creating order from cart
const createOrderValidation = [
  body("discount_id")
    .optional()
    .isMongoId()
    .withMessage("ID mã giảm giá không hợp lệ"),
  body("payment_method")
    .optional()
    .isIn(["cash", "vnpay", "wallet"])
    .withMessage(
      "Phương thức thanh toán không hợp lệ. Chỉ chấp nhận: cash, vnpay, wallet"
    ),
  validate,
];

// Routes - all require authentication
router.use(authentication());

// Create order from cart (POST /orders/) - Sẽ dùng endpoint này
router.post("/", createOrderValidation, OrderController.createFromCart);

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

import { OrderModel } from "../models/order.model.js";

router.get(
  "/:orderId/status",
  orderIdValidation,
  handle(async (req, res) => {
    // Dùng handle từ base.controller
    const orderId = req.params.orderId;
    const currentUser = req.currentUser;

    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Kiểm tra quyền xem: Chỉ chủ đơn hàng hoặc Admin
    if (
      order.buyer_id.toString() !== currentUser.id.toString() &&
      currentUser.role !== ROLES.ADMIN
    ) {
      return res
        .status(403)
        .json({ message: "Không có quyền xem đơn hàng này" });
    }

    res.json({ status: order.status });
  })
);

// GET /orders - Lấy tất cả đơn hàng (Admin only)
router.get(
  "/",
  authorizeByRoles([ROLES.ADMIN]),
  handle(async (req, res) => {
    const { status, limit = 50, offset = 0 } = req.query;
    const { OrderItemModel } = await import("../models/order_item.model.js");

    const query = {};
    if (status) {
      query.status = status;
    }

    const orders = await OrderModel.find(query)
      .populate("buyer_id", "full_name email")
      .populate("store_id", "name")
      .populate("shipper_id", "full_name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Lấy order items riêng để lấy image của sản phẩm đầu tiên
    const orderIds = orders.map((o) => o._id);
    const firstOrderItems = await OrderItemModel.aggregate([
      {
        $match: {
          order_id: { $in: orderIds },
        },
      },
      {
        $sort: { order_id: 1, _id: 1 },
      },
      {
        $group: {
          _id: "$order_id",
          firstItem: { $first: "$$ROOT" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "firstItem.product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: {
          path: "$product",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          order_id: "$_id",
          image_url: "$product.image_url",
        },
      },
    ]);

    const imageMap = new Map();
    firstOrderItems.forEach((item) => {
      imageMap.set(item.order_id.toString(), item.image_url || null);
    });

    res.json(
      orders.map((order) => ({
        ...order,
        id: order._id.toString(),
        buyer_id: order.buyer_id?._id.toString() || order.buyer_id.toString(),
        buyer_name: order.buyer_id?.full_name || null,
        buyer_email: order.buyer_id?.email || null,
        store_id: order.store_id?._id.toString() || order.store_id.toString(),
        store_name: order.store_id?.name || null,
        shipper_id: order.shipper_id?._id?.toString() || order.shipper_id?.toString() || null,
        shipper_name: order.shipper_id?.full_name || null,
        shipper_email: order.shipper_id?.email || null,
        first_item_image_url: imageMap.get(order._id.toString()) || null,
      }))
    );
  })
);

// PATCH /orders/:orderId/status - Cập nhật trạng thái đơn hàng (Admin/Seller)
router.patch(
  "/:orderId/status",
  authorizeByRoles([ROLES.ADMIN, ROLES.SELLER]),
  [
    orderIdValidation[0],
    body("status")
      .isIn([
        "pending",
        "paid",
        "payment_failed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ])
      .withMessage("Trạng thái không hợp lệ"),
    validate,
  ],
  OrderController.updateStatus
);

// POST /orders/:orderId/assign-shipper - Gán shipper cho đơn hàng (Seller/Admin)
router.post(
  "/:orderId/assign-shipper",
  authorizeByRoles([ROLES.ADMIN, ROLES.SELLER]),
  [
    orderIdValidation[0],
    body("shipper_id").isMongoId().withMessage("ID shipper không hợp lệ"),
    validate,
  ],
  handle(async (req, res) => {
    const orderId = req.params.orderId;
    const { shipper_id } = req.body;
    const { OrderModel } = await import("../models/order.model.js");
    const { UserModel } = await import("../models/user.model.js");

    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Kiểm tra quyền: Seller chỉ được gán shipper cho đơn hàng của store mình
    if (req.currentUser.role === ROLES.SELLER) {
      const { StoreModel } = await import("../models/store.model.js");
      const store = await StoreModel.findOne({
        _id: order.store_id,
        owner_id: req.currentUser.id,
      }).lean();

      if (!store) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền gán shipper cho đơn hàng này" });
      }
    }

    // Kiểm tra shipper tồn tại và có role SHIPPER
    const shipper = await UserModel.findById(shipper_id).lean();
    if (!shipper || shipper.role !== ROLES.SHIPPER) {
      return res.status(400).json({ message: "Shipper không hợp lệ" });
    }

    if (order.shipper_id) {
      return res
        .status(400)
        .json({ message: "Đơn hàng đã được gán cho shipper khác" });
    }

    if (order.status !== "paid" && order.status !== "processing") {
      return res.status(400).json({
        message:
          "Chỉ có thể gán shipper cho đơn hàng ở trạng thái 'paid' hoặc 'processing'",
      });
    }

    await OrderModel.findByIdAndUpdate(orderId, {
      $set: {
        shipper_id: shipper_id,
        status: "processing",
      },
    });

    res.json({ message: "Đã gán shipper thành công" });
  })
);

// POST /orders/:orderId/cancel - Hủy đơn hàng (Buyer/Seller/Admin)
router.post(
  "/:orderId/cancel",
  orderIdValidation,
  [
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Lý do hủy tối đa 500 ký tự"),
    validate,
  ],
  OrderController.cancel
);

// POST /orders/:orderId/confirm-delivery - Customer xác nhận đã nhận hàng
router.post(
  "/:orderId/confirm-delivery",
  orderIdValidation,
  [
    body("confirmed").isBoolean().withMessage("confirmed phải là boolean"),
    body("note").optional().trim().isLength({ max: 500 }),
    validate,
  ],
  handle(async (req, res) => {
    const orderId = req.params.orderId;
    const userId = req.currentUser.id;
    const { confirmed, note } = req.body;
    const { OrderModel } = await import("../models/order.model.js");
    const { NotificationModel } = await import(
      "../models/notification.model.js"
    );
    const { StoreModel } = await import("../models/store.model.js");

    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Chỉ customer của đơn hàng mới được confirm
    if (order.buyer_id.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xác nhận đơn hàng này" });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({
        message: "Chỉ có thể xác nhận đơn hàng ở trạng thái 'delivered'",
      });
    }

    const updateData = {
      delivery_confirmed_by_customer: confirmed,
      delivery_confirmed_at: new Date(),
    };

    await OrderModel.findByIdAndUpdate(orderId, { $set: updateData });

    if (confirmed) {
      // Tạo notification cho seller: customer đã xác nhận
      const store = await StoreModel.findById(order.store_id)
        .populate("owner_id")
        .lean();
      if (store?.owner_id) {
        await NotificationModel.create({
          user_id: store.owner_id._id,
          type: "delivery_confirmed",
          title: "Khách hàng đã xác nhận nhận hàng",
          message: `Đơn hàng ${order.code} đã được khách hàng xác nhận nhận hàng.`,
          order_id: orderId,
          data: {
            order_code: order.code,
            order_id: orderId,
          },
        });
      }

    } else {
      // Customer chưa nhận được → Tạo notification cho seller để xử lý
      const store = await StoreModel.findById(order.store_id)
        .populate("owner_id")
        .lean();
      if (store?.owner_id) {
        await NotificationModel.create({
          user_id: store.owner_id._id,
          type: "order",
          title: "Khách hàng báo chưa nhận được hàng",
          message: `Đơn hàng ${
            order.code
          }: Khách hàng báo chưa nhận được hàng.${
            note ? ` Lý do: ${note}` : ""
          }`,
          order_id: orderId,
          data: {
            order_code: order.code,
            order_id: orderId,
            note: note || null,
          },
        });
      }
    }

    res.json({
      message: confirmed
        ? "Đã xác nhận nhận hàng thành công"
        : "Đã báo chưa nhận được hàng. Shop sẽ liên hệ với bạn sớm nhất.",
    });
  })
);

export default router;
