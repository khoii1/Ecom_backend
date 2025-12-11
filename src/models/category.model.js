import { mongoose } from '../config/database.js';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  image_url: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
categorySchema.index({ name: 1 });
categorySchema.index({ parent_id: 1 });

export const CategoryModel = mongoose.model('Category', categorySchema);
