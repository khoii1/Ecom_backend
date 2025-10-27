import { Router } from "express";
import { body, param } from "express-validator";
import { StoreController } from "../controllers/store.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { handle } from "../controllers/base.controller.js";
import { databasePool } from "../config/database.js";

const router = Router();

// Validation middleware
const storeIdValidation = [
  param("storeId").isInt({ min: 1 }).withMessage("ID cửa hàng không hợp lệ"),
  validate,
];

const createStoreValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên cửa hàng phải từ 2-100 ký tự"),
  validate,
];

const updateStoreValidation = [
  // SỬA: Thay đổi isUUID() thành isInt({ min: 1 })
  param("storeId").isInt({ min: 1 }).withMessage("ID cửa hàng không hợp lệ"),
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
router.get(
  "/my/stores",
  authentication(),
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  StoreController.myStores
);
router.get("/:storeId", storeIdValidation, StoreController.detail);
router.get(
  "/admin/list",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  handle(async (req, res) => {
    const query = `
      SELECT 
        s.*, 
        u.full_name as owner_name, 
        u.email as owner_email 
      FROM stores s
      JOIN users u ON s.owner_id = u.id
      ORDER BY s.created_at DESC
    `;
    const r = await databasePool.query(query);

    // Format lại ID cho nhất quán
    const stores = r.rows.map((row) => ({
      ...row,
      id: row.id.toString(),
      owner_id: row.owner_id.toString(),
    }));
    res.json(stores);
  })
);
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
