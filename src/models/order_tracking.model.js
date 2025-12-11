import { mongoose } from '../config/database.js';

const orderTrackingSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'payment_failed', 'processing', 'shipped', 'delivered', 'cancelled'],
    required: true,
  },
  description: {
    type: String,
    default: null,
    trim: true,
  },
  location: {
    type: String,
    default: null,
    trim: true,
  },
  note: {
    type: String,
    default: null,
    trim: true,
  },
}, {
  timestamps: { createdAt: 'tracked_at', updatedAt: false },
});

// Indexes
orderTrackingSchema.index({ order_id: 1 });
orderTrackingSchema.index({ order_id: 1, tracked_at: -1 });

export const OrderTrackingModel = mongoose.model('OrderTracking', orderTrackingSchema);

