import { Router } from "express";
import { body, param } from "express-validator";
import { CartItemController } from "../controllers/cart_item.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";
import { validate } from "../middleware/validation.js";

const router = Router();

// Validation middleware - MongoDB ObjectId
const cartItemIdValidation = [
  param("cartItemId")
    .isMongoId()
    .withMessage("ID mục giỏ hàng không hợp lệ"),
  validate,
];

const createCartItemValidation = [
  body("cart_id").isMongoId().withMessage("ID giỏ hàng không hợp lệ"),
  body("product_id").isMongoId().withMessage("ID sản phẩm không hợp lệ"),
  body("qty").isInt({ min: 1 }).withMessage("Số lượng phải là số nguyên dương"),
  body("variant_id")
    .optional()
    .isMongoId()
    .withMessage("ID biến thể không hợp lệ"),
  validate,
];

const updateCartItemValidation = [
  ...cartItemIdValidation,
  body("qty")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số lượng phải là số nguyên dương"),
  validate,
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
