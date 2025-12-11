import { Router } from "express";
import { body, param } from "express-validator";
import { StoreController } from "../controllers/store.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";
import { handle } from "../controllers/base.controller.js";
import { StoreModel } from "../models/store.model.js";
import { UserModel } from "../models/user.model.js";

const router = Router();

// Validation middleware - MongoDB ObjectId
const storeIdValidation = [
  param("storeId").isMongoId().withMessage("ID cửa hàng không hợp lệ"),
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
  param("storeId").isMongoId().withMessage("ID cửa hàng không hợp lệ"),
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
    const stores = await StoreModel.find({})
      .populate('owner_id', 'full_name email')
      .sort({ createdAt: -1 })
      .lean();

    const formattedStores = stores.map((store) => ({
      ...store,
      id: store._id.toString(),
      owner_id: store.owner_id?._id.toString() || store.owner_id.toString(),
      owner_name: store.owner_id?.full_name || null,
      owner_email: store.owner_id?.email || null,
    }));
    
    res.json(formattedStores);
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
