import { Router } from "express";
import { body, param } from "express-validator";
import { UserService } from "../services/user.service.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { handle } from "../controllers/base.controller.js";

const router = Router();

// User controller functions (inline since no separate controller exists)
const UserController = {
  list: handle(async (req, res) => {
    const users = await UserService.list();
    res.json(users);
  }),

  detail: handle(async (req, res) => {
    const user = await UserService.detail(req.params.userId);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    res.json(user);
  }),

  create: handle(async (req, res) => {
    const user = await UserService.create({}, req.body);
    res.status(201).json(user);
  }),

  update: handle(async (req, res) => {
    const updated = await UserService.update({}, req.params.userId, req.body);
    if (!updated)
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    res.json(updated);
  }),

  remove: handle(async (req, res) => {
    await UserService.remove({}, req.params.userId);
    res.json({ message: "Đã xóa người dùng" });
  }),

  getProfile: handle(async (req, res) => {
    const user = await UserService.detail(req.currentUser.id);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    const { password_hash, ...userProfile } = user;
    // Convert ID to string for frontend compatibility
    userProfile.id = userProfile.id.toString();
    res.json(userProfile);
  }),

  updateProfile: handle(async (req, res) => {
    const { password, ...updateData } = req.body;
    const updated = await UserService.update(
      {},
      req.currentUser.id,
      updateData
    );
    if (!updated)
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    const { password_hash, ...userProfile } = updated;
    res.json(userProfile);
  }),
};

// Validation middleware
const userIdValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("userId").isInt({ min: 1 }).withMessage("ID người dùng không hợp lệ"),
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
    .isIn(["USER", "SELLER", "ADMIN"])
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
    .isIn(["USER", "SELLER", "ADMIN"])
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
  authorizeByRoles([ROLES.ADMIN]),
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
