import { Router } from "express";
import { body, param } from "express-validator";
import { UserController } from "../controllers/user.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware - MongoDB ObjectId
const userIdValidation = [
  param("userId").isMongoId().withMessage("ID người dùng không hợp lệ"),
  validate,
];

const createUserValidation = [
  body("full_name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên phải từ 2-100 ký tự"),
  body("email").isEmail().normalizeEmail().withMessage("Email không hợp lệ"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Mật khẩu phải ít nhất 6 ký tự"),
  body("role")
    .optional()
    .isIn(["USER", "SELLER", "ADMIN", "SHIPPER"])
    .withMessage("Role không hợp lệ"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "pending"])
    .withMessage("Status không hợp lệ"),
  validate,
];

const updateUserValidation = [
  ...userIdValidation,
  body("full_name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên phải từ 2-100 ký tự"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Email không hợp lệ"),
  body("role")
    .optional()
    .isIn(["USER", "SELLER", "ADMIN", "SHIPPER"])
    .withMessage("Role không hợp lệ"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "pending"])
    .withMessage("Status không hợp lệ"),
  validate,
];

const updateProfileValidation = [
  body("full_name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên phải từ 2-100 ký tự"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Email không hợp lệ"),
  validate,
];

// Admin routes
router.get(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN, ROLES.SELLER]),
  UserController.list
);

router.get(
  "/:userId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  userIdValidation,
  UserController.detail
);

router.post(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  createUserValidation,
  UserController.create
);

router.put(
  "/:userId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  updateUserValidation,
  UserController.update
);

router.delete(
  "/:userId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  userIdValidation,
  UserController.remove
);

// User profile routes
router.get("/profile/me", authentication(), UserController.getProfile);

router.put(
  "/profile/me",
  authentication(),
  updateProfileValidation,
  UserController.updateProfile
);

export default router;
