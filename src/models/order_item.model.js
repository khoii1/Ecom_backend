import { mongoose } from '../config/database.js';

const orderItemSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
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
  unit_price: {
    type: Number,
    required: true,
    min: 0,
  },
  qty: {
    type: Number,
    required: true,
    min: 1,
  },
}, {
  timestamps: false,
});

// Indexes
orderItemSchema.index({ order_id: 1 });
orderItemSchema.index({ product_id: 1 });

export const OrderItemModel = mongoose.model('OrderItem', orderItemSchema);
