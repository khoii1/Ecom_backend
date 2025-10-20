import { Router } from "express";
import { param } from "express-validator";
import { AuthTokenController } from "../controllers/auth_token.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const authTokenIdValidation = [
  param("authTokenId").isUUID().withMessage("ID token không hợp lệ"),
];

// Routes - Admin only for token management
router.get(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  AuthTokenController.list
);

router.get(
  "/:authTokenId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  authTokenIdValidation,
  AuthTokenController.detail
);

router.delete(
  "/:authTokenId",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  authTokenIdValidation,
  AuthTokenController.remove
);

export default router;
