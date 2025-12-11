import { CartService } from "../services/cart.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const CartController = {
  getMyCart: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.debug('CART', 'Lấy giỏ hàng', { userId });
    const cart = await CartService.getMyCart(userId);
    logger.info('CART', `Giỏ hàng có ${cart.items?.length || 0} sản phẩm`, { userId });
    res.json(cart);
  }),

  addItem: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { product_id, qty } = req.body;
    logger.info('CART', 'Thêm sản phẩm vào giỏ hàng', { userId, productId: product_id, qty });
    const item = await CartService.addItem(userId, req.body);
    logger.info('CART', 'Thêm vào giỏ hàng thành công', { userId, cartItemId: item.id });
    res.status(201).json(item);
  }),

  updateItem: handle(async (req, res) => {
    const userId = req.currentUser?.id;
    const itemId = req.params.itemId;
    const qty = req.body.qty;
    logger.info('CART', 'Cập nhật số lượng sản phẩm', { userId, itemId, qty });
    
    const updated = await CartService.updateItem(itemId, qty);
    if (!updated) {
      logger.warn('CART', 'Cập nhật thất bại - mục không tồn tại', { itemId });
      return res.status(404).json({ message: "Mục giỏ hàng không tồn tại" });
    }
    logger.info('CART', 'Cập nhật số lượng thành công', { itemId, qty });
    res.json(updated);
  }),

  removeItem: handle(async (req, res) => {
    const userId = req.currentUser?.id;
    const itemId = req.params.itemId;
    logger.info('CART', 'Xóa sản phẩm khỏi giỏ hàng', { userId, itemId });
    await CartService.removeItem(itemId);
    logger.info('CART', 'Xóa khỏi giỏ hàng thành công', { itemId });
    res.json({ message: "Đã xóa khỏi giỏ hàng" });
  }),

  clear: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.info('CART', 'Xóa toàn bộ giỏ hàng', { userId });
    await CartService.clear(userId);
    logger.info('CART', 'Xóa giỏ hàng thành công', { userId });
    res.json({ message: "Đã xóa toàn bộ giỏ hàng" });
  }),
};
