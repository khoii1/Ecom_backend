import { Router } from "express";
import { body, param } from "express-validator";
import { CartItemController } from "../controllers/cart_item.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const cartItemIdValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("cartItemId")
    .isInt({ min: 1 })
    .withMessage("ID mục giỏ hàng không hợp lệ"),
];

const createCartItemValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  body("cart_id").isInt({ min: 1 }).withMessage("ID giỏ hàng không hợp lệ"),
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  body("product_id").isInt({ min: 1 }).withMessage("ID sản phẩm không hợp lệ"),
  body("qty").isInt({ min: 1 }).withMessage("Số lượng phải là số nguyên dương"),
  body("variant_id")
    .optional()
    // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
    .isInt({ min: 1 })
    .withMessage("ID biến thể không hợp lệ"),
];

const updateCartItemValidation = [
  ...cartItemIdValidation,
  body("qty")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số lượng phải là số nguyên dương"),
];

// Routes - Admin only for direct cart item management
router.get(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  CartItemController.list
);

router.get(
  "/:cartItemId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  cartItemIdValidation,
  CartItemController.detail
);

router.post(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  createCartItemValidation,
  CartItemController.create
);

router.put(
  "/:cartItemId",
  authentication(),
  updateCartItemValidation,
  CartItemController.update
);

router.delete(
  "/:cartItemId",
  authentication(),
  cartItemIdValidation,
  CartItemController.remove
);

export default router;
