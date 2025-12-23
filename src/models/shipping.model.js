import { mongoose } from "../config/database.js";

const shippingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    base_price: {
      type: Number,
      required: true,
      min: 0,
    },
    price_per_km: {
      type: Number,
      default: 0,
      min: 0,
    },
    price_per_kg: {
      type: Number,
      default: 0,
      min: 0,
    },
    max_weight_kg: {
      type: Number,
      default: null,
    },
    estimated_days: {
      type: Number,
      default: null,
      min: 1,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: code index is automatically created by unique: true
shippingSchema.index({ is_active: 1 });

export const ShippingModel = mongoose.model("Shipping", shippingSchema);

