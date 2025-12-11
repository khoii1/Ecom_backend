import { Router } from "express";
import { body, param } from "express-validator";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { handle } from "../controllers/base.controller.js";
import { OrderModel } from "../models/order.model.js";
import { OrderItemModel } from "../models/order_item.model.js";
import { NotificationModel } from "../models/notification.model.js";
import { uploadDeliveryProof } from "../middleware/upload.js";
import { logger } from "../utils/logger.js";

const router = Router();

// Tất cả routes đều yêu cầu authentication và role SHIPPER
router.use(authentication());
router.use(authorizeByRoles([ROLES.SHIPPER, ROLES.ADMIN]));

const orderIdValidation = [
  param("orderId").isMongoId().withMessage("ID đơn hàng không hợp lệ"),
  validate,
];

// GET /shipper/orders/available - Xem đơn hàng chờ giao (chưa có shipper)
router.get(
  "/orders/available",
  handle(async (req, res) => {
    const orders = await OrderModel.find({
      $or: [{ status: "paid" }, { status: "processing" }],
      shipper_id: null,
    })
      .populate("buyer_id", "full_name email")
      .populate("store_id", "name")
      .populate("shipping_address")
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      orders.map((order) => ({
        ...order,
        id: order._id.toString(),
        buyer_id: order.buyer_id?._id.toString(),
        buyer_name: order.buyer_id?.full_name,
        store_id: order.store_id?._id.toString(),
        store_name: order.store_id?.name,
        shipping_address: order.shipping_address
          ? {
              ...order.shipping_address,
              id: order.shipping_address._id.toString(),
            }
          : null,
      }))
    );
  })
);

// GET /shipper/orders/my - Xem đơn hàng đã được gán cho shipper
router.get(
  "/orders/my",
  handle(async (req, res) => {
    const shipperId = req.currentUser.id;

    const orders = await OrderModel.find({
      shipper_id: shipperId,
      status: { $in: ["processing", "shipped", "delivered"] },
    })
      .populate("buyer_id", "full_name email")
      .populate("store_id", "name")
      .populate("shipping_address")
      .sort({ createdAt: -1 })
      .lean();

    // Lấy order items để tính tổng số sản phẩm
    const orderIds = orders.map((o) => o._id);
    const orderItems = await OrderItemModel.find({
      order_id: { $in: orderIds },
    })
      .populate("product_id", "title image_url")
      .lean();

    const itemsMap = new Map();
    orderItems.forEach((item) => {
      if (!itemsMap.has(item.order_id.toString())) {
        itemsMap.set(item.order_id.toString(), []);
      }
      itemsMap.get(item.order_id.toString()).push({
        ...item,
        id: item._id.toString(),
        product_id: item.product_id?._id.toString(),
        product_title: item.product_id?.title,
        product_image_url: item.product_id?.image_url,
      });
    });

    res.json(
      orders.map((order) => ({
        ...order,
        id: order._id.toString(),
        buyer_id: order.buyer_id?._id.toString(),
        buyer_name: order.buyer_id?.full_name,
        buyer_email: order.buyer_id?.email,
        store_id: order.store_id?._id.toString(),
        store_name: order.store_id?.name,
        shipping_address: order.shipping_address
          ? {
              ...order.shipping_address,
              id: order.shipping_address._id.toString(),
            }
          : null,
        items: itemsMap.get(order._id.toString()) || [],
      }))
    );
  })
);

// POST /shipper/orders/:orderId/accept - Nhận đơn hàng
router.post(
  "/orders/:orderId/accept",
  orderIdValidation,
  handle(async (req, res) => {
    const orderId = req.params.orderId;
    const shipperId = req.currentUser.id;

    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    if (order.shipper_id) {
      return res
        .status(400)
        .json({ message: "Đơn hàng đã được gán cho shipper khác" });
    }

    if (order.status !== "paid" && order.status !== "processing") {
      return res.status(400).json({
        message:
          "Chỉ có thể nhận đơn hàng ở trạng thái 'paid' hoặc 'processing'",
      });
    }

    await OrderModel.findByIdAndUpdate(orderId, {
      $set: {
        shipper_id: shipperId,
        status: "processing",
      },
    });

    logger.info("SHIPPER", "Shipper nhận đơn hàng", {
      orderId,
      shipperId,
    });

    res.json({ message: "Đã nhận đơn hàng thành công" });
  })
);

// POST /shipper/orders/:orderId/pickup - Xác nhận đã nhận hàng từ store
router.post(
  "/orders/:orderId/pickup",
  orderIdValidation,
  handle(async (req, res) => {
    const orderId = req.params.orderId;
    const shipperId = req.currentUser.id;

    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    if (order.shipper_id?.toString() !== shipperId.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện hành động này" });
    }

    if (order.status !== "processing") {
      return res
        .status(400)
        .json({
          message: "Đơn hàng phải ở trạng thái 'processing' để nhận hàng",
        });
    }

    await OrderModel.findByIdAndUpdate(orderId, {
      $set: {
        status: "shipped",
      },
    });

    logger.info("SHIPPER", "Shipper nhận hàng từ store", {
      orderId,
      shipperId,
    });

    res.json({ message: "Đã xác nhận nhận hàng thành công" });
  })
);

// POST /shipper/orders/:orderId/deliver - Xác nhận đã giao hàng (với ảnh)
router.post(
  "/orders/:orderId/deliver",
  orderIdValidation,
  uploadDeliveryProof("delivery_proof_image"),
  handle(async (req, res) => {
    const orderId = req.params.orderId;
    const shipperId = req.currentUser.id;
    const { delivery_note } = req.body;

    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    if (order.shipper_id?.toString() !== shipperId.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện hành động này" });
    }

    if (order.status !== "shipped") {
      return res
        .status(400)
        .json({ message: "Đơn hàng phải ở trạng thái 'shipped' để giao hàng" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Vui lòng upload ảnh xác nhận giao hàng" });
    }

    const deliveryProofImage = req.file.path; // Cloudinary URL

    // Import OrderTrackingModel
    const { OrderTrackingModel } = await import("../models/order_tracking.model.js");
    const { OrderItemModel } = await import("../models/order_item.model.js");
    const { ProductModel } = await import("../models/product.model.js");

    // Status cuối cùng luôn là "delivered" khi shipper chụp ảnh xác nhận giao hàng
    // Với cash payment: thanh toán xảy ra khi giao hàng, nhưng status vẫn là "delivered"
    // Với VNPay payment: đã thanh toán từ trước, status là "delivered"
    const newStatus = "delivered";

    // Với cash payment, cần giảm stock khi giao hàng (vì lúc này mới thu tiền)
    if (order.payment_method === "cash") {
      logger.info("SHIPPER", "Thanh toán tiền mặt: giảm stock khi giao hàng", {
        orderId,
        paymentMethod: order.payment_method,
      });

      const orderItems = await OrderItemModel.find({ order_id: orderId }).lean();
      for (const item of orderItems) {
        // Lấy thông tin product hiện tại để kiểm tra reserved_quantity
        const product = await ProductModel.findById(item.product_id).lean();

        // Luôn giảm stock_quantity (stock thực tế)
        const updateData = {
          $inc: {
            stock_quantity: -item.qty,
          },
        };

        // Chỉ giảm reserved_quantity nếu nó > 0 (còn reservation)
        if (product && product.reserved_quantity > 0) {
          updateData.$inc.reserved_quantity = -item.qty;
        }

        await ProductModel.findByIdAndUpdate(item.product_id, updateData);
      }
      logger.info("SHIPPER", "Đã giảm stock sau giao hàng (cash)", { orderId });
    }

    // Tạo tracking entry cho 'delivered' (trạng thái cuối cùng)
    await OrderTrackingModel.create({
      order_id: orderId,
      status: "delivered",
      description: "Đơn hàng đã được giao thành công",
      location: null,
      note: delivery_note || null,
    });

    // Nếu là cash payment, tạo thêm tracking entry cho 'paid' (trạng thái trung gian)
    // để lưu lại lịch sử thanh toán, nhưng status cuối cùng vẫn là "delivered"
    if (order.payment_method === "cash") {
      await OrderTrackingModel.create({
        order_id: orderId,
        status: "paid",
        description: "Đơn hàng đã được thanh toán (tiền mặt)",
        location: null,
        note: null,
      });
      logger.info("SHIPPER", "Đã tạo tracking entry cho 'paid' (cash payment)", {
        orderId,
      });
    }

    // Cập nhật order với status = "delivered" (cho cả cash và VNPay)
    const updatedOrder = await OrderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: newStatus,
          delivery_proof_image: deliveryProofImage,
          delivery_note: delivery_note || null,
        },
      },
      { new: true }
    ).lean();

    // Tạo notification cho customer
    await NotificationModel.create({
      user_id: order.buyer_id,
      type: "order_delivered",
      title: "Đơn hàng đã được giao",
      message: `Đơn hàng ${order.code} đã được giao. Vui lòng xác nhận đã nhận hàng.`,
      order_id: orderId,
      data: {
        order_code: order.code,
        order_id: orderId,
      },
    });

    logger.info("SHIPPER", "Shipper giao hàng thành công", {
      orderId,
      shipperId,
    });

    res.json({
      message: "Đã xác nhận giao hàng thành công",
      order: {
        ...updatedOrder,
        id: updatedOrder._id.toString(),
      },
    });
  })
);

// GET /shipper/orders/:orderId - Chi tiết đơn hàng
router.get(
  "/orders/:orderId",
  orderIdValidation,
  handle(async (req, res) => {
    const orderId = req.params.orderId;
    const shipperId = req.currentUser.id;

    const order = await OrderModel.findById(orderId)
      .populate("buyer_id", "full_name email phone")
      .populate("store_id", "name address")
      .populate("shipping_address")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Kiểm tra shipper có quyền xem đơn này không
    if (
      order.shipper_id?.toString() !== shipperId.toString() &&
      req.currentUser.role !== ROLES.ADMIN
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xem đơn hàng này" });
    }

    // Lấy order items
    const orderItems = await OrderItemModel.find({ order_id: orderId })
      .populate("product_id", "title image_url price")
      .lean();

    res.json({
      ...order,
      id: order._id.toString(),
      buyer_id: order.buyer_id?._id.toString(),
      buyer_name: order.buyer_id?.full_name,
      buyer_email: order.buyer_id?.email,
      store_id: order.store_id?._id.toString(),
      store_name: order.store_id?.name,
      shipping_address: order.shipping_address
        ? {
            ...order.shipping_address,
            id: order.shipping_address._id.toString(),
          }
        : null,
      items: orderItems.map((item) => ({
        ...item,
        id: item._id.toString(),
        product_id: item.product_id?._id.toString(),
        product_title: item.product_id?.title,
        product_image_url: item.product_id?.image_url,
        product_price: item.product_id?.price,
      })),
    });
  })
);

export default router;
