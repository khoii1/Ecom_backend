import { Router } from "express";
import { body, param } from "express-validator";
import { StoreController } from "../controllers/store.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const storeIdValidation = [
  param("storeId").isUUID().withMessage("ID cửa hàng không hợp lệ"),
  validate,
];

const createStoreValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên cửa hàng phải từ 2-100 ký tự"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Slug phải từ 2-100 ký tự"),
  validate,
];

const updateStoreValidation = [
  param("storeId").isUUID().withMessage("ID cửa hàng không hợp lệ"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên cửa hàng phải từ 2-100 ký tự"),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Trạng thái không hợp lệ"),
  validate,
];

// Routes
router.get("/", StoreController.list);
router.get("/:storeId", storeIdValidation, StoreController.detail);
router.post(
  "/",
  authentication(),
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  createStoreValidation,
  StoreController.create
);
router.put(
  "/:storeId",
  authentication(),
  updateStoreValidation,
  StoreController.update
);
router.delete(
  "/:storeId",
  authentication(),
  storeIdValidation,
  StoreController.remove
);

export default router;
