import { Router } from "express";
import { body } from "express-validator";
import { AuthController } from "../controllers/auth.controller.js";
import { validate } from "../middleware/validation.js";

const router = Router();

// Validation middleware
const registerValidation = [
  body("fullName")
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
  validate,
];

const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email không hợp lệ"),
  body("password").notEmpty().withMessage("Mật khẩu không được trống"),
  validate,
];

const verifyEmailValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email không hợp lệ"),
  body("code")
    .isLength({ min: 6, max: 6 })
    .withMessage("Mã xác minh phải có 6 ký tự"),
  validate,
];

const forgotPasswordValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email không hợp lệ"),
  validate,
];

const resetPasswordValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Email không hợp lệ"),
  body("code")
    .isLength({ min: 6, max: 6 })
    .withMessage("Mã xác minh phải có 6 ký tự"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Mật khẩu mới phải ít nhất 6 ký tự"),
  validate,
];

// Routes
router.post("/register", registerValidation, AuthController.register);
router.post("/verify-email", verifyEmailValidation, AuthController.verifyEmail);
router.post("/login", loginValidation, AuthController.login);
router.post("/logout", AuthController.logout);
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  AuthController.forgotPassword
);
router.post(
  "/verify-reset-code",
  verifyEmailValidation, 
  AuthController.verifyResetCode
);

router.post(
  "/reset-password",
  resetPasswordValidation,
  AuthController.resetPassword
);

export default router;
