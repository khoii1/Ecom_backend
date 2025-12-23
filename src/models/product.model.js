import { mongoose } from "../config/database.js";

const productSchema = new mongoose.Schema(
  {
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discount_percentage: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    rating: {
      type: Number,
      default: null,
      min: 0,
      max: 5,
    },
    image_url: {
      type: String,
      default: null,
    },
    image_urls: {
      type: [String],
      default: [],
    },
    stock_quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    reserved_quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
productSchema.index({ store_id: 1 });
productSchema.index({ category_id: 1 });
productSchema.index({ status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ discount_percentage: -1 });
productSchema.index({ createdAt: -1 });

// Text index for search
productSchema.index({ title: 'text', description: 'text' });

// Virtual để tính final_price
productSchema.virtual("final_price").get(function () {
  if (!this.discount_percentage || this.discount_percentage <= 0) {
    return this.price;
  }
  const discountAmount = (this.price * this.discount_percentage) / 100;
  return this.price - discountAmount;
});

// Đảm bảo virtual được include khi convert to JSON
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

// Static method để tính final price
productSchema.statics.calculateFinalPrice = function (
  price,
  discountPercentage
) {
  if (!discountPercentage || discountPercentage <= 0) {
    return price;
  }
  const discountAmount = (price * discountPercentage) / 100;
  return price - discountAmount;
};

export const ProductModel = mongoose.model("Product", productSchema);
