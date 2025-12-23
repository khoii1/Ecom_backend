import { mongoose } from "../config/database.js";

const returnItemSchema = new mongoose.Schema(
  {
    order_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderItem",
      required: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    unit_price: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    _id: false, // Không tạo _id cho subdocument
  }
);

const returnSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    return_type: {
      type: String,
      enum: ["refund", "exchange", "both"],
      default: "refund",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    items: {
      type: [returnItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: "Phải có ít nhất một sản phẩm để trả hàng",
      },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "processing",
        "completed",
        "cancelled",
      ],
      default: "pending",
      required: true,
    },
    refund_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    refund_method: {
      type: String,
      enum: ["original", "wallet", "bank_transfer"],
      default: "original",
    },
    refund_status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    images: {
      type: [String],
      default: [],
    },
    admin_note: {
      type: String,
      default: null,
      trim: true,
    },
    customer_note: {
      type: String,
      default: null,
      trim: true,
    },
    processed_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
    exchange_order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
returnSchema.index({ order_id: 1 });
returnSchema.index({ user_id: 1 });
returnSchema.index({ store_id: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });

// Virtual để populate order
returnSchema.virtual("order", {
  ref: "Order",
  localField: "order_id",
  foreignField: "_id",
  justOne: true,
});

// Virtual để populate user
returnSchema.virtual("user", {
  ref: "User",
  localField: "user_id",
  foreignField: "_id",
  justOne: true,
});

// Virtual để populate store
returnSchema.virtual("store", {
  ref: "Store",
  localField: "store_id",
  foreignField: "_id",
  justOne: true,
});

returnSchema.set("toJSON", { virtuals: true });
returnSchema.set("toObject", { virtuals: true });

export const ReturnModel = mongoose.model("Return", returnSchema);
