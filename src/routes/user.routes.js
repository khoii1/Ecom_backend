import { Router } from "express";
import { body, param } from "express-validator";
import { UserController } from "../controllers/user.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { handle } from "../controllers/base.controller.js";

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
  body("phone")
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage("Số điện thoại không hợp lệ"),
  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Địa chỉ không được quá 500 ký tự"),
  validate,
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Vui lòng nhập mật khẩu hiện tại"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Mật khẩu mới phải ít nhất 6 ký tự"),
  validate,
];

// Admin routes
router.get(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN, ROLES.SELLER]),
  handle(async (req, res) => {
    const { role, status, search, limit = 50, offset = 0 } = req.query;
    const { UserModel } = await import("../models/user.model.js");

    const query = {};

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await UserModel.find(query)
      .select("-password_hash")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await UserModel.countDocuments(query);

    res.json({
      users: users.map((u) => ({
        ...u,
        id: u._id.toString(),
        created_at: u.createdAt ? u.createdAt.toISOString() : null,
        updated_at: u.updatedAt ? u.updatedAt.toISOString() : null,
      })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  })
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

router.post(
  "/profile/change-password",
  authentication(),
  changePasswordValidation,
  UserController.changePassword
);

export default router;
