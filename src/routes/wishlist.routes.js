import { Router } from "express";
import { WishlistController } from "../controllers/wishlist.controller.js";
import { authentication } from "../middleware/authentication.js";
import { body, param } from "express-validator";
import { validate } from "../middleware/validation.js";

const router = Router();

// Tất cả routes đều cần authentication
router.use(authentication());

// GET /wishlist - Lấy danh sách yêu thích của user hiện tại
router.get("/", WishlistController.getMyWishlist);

// GET /wishlist/check/:productId - Kiểm tra sản phẩm có trong wishlist không
router.get(
  "/check/:productId",
  [param("productId").isMongoId().withMessage("ID sản phẩm không hợp lệ"), validate],
  WishlistController.check
);

// POST /wishlist - Thêm sản phẩm vào wishlist
router.post(
  "/",
  [
    body("product_id")
      .isMongoId()
      .withMessage("ID sản phẩm không hợp lệ")
      .notEmpty()
      .withMessage("ID sản phẩm là bắt buộc"),
    validate,
  ],
  WishlistController.add
);

// DELETE /wishlist/:productId - Xóa sản phẩm khỏi wishlist
router.delete(
  "/:productId",
  [param("productId").isMongoId().withMessage("ID sản phẩm không hợp lệ"), validate],
  WishlistController.remove
);

// DELETE /wishlist - Xóa tất cả khỏi wishlist
router.delete("/", WishlistController.clear);

export default router;

