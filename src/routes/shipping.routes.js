import { Router } from "express";
import { body, param } from "express-validator";
import { ShippingController } from "../controllers/shipping.controller.js";
import { validate } from "../middleware/validation.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation
const calculateShippingValidation = [
  body("shipping_code")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Mã phương thức vận chuyển không hợp lệ"),
  body("destination")
    .notEmpty()
    .withMessage("Địa chỉ đích là bắt buộc")
    .custom((value) => {
      if (typeof value !== 'object') {
        throw new Error("destination phải là object");
      }
      if (!value.address) {
        throw new Error("destination.address là bắt buộc");
      }
      return true;
    }),
  body("origin")
    .optional()
    .custom((value) => {
      if (value !== null && typeof value !== 'object') {
        throw new Error("origin phải là object hoặc null");
      }
      return true;
    }),
  body("weight")
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage("Trọng lượng phải lớn hơn 0.1kg"),
  body("total_value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Tổng giá trị phải >= 0"),
];

// Public Routes
router.get("/methods", ShippingController.getMethods);
router.post(
  "/calculate",
  calculateShippingValidation,
  validate,
  ShippingController.calculate
);
router.post(
  "/calculate-all",
  calculateShippingValidation.slice(1), // Skip shipping_code validation
  validate,
  ShippingController.calculateAll
);

// Admin CRUD routes (require authentication)
const shippingMethodValidation = [
  body("code")
    .notEmpty()
    .trim()
    .withMessage("Mã phương thức là bắt buộc"),
  body("name")
    .notEmpty()
    .trim()
    .withMessage("Tên phương thức là bắt buộc"),
  body("base_cost")
    .isFloat({ min: 0 })
    .withMessage("Chi phí cơ bản phải >= 0"),
  body("cost_per_km")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Chi phí/km phải >= 0"),
  body("cost_per_kg")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Chi phí/kg phải >= 0"),
];

router.post(
  "/methods",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  shippingMethodValidation,
  validate,
  ShippingController.create
);
router.put(
  "/methods/:id",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  [param("id").isMongoId().withMessage("ID không hợp lệ"), ...shippingMethodValidation],
  validate,
  ShippingController.update
);
router.delete(
  "/methods/:id",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  [param("id").isMongoId().withMessage("ID không hợp lệ")],
  validate,
  ShippingController.delete
);

export default router;

