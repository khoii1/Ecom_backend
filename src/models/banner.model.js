import { mongoose } from '../config/database.js';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    image_url: {
      type: String,
      required: true,
      trim: true,
    },
    link_type: {
      type: String,
      enum: ['product', 'category', 'store', 'none'],
      default: 'none',
    },
    link_target_id: {
      type: String,
      default: null, // ID của product/category/store nếu link_type tương ứng
    },
    position: {
      type: String,
      enum: ['home_top', 'home_middle', 'home_bottom', 'category_top', 'sidebar'],
      default: 'home_top',
    },
    display_order: {
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
    click_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
bannerSchema.index({ position: 1, is_active: 1, display_order: 1 });
bannerSchema.index({ start_date: 1, end_date: 1 });
bannerSchema.index({ is_active: 1, display_order: 1 });

export const BannerModel = mongoose.model('Banner', bannerSchema);

