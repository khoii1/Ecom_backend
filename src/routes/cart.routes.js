import { Router } from "express";
import { body, param } from "express-validator";
import { authentication } from "../middleware/authentication.js";
import { validate } from "../middleware/validation.js";
import { CartController } from "../controllers/cart.controller.js";

const router = Router();

// Validation middleware
const addItemValidation = [
  body("product_id").isUUID().withMessage("ID sản phẩm không hợp lệ"),
  body("qty").isInt({ min: 1 }).withMessage("Số lượng phải là số nguyên dương"),
  validate,
];

const updateItemValidation = [
  param("itemId").isUUID().withMessage("ID mục giỏ hàng không hợp lệ"),
  body("qty").isInt({ min: 1 }).withMessage("Số lượng phải là số nguyên dương"),
  validate,
];

const itemIdValidation = [
  param("itemId").isUUID().withMessage("ID mục giỏ hàng không hợp lệ"),
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
