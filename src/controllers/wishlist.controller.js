import { WishlistService } from "../services/wishlist.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const WishlistController = {
  getMyWishlist: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.debug('WISHLIST', 'Lấy danh sách yêu thích', { userId });
    const items = await WishlistService.getMyWishlist(userId);
    logger.info('WISHLIST', `Trả về ${items.length} sản phẩm yêu thích`, { userId });
    res.json(items);
  }),

  check: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const productId = req.params.productId;
    logger.debug('WISHLIST', 'Kiểm tra sản phẩm trong wishlist', { userId, productId });
    const isInWishlist = await WishlistService.isInWishlist(userId, productId);
    res.json({ isInWishlist });
  }),

  add: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { product_id } = req.body;
    logger.info('WISHLIST', 'Thêm sản phẩm vào wishlist', { userId, productId: product_id });
    await WishlistService.addToWishlist(userId, product_id);
    logger.info('WISHLIST', 'Thêm vào wishlist thành công', { userId, productId: product_id });
    res.status(201).json({ message: "Đã thêm vào danh sách yêu thích" });
  }),

  remove: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const productId = req.params.productId;
    logger.info('WISHLIST', 'Xóa sản phẩm khỏi wishlist', { userId, productId });
    await WishlistService.removeFromWishlist(userId, productId);
    logger.info('WISHLIST', 'Xóa khỏi wishlist thành công', { userId, productId });
    res.json({ message: "Đã xóa khỏi danh sách yêu thích" });
  }),

  clear: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.info('WISHLIST', 'Xóa tất cả khỏi wishlist', { userId });
    await WishlistService.clearWishlist(userId);
    logger.info('WISHLIST', 'Xóa tất cả thành công', { userId });
    res.json({ message: "Đã xóa tất cả khỏi danh sách yêu thích" });
  }),
};

