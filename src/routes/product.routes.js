import { Router } from "express";
import { body, param, query } from "express-validator";
import { ProductController } from "../controllers/product.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { uploadSingle, uploadMultiple } from "../middleware/upload.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { handle } from "../controllers/base.controller.js";

const router = Router();

// Validation middleware - MongoDB ObjectId
const productIdValidation = [
  param("productId").isMongoId().withMessage("ID sản phẩm không hợp lệ"),
];

const createProductValidation = [
  body("store_id").isMongoId().withMessage("ID cửa hàng không hợp lệ"),
  body("title")
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Tiêu đề sản phẩm phải từ 2-200 ký tự"),

  body("category_id")
    .optional()
    .isMongoId()
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
  body("category_id")
    .optional()
    .isMongoId()
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

// Admin only - Xem tất cả products trong hệ thống
router.get(
  "/admin/list",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  handle(async (req, res) => {
    const { ProductModel } = await import("../models/product.model.js");
    const { StoreModel } = await import("../models/store.model.js");
    
    const {
      status,
      store_id,
      category_id,
      search,
      limit = 50,
      offset = 0,
    } = req.query;

    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (store_id) {
      query.store_id = store_id;
    }
    
    if (category_id) {
      query.category_id = category_id;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await ProductModel.find(query)
      .populate("store_id", "name owner_id")
      .populate("category_id", "name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await ProductModel.countDocuments(query);

    // Populate owner info cho store
    const storeIds = [...new Set(products.map(p => p.store_id?._id?.toString()).filter(Boolean))];
    const stores = await StoreModel.find({ _id: { $in: storeIds } })
      .populate("owner_id", "full_name email")
      .lean();
    
    const storeMap = new Map();
    stores.forEach(store => {
      storeMap.set(store._id.toString(), store);
    });

    res.json({
      products: products.map((p) => ({
        ...p,
        id: p._id.toString(),
        store_id: p.store_id?._id.toString() || p.store_id?.toString(),
        store_name: p.store_id?.name || null,
        store_owner_name: storeMap.get(p.store_id?._id?.toString())?.owner_id?.full_name || null,
        store_owner_email: storeMap.get(p.store_id?._id?.toString())?.owner_id?.email || null,
        category_id: p.category_id?._id.toString() || p.category_id?.toString(),
        category_name: p.category_id?.name || null,
      })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  })
);

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

// Upload multiple images endpoint
router.post(
  "/upload-images",
  authentication(),
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  uploadMultiple("images", 10, false), // Max 10 images, use product folder
  ProductController.uploadMultipleImages
);

export default router;
