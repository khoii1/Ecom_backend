import { mongoose } from '../config/database.js';

const cartSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes
cartSchema.index({ user_id: 1 }, { unique: true });

export const CartModel = mongoose.model('Cart', cartSchema);
