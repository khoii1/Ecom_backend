import { mongoose } from '../config/database.js';

const addressSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  full_name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  province: {
    type: String,
    required: true,
    trim: true,
  },
  district: {
    type: String,
    required: true,
    trim: true,
  },
  ward: {
    type: String,
    required: true,
    trim: true,
  },
  street: {
    type: String,
    required: true,
    trim: true,
  },
  is_default: {
    type: Boolean,
    default: false,
  },
  note: {
    type: String,
    default: null,
    trim: true,
  },
}, {
  timestamps: true,
});

// Indexes
addressSchema.index({ user_id: 1 });
addressSchema.index({ user_id: 1, is_default: 1 });

// Middleware: Khi set một address làm default, bỏ default của các address khác
addressSchema.pre('save', async function(next) {
  if (this.is_default && this.isModified('is_default')) {
    await this.constructor.updateMany(
      { user_id: this.user_id, _id: { $ne: this._id } },
      { $set: { is_default: false } }
    );
  }
  next();
});

export const AddressModel = mongoose.model('Address', addressSchema);

