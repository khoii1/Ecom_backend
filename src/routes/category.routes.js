import { Router } from "express";
import { body, param } from "express-validator";
import { CategoryController } from "../controllers/category.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const categoryIdValidation = [
  param("categoryId").isUUID().withMessage("ID danh mục không hợp lệ"),
];

const createCategoryValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên danh mục phải từ 2-100 ký tự"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Slug phải từ 2-100 ký tự"),
  body("parent_id")
    .optional()
    .isUUID()
    .withMessage("ID danh mục cha không hợp lệ"),
];

const updateCategoryValidation = [
  ...categoryIdValidation,
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên danh mục phải từ 2-100 ký tự"),
  body("parent_id")
    .optional()
    .isUUID()
    .withMessage("ID danh mục cha không hợp lệ"),
];

// Routes
router.get("/", CategoryController.list);
router.get("/:categoryId", categoryIdValidation, CategoryController.detail);
router.post(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN, ROLES.SELLER]),
  createCategoryValidation,
  CategoryController.create
);
router.put(
  "/:categoryId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN, ROLES.SELLER]),
  updateCategoryValidation,
  CategoryController.update
);
router.delete(
  "/:categoryId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN, ROLES.SELLER]),
  categoryIdValidation,
  CategoryController.remove
);

export default router;
