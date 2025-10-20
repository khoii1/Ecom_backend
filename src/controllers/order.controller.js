import { OrderService } from "../services/order.service.js";
import { handle } from "./base.controller.js";

export const OrderController = {
  createFromCart: handle(async (req, res) => {
    const result = await OrderService.createFromCart(req.currentUser.id);
    if (result.error) return res.status(400).json({ message: result.error });
    res.status(201).json(result);
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
