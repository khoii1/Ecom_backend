import { Router } from "express";
import { AddressController } from "../controllers/address.controller.js";
import { authentication } from "../middleware/authentication.js";
import { body, param } from "express-validator";
import { validate } from "../middleware/validation.js";

const router = Router();

// Tất cả routes đều cần authentication
router.use(authentication());

// GET /addresses - Lấy tất cả địa chỉ của user
router.get("/", AddressController.getMyAddresses);

// GET /addresses/default - Lấy địa chỉ mặc định
router.get("/default", AddressController.getDefault);

// GET /addresses/:addressId - Lấy địa chỉ theo ID
router.get(
  "/:addressId",
  [param("addressId").isMongoId().withMessage("ID địa chỉ không hợp lệ"), validate],
  AddressController.getById
);

// POST /addresses - Tạo địa chỉ mới
router.post(
  "/",
  [
    body("full_name").trim().notEmpty().withMessage("Tên người nhận là bắt buộc"),
    body("phone").trim().notEmpty().withMessage("Số điện thoại là bắt buộc"),
    body("province").trim().notEmpty().withMessage("Tỉnh/Thành phố là bắt buộc"),
    body("district").trim().notEmpty().withMessage("Quận/Huyện là bắt buộc"),
    body("ward").trim().notEmpty().withMessage("Phường/Xã là bắt buộc"),
    body("street").trim().notEmpty().withMessage("Địa chỉ cụ thể là bắt buộc"),
    validate,
  ],
  AddressController.create
);

// PUT /addresses/:addressId - Cập nhật địa chỉ
router.put(
  "/:addressId",
  [
    param("addressId").isMongoId().withMessage("ID địa chỉ không hợp lệ"),
    validate,
  ],
  AddressController.update
);

// DELETE /addresses/:addressId - Xóa địa chỉ
router.delete(
  "/:addressId",
  [param("addressId").isMongoId().withMessage("ID địa chỉ không hợp lệ"), validate],
  AddressController.delete
);

// PATCH /addresses/:addressId/set-default - Set địa chỉ làm mặc định
router.patch(
  "/:addressId/set-default",
  [param("addressId").isMongoId().withMessage("ID địa chỉ không hợp lệ"), validate],
  AddressController.setDefault
);

export default router;

