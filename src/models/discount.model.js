import { mongoose } from "../config/database.js";

const discountCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    discount_type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discount_value: {
      type: Number,
      required: true,
      min: 0.01,
    },
    min_order_value: {
      type: Number,
      default: 0,
      min: 0,
    },
    max_discount_amount: {
      type: Number,
      default: null,
      min: 0,
    },
    usage_limit: {
      type: Number,
      default: null,
      min: 1,
    },
    used_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    start_date: {
      type: Date,
      default: Date.now,
    },
    end_date: {
      type: Date,
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    category_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Category",
      default: [],
    },
    claimed_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    claim_limit: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
discountCodeSchema.index({ code: 1 }, { unique: true });
discountCodeSchema.index({ is_active: 1 });
discountCodeSchema.index({ end_date: 1 });

// Pre-save middleware để uppercase code
discountCodeSchema.pre("save", function (next) {
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  next();
});

export const DiscountModel = mongoose.model("DiscountCode", discountCodeSchema);

// Discount Usage Schema
const discountUsageSchema = new mongoose.Schema(
  {
    discount_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscountCode",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "used_at", updatedAt: false },
  }
);

// Unique constraint: mỗi user chỉ dùng mỗi mã 1 lần
discountUsageSchema.index({ discount_id: 1, user_id: 1 }, { unique: true });

// Indexes
discountUsageSchema.index({ discount_id: 1 });
discountUsageSchema.index({ user_id: 1 });

export const DiscountUsageModel = mongoose.model(
  "DiscountUsage",
  discountUsageSchema
);

// Discount Claim Schema - Lưu mã đã nhận của user (chưa dùng)
const discountClaimSchema = new mongoose.Schema(
  {
    discount_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscountCode",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    claimed_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "claimed_at", updatedAt: false },
  }
);

// Unique constraint: mỗi user chỉ nhận mỗi mã 1 lần
discountClaimSchema.index({ discount_id: 1, user_id: 1 }, { unique: true });

// Indexes
discountClaimSchema.index({ discount_id: 1 });
discountClaimSchema.index({ user_id: 1 });

export const DiscountClaimModel = mongoose.model(
  "DiscountClaim",
  discountClaimSchema
);

// Static methods cho DiscountModel
DiscountModel.findByCode = async function (code) {
  return await this.findOne({ code: code.toUpperCase() }).lean();
};

DiscountModel.validateCode = async function (
  code,
  orderTotal,
  userId,
  productCategoryIds = []
) {
  const discount = await this.findByCode(code);

  if (!discount) {
    return { valid: false, message: "Mã giảm giá không tồn tại" };
  }

  if (!discount.is_active) {
    return { valid: false, message: "Mã giảm giá đã bị vô hiệu hóa" };
  }

  const now = new Date();
  if (discount.start_date && now < discount.start_date) {
    return { valid: false, message: "Mã giảm giá chưa có hiệu lực" };
  }

  if (discount.end_date && now > discount.end_date) {
    return { valid: false, message: "Mã giảm giá đã hết hạn" };
  }

  if (orderTotal < discount.min_order_value) {
    return {
      valid: false,
      message: `Đơn hàng tối thiểu ${discount.min_order_value} để sử dụng mã này`,
    };
  }

  if (discount.usage_limit && discount.used_count >= discount.usage_limit) {
    return { valid: false, message: "Mã giảm giá đã hết lượt sử dụng" };
  }

  // Kiểm tra category_ids nếu có
  if (
    discount.category_ids &&
    discount.category_ids.length > 0 &&
    productCategoryIds.length > 0
  ) {
    const discountCategoryIds = discount.category_ids.map((id) =>
      id.toString()
    );
    const hasMatchingCategory = productCategoryIds.some((catId) =>
      discountCategoryIds.includes(catId.toString())
    );
    if (!hasMatchingCategory) {
      return {
        valid: false,
        message: "Mã giảm giá này không áp dụng cho sản phẩm trong giỏ hàng",
      };
    }
  }

  // Kiểm tra user đã claim mã này chưa (phải claim trước khi dùng)
  const { DiscountClaimModel } = await import("./discount.model.js");
  const claim = await DiscountClaimModel.findOne({
    discount_id: discount._id,
    user_id: userId,
  }).lean();

  if (!claim) {
    return { valid: false, message: "Bạn chưa nhận mã giảm giá này" };
  }

  // Kiểm tra user đã dùng mã này chưa
  const usage = await DiscountUsageModel.findOne({
    discount_id: discount._id,
    user_id: userId,
  }).lean();

  if (usage) {
    return { valid: false, message: "Bạn đã sử dụng mã giảm giá này rồi" };
  }

  // Tính toán số tiền giảm
  let discountAmount = 0;
  if (discount.discount_type === "percentage") {
    discountAmount = (orderTotal * parseFloat(discount.discount_value)) / 100;
    if (
      discount.max_discount_amount &&
      discountAmount > parseFloat(discount.max_discount_amount)
    ) {
      discountAmount = parseFloat(discount.max_discount_amount);
    }
  } else {
    discountAmount = parseFloat(discount.discount_value);
  }

  // Đảm bảo không giảm quá tổng đơn hàng
  if (discountAmount > orderTotal) {
    discountAmount = orderTotal;
  }

  return {
    valid: true,
    discount,
    discountAmount: Math.round(discountAmount * 100) / 100,
  };
};

DiscountModel.useCode = async function (discountId, userId, orderId) {
  // Không dùng transaction trong development (standalone MongoDB không hỗ trợ)
  // Trong production với replica set, có thể bật lại transaction
  const useTransaction =
    process.env.NODE_ENV === "production" &&
    process.env.USE_MONGODB_TRANSACTIONS === "true";

  if (useTransaction) {
    // Sử dụng transaction trong production
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Tăng used_count
        await this.findByIdAndUpdate(
          discountId,
          { $inc: { used_count: 1 } },
          { session }
        );

        // Tạo usage record
        await DiscountUsageModel.create(
          [
            {
              discount_id: discountId,
              user_id: userId,
              order_id: orderId,
            },
          ],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
  } else {
    // Không dùng transaction (development mode hoặc standalone MongoDB)
    // Tăng used_count
    await this.findByIdAndUpdate(discountId, { $inc: { used_count: 1 } });

    // Tạo usage record
    await DiscountUsageModel.create({
      discount_id: discountId,
      user_id: userId,
      order_id: orderId,
    });
  }
};

DiscountModel.findAll = async function () {
  return await this.find({}).sort({ createdAt: -1 }).lean();
};

DiscountModel.findActiveDiscounts = async function () {
  const now = new Date();
  return await this.find({
    is_active: true,
    start_date: { $lte: now },
    $or: [{ end_date: null }, { end_date: { $gte: now } }],
  })
    .sort({ createdAt: -1 })
    .lean();
};
