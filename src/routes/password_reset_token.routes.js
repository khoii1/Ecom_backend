import { Router } from "express";
import { param } from "express-validator";
import { PasswordResetTokenController } from "../controllers/password_reset_token.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const tokenIdValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("tokenId").isInt({ min: 1 }).withMessage("ID token không hợp lệ"),
];

// Routes - Admin only for token management
router.get(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  PasswordResetTokenController.list
);

router.get(
  "/:tokenId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  tokenIdValidation,
  PasswordResetTokenController.detail
);

router.delete(
  "/:tokenId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  tokenIdValidation,
  PasswordResetTokenController.remove
);

export default router;
