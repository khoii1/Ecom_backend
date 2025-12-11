import { Router } from "express";
import { ProductVariantController } from "../controllers/product_variant.controller.js";
import { authentication } from "../middleware/authentication.js";
import { body, param } from "express-validator";
import { validate } from "../middleware/validation.js";

const router = Router();

// GET routes không cần auth (public)
// GET /products/:productId/variants - Lấy danh sách biến thể của sản phẩm
router.get(
  "/products/:productId/variants",
  [param("productId").isMongoId().withMessage("ID sản phẩm không hợp lệ"), validate],
  ProductVariantController.getByProduct
);

// GET /variants/:variantId - Lấy biến thể theo ID
router.get(
  "/variants/:variantId",
  [param("variantId").isMongoId().withMessage("ID biến thể không hợp lệ"), validate],
  ProductVariantController.getById
);

// Các routes còn lại cần authentication (chỉ seller/admin)
router.use(authentication());

// POST /products/:productId/variants - Tạo biến thể mới
router.post(
  "/products/:productId/variants",
  [
    param("productId").isMongoId().withMessage("ID sản phẩm không hợp lệ"),
    body("name").trim().notEmpty().withMessage("Tên biến thể là bắt buộc"),
    body("value").trim().notEmpty().withMessage("Giá trị biến thể là bắt buộc"),
    validate,
  ],
  ProductVariantController.create
);

// PUT /variants/:variantId - Cập nhật biến thể
router.put(
  "/variants/:variantId",
  [param("variantId").isMongoId().withMessage("ID biến thể không hợp lệ"), validate],
  ProductVariantController.update
);

// DELETE /variants/:variantId - Xóa biến thể
router.delete(
  "/variants/:variantId",
  [param("variantId").isMongoId().withMessage("ID biến thể không hợp lệ"), validate],
  ProductVariantController.delete
);

export default router;

