import { Router } from "express";
import { body, param } from "express-validator";
import { mongoose } from "../config/database.js";
import { CategoryController } from "../controllers/category.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";
import { validate } from "../middleware/validation.js";

const router = Router();

// Validation middleware - MongoDB ObjectId
const categoryIdValidation = [
  param("categoryId").isMongoId().withMessage("ID danh mục không hợp lệ"),
  validate,
];

const createCategoryValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên danh mục phải từ 2-100 ký tự"),
  body("parent_id")
    .optional({ values: 'falsy' })
    .custom((value) => {
      // Cho phép null, undefined, hoặc empty string
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // Nếu có giá trị, phải là valid MongoId
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage("ID danh mục cha không hợp lệ"),
  validate,
];

const updateCategoryValidation = [
  ...categoryIdValidation,
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên danh mục phải từ 2-100 ký tự"),
  body("parent_id")
    .optional({ values: 'falsy' })
    .custom((value) => {
      // Cho phép null, undefined, hoặc empty string
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // Nếu có giá trị, phải là valid MongoId
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage("ID danh mục cha không hợp lệ"),
  validate,
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
