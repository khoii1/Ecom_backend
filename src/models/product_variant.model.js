import { mongoose } from '../config/database.js';

const productVariantSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  value: {
    type: String,
    required: true,
    trim: true,
  },
  price_modifier: {
    type: Number,
    default: 0,
  },
  stock_quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  sku: {
    type: String,
    default: null,
    trim: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
productVariantSchema.index({ product_id: 1 });
productVariantSchema.index({ product_id: 1, name: 1, value: 1 }, { unique: true });

export const ProductVariantModel = mongoose.model('ProductVariant', productVariantSchema);

