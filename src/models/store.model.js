import { mongoose } from '../config/database.js';

const storeSchema = new mongoose.Schema({
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, {
  timestamps: true,
});

// Indexes
storeSchema.index({ owner_id: 1 });
storeSchema.index({ status: 1 });

export const StoreModel = mongoose.model('Store', storeSchema);
