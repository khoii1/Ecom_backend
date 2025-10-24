import { Router } from "express";
import { body, param } from "express-validator";
import { CategoryController } from "../controllers/category.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const categoryIdValidation = [
  param("categoryId").isInt({ min: 1 }).withMessage("ID danh mục không hợp lệ"),
];

const createCategoryValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên danh mục phải từ 2-100 ký tự"),

  body("parent_id")
    .optional()
    .isInt({ min: 1 })
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
    .isInt({ min: 1 })
    .withMessage("ID danh mục cha không hợp lệ"),
];

// PUBLIC ROUTES - Không cần authentication
router.get("/", CategoryController.list);
router.get("/stats", CategoryController.listWithStats);
router.get("/tree", CategoryController.tree);
router.get("/:categoryId", categoryIdValidation, CategoryController.detail);

// ADMIN ONLY ROUTES - Cần authentication + admin role
router.post(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  createCategoryValidation,
  CategoryController.create
);
router.put(
  "/:categoryId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  updateCategoryValidation,
  CategoryController.update
);
router.delete(
  "/:categoryId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  categoryIdValidation,
  CategoryController.remove
);

export default router;
