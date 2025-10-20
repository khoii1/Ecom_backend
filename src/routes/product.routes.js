import { Router } from "express";
import { body, param, query } from "express-validator";
import { ProductController } from "../controllers/product.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const productIdValidation = [
  param("productId").isUUID().withMessage("ID sản phẩm không hợp lệ"),
];

const createProductValidation = [
  body("store_id").isUUID().withMessage("ID cửa hàng không hợp lệ"),
  body("title")
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Tiêu đề sản phẩm phải từ 2-200 ký tự"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Slug phải từ 2-200 ký tự"),
  body("category_id")
    .optional()
    .isUUID()
    .withMessage("ID danh mục không hợp lệ"),
  body("price")
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Giá phải là số dương"),
  body("image_url").optional().isURL().withMessage("URL hình ảnh không hợp lệ"),
  body("has_variants")
    .optional()
    .isBoolean()
    .withMessage("has_variants phải là boolean"),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Trạng thái không hợp lệ"),
];

const updateProductValidation = [
  ...productIdValidation,
  body("title")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Tiêu đề sản phẩm phải từ 2-200 ký tự"),
  body("category_id")
    .optional()
    .isUUID()
    .withMessage("ID danh mục không hợp lệ"),
  body("price")
    .optional()
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Giá phải là số dương"),
  body("image_url").optional().isURL().withMessage("URL hình ảnh không hợp lệ"),
  body("has_variants")
    .optional()
    .isBoolean()
    .withMessage("has_variants phải là boolean"),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Trạng thái không hợp lệ"),
];

// Routes
router.get("/", ProductController.list);
router.get("/:productId", productIdValidation, ProductController.detail);
router.post(
  "/",
  authentication(),
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  createProductValidation,
  ProductController.create
);
router.put(
  "/:productId",
  authentication(),
  updateProductValidation,
  ProductController.update
);
router.delete(
  "/:productId",
  authentication(),
  productIdValidation,
  ProductController.remove
);

export default router;
