import { CartService } from "../services/cart.service.js";
import { handle } from "./base.controller.js";

export const CartController = {
  getMyCart: handle(async (req, res) => {
    const cart = await CartService.getMyCart(req.currentUser.id);
    res.json(cart);
  }),

  addItem: handle(async (req, res) => {
    const item = await CartService.addItem(req.currentUser.id, req.body);
    res.status(201).json(item);
  }),

  updateItem: handle(async (req, res) => {
    const updated = await CartService.updateItem(
      req.params.itemId,
      req.body.qty
    );
    if (!updated)
      return res.status(404).json({ message: "Mục giỏ hàng không tồn tại" });
    res.json(updated);
  }),

  removeItem: handle(async (req, res) => {
    await CartService.removeItem(req.params.itemId);
    res.json({ message: "Đã xóa khỏi giỏ hàng" });
  }),

  clear: handle(async (req, res) => {
    await CartService.clear(req.currentUser.id);
    res.json({ message: "Đã xóa toàn bộ giỏ hàng" });
  }),
};
