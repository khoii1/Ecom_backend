import { OrderService } from "../services/order.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const OrderController = {
  createFromCart: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { discount_id, payment_method = "cash", shipping_code, shipping_address_id, shipping_fee = 0 } = req.body;
    logger.info("ORDER", "Yêu cầu tạo đơn hàng từ giỏ hàng", {
      userId,
      discountId: discount_id,
      paymentMethod: payment_method,
      shippingCode: shipping_code,
      shippingAddressId: shipping_address_id,
    });
    try {
      const order = await OrderService.createFromCart(
        userId,
        discount_id,
        payment_method,
        shipping_code,
        shipping_address_id,
        shipping_fee
      );
      logger.info("ORDER", "Tạo đơn hàng thành công", {
        orderId: order.id,
        userId,
        total: order.total,
      });
      // Backend service đã xóa cart items khi tạo Order
      res.status(201).json(order);
    } catch (e) {
      logger.error("ORDER", "Tạo đơn hàng thất bại", {
        error: e.message,
        userId,
      });
      if (e.message.includes("Giỏ hàng trống")) {
        return res.status(400).json({ message: e.message });
      }
      if (e.message.includes("Không thể tạo đơn hàng")) {
        return res.status(500).json({ message: e.message });
      }
      throw e; // Ném lỗi để base handler bắt
    }
  }),

  listMyOrders: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.debug("ORDER", "Lấy danh sách đơn hàng của user", { userId });
    const orders = await OrderService.listMyOrders(userId);
    logger.info("ORDER", `Trả về ${orders.length} đơn hàng`, { userId });
    res.json(orders);
  }),

  listByStore: handle(async (req, res) => {
    const storeId = req.params.storeId;
    logger.debug("ORDER", "Lấy danh sách đơn hàng theo store", { storeId });
    const orders = await OrderService.listByStore(storeId);
    logger.info("ORDER", `Trả về ${orders.length} đơn hàng cho store`, {
      storeId,
    });
    res.json(orders);
  }),

  detail: handle(async (req, res) => {
    const orderId = req.params.orderId;
    logger.debug("ORDER", "Lấy chi tiết đơn hàng", { orderId });
    const order = await OrderService.detail(orderId);
    if (!order) {
      logger.warn("ORDER", "Đơn hàng không tồn tại", { orderId });
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    }
    res.json(order);
  }),

  updateStatus: handle(async (req, res) => {
    const orderId = req.params.orderId;
    const newStatus = req.body.status;
    const userId = req.currentUser?.id;
    const trackingInfo = {
      description: req.body.description,
      location: req.body.location,
      note: req.body.note,
      tracking_number: req.body.tracking_number,
      shipping_method: req.body.shipping_method,
    };
    logger.info("ORDER", "Yêu cầu cập nhật trạng thái đơn hàng", {
      orderId,
      newStatus,
      userId,
    });

    const updated = await OrderService.updateStatus(
      orderId,
      newStatus,
      req.currentUser,
      trackingInfo
    );
    if (!updated) {
      logger.warn(
        "ORDER",
        "Cập nhật trạng thái thất bại - đơn hàng không tồn tại",
        { orderId }
      );
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    }
    logger.info("ORDER", "Cập nhật trạng thái thành công", {
      orderId,
      newStatus,
      userId,
    });
    res.json(updated);
  }),

  cancel: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const orderId = req.params.orderId;
    const { reason } = req.body;

    logger.info("ORDER", "Yêu cầu hủy đơn hàng", {
      orderId,
      userId,
      reason,
    });

    try {
      const order = await OrderService.cancelOrder(orderId, req.currentUser, reason);
      logger.info("ORDER", "Hủy đơn hàng thành công", {
        orderId,
        userId,
      });
      res.json({
        message: "Đơn hàng đã được hủy thành công",
        order,
      });
    } catch (error) {
      logger.error("ORDER", "Hủy đơn hàng thất bại", {
        error: error.message,
        orderId,
        userId,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes("Không thể hủy")) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }
  }),
};
