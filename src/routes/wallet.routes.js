import { Router } from "express";
import { body, param, query } from "express-validator";
import { WalletController } from "../controllers/wallet.controller.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation middleware
const transactionIdValidation = [
  param("transactionId").isMongoId().withMessage("ID giao dịch không hợp lệ"),
  validate,
];

const topupValidation = [
  body("amount")
    .isFloat({ min: 10000, max: 50000000 })
    .withMessage("Số tiền nạp phải từ 10,000 đến 50,000,000 VNĐ"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Mô tả tối đa 500 ký tự"),
  validate,
];

const transactionsQueryValidation = [
  query("type")
    .optional()
    .isIn(["topup", "payment", "refund", "withdrawal"])
    .withMessage("Loại giao dịch không hợp lệ"),
  query("status")
    .optional()
    .isIn(["pending", "completed", "failed", "cancelled"])
    .withMessage("Trạng thái không hợp lệ"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit phải từ 1-100"),
  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Offset phải là số nguyên dương"),
  validate,
];

// Tất cả routes đều cần authentication
router.use(authentication());

// Admin routes
// GET /wallet/admin/all-transactions - Admin xem tất cả giao dịch
router.get(
  "/admin/all-transactions",
  authorizeByRoles([ROLES.ADMIN]),
  transactionsQueryValidation,
  WalletController.getAllTransactionsForAdmin
);

// GET /wallet/balance - Xem số dư ví
router.get("/balance", WalletController.getBalance);

// POST /wallet/topup - Tạo yêu cầu nạp tiền
router.post("/topup", topupValidation, WalletController.createTopupRequest);

// GET /wallet/transactions - Lịch sử giao dịch
router.get(
  "/transactions",
  transactionsQueryValidation,
  WalletController.getTransactions
);

// GET /wallet/transactions/:transactionId - Chi tiết giao dịch
router.get(
  "/transactions/:transactionId",
  transactionIdValidation,
  WalletController.getTransactionDetail
);

// DELETE /wallet/transactions/:transactionId - Hủy giao dịch pending
router.delete(
  "/transactions/:transactionId",
  transactionIdValidation,
  WalletController.cancelTransaction
);

export default router;
