import { mongoose } from "../config/database.js";

const reviewSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
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
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    image_urls: {
      type: [String],
      default: [],
    },
    seller_response: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    seller_response_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: mỗi order chỉ được đánh giá 1 lần cho mỗi sản phẩm
reviewSchema.index({ product_id: 1, order_id: 1 }, { unique: true });

// Indexes
reviewSchema.index({ product_id: 1 });
reviewSchema.index({ user_id: 1 });
reviewSchema.index({ rating: 1 });

// Middleware để tự động cập nhật rating của product
reviewSchema.post("save", async function () {
  await this.constructor.updateProductRating(this.product_id);
});

reviewSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    await doc.constructor.updateProductRating(doc.product_id);
  }
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await doc.constructor.updateProductRating(doc.product_id);
  }
});

// Static method để cập nhật rating của product
reviewSchema.statics.updateProductRating = async function (productId) {
  const Review = this;
  const Product = mongoose.model("Product");
  const ObjectId = mongoose.Types.ObjectId;

  const stats = await Review.aggregate([
    { $match: { product_id: new ObjectId(productId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    const rating = Math.round(stats[0].averageRating * 10) / 10;
    await Product.findByIdAndUpdate(productId, { rating });
  } else {
    // Nếu không có review, set rating = null (hiển thị 0 hoặc N/A)
    await Product.findByIdAndUpdate(productId, { rating: null });
  }
};

// Static method để lấy stats của product
reviewSchema.statics.getProductStats = async function (productId) {
  const { mongoose } = await import("../config/database.js");
  const ObjectId = mongoose.Types.ObjectId;

  // Lấy tổng số reviews và rating trung bình
  const stats = await this.aggregate([
    { $match: { product_id: new ObjectId(productId) } },
    {
      $group: {
        _id: null,
        total_reviews: { $sum: 1 },
        average_rating: { $avg: "$rating" },
      },
    },
  ]);

  // Lấy số lượng reviews cho mỗi mức sao
  const starDistribution = await this.aggregate([
    { $match: { product_id: new ObjectId(productId) } },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ]);

  // Khởi tạo số lượng cho mỗi mức sao
  const starCounts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  // Điền số lượng từ kết quả aggregate
  starDistribution.forEach((item) => {
    const rating = item._id;
    if (rating >= 1 && rating <= 5) {
      starCounts[rating] = item.count;
    }
  });

  if (stats.length > 0) {
    return {
      total_reviews: stats[0].total_reviews,
      average_rating: Math.round(stats[0].average_rating * 10) / 10,
      five_star: starCounts[5],
      four_star: starCounts[4],
      three_star: starCounts[3],
      two_star: starCounts[2],
      one_star: starCounts[1],
    };
  }

  return {
    total_reviews: 0,
    average_rating: 0,
    five_star: 0,
    four_star: 0,
    three_star: 0,
    two_star: 0,
    one_star: 0,
  };
};

export const ReviewModel = mongoose.model("Review", reviewSchema);
