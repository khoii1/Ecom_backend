import { Router } from "express";
import { body, param } from "express-validator";
import { authentication } from "../middleware/authentication.js";
import { validate } from "../middleware/validation.js";
import { CartController } from "../controllers/cart.controller.js";

const router = Router();

// Validation middleware
const addItemValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  body("product_id").isInt({ min: 1 }).withMessage("ID sản phẩm không hợp lệ"),
  body("qty").isInt({ min: 1 }).withMessage("Số lượng phải là số nguyên dương"),
  validate,
];

const updateItemValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("itemId").isInt({ min: 1 }).withMessage("ID mục giỏ hàng không hợp lệ"),
  body("qty").isInt({ min: 1 }).withMessage("Số lượng phải là số nguyên dương"),
  validate,
];

const itemIdValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("itemId").isInt({ min: 1 }).withMessage("ID mục giỏ hàng không hợp lệ"),
  validate,
];

// Routes - all require authentication
router.use(authentication());

router.get("/", CartController.getMyCart);
router.post("/items", addItemValidation, CartController.addItem);
router.put("/items/:itemId", updateItemValidation, CartController.updateItem);
router.delete("/items/:itemId", itemIdValidation, CartController.removeItem);
router.delete("/", CartController.clear);

export default router;
