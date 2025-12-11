import { mongoose } from '../config/database.js';

const passwordResetTokenSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token_hash: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ['verify_email', 'reset_password'],
    required: true,
  },
  expires_at: {
    type: Date,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
passwordResetTokenSchema.index({ user_id: 1 });
passwordResetTokenSchema.index({ token_hash: 1 });
passwordResetTokenSchema.index({ expires_at: 1 });
passwordResetTokenSchema.index({ purpose: 1 });
passwordResetTokenSchema.index({ user_id: 1, purpose: 1 }); // Compound index

export const PasswordResetTokenModel = mongoose.model('PasswordResetToken', passwordResetTokenSchema);

// Helper methods
PasswordResetTokenModel.findLatestByPurpose = async function(userId, purpose) {
  return await this.findOne({
    user_id: userId,
    purpose: purpose,
    used: false,
    expires_at: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
};

PasswordResetTokenModel.markUsed = async function(tokenId) {
  return await this.findByIdAndUpdate(
    tokenId,
    { $set: { used: true } },
    { new: true }
  ).lean();
};
