import { Router } from "express";
import { body, param } from "express-validator";
import { DiscountModel } from "../models/discount.model.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { handle } from "../controllers/base.controller.js";
import { ROLES } from "../constants/roles.js";
import { mongoose } from "../config/database.js";

const router = Router();

// Validation
const discountValidation = [
  body("code")
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Mã giảm giá phải từ 3-20 ký tự")
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage("Mã giảm giá chỉ chứa chữ và số"),
  body("discount_type")
    .isIn(["percentage", "fixed"])
    .withMessage("Loại giảm giá phải là percentage hoặc fixed"),
  body("discount_value")
    .isFloat({ min: 0.01 })
    .withMessage("Giá trị giảm phải lớn hơn 0"),
  body("min_order_value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giá trị đơn hàng tối thiểu không hợp lệ"),
  body("max_discount_amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giới hạn giảm giá không hợp lệ"),
  body("usage_limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số lần sử dụng tối đa phải >= 1"),
  body("end_date")
    .optional()
    .isISO8601()
    .withMessage("Ngày hết hạn không hợp lệ"),
];

// GET /discounts - Lấy danh sách mã giảm giá (Admin)
router.get(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  handle(async (req, res) => {
    const discounts = await DiscountModel.findAll();
    res.json(
      discounts.map((d) => ({
        ...d,
        id: d._id.toString(),
      }))
    );
  })
);

// GET /discounts/active - Lấy mã giảm giá còn hiệu lực (Public)
router.get(
  "/active",
  handle(async (req, res) => {
    const discounts = await DiscountModel.findActiveDiscounts();
    res.json(
      discounts.map((d) => ({
        ...d,
        id: d._id.toString(),
      }))
    );
  })
);

// POST /discounts/validate - Kiểm tra mã giảm giá
router.post(
  "/validate",
  authentication(),
  [
    body("code").trim().notEmpty().withMessage("Vui lòng nhập mã giảm giá"),
    body("order_total")
      .isFloat({ min: 0 })
      .withMessage("Tổng đơn hàng không hợp lệ"),
    body("category_ids")
      .optional()
      .isArray()
      .withMessage("category_ids phải là mảng"),
  ],
  validate,
  handle(async (req, res) => {
    const { code, order_total, category_ids = [] } = req.body;
    const userId = req.currentUser.id;

    const result = await DiscountModel.validateCode(
      code,
      order_total,
      userId,
      category_ids
    );

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    res.json({
      valid: true,
      discount_id: result.discount._id.toString(),
      code: result.discount.code,
      discount_type: result.discount.discount_type,
      discount_value: parseFloat(result.discount.discount_value),
      discount_amount: result.discountAmount,
      message: `Giảm ${result.discountAmount.toLocaleString()}đ`,
    });
  })
);

// POST /discounts - Tạo mã giảm giá mới (Admin)
router.post(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  discountValidation,
  validate,
  handle(async (req, res) => {
    const {
      code,
      description,
      discount_type,
      discount_value,
      min_order_value,
      max_discount_amount,
      usage_limit,
      start_date,
      end_date,
    } = req.body;

    // Kiểm tra mã đã tồn tại chưa
    const existing = await DiscountModel.findByCode(code);
    if (existing) {
      return res.status(400).json({ message: "Mã giảm giá đã tồn tại" });
    }

    // Validate percentage không quá 100%
    if (discount_type === "percentage" && discount_value > 100) {
      return res
        .status(400)
        .json({ message: "Phần trăm giảm giá không được vượt quá 100%" });
    }

    const discount = await DiscountModel.create({
      code,
      description,
      discount_type,
      discount_value,
      min_order_value: min_order_value || 0,
      max_discount_amount,
      usage_limit,
      claim_limit: req.body.claim_limit,
      category_ids: req.body.category_ids || [],
      start_date: start_date ? new Date(start_date) : new Date(),
      end_date: end_date ? new Date(end_date) : null,
    });

    res.status(201).json({
      ...discount.toObject(),
      id: discount._id.toString(),
    });
  })
);

// PUT /discounts/:id - Cập nhật mã giảm giá (Admin)
router.put(
  "/:id",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  [
    param("id").isMongoId().withMessage("ID không hợp lệ"),
    body("code")
      .optional()
      .trim()
      .isLength({ min: 3, max: 20 })
      .matches(/^[A-Za-z0-9]+$/),
    body("discount_type").optional().isIn(["percentage", "fixed"]),
    body("discount_value").optional().isFloat({ min: 0.01 }),
    body("is_active").optional().isBoolean(),
  ],
  validate,
  handle(async (req, res) => {
    const id = req.params.id;

    const existing = await DiscountModel.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá" });
    }

    const updated = await DiscountModel.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();

    res.json({
      ...updated,
      id: updated._id.toString(),
    });
  })
);

// DELETE /discounts/:id - Xóa mã giảm giá (Admin)
router.delete(
  "/:id",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  [param("id").isMongoId().withMessage("ID không hợp lệ")],
  validate,
  handle(async (req, res) => {
    const id = req.params.id;

    const existing = await DiscountModel.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá" });
    }

    await DiscountModel.findByIdAndDelete(id);
    res.json({ message: "Xóa mã giảm giá thành công" });
  })
);

// GET /discounts/available - Lấy danh sách mã có thể nhận (Public hoặc User)
router.get(
  "/available",
  authentication(),
  handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { DiscountClaimModel } = await import("../models/discount.model.js");

    const now = new Date();
    const availableDiscounts = await DiscountModel.find({
      is_active: true,
      start_date: { $lte: now },
      $or: [{ end_date: null }, { end_date: { $gte: now } }],
      $and: [
        {
          $or: [
            { claim_limit: null },
            { $expr: { $lt: ["$claimed_count", "$claim_limit"] } },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Kiểm tra user đã claim mã nào chưa
    const claimedDiscounts = await DiscountClaimModel.find({
      user_id: userId,
    }).lean();
    const claimedDiscountIds = new Set(
      claimedDiscounts.map((c) => c.discount_id.toString())
    );

    const result = availableDiscounts.map((discount) => {
      const isClaimed = claimedDiscountIds.has(discount._id.toString());
      const canClaim =
        !isClaimed &&
        (!discount.claim_limit ||
          discount.claimed_count < discount.claim_limit);

      return {
        ...discount,
        id: discount._id.toString(),
        is_claimed: isClaimed,
        can_claim: canClaim,
        category_ids: discount.category_ids?.map((id) => id.toString()) || [],
      };
    });

    res.json(result);
  })
);

// POST /discounts/:id/claim - User nhận mã giảm giá
router.post(
  "/:id/claim",
  authentication(),
  [param("id").isMongoId().withMessage("ID không hợp lệ")],
  validate,
  handle(async (req, res) => {
    const discountId = req.params.id;
    const userId = req.currentUser.id;
    const { DiscountClaimModel } = await import("../models/discount.model.js");

    const discount = await DiscountModel.findById(discountId).lean();
    if (!discount) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá" });
    }

    if (!discount.is_active) {
      return res.status(400).json({ message: "Mã giảm giá đã bị vô hiệu hóa" });
    }

    const now = new Date();
    if (discount.start_date && now < discount.start_date) {
      return res.status(400).json({ message: "Mã giảm giá chưa có hiệu lực" });
    }

    if (discount.end_date && now > discount.end_date) {
      return res.status(400).json({ message: "Mã giảm giá đã hết hạn" });
    }

    if (
      discount.claim_limit &&
      discount.claimed_count >= discount.claim_limit
    ) {
      return res.status(400).json({ message: "Mã giảm giá đã hết lượt nhận" });
    }

    // Kiểm tra user đã claim chưa
    const existingClaim = await DiscountClaimModel.findOne({
      discount_id: discountId,
      user_id: userId,
    }).lean();

    if (existingClaim) {
      return res.status(400).json({ message: "Bạn đã nhận mã này rồi" });
    }

    // Tạo claim record và tăng claimed_count
    // Không dùng transaction trong development (standalone MongoDB không hỗ trợ)
    // Trong production với replica set, có thể bật lại transaction
    const useTransaction =
      process.env.NODE_ENV === "production" &&
      process.env.USE_MONGODB_TRANSACTIONS === "true";

    // Kiểm tra lại claim_limit một lần nữa để tránh race condition
    const currentDiscount = await DiscountModel.findById(discountId).lean();
    if (
      currentDiscount.claim_limit &&
      currentDiscount.claimed_count >= currentDiscount.claim_limit
    ) {
      return res.status(400).json({ message: "Mã giảm giá đã hết lượt nhận" });
    }

    if (useTransaction) {
      // Sử dụng transaction trong production
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Tạo claim record
          await DiscountClaimModel.create(
            [
              {
                discount_id: discountId,
                user_id: userId,
              },
            ],
            { session }
          );

          // Tăng claimed_count
          await DiscountModel.findByIdAndUpdate(
            discountId,
            { $inc: { claimed_count: 1 } },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Không dùng transaction (development mode hoặc standalone MongoDB)
      // Tạo claim record
      await DiscountClaimModel.create({
        discount_id: discountId,
        user_id: userId,
      });

      // Tăng claimed_count
      await DiscountModel.findByIdAndUpdate(discountId, {
        $inc: { claimed_count: 1 },
      });
    }

    res.json({
      message: "Nhận mã giảm giá thành công",
      discount: {
        ...discount,
        id: discount._id.toString(),
      },
    });
  })
);

// GET /discounts/my - Lấy danh sách mã đã nhận của user
router.get(
  "/my",
  authentication(),
  handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { DiscountClaimModel } = await import("../models/discount.model.js");

    const claims = await DiscountClaimModel.find({ user_id: userId })
      .populate("discount_id")
      .sort({ claimed_at: -1 })
      .lean();

    const now = new Date();
    const result = claims
      .filter((claim) => claim.discount_id) // Lọc các mã đã bị xóa
      .map((claim) => {
        const discount = claim.discount_id;
        const isExpired =
          discount.end_date && new Date(discount.end_date) < now;
        const isActive = discount.is_active && !isExpired;

        // Kiểm tra đã dùng chưa
        return {
          id: claim._id.toString(),
          discount_id: discount._id.toString(),
          code: discount.code,
          description: discount.description,
          discount_type: discount.discount_type,
          discount_value: discount.discount_value,
          min_order_value: discount.min_order_value,
          max_discount_amount: discount.max_discount_amount,
          end_date: discount.end_date,
          claimed_at: claim.claimed_at,
          is_active: isActive,
          is_expired: isExpired,
          category_ids: discount.category_ids?.map((id) => id.toString()) || [],
        };
      });

    res.json(result);
  })
);

export default router;
