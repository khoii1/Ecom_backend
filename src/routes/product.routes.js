import { Router } from "express";
import { body, param, query } from "express-validator";
import { ProductController } from "../controllers/product.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { uploadSingle } from "../middleware/upload.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const productIdValidation = [
  param("productId").isInt({ min: 1 }).withMessage("ID sản phẩm không hợp lệ"),
];

const createProductValidation = [
  body("store_id").isInt({ min: 1 }).withMessage("ID cửa hàng không hợp lệ"),
  body("title")
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Tiêu đề sản phẩm phải từ 2-200 ký tự"),

  body("category_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("ID danh mục không hợp lệ"),
  body("price")
    .isNumeric()
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage("Giá phải là số dương"),
  body("discounted_price")
    .optional()
    .isNumeric()
    .toFloat()
    .isFloat({ min: 0 })
    .custom((value, { req }) => {
      if (value && req.body.price) {
        const price = parseFloat(req.body.price);
        if (value > price) {
          throw new Error("Giá sau giảm phải nhỏ hơn hoặc bằng giá gốc");
        }
      }
      return true;
    }),
  body("rating")
    .optional()
    .isNumeric()
    .toFloat()
    .isFloat({ min: 0, max: 5 })
    .withMessage("Đánh giá phải từ 0 đến 5"),
  body("image_url").optional().isURL().withMessage("URL hình ảnh không hợp lệ"),
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
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  body("category_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("ID danh mục không hợp lệ"),
  body("price")
    .optional()
    .isNumeric()
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage("Giá phải là số dương"),
  body("discounted_price")
    .optional()
    .isNumeric()
    .toFloat()
    .isFloat({ min: 0 })
    .custom((value, { req }) => {
      if (value && req.body.price) {
        const price = parseFloat(req.body.price);
        if (value > price) {
          throw new Error("Giá sau giảm phải nhỏ hơn hoặc bằng giá gốc");
        }
      }
      return true;
    }),
  body("rating")
    .optional()
    .isNumeric()
    .toFloat()
    .isFloat({ min: 0, max: 5 })
    .withMessage("Đánh giá phải từ 0 đến 5"),
  body("image_url").optional().isURL().withMessage("URL hình ảnh không hợp lệ"),
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
  validate,
  (req, res, next) => {
    // Ensure price fields are numbers
    if (req.body.price) {
      req.body.price = parseFloat(req.body.price);
    }
    if (req.body.discounted_price) {
      req.body.discounted_price = parseFloat(req.body.discounted_price);
    }
    if (req.body.rating) {
      req.body.rating = parseFloat(req.body.rating);
    }
    next();
  },
  ProductController.create
);
router.put(
  "/:productId",
  authentication(),
  updateProductValidation,
  validate,
  (req, res, next) => {
    // Ensure price fields are numbers
    if (req.body.price) {
      req.body.price = parseFloat(req.body.price);
    }
    if (req.body.discounted_price) {
      req.body.discounted_price = parseFloat(req.body.discounted_price);
    }
    if (req.body.rating) {
      req.body.rating = parseFloat(req.body.rating);
    }
    next();
  },
  ProductController.update
);
router.delete(
  "/:productId",
  authentication(),
  productIdValidation,
  ProductController.remove
);

// Upload image endpoint
router.post(
  "/upload-image",
  authentication(),
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  uploadSingle("image"),
  ProductController.uploadImage
);

export default router;
