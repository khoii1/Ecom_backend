import { mongoose } from '../config/database.js';

const cartItemSchema = new mongoose.Schema({
  cart_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart',
    required: true,
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  variant_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  qty: {
    type: Number,
    required: true,
    min: 1,
  },
}, {
  timestamps: false, // Cart items không cần timestamps
});

// Indexes
cartItemSchema.index({ cart_id: 1 });
cartItemSchema.index({ product_id: 1 });
cartItemSchema.index({ cart_id: 1, product_id: 1 }); // Compound index để tìm nhanh

export const CartItemModel = mongoose.model('CartItem', cartItemSchema);
