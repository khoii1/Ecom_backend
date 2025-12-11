import { mongoose } from "../config/database.js";

const orderSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
    },
    buyer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "payment_failed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    payment_method: {
      type: String,
      enum: ["cash", "vnpay", "wallet"],
      default: "cash",
    },
    reserved_until: {
      type: Date,
      default: null,
    },
    discount_code: {
      type: String,
      default: null,
    },
    discount_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shipping_address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      default: null,
    },
    tracking_number: {
      type: String,
      default: null,
      trim: true,
    },
    shipping_method: {
      type: String,
      default: null,
      trim: true,
    },
    shipper_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    delivery_proof_image: {
      type: String,
      default: null,
    },
    delivery_confirmed_by_customer: {
      type: Boolean,
      default: false,
    },
    delivery_confirmed_at: {
      type: Date,
      default: null,
    },
    delivery_note: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
orderSchema.index({ buyer_id: 1 });
orderSchema.index({ store_id: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ shipper_id: 1 });
orderSchema.index({ code: 1 }, { unique: true });
orderSchema.index({ createdAt: -1 });

// Virtual để populate order_items
orderSchema.virtual("order_items", {
  ref: "OrderItem",
  localField: "_id",
  foreignField: "order_id",
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

export const OrderModel = mongoose.model("Order", orderSchema);
