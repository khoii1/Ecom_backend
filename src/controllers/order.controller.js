import { OrderService } from "../services/order.service.js";
import { handle } from "./base.controller.js";

export const OrderController = {
  createFromCart: handle(async (req, res) => {
    try {
      const order = await OrderService.createFromCart(req.currentUser.id);
      // Backend service đã xóa cart items khi tạo Order
      res.status(201).json(order);
    } catch (e) {
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
    const orders = await OrderService.listMyOrders(req.currentUser.id);
    res.json(orders);
  }),

  listByStore: handle(async (req, res) => {
    const orders = await OrderService.listByStore(req.params.storeId);
    res.json(orders);
  }),

  detail: handle(async (req, res) => {
    const order = await OrderService.detail(req.params.orderId);
    if (!order)
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    res.json(order);
  }),

  updateStatus: handle(async (req, res) => {
    const updated = await OrderService.updateStatus(
      req.params.orderId,
      req.body.status,
      req.currentUser
    );
    if (!updated)
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    res.json(updated);
  }),
};
