import { mongoose } from '../config/database.js';

const wishlistSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
}, {
  timestamps: true,
});

// Unique constraint: mỗi user chỉ có thể thêm mỗi sản phẩm 1 lần vào wishlist
wishlistSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

// Indexes
wishlistSchema.index({ user_id: 1 });
wishlistSchema.index({ product_id: 1 });

export const WishlistModel = mongoose.model('Wishlist', wishlistSchema);

